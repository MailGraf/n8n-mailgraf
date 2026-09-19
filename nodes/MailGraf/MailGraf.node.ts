import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	compact,
	findContactByEmail,
	mailGrafRequest,
	mailGrafRequestAll,
} from './GenericFunctions';
import { mailGrafProperties } from './MailGrafDescription';

type CustomFieldRow = { key: string; value: string };

export class MailGraf implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MailGraf',
		name: 'mailGraf',
		icon: { light: 'file:mailgraf.svg', dark: 'file:mailgraf.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create and update contacts, manage lists and send events in MailGraf',
		defaults: {
			name: 'MailGraf',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mailGrafApi',
				required: true,
			},
		],
		properties: mailGrafProperties,
	};

	methods = {
		loadOptions: {
			async getLists(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const lists = await mailGrafRequestAll.call(this, '/lists', {});
				return lists.map((list) => ({ name: String(list.name), value: Number(list.id) }));
			},
			async getCustomFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await mailGrafRequest.call(this, 'GET', '/fields');
				const fields = (response.items as IDataObject[]) ?? [];
				return fields.map((field) => ({
					name: `${String(field.name)} (${String(field.field_type)})`,
					value: String(field.key),
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let output: IDataObject | IDataObject[];

				if (resource === 'contact') {
					output = await runContact.call(this, operation, i);
				} else if (resource === 'event') {
					output = await runEvent.call(this, i);
				} else if (resource === 'list') {
					output = await runList.call(this, i);
				} else if (resource === 'campaign') {
					output = await runCampaign.call(this, operation, i);
				} else if (resource === 'customField') {
					const response = await mailGrafRequest.call(this, 'GET', '/fields');
					output = (response.items as IDataObject[]) ?? [];
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
						itemIndex: i,
					});
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(output),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function runContact(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'upsert') {
		const email = this.getNodeParameter('email', i) as string;
		const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const body = compact({
			email,
			first_name: extra.firstName,
			last_name: extra.lastName,
			country: extra.country,
		});
		const customFields = collectCustomFields(extra.customFieldsUi as IDataObject | undefined);
		if (Object.keys(customFields).length) body.custom_fields = customFields;
		const listId = extra.listId ? Number(extra.listId) : undefined;

		if (extra.doubleOptIn === true) {
			// Confirmation path: MailGraf emails the contact and creates them on click.
			if (listId) body.list_id = listId;
			return await mailGrafRequest.call(this, 'POST', '/contacts/opt-in', body);
		}

		const response = await mailGrafRequest.call(this, 'POST', '/contacts', body);
		const contact = response.contact as IDataObject;
		if (listId) {
			await mailGrafRequest.call(this, 'POST', `/lists/${listId}/contacts`, { email: contact.email });
		}
		return { ...contact, created: response.created };
	}

	if (operation === 'get') {
		const findBy = this.getNodeParameter('findBy', i) as string;
		if (findBy === 'id') {
			const contactId = this.getNodeParameter('contactId', i) as string;
			return await mailGrafRequest.call(this, 'GET', `/contacts/${encodeURIComponent(contactId)}`);
		}
		const email = this.getNodeParameter('email', i) as string;
		const contact = await findContactByEmail.call(this, email);
		if (!contact) {
			throw new NodeOperationError(
				this.getNode(),
				`No MailGraf contact uses the email address ${email}.`,
				{ itemIndex: i },
			);
		}
		return contact;
	}

	if (operation === 'getAll') {
		return await getMany.call(this, '/contacts', i);
	}

	if (operation === 'addToList') {
		const email = this.getNodeParameter('email', i) as string;
		const listId = Number(this.getNodeParameter('listId', i));
		const response = await mailGrafRequest.call(this, 'POST', `/lists/${listId}/contacts`, {
			email,
		});
		return { ...(response.contact as IDataObject), created: response.created, list_id: listId };
	}

	if (operation === 'removeFromList') {
		const email = this.getNodeParameter('email', i) as string;
		const listId = Number(this.getNodeParameter('listId', i));
		const contact = await requireContact.call(this, email, i);
		const response = await mailGrafRequest.call(
			this,
			'DELETE',
			`/lists/${listId}/contacts/${Number(contact.id)}`,
		);
		return { removed: response.removed, contact_id: contact.id, email: contact.email, list_id: listId };
	}

	if (operation === 'unsubscribe') {
		const email = this.getNodeParameter('email', i) as string;
		const contact = await requireContact.call(this, email, i);
		const response = await mailGrafRequest.call(
			this,
			'POST',
			`/contacts/${Number(contact.id)}/unsubscribe`,
			{},
		);
		return { ...(response.contact as IDataObject), changed: response.changed };
	}

	if (operation === 'block') {
		const email = this.getNodeParameter('email', i) as string;
		return await mailGrafRequest.call(this, 'POST', '/suppressions', { email });
	}

	throw new NodeOperationError(this.getNode(), `Unknown contact operation: ${operation}`, {
		itemIndex: i,
	});
}

async function runEvent(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const email = this.getNodeParameter('email', i) as string;
	const name = this.getNodeParameter('eventName', i) as string;
	const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
	const body = compact({
		email,
		name,
		occurred_at: extra.occurredAt,
		event_id: extra.eventId,
	});
	if (extra.properties) {
		const properties =
			typeof extra.properties === 'string' ? parseJson(this, extra.properties, i) : extra.properties;
		if (Object.keys(properties as IDataObject).length) body.properties = properties;
	}
	return await mailGrafRequest.call(this, 'POST', '/events', body);
}

async function runList(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	return await getMany.call(this, '/lists', i);
}

async function runCampaign(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'getReport') {
		const campaignId = this.getNodeParameter('campaignId', i) as string;
		return await mailGrafRequest.call(
			this,
			'GET',
			`/campaigns/${encodeURIComponent(campaignId)}/report`,
		);
	}
	return await getMany.call(this, '/campaigns', i);
}

async function getMany(this: IExecuteFunctions, endpoint: string, i: number): Promise<IDataObject[]> {
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
	return await mailGrafRequestAll.call(this, endpoint, {}, limit);
}

async function requireContact(
	this: IExecuteFunctions,
	email: string,
	i: number,
): Promise<IDataObject> {
	const contact = await findContactByEmail.call(this, email);
	if (!contact) {
		throw new NodeOperationError(
			this.getNode(),
			`No MailGraf contact uses the email address ${email}.`,
			{ itemIndex: i },
		);
	}
	return contact;
}

function collectCustomFields(ui: IDataObject | undefined): IDataObject {
	const rows = (ui?.customFieldsValues as CustomFieldRow[] | undefined) ?? [];
	const result: IDataObject = {};
	for (const row of rows) {
		if (row.key && row.value !== '' && row.value !== undefined) result[row.key] = row.value;
	}
	return result;
}

function parseJson(context: IExecuteFunctions, raw: string, i: number): IDataObject {
	try {
		return JSON.parse(raw) as IDataObject;
	} catch {
		throw new NodeOperationError(context.getNode(), 'Properties must be valid JSON.', {
			itemIndex: i,
		});
	}
}
