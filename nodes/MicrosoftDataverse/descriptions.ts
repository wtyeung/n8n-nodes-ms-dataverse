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
	],
	default: 'get',
};

export const tableDescription: INodeProperties = {
	displayName: 'Table',
	name: 'table',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
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

export const createOperationFields: INodeProperties[] = [
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
						type: 'string',
						default: '',
						description: 'Name of the field to set',
						placeholder: 'e.g. name',
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
];

export const getOperationFields: INodeProperties[] = [
	{
		displayName: 'Record ID Type',
		name: 'recordIdType',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['get'],
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
				operation: ['get', 'delete', 'update'],
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
				operation: ['get'],
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
						type: 'string',
						default: '',
						description: 'Name of the alternate key',
						placeholder: 'e.g. emailaddress1',
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

export const updateOperationFields: INodeProperties[] = [
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
						type: 'string',
						default: '',
						description: 'Name of the field to update',
						placeholder: 'e.g. name',
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
