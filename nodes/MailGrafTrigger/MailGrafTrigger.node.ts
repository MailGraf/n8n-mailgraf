import { createHmac, timingSafeEqual } from 'crypto';
import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { mailGrafRequest } from '../MailGraf/GenericFunctions';

/**
 * MailGraf posts each event to the webhook the trigger registers with
 * POST /v1/webhooks when the workflow is activated; deactivating deletes it.
 * Every delivery carries `X-MailGraf-Signature: t=<unix>,v1=<hex>`, an
 * HMAC-SHA256 of "<t>.<raw body>" with the webhook's signing secret.
 */

const EVENT_OPTIONS = [
	{ name: 'Campaign Sent', value: 'campaign.sent', description: 'A campaign finished sending' },
	{ name: 'Contact Added to List', value: 'contact.list_added', description: 'A contact joined a list' },
	{
		name: 'Contact Complained',
		value: 'contact.complained',
		description: 'A contact reported an email as spam',
	},
	{
		name: 'Contact Confirmed',
		value: 'contact.subscribed',
		description: 'A contact confirmed their subscription (double opt-in)',
	},
	{
		name: 'Contact Removed From List',
		value: 'contact.list_removed',
		description: 'A contact left a list',
	},
	{ name: 'Contact Tagged', value: 'contact.tag_added', description: 'A tag was added to a contact' },
	{
		name: 'Contact Unsubscribed',
		value: 'contact.unsubscribed',
		description: 'A contact unsubscribed through the link or manually in MailGraf',
	},
	{
		name: 'Contact Untagged',
		value: 'contact.tag_removed',
		description: 'A tag was removed from a contact',
	},
	{ name: 'Email Bounced', value: 'email.bounced', description: 'An email to a contact bounced' },
	{ name: 'Email Delivered', value: 'email.delivered', description: 'An email was delivered' },
	{ name: 'Form Submitted', value: 'form.submitted', description: 'A MailGraf form was submitted' },
];

export class MailGrafTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MailGraf Trigger',
		name: 'mailGrafTrigger',
		icon: { light: 'file:mailgraf.svg', dark: 'file:mailgraf.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow the moment something happens in MailGraf',
		defaults: {
			name: 'MailGraf Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mailGrafApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: [],
				options: EVENT_OPTIONS,
				description: 'The MailGraf events that start this workflow',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!staticData.webhookId) return false;
				const response = await mailGrafRequest.call(this, 'GET', '/webhooks');
				const items = (response.items as IDataObject[]) ?? [];
				const found = items.find(
					(item) => Number(item.id) === Number(staticData.webhookId) && item.url === webhookUrl,
				);
				if (!found) {
					delete staticData.webhookId;
					delete staticData.secret;
					return false;
				}
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];
				const response = await mailGrafRequest.call(this, 'POST', '/webhooks', {
					url: webhookUrl,
					events,
					name: 'n8n',
				});
				staticData.webhookId = response.id;
				staticData.secret = response.secret;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (staticData.webhookId) {
					try {
						await mailGrafRequest.call(this, 'DELETE', `/webhooks/${Number(staticData.webhookId)}`);
					} catch (error) {
						// Usually already removed in MailGraf; the local reference is dropped either way.
						this.logger.warn('MailGraf webhook could not be deleted', {
							webhookId: staticData.webhookId,
							error: (error as Error).message,
						});
					}
				}
				delete staticData.webhookId;
				delete staticData.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const response = this.getResponseObject();
		const staticData = this.getWorkflowStaticData('node');
		const secret = staticData.secret as string | undefined;
		const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;

		if (secret && rawBody) {
			const header = String(request.headers['x-mailgraf-signature'] ?? '');
			if (!signatureMatches(header, rawBody, secret)) {
				response.status(401).send('Invalid MailGraf signature');
				return { noWebhookResponse: true };
			}
		}

		const payload = this.getBodyData() as IDataObject;
		return {
			workflowData: [this.helpers.returnJsonArray(flatten(payload))],
		};
	}
}

function signatureMatches(header: string, rawBody: Buffer, secret: string): boolean {
	const parts = Object.fromEntries(
		header
			.split(',')
			.map((part) => part.trim().split('='))
			.filter((pair) => pair.length === 2),
	) as Record<string, string>;
	if (!parts.t || !parts.v1) return false;
	const expected = createHmac('sha256', secret)
		.update(`${parts.t}.${rawBody.toString('utf8')}`)
		.digest('hex');
	const given = Buffer.from(parts.v1, 'utf8');
	const wanted = Buffer.from(expected, 'utf8');
	return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** Flattens MailGraf's payload so the common fields sit at the top level. */
function flatten(payload: IDataObject): IDataObject {
	const contact = (payload.contact as IDataObject | null) ?? {};
	const campaign = (payload.campaign as IDataObject | null) ?? null;
	const data = (payload.data as IDataObject | null) ?? {};
	return {
		event: payload.type,
		event_id: payload.event_id ?? null,
		occurred_at: payload.occurred_at ?? null,
		contact_id: contact.id ?? null,
		email: contact.email ?? null,
		campaign_id: campaign ? campaign.id : null,
		campaign_name: campaign ? campaign.name : null,
		...data,
		payload,
	};
}
