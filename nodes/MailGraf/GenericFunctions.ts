import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type MailGrafContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

const DEFAULT_BASE_URL = 'https://api.mailgraf.com/v1';

/**
 * Public API errors carry `detail`: a sentence, or a list of field-level
 * issues on 422. Both become one readable line for the workflow editor.
 */
function readDetail(error: IDataObject): string | undefined {
	const response = (error.response ?? error.cause) as IDataObject | undefined;
	const data = (response?.data ?? response?.body) as IDataObject | undefined;
	const detail = data?.detail;
	if (typeof detail === 'string' && detail) return detail;
	if (Array.isArray(detail) && detail.length) {
		return (detail as IDataObject[])
			.map((issue) => {
				const loc = Array.isArray(issue.loc) ? issue.loc : [];
				const field = loc.length ? String(loc[loc.length - 1]) : '';
				return field ? `${field}: ${String(issue.msg)}` : String(issue.msg);
			})
			.join('; ');
	}
	return undefined;
}

export async function mailGrafRequest(
	this: MailGrafContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('mailGrafApi');
	const baseUrl = String(credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		headers: { Accept: 'application/json' },
		json: true,
	};
	if (body && Object.keys(body).length > 0) options.body = body;
	if (qs && Object.keys(qs).length > 0) options.qs = qs;

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'mailGrafApi',
			options,
		)) as IDataObject;
	} catch (error) {
		const status = Number((error as IDataObject).httpCode ?? (error as IDataObject).statusCode);
		let message = readDetail(error as IDataObject);
		if (status === 401) {
			message =
				'MailGraf did not accept this API key. Create a new key under Settings > Developers > API and update the credential.';
		} else if (status === 403 && !message) {
			message = 'Your MailGraf plan does not include API access.';
		}
		throw new NodeApiError(this.getNode(), error as JsonObject, message ? { message } : undefined);
	}
}

/** Looks a contact up by exact email address; undefined when none exists. */
export async function findContactByEmail(
	this: MailGrafContext,
	email: string,
): Promise<IDataObject | undefined> {
	const response = await mailGrafRequest.call(this, 'GET', '/contacts', undefined, {
		email,
		limit: 1,
	});
	const items = (response.items as IDataObject[]) ?? [];
	return items[0];
}

/** Drops empty optional values so the API sees a missing key, not an empty string. */
export function compact(data: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ''),
	);
}

/** Walks MailGraf's cursor pagination until `limit` items or the last page. */
export async function mailGrafRequestAll(
	this: MailGrafContext,
	endpoint: string,
	qs: IDataObject,
	limit?: number,
): Promise<IDataObject[]> {
	const results: IDataObject[] = [];
	let cursor: string | null = null;
	do {
		const pageSize = limit ? Math.min(100, limit - results.length) : 100;
		const query: IDataObject = { ...qs, limit: pageSize };
		if (cursor) query.cursor = cursor;
		const response = await mailGrafRequest.call(this, 'GET', endpoint, undefined, query);
		results.push(...((response.items as IDataObject[]) ?? []));
		cursor = response.has_more ? String(response.next_cursor ?? '') || null : null;
	} while (cursor && (!limit || results.length < limit));
	return limit ? results.slice(0, limit) : results;
}
