import type { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { dataverseApiRequest } from '../GenericFunctions';

interface FieldDefinition {
	schemaName: string;
	displayName: string;
	fieldType: string;
	description?: string;
	requiredLevel?: string;
	maxLength?: number;
	precision?: number;
	minValue?: number;
	maxValue?: number;
}

/**
 * Create a custom table with fields in Dataverse
 */
export async function createTable(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const schemaName = this.getNodeParameter('schemaName', itemIndex) as string;
	const displayName = this.getNodeParameter('displayName', itemIndex) as string;
	const pluralDisplayName = this.getNodeParameter('pluralDisplayName', itemIndex) as string;
	const description = this.getNodeParameter('description', itemIndex, '') as string;
	const primaryNameField = this.getNodeParameter('primaryNameField', itemIndex) as string;
	const primaryNameDisplayName = this.getNodeParameter('primaryNameDisplayName', itemIndex) as string;
	const additionalFields = this.getNodeParameter('additionalFields.field', itemIndex, []) as FieldDefinition[];

	// Build the table definition
	const tableDefinition: IDataObject = {
		'@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
		SchemaName: schemaName,
		DisplayName: {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: displayName,
					LanguageCode: 1033,
				},
			],
		},
		DisplayCollectionName: {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: pluralDisplayName,
					LanguageCode: 1033,
				},
			],
		},
		HasActivities: false,
		HasNotes: false,
		IsActivity: false,
		OwnershipType: 'UserOwned',
		Attributes: [],
	};

	if (description) {
		tableDefinition.Description = {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: description,
					LanguageCode: 1033,
				},
			],
		};
	}

	// Add primary name attribute
	const primaryNameAttribute: IDataObject = {
		'@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
		SchemaName: primaryNameField,
		RequiredLevel: {
			Value: 'None',
			CanBeChanged: true,
		},
		MaxLength: 100,
		FormatName: {
			Value: 'Text',
		},
		DisplayName: {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: primaryNameDisplayName,
					LanguageCode: 1033,
				},
			],
		},
		IsPrimaryName: true,
	};

	(tableDefinition.Attributes as IDataObject[]).push(primaryNameAttribute);

	// Add additional fields
	for (const field of additionalFields) {
		const attribute = buildAttributeDefinition(field);
		(tableDefinition.Attributes as IDataObject[]).push(attribute);
	}

	// Create the table
	const response = await dataverseApiRequest.call(
		this,
		'POST',
		'/EntityDefinitions',
		tableDefinition,
		undefined,
		itemIndex,
	);

	return {
		success: true,
		schemaName,
		displayName,
		tableId: (response as IDataObject).MetadataId,
		fieldsCreated: 1 + additionalFields.length,
	};
}

/**
 * Build attribute definition based on field type
 */
function buildAttributeDefinition(field: FieldDefinition): IDataObject {
	const baseAttribute: IDataObject = {
		SchemaName: field.schemaName,
		RequiredLevel: {
			Value: field.requiredLevel || 'None',
			CanBeChanged: true,
		},
		DisplayName: {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: field.displayName,
					LanguageCode: 1033,
				},
			],
		},
	};

	if (field.description) {
		baseAttribute.Description = {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: field.description,
					LanguageCode: 1033,
				},
			],
		};
	}

	switch (field.fieldType) {
		case 'String':
			return {
				...baseAttribute,
				'@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
				MaxLength: field.maxLength || 100,
				FormatName: {
					Value: 'Text',
				},
			};

		case 'Memo':
			return {
				...baseAttribute,
				'@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
				MaxLength: field.maxLength || 2000,
				Format: 'Text',
			};

		case 'Integer':
			return {
				...baseAttribute,
				'@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
				Format: 'None',
				MinValue: field.minValue !== undefined ? field.minValue : -2147483648,
				MaxValue: field.maxValue !== undefined ? field.maxValue : 2147483647,
			};

		case 'Decimal':
			return {
				...baseAttribute,
				'@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
				Precision: field.precision || 2,
				MinValue: field.minValue !== undefined ? field.minValue : -100000000000,
				MaxValue: field.maxValue !== undefined ? field.maxValue : 100000000000,
			};

		case 'Money':
			return {
				...baseAttribute,
				'@odata.type': 'Microsoft.Dynamics.CRM.MoneyAttributeMetadata',
				Precision: field.precision || 2,
				PrecisionSource: 2,
				MinValue: field.minValue !== undefined ? field.minValue : 0,
				MaxValue: field.maxValue !== undefined ? field.maxValue : 1000000000,
			};

		case 'Boolean':
			return {
				...baseAttribute,
				'@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
				OptionSet: {
					'@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
					TrueOption: {
						Value: 1,
						Label: {
							'@odata.type': 'Microsoft.Dynamics.CRM.Label',
							LocalizedLabels: [
								{
									'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
									Label: 'Yes',
									LanguageCode: 1033,
								},
							],
						},
					},
					FalseOption: {
						Value: 0,
						Label: {
							'@odata.type': 'Microsoft.Dynamics.CRM.Label',
							LocalizedLabels: [
								{
									'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
									Label: 'No',
									LanguageCode: 1033,
								},
							],
						},
					},
				},
			};

		case 'DateTime':
			return {
				...baseAttribute,
				'@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
				Format: 'DateAndTime',
				ImeMode: 'Auto',
			};

		case 'Picklist':
			return {
				...baseAttribute,
				'@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
				OptionSet: {
					'@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
					IsGlobal: false,
					OptionSetType: 'Picklist',
					Options: [],
				},
			};

		default:
			return {
				...baseAttribute,
				'@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
				MaxLength: 100,
				FormatName: {
					Value: 'Text',
				},
			};
	}
}
