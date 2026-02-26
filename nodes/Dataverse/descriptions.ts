import type { INodeProperties } from 'n8n-workflow';

export const resourceDescription: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Record',
			value: 'record',
		},
		{
			name: 'SQL Query via TDS (Read-Only)',
			value: 'sql',
		},
		{
			name: 'Webhook',
			value: 'webhook',
		},
		{
			name: 'Plugin',
			value: 'plugin',
		},
		{
			name: 'Web Resource',
			value: 'webresource',
		},
	],
	default: 'record',
};

export const operationDescription: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: {
			resource: ['record'],
		},
	},
	options: [
		{
			name: 'Create',
			value: 'create',
			description: 'Create a new record',
			action: 'Create a record',
		},
		{
			name: 'Delete',
			value: 'delete',
			description: 'Delete a record',
			action: 'Delete a record',
		},
		{
			name: 'Get',
			value: 'get',
			description: 'Get a single record',
			action: 'Get a record',
		},
		{
			name: 'Get Many',
			value: 'getMany',
			description: 'Get multiple records',
			action: 'Get many records',
		},
		{
			name: 'Update',
			value: 'update',
			description: 'Update a record',
			action: 'Update a record',
		},
		{
			name: 'Upsert',
			value: 'upsert',
			description: 'Create a new record or update if it exists (based on alternate key)',
			action: 'Upsert a record',
		},
		{
			name: 'Share',
			value: 'share',
			description: 'Share a record with a user or team',
			action: 'Share a record',
		},
	],
	default: 'get',
};

export const optionsDescription: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add Option',
	default: {},
	options: [
		{
			displayName: 'Custom Auth.Enable',
			name: 'useCustomAuth',
			type: 'boolean',
			default: false,
			description: 'Whether to provide a custom access token and environment URL instead of using OAuth2 credentials',
		},
		{
			displayName: 'Custom Auth.Environment URL',
			name: 'customEnvironmentUrl',
			type: 'string',
			displayOptions: {
				show: {
					useCustomAuth: [true],
				},
			},
			default: '',
			required: true,
			description: 'The URL of your Dataverse environment',
			placeholder: 'https://yourorg.crm.dynamics.com',
		},
		{
			displayName: 'Custom Auth.Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			displayOptions: {
				show: {
					useCustomAuth: [true],
				},
			},
			default: '',
			description: 'Provide an access token (e.g., from webhook headers or previous nodes)',
			placeholder: '={{ $json.token }}',
		},
		{
			displayName: 'Download Files.Enable',
			name: 'downloadFiles',
			type: 'boolean',
			displayOptions: {
				show: {
					'/resource': ['record'],
					'/operation': ['get'],
				},
			},
			default: false,
			description: 'Whether to download file/document fields as binary data. Files are downloaded via the File endpoint.',
		},
		{
			displayName: 'Download Files.Field Names',
			name: 'fileFieldNames',
			type: 'string',
			displayOptions: {
				show: {
					'/resource': ['record'],
					'/operation': ['get'],
					downloadFiles: [true],
				},
			},
			default: '',
			placeholder: 'e.g., crb1b_document,attachment',
			description: 'Comma-separated list of file field names to download. Leave empty to auto-detect using field metadata.',
		},
		{
			displayName: 'Download Images.Enable',
			name: 'downloadImages',
			type: 'options',
			displayOptions: {
				show: {
					'/resource': ['record'],
					'/operation': ['get'],
				},
			},
			options: [
				{
					name: 'No',
					value: 'none',
				},
				{
					name: 'Thumbnails Only (Base64 in Response)',
					value: 'thumbnails',
				},
				{
					name: 'Full Images (Download via API)',
					value: 'full',
				},
			],
			default: 'none',
			description: 'Whether to download image fields. Thumbnails use base64 data from response, full images download via Image endpoint.',
		},
		{
			displayName: 'Download Images.Field Names',
			name: 'imageFieldNames',
			type: 'string',
			displayOptions: {
				show: {
					'/resource': ['record'],
					'/operation': ['get'],
					downloadImages: ['thumbnails', 'full'],
				},
			},
			default: '',
			placeholder: 'e.g., crb1b_img,entityimage',
			description: 'Comma-separated list of image field names to download. Leave empty to auto-detect using field metadata.',
		},
	],
};

export const tableDescription: INodeProperties = {
	displayName: 'Table',
	name: 'table',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	description: 'Select a table for the operation',
	displayOptions: {
		show: {
			resource: ['record', 'sql', 'webhook', 'plugin'],
		},
	},
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchTables',
				searchable: true,
			},
		},
		{
			displayName: 'By Name',
			name: 'name',
			type: 'string',
			placeholder: 'e.g. accounts',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-z_][a-z0-9_]*$',
						errorMessage:
							'Table name must be lowercase and contain only letters, numbers, and underscores',
					},
				},
			],
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. account',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-z_][a-z0-9_]*$',
						errorMessage:
							'Table ID must be lowercase and contain only letters, numbers, and underscores',
					},
				},
			],
		},
	],
};

export const fieldSchemaSelector: INodeProperties = {
	displayName: 'View Table Fields (Reference Only) Name or ID',
	name: 'viewTableFields',
	type: 'options',
	typeOptions: {
		loadOptionsMethod: 'getTableFieldsForDisplay',
	},
	displayOptions: {
		show: {
			resource: ['record', 'sql', 'webhook'],
		},
	},
	default: '',
	description: 'Reference only: Select a table first, then use this to view available fields with their logical names, types, and permissions. This field is not used in the operation. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	placeholder: 'Select a table first...',
};

export const createOperationFields: INodeProperties[] = [
	{
		displayName: 'Fields Input Mode',
		name: 'fieldsInputMode',
		type: 'options',
		options: [
			{
				name: 'Field Collection',
				value: 'collection',
				description: 'Add fields one by one',
			},
			{
				name: 'JSON',
				value: 'json',
				description: 'Provide fields as JSON object',
			},
		],
		default: 'collection',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['create'],
				fieldsInputMode: ['collection'],
			},
		},
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name',
						name: 'name',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getTableFieldNames',
						},
						default: '',
						description: 'Name of the field to set. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Field Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value to set for the field',
					},
				],
			},
		],
	},
	{
		displayName: 'Fields (JSON)',
		name: 'fieldsJson',
		type: 'json',
		default: '{}',
		description: 'Provide fields as a JSON object with field names as keys',
		placeholder: '{"name": "Test", "email": "test@example.com"}',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['create'],
				fieldsInputMode: ['json'],
			},
		},
	},
];

export const getOperationFields: INodeProperties[] = [
	{
		displayName: 'Record ID Type',
		name: 'recordIdType',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['get', 'update', 'delete', 'share'],
			},
		},
		options: [
			{
				name: 'Primary Key (ID)',
				value: 'id',
				description: 'Use the primary key GUID',
			},
			{
				name: 'Alternate Key',
				value: 'alternateKey',
				description: 'Use alternate key-value pairs',
			},
		],
		default: 'id',
		description: 'How to identify the record',
	},
	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['get', 'delete', 'update', 'share'],
				recordIdType: ['id'],
			},
		},
		default: '',
		required: true,
		description: 'The GUID of the record',
		placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
	},
	{
		displayName: 'Alternate Keys',
		name: 'alternateKeys',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Key',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['get', 'update', 'delete', 'share'],
				recordIdType: ['alternateKey'],
			},
		},
		options: [
			{
				displayName: 'Key',
				name: 'key',
				values: [
					{
						displayName: 'Key Name',
						name: 'name',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getAlternateKeyFields',
						},
						default: '',
						description: 'Name of the alternate key field. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Key Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value of the alternate key',
					},
				],
			},
		],
	},
	{
		displayName: 'Select Fields',
		name: 'selectFields',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['get', 'getMany'],
			},
		},
		default: '',
		description: 'Comma-separated list of fields to return (leave empty for all fields)',
		placeholder: 'e.g. name,emailaddress1,telephone1',
	},
];

export const upsertOperationFields: INodeProperties[] = [
	{
		displayName: 'Alternate Keys',
		name: 'alternateKeys',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Key',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['upsert'],
			},
		},
		description: 'Alternate key fields to match records. If table has alternate keys defined (e.g., domain, email), specify them here. Dataverse will update if match found, create if not. Leave empty to always create new records.',
		options: [
			{
				displayName: 'Key',
				name: 'key',
				values: [
					{
						displayName: 'Key Name',
						name: 'name',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getAlternateKeyFields',
						},
						default: '',
						description: 'Name of the alternate key field. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Key Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value to match on',
						placeholder: 'e.g. example.com',
					},
				],
			},
		],
	},
	{
		displayName: 'Fields Input Mode',
		name: 'fieldsInputMode',
		type: 'options',
		options: [
			{
				name: 'Field Collection',
				value: 'collection',
				description: 'Add fields one by one',
			},
			{
				name: 'JSON',
				value: 'json',
				description: 'Provide fields as JSON object',
			},
		],
		default: 'collection',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['upsert'],
			},
		},
	},
	{
		displayName: 'Upsert Fields',
		name: 'upsertFields',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['upsert'],
				fieldsInputMode: ['collection'],
			},
		},
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name',
						name: 'name',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getTableFieldNames',
						},
						default: '',
						description: 'Name of the field to set. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Field Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value for the field',
					},
				],
			},
		],
	},
	{
		displayName: 'Upsert Fields (JSON)',
		name: 'upsertFieldsJson',
		type: 'json',
		default: '{}',
		description: 'Provide fields as a JSON object with field names as keys',
		placeholder: '{"name": "Test", "email": "test@example.com"}',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['upsert'],
				fieldsInputMode: ['json'],
			},
		},
	},
];

export const shareOperationFields: INodeProperties[] = [
	{
		displayName: 'Principal Type',
		name: 'principalType',
		type: 'options',
		options: [
			{
				name: 'User',
				value: 'systemuser',
				description: 'Share with a user',
			},
			{
				name: 'Team',
				value: 'team',
				description: 'Share with a team',
			},
		],
		default: 'systemuser',
		required: true,
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['share'],
			},
		},
		description: 'Type of principal to share with',
	},
	{
		displayName: 'Principal ID Type',
		name: 'principalIdType',
		type: 'options',
		options: [
			{
				name: 'GUID',
				value: 'guid',
				description: 'Use the principal ID (GUID)',
			},
			{
				name: 'UPN (User Principal Name)',
				value: 'upn',
				description: 'Use email/UPN (will lookup the GUID)',
			},
		],
		default: 'upn',
		required: true,
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['share'],
				principalType: ['systemuser'],
			},
		},
		description: 'How to identify the user',
	},
	{
		displayName: 'Principal ID (GUID)',
		name: 'principalId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['share'],
				principalIdType: ['guid'],
			},
		},
		description: 'GUID of the user or team',
		placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
	},
	{
		displayName: 'User Principal Name (Email)',
		name: 'principalUpn',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['share'],
				principalIdType: ['upn'],
			},
		},
		description: 'Email address or User Principal Name of the user',
		placeholder: 'e.g. user@example.com',
	},
	{
		displayName: 'Team Name',
		name: 'teamName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['share'],
				principalType: ['team'],
			},
		},
		description: 'Name of the team (will lookup the GUID)',
		placeholder: 'e.g. Sales Team',
	},
	{
		displayName: 'Access Rights',
		name: 'accessRights',
		type: 'multiOptions',
		options: [
			{
				name: 'Read',
				value: 'ReadAccess',
				description: 'Read access to the record',
			},
			{
				name: 'Write',
				value: 'WriteAccess',
				description: 'Write access to the record',
			},
			{
				name: 'Delete',
				value: 'DeleteAccess',
				description: 'Delete access to the record',
			},
			{
				name: 'Append',
				value: 'AppendAccess',
				description: 'Append access to the record',
			},
			{
				name: 'Append To',
				value: 'AppendToAccess',
				description: 'Append to access to the record',
			},
			{
				name: 'Assign',
				value: 'AssignAccess',
				description: 'Assign access to the record',
			},
			{
				name: 'Share',
				value: 'ShareAccess',
				description: 'Share access to the record',
			},
		],
		default: ['ReadAccess', 'WriteAccess'],
		required: true,
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['share'],
			},
		},
		description: 'Access rights to grant',
	},
];

export const updateOperationFields: INodeProperties[] = [
	{
		displayName: 'Fields Input Mode',
		name: 'fieldsInputMode',
		type: 'options',
		options: [
			{
				name: 'Field Collection',
				value: 'collection',
				description: 'Add fields one by one',
			},
			{
				name: 'JSON',
				value: 'json',
				description: 'Provide fields as JSON object',
			},
		],
		default: 'collection',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['update'],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['update'],
				fieldsInputMode: ['collection'],
			},
		},
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name',
						name: 'name',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getTableFieldNames',
						},
						default: '',
						description: 'Name of the field to update. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Field Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'New value for the field',
					},
				],
			},
		],
	},
	{
		displayName: 'Update Fields (JSON)',
		name: 'updateFieldsJson',
		type: 'json',
		default: '{}',
		description: 'Provide fields to update as a JSON object with field names as keys',
		placeholder: '{"name": "Updated Name", "email": "updated@example.com"}',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['update'],
				fieldsInputMode: ['json'],
			},
		},
	},
];

export const getManyOperationFields: INodeProperties[] = [
	{
		displayName: 'Query Type',
		name: 'queryType',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getMany'],
			},
		},
		options: [
			{
				name: 'OData',
				value: 'odata',
				description: 'Use OData query syntax',
			},
			{
				name: 'FetchXML',
				value: 'fetchxml',
				description: 'Use FetchXML query',
			},
		],
		default: 'odata',
		description: 'Type of query to use',
	},
	{
		displayName: 'OData Filter',
		name: 'odataFilter',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getMany'],
				queryType: ['odata'],
			},
		},
		default: '',
		description: 'OData $filter query parameter',
		placeholder: "e.g. name eq 'Contoso'",
	},
	{
		displayName: 'OData Order By',
		name: 'odataOrderBy',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getMany'],
				queryType: ['odata'],
			},
		},
		default: '',
		description: 'OData $orderby query parameter',
		placeholder: 'e.g. createdon desc',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getMany'],
				queryType: ['odata'],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 5000,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'FetchXML Query',
		name: 'fetchXml',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getMany'],
				queryType: ['fetchxml'],
			},
		},
		typeOptions: {
			rows: 10,
		},
		default: '',
		description: 'Complete FetchXML query',
		placeholder: `<fetch top="50">
  <entity name="account">
    <attribute name="name" />
    <attribute name="emailaddress1" />
  </entity>
</fetch>`,
	},
];

export const webhookOperationDescription: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: {
			resource: ['webhook'],
		},
	},
	options: [
		{
			name: 'Register Endpoint',
			value: 'registerEndpoint',
			description: 'Create a new webhook endpoint (ServiceEndpoint) that can be reused',
			action: 'Register a webhook endpoint',
		},
		{
			name: 'Register Step',
			value: 'registerWebhookStep',
			description: 'Register a step to link endpoint with a table/message',
			action: 'Register a webhook step',
		},
		{
			name: 'List Endpoints',
			value: 'listEndpoints',
			description: 'List all webhook endpoints',
			action: 'List webhook endpoints',
		},
		{
			name: 'List Endpoint Steps',
			value: 'listEndpointSteps',
			description: 'List SDK message processing steps for an endpoint',
			action: 'List endpoint steps',
		},
		{
			name: 'Delete Endpoint',
			value: 'deleteEndpoint',
			description: 'Delete a webhook endpoint and all its associated steps',
			action: 'Delete a webhook endpoint',
		},
		{
			name: 'Delete Step',
			value: 'deleteStep',
			description: 'Delete a specific SDK message processing step',
			action: 'Delete a step',
		},
		{
			name: 'List SDK Message Filters',
			value: 'listSdkMessageFilters',
			description: 'List SDK message filters for a table',
			action: 'List SDK message filters',
		},
	],
	default: 'registerEndpoint',
};

export const webhookOperationFields: INodeProperties[] = [
	// Register Endpoint fields
	{
		displayName: 'Endpoint Name',
		name: 'endpointName',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['registerEndpoint'],
			},
		},
		default: '',
		required: true,
		description: 'Name for the webhook endpoint',
		placeholder: 'e.g. My Webhook Endpoint',
	},
	{
		displayName: 'Webhook URL',
		name: 'webhookUrl',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['registerEndpoint'],
			},
		},
		default: '',
		required: true,
		description: 'URL endpoint to receive webhook notifications',
		placeholder: 'e.g. https://your-app.com/webhook/dataverse',
	},
	{
		displayName: 'Description',
		name: 'endpointDescription',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['registerEndpoint'],
			},
		},
		default: '',
		description: 'Description for the webhook endpoint',
		placeholder: 'e.g. Endpoint for receiving Dataverse events',
	},
	{
		displayName: 'Auth Header',
		name: 'authHeader',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['registerEndpoint'],
			},
		},
		default: '',
		description: 'Custom authorization header value (e.g., x-api-key:your-key)',
		placeholder: 'e.g. x-api-key:abc123',
	},
	// Register Webhook Step fields
	{
		displayName: 'Service Endpoint ID',
		name: 'serviceEndpointId',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['registerWebhookStep', 'deleteEndpoint', 'listEndpointSteps'],
			},
		},
		default: '',
		required: true,
		description: 'ID of the webhook endpoint to use',
		placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
	},
	{
		displayName: 'Operation',
		name: 'webhookOperation',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['registerWebhookStep'],
			},
		},
		options: [
			{ name: 'Create', value: 'Create' },
			{ name: 'Update', value: 'Update' },
			{ name: 'Delete', value: 'Delete' },
			{ name: 'Assign', value: 'Assign' },
			{ name: 'SetState', value: 'SetState' },
		],
		default: 'Create',
		description: 'Dataverse operation to trigger the webhook',
	},
	{
		displayName: 'Step Name',
		name: 'stepName',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['registerWebhookStep'],
			},
		},
		default: '',
		description: 'Name for the SDK message processing step (optional)',
		placeholder: 'e.g. Account Create Webhook',
	},
	{
		displayName: 'Filtering Attributes',
		name: 'filteringAttributes',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['registerWebhookStep'],
				webhookOperation: ['Update'],
			},
		},
		default: '',
		description: 'Comma-separated list of field names that trigger this step. Leave empty to monitor all fields.',
		placeholder: 'e.g. name,emailaddress1,statuscode',
	},
	// List Endpoints fields
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['listEndpoints', 'listEndpointSteps'],
			},
		},
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['listEndpoints', 'listEndpointSteps'],
				returnAll: [false],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 500,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	// Delete Step fields
	{
		displayName: 'Step ID',
		name: 'stepId',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webhook'],
				operation: ['deleteStep'],
			},
		},
		default: '',
		required: true,
		description: 'ID of the SDK message processing step to delete',
		placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
	},
];
export const sqlOperationDescription: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: {
			resource: ['sql'],
		},
	},
	options: [
		{
			name: 'Execute Query',
			value: 'executeQuery',
			description: 'Execute a SQL query via TDS',
			action: 'Execute a SQL query',
		},
	],
	default: 'executeQuery',
};

export const sqlQueryFields: INodeProperties[] = [
	{
		displayName: 'SQL Query',
		name: 'sqlQuery',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['sql'],
				operation: ['executeQuery'],
			},
		},
		typeOptions: {
			rows: 10,
		},
		default: '',
		required: true,
		description: 'SQL query to execute against Dataverse',
		placeholder: 'SELECT TOP 10 name, emailaddress1 FROM account',
	},
];

// Plugin Operations
export const pluginOperationDescription: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: {
			resource: ['plugin'],
		},
	},
	options: [
		{
			name: 'Upload Assembly',
			value: 'uploadPluginAssembly',
			description: 'Upload a DLL plugin assembly',
			action: 'Upload a plugin assembly',
		},
		{
			name: 'Register Step',
			value: 'registerPluginStep',
			description: 'Register a plugin step for a table/operation',
			action: 'Register a plugin step',
		},
		{
			name: 'List Assemblies',
			value: 'listPluginAssemblies',
			description: 'List all plugin assemblies',
			action: 'List plugin assemblies',
		},
		{
			name: 'Delete Assembly',
			value: 'deletePluginAssembly',
			description: 'Delete a plugin assembly',
			action: 'Delete a plugin assembly',
		},
	],
	default: 'uploadPluginAssembly',
};

export const pluginOperationFields: INodeProperties[] = [
	// Upload Assembly fields
	{
		displayName: 'Assembly Name',
		name: 'assemblyName',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['uploadPluginAssembly'],
			},
		},
		default: '',
		required: true,
		description: 'Name for the plugin assembly',
		placeholder: 'e.g. MyPluginAssembly',
	},
	{
		displayName: 'DLL File',
		name: 'dllFile',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['uploadPluginAssembly'],
			},
		},
		default: '',
		required: true,
		description: 'Base64-encoded DLL content. Use an expression like {{ $binary.file.data }} if reading from a file node, or paste the base64 string directly',
		placeholder: 'e.g. {{ $binary.file.data }}',
	},
	{
		displayName: 'Source Type',
		name: 'sourceType',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['uploadPluginAssembly'],
			},
		},
		options: [
			{ name: 'Database', value: 0 },
			{ name: 'Disk', value: 1 },
			{ name: 'Normal', value: 2 },
			{ name: 'Azure', value: 3 },
		],
		default: 0,
		description: 'Source type for the plugin assembly',
	},
	{
		displayName: 'Isolation Mode',
		name: 'isolationMode',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['uploadPluginAssembly'],
			},
		},
		options: [
			{ name: 'None', value: 1 },
			{ name: 'Sandbox', value: 2 },
		],
		default: 2,
		description: 'Isolation mode for the plugin (Sandbox recommended)',
	},
	// Register Step fields
	{
		displayName: 'Plugin Assembly ID',
		name: 'pluginAssemblyId',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['registerPluginStep'],
			},
		},
		default: '',
		required: true,
		description: 'ID of the plugin assembly',
		placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
	},
	{
		displayName: 'Plugin Type Name',
		name: 'pluginTypeName',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['registerPluginStep'],
			},
		},
		default: '',
		required: true,
		description: 'Full class name of the plugin type (e.g., Namespace.ClassName)',
		placeholder: 'e.g. MyNamespace.MyPluginClass',
	},
	{
		displayName: 'Step Name',
		name: 'stepName',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['registerPluginStep'],
			},
		},
		default: '',
		required: true,
		description: 'Name for the plugin step',
		placeholder: 'e.g. Account Create Plugin',
	},
	{
		displayName: 'Event Operation',
		name: 'eventOperation',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['registerPluginStep'],
			},
		},
		options: [
			{ name: 'Create', value: 1 },
			{ name: 'Update', value: 2 },
			{ name: 'Delete', value: 3 },
		],
		default: 1,
		description: 'Dataverse operation that triggers the plugin',
	},
	{
		displayName: 'Execution Stage',
		name: 'stage',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['registerPluginStep'],
			},
		},
		options: [
			{ name: 'Pre-Validation', value: 10 },
			{ name: 'Pre-Operation', value: 20 },
			{ name: 'Post-Operation', value: 40 },
		],
		default: 40,
		description: 'Execution stage of the plugin',
	},
	{
		displayName: 'Filtering Attributes',
		name: 'filteringAttributes',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['registerPluginStep'],
				eventOperation: [2],
			},
		},
		default: '',
		description: 'Comma-separated list of field names that trigger this step (Update operations only). Leave empty to monitor all fields.',
		placeholder: 'e.g. name,emailaddress1,statuscode',
	},
	// List Assemblies fields
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['listPluginAssemblies'],
			},
		},
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['listPluginAssemblies'],
				returnAll: [false],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 500,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	// Delete Assembly fields
	{
		displayName: 'Assembly ID',
		name: 'assemblyId',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['plugin'],
				operation: ['deletePluginAssembly'],
			},
		},
		default: '',
		required: true,
		description: 'ID of the plugin assembly to delete',
		placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
	},
];

// Web Resource Operations
export const webResourceOperationDescription: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: {
		show: {
			resource: ['webresource'],
		},
	},
	options: [
		{
			name: 'Upload',
			value: 'uploadWebResource',
			description: 'Upload a new web resource (JS, CSS, HTML, etc.)',
			action: 'Upload a web resource',
		},
		{
			name: 'Update',
			value: 'updateWebResource',
			description: 'Update an existing web resource content',
			action: 'Update a web resource',
		},
		{
			name: 'List',
			value: 'listWebResources',
			description: 'List web resources',
			action: 'List web resources',
		},
		{
			name: 'Delete',
			value: 'deleteWebResource',
			description: 'Delete a web resource',
			action: 'Delete a web resource',
		},
	],
	default: 'uploadWebResource',
};

export const webResourceOperationFields: INodeProperties[] = [
	// Upload Web Resource fields
	{
		displayName: 'Display Name',
		name: 'webResourceDisplayName',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['uploadWebResource'],
			},
		},
		default: '',
		required: true,
		description: 'Display name for the web resource',
		placeholder: 'e.g. My Custom Script',
	},
	{
		displayName: 'Unique Name',
		name: 'webResourceName',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['uploadWebResource'],
			},
		},
		default: '',
		required: true,
		description: 'Schema name for the web resource (must include publisher prefix)',
		placeholder: 'e.g. prefix_/scripts/myscript.js',
	},
	{
		displayName: 'Web Resource Type',
		name: 'webResourceType',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['uploadWebResource'],
			},
		},
		options: [
			{ name: 'HTML', value: 1 },
			{ name: 'CSS', value: 2 },
			{ name: 'JavaScript', value: 3 },
			{ name: 'XML', value: 4 },
			{ name: 'PNG', value: 5 },
			{ name: 'JPG', value: 6 },
			{ name: 'GIF', value: 7 },
			{ name: 'XAP (Silverlight)', value: 8 },
			{ name: 'XSL', value: 9 },
			{ name: 'ICO', value: 10 },
			{ name: 'SVG', value: 11 },
			{ name: 'RESX', value: 12 },
		],
		default: 3,
		description: 'Type of web resource',
	},
	{
		displayName: 'Content',
		name: 'webResourceContent',
		type: 'string',
		typeOptions: {
			rows: 10,
		},
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['uploadWebResource'],
			},
		},
		default: '',
		required: true,
		description: 'Content of the web resource. For text types (JS, CSS, HTML), provide the raw code — it will be base64-encoded automatically. For binary types (images), provide base64-encoded content.',
		placeholder: 'e.g. console.log("Hello Dataverse");',
	},
	{
		displayName: 'Description',
		name: 'webResourceDescription',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['uploadWebResource'],
			},
		},
		default: '',
		description: 'Description for the web resource',
	},
	// Update Web Resource fields
	{
		displayName: 'Web Resource ID',
		name: 'webResourceId',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['updateWebResource', 'deleteWebResource'],
			},
		},
		default: '',
		required: true,
		description: 'ID of the web resource',
		placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
	},
	{
		displayName: 'Content',
		name: 'webResourceContent',
		type: 'string',
		typeOptions: {
			rows: 10,
		},
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['updateWebResource'],
			},
		},
		default: '',
		required: true,
		description: 'New content for the web resource. For text types (JS, CSS, HTML), provide the raw code — it will be base64-encoded automatically.',
		placeholder: 'e.g. console.log("Updated code");',
	},
	// List Web Resources fields
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['listWebResources'],
			},
		},
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['listWebResources'],
				returnAll: [false],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 500,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filter by Type',
		name: 'webResourceTypeFilter',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['webresource'],
				operation: ['listWebResources'],
			},
		},
		options: [
			{ name: 'All', value: 0 },
			{ name: 'HTML', value: 1 },
			{ name: 'CSS', value: 2 },
			{ name: 'JavaScript', value: 3 },
			{ name: 'XML', value: 4 },
			{ name: 'PNG', value: 5 },
			{ name: 'JPG', value: 6 },
			{ name: 'GIF', value: 7 },
			{ name: 'SVG', value: 11 },
		],
		default: 0,
		description: 'Filter web resources by type',
	},
];
