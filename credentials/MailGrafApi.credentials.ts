import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class MailGrafApi implements ICredentialType {
	name = 'mailGrafApi';

	displayName = 'MailGraf API';

	icon: Icon = {
		light: 'file:../nodes/MailGraf/mailgraf.svg',
		dark: 'file:../nodes/MailGraf/mailgraf.dark.svg',
	};

	documentationUrl = 'https://github.com/MailGraf/n8n-mailgraf?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Create a key in MailGraf under Settings > Developers > API. MailGraf shows the key once, so copy it before closing the window.',
		},
		{
			displayName: 'API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.mailgraf.com/v1',
			description: 'Keep the default unless MailGraf gives you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/account',
		},
	};
}
