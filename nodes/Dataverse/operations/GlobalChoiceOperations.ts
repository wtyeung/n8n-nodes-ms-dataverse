import type { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { dataverseApiRequest } from '../GenericFunctions';

interface DataverseApiResponse {
	value?: IDataObject[];
	[key: string]: unknown;
}

/**
 * List all global choices
 */
export async function listGlobalChoices(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const response = (await dataverseApiRequest.call(
		this,
		'GET',
		'/GlobalOptionSetDefinitions',
		undefined,
		{
			$select: 'Name,DisplayName,Description',
			$expand: 'Options($select=Label,Value)',
		},
		itemIndex,
	)) as DataverseApiResponse;

	return {
		globalChoices: response.value || [],
		count: response.value?.length || 0,
	};
}

/**
 * Get a specific global choice
 */
export async function getGlobalChoice(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const choiceName = this.getNodeParameter('choiceName', itemIndex) as string;

	const response = (await dataverseApiRequest.call(
		this,
		'GET',
		`/GlobalOptionSetDefinitions(Name='${choiceName}')`,
		undefined,
		{
			$expand: 'Options($select=Label,Value)',
		},
		itemIndex,
	)) as IDataObject;

	return response;
}

/**
 * Create a new global choice
 */
export async function createGlobalChoice(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const choiceName = this.getNodeParameter('newChoiceName', itemIndex) as string;
	const displayName = this.getNodeParameter('displayName', itemIndex) as string;
	const description = this.getNodeParameter('description', itemIndex, '') as string;
	const options = this.getNodeParameter('options.option', itemIndex, []) as Array<{
		label: string;
		value: number;
	}>;

	// Build options array
	const optionsArray = options.map((opt) => ({
		Value: opt.value,
		Label: {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: opt.label,
					LanguageCode: 1033,
					IsManaged: false,
				},
			],
			UserLocalizedLabel: {
				'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
				Label: opt.label,
				LanguageCode: 1033,
				IsManaged: false,
			},
		},
	}));

	const body = {
		'@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
		Name: choiceName,
		DisplayName: {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: displayName,
					LanguageCode: 1033,
					IsManaged: false,
				},
			],
			UserLocalizedLabel: {
				'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
				Label: displayName,
				LanguageCode: 1033,
				IsManaged: false,
			},
		},
		Description: {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: description,
					LanguageCode: 1033,
					IsManaged: false,
				},
			],
			UserLocalizedLabel: {
				'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
				Label: description,
				LanguageCode: 1033,
				IsManaged: false,
			},
		},
		OptionSetType: 'Picklist',
		Options: optionsArray,
	};

	const response = (await dataverseApiRequest.call(
		this,
		'POST',
		'/GlobalOptionSetDefinitions',
		body,
		undefined,
		itemIndex,
	)) as IDataObject;

	return {
		success: true,
		name: choiceName,
		metadataId: response.MetadataId,
	};
}

/**
 * Add an option to an existing global choice
 */
export async function addOptionToGlobalChoice(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const choiceName = this.getNodeParameter('choiceName', itemIndex) as string;
	const optionLabel = this.getNodeParameter('optionLabel', itemIndex) as string;
	const optionValue = this.getNodeParameter('optionValue', itemIndex, undefined) as
		| number
		| undefined;

	// First, get the MetadataId of the global choice
	const choiceResponse = (await dataverseApiRequest.call(
		this,
		'GET',
		`/GlobalOptionSetDefinitions(Name='${choiceName}')`,
		undefined,
		{
			$select: 'MetadataId',
		},
		itemIndex,
	)) as IDataObject;

	const metadataId = choiceResponse.MetadataId as string;

	// Build the InsertOptionValue request
	const body: IDataObject = {
		Label: {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: optionLabel,
					LanguageCode: 1033,
				},
			],
		},
		OptionSetName: choiceName,
	};

	// Add value if provided, otherwise it will be auto-generated
	if (optionValue !== undefined) {
		body.Value = optionValue;
	}

	const response = (await dataverseApiRequest.call(
		this,
		'POST',
		`/GlobalOptionSetDefinitions(${metadataId})/Microsoft.Dynamics.CRM.InsertOptionValue`,
		body,
		undefined,
		itemIndex,
	)) as IDataObject;

	return {
		success: true,
		choiceName,
		newOptionValue: response.NewOptionValue,
	};
}

/**
 * Update an option in a global choice
 */
export async function updateOptionInGlobalChoice(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const choiceName = this.getNodeParameter('choiceName', itemIndex) as string;
	const optionValue = this.getNodeParameter('optionValue', itemIndex) as number;
	const newLabel = this.getNodeParameter('newLabel', itemIndex) as string;

	// First, get the MetadataId of the global choice
	const choiceResponse = (await dataverseApiRequest.call(
		this,
		'GET',
		`/GlobalOptionSetDefinitions(Name='${choiceName}')`,
		undefined,
		{
			$select: 'MetadataId',
		},
		itemIndex,
	)) as IDataObject;

	const metadataId = choiceResponse.MetadataId as string;

	// Build the UpdateOptionValue request
	const body = {
		OptionSetName: choiceName,
		Value: optionValue,
		Label: {
			'@odata.type': 'Microsoft.Dynamics.CRM.Label',
			LocalizedLabels: [
				{
					'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
					Label: newLabel,
					LanguageCode: 1033,
				},
			],
		},
		MergeLabels: false,
	};

	await dataverseApiRequest.call(
		this,
		'POST',
		`/GlobalOptionSetDefinitions(${metadataId})/Microsoft.Dynamics.CRM.UpdateOptionValue`,
		body,
		undefined,
		itemIndex,
	);

	return {
		success: true,
		choiceName,
		optionValue,
		newLabel,
	};
}

/**
 * Delete an option from a global choice
 */
export async function deleteOptionFromGlobalChoice(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const choiceName = this.getNodeParameter('choiceName', itemIndex) as string;
	const optionValue = this.getNodeParameter('optionValue', itemIndex) as number;

	// First, get the MetadataId of the global choice
	const choiceResponse = (await dataverseApiRequest.call(
		this,
		'GET',
		`/GlobalOptionSetDefinitions(Name='${choiceName}')`,
		undefined,
		{
			$select: 'MetadataId',
		},
		itemIndex,
	)) as IDataObject;

	const metadataId = choiceResponse.MetadataId as string;

	// Build the DeleteOptionValue request
	const body = {
		OptionSetName: choiceName,
		Value: optionValue,
	};

	await dataverseApiRequest.call(
		this,
		'POST',
		`/GlobalOptionSetDefinitions(${metadataId})/Microsoft.Dynamics.CRM.DeleteOptionValue`,
		body,
		undefined,
		itemIndex,
	);

	return {
		success: true,
		choiceName,
		deletedOptionValue: optionValue,
	};
}

/**
 * Delete a global choice
 */
export async function deleteGlobalChoice(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const choiceName = this.getNodeParameter('choiceName', itemIndex) as string;

	// First, get the MetadataId of the global choice
	const choiceResponse = (await dataverseApiRequest.call(
		this,
		'GET',
		`/GlobalOptionSetDefinitions(Name='${choiceName}')`,
		undefined,
		{
			$select: 'MetadataId',
		},
		itemIndex,
	)) as IDataObject;

	const metadataId = choiceResponse.MetadataId as string;

	// Delete the global choice
	await dataverseApiRequest.call(
		this,
		'DELETE',
		`/GlobalOptionSetDefinitions(${metadataId})`,
		undefined,
		undefined,
		itemIndex,
	);

	return {
		success: true,
		deletedChoice: choiceName,
	};
}
