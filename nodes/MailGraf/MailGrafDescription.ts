import type { INodeProperties } from 'n8n-workflow';

const returnAllAndLimit = (resource: string, operation = 'getAll'): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: [resource], operation: [operation] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		description: 'Max number of results to return',
		displayOptions: { show: { resource: [resource], operation: [operation], returnAll: [false] } },
	},
];

export const mailGrafProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Campaign', value: 'campaign' },
			{ name: 'Contact', value: 'contact' },
			{ name: 'Custom Field', value: 'customField' },
			{ name: 'Event', value: 'event' },
			{ name: 'List', value: 'list' },
		],
		default: 'contact',
	},

	// ---------------------------------------------------------------- contact
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{
				name: 'Add to List',
				value: 'addToList',
				description: 'Add a contact to a list, creating the contact if it does not exist',
				action: 'Add a contact to a list',
			},
			{
				name: 'Block',
				value: 'block',
				description: 'Add an email address to the account block list',
				action: 'Block an email address',
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				action: 'Create or update a contact',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a contact by email address or ID',
				action: 'Get a contact',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many contacts, newest first',
				action: 'Get many contacts',
			},
			{
				name: 'Remove From List',
				value: 'removeFromList',
				description: 'Remove a contact from a list; the contact stays in the account',
				action: 'Remove a contact from a list',
			},
			{
				name: 'Unsubscribe',
				value: 'unsubscribe',
				description: 'Unsubscribe a contact; the contact stays in the account and stops receiving campaigns',
				action: 'Unsubscribe a contact',
			},
		],
		default: 'upsert',
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contact'],
				operation: ['addToList', 'block', 'removeFromList', 'unsubscribe', 'upsert'],
			},
		},
	},
	{
		displayName: 'List Name or ID',
		name: 'listId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLists' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: { show: { resource: ['contact'], operation: ['addToList', 'removeFromList'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: ['upsert'] } },
		options: [
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				default: '',
				description: 'Free text, for example GB or TR',
			},
			{
				displayName: 'Custom Fields',
				name: 'customFieldsUi',
				type: 'fixedCollection',
				placeholder: 'Add Custom Field',
				default: {},
				typeOptions: { multipleValues: true },
				options: [
					{
						displayName: 'Custom Field',
						name: 'customFieldsValues',
						values: [
							{
								displayName: 'Field Name or ID',
								name: 'key',
								type: 'options',
								typeOptions: { loadOptionsMethod: 'getCustomFields' },
								default: '',
								description:
									'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Double Opt-In',
				name: 'doubleOptIn',
				type: 'boolean',
				default: false,
				description:
					'Whether MailGraf emails the contact a confirmation link and adds them only after they click it. The name, country, custom fields and list are applied at that moment. Needs a verified sending domain in MailGraf.',
			},
			{
				displayName: 'First Name',
				name: 'firstName',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Last Name',
				name: 'lastName',
				type: 'string',
				default: '',
			},
			{
				displayName: 'List Name or ID',
				name: 'listId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getLists' },
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
		],
	},
	{
		displayName: 'Find By',
		name: 'findBy',
		type: 'options',
		options: [
			{ name: 'Email', value: 'email' },
			{ name: 'ID', value: 'id' },
		],
		default: 'email',
		displayOptions: { show: { resource: ['contact'], operation: ['get'] } },
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['contact'], operation: ['get'], findBy: ['email'] } },
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['contact'], operation: ['get'], findBy: ['id'] } },
	},
	...returnAllAndLimit('contact'),

	// ------------------------------------------------------------------ event
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['event'] } },
		options: [
			{
				name: 'Send',
				value: 'send',
				description: 'Record a custom event for a contact, which can start an automation',
				action: 'Send an event',
			},
		],
		default: 'send',
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		description: 'The contact must already exist in MailGraf',
		displayOptions: { show: { resource: ['event'], operation: ['send'] } },
	},
	{
		displayName: 'Event Name',
		name: 'eventName',
		type: 'string',
		placeholder: 'order_paid',
		required: true,
		default: '',
		description: 'A stable name your automation listens for',
		displayOptions: { show: { resource: ['event'], operation: ['send'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['event'], operation: ['send'] } },
		options: [
			{
				displayName: 'Deduplication Key',
				name: 'eventId',
				type: 'string',
				default: '',
				description:
					'A unique value such as the order number. Sending the same key again is ignored, which keeps retries safe.',
			},
			{
				displayName: 'Occurred At',
				name: 'occurredAt',
				type: 'dateTime',
				default: '',
				description: 'Must be within the last 24 hours; leave empty to use the current time',
			},
			{
				displayName: 'Properties',
				name: 'properties',
				type: 'json',
				default: '{}',
				description: 'Event details as JSON, such as order_id and total. Limited to 8 KB.',
			},
		],
	},

	// ------------------------------------------------------------------- list
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['list'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many lists with their IDs',
				action: 'Get many lists',
			},
		],
		default: 'getAll',
	},
	...returnAllAndLimit('list'),

	// --------------------------------------------------------------- campaign
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['campaign'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many campaigns, newest first',
				action: 'Get many campaigns',
			},
			{
				name: 'Get Report',
				value: 'getReport',
				description: 'Get delivery and engagement totals for a campaign',
				action: 'Get a campaign report',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Campaign ID',
		name: 'campaignId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['campaign'], operation: ['getReport'] } },
	},
	...returnAllAndLimit('campaign'),

	// ----------------------------------------------------------- custom field
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customField'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the custom fields defined in the account, with their keys and types',
				action: 'Get many custom fields',
			},
		],
		default: 'getAll',
	},
];
