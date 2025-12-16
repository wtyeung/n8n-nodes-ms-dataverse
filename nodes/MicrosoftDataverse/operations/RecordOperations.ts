import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import {
	dataverseApiRequest,
	buildRecordIdentifier,
	fieldsToObject,
	buildODataQuery,
} from '../GenericFunctions';
import type { FieldValue, AlternateKey, DataverseApiResponse } from '../types';

/**
 * Create a new record in Dataverse
 */
export async function createRecord(
	this: IExecuteFunctions,
	table: string,
	itemIndex: number,
): Promise<IDataObject> {
	const fields = this.getNodeParameter('fields.field', itemIndex, []) as FieldValue[];
	const body = fieldsToObject(fields);

	return await dataverseApiRequest.call(this, 'POST', `/${table}`, body);
}

/**
 * Get a single record from Dataverse
 */
export async function getRecord(
	this: IExecuteFunctions,
	table: string,
	itemIndex: number,
): Promise<IDataObject> {
	const recordIdType = this.getNodeParameter('recordIdType', itemIndex) as string;
	const selectFields = this.getNodeParameter('selectFields', itemIndex, '') as string;

	let recordIdentifier = '';

	if (recordIdType === 'id') {
		const recordId = this.getNodeParameter('recordId', itemIndex) as string;
		recordIdentifier = buildRecordIdentifier('id', recordId);
	} else {
		const alternateKeys = this.getNodeParameter('alternateKeys.key', itemIndex, []) as AlternateKey[];
		recordIdentifier = buildRecordIdentifier('alternateKey', undefined, alternateKeys);
	}

	const qs: IDataObject = {};
	if (selectFields) {
		qs.$select = selectFields;
	}

	return await dataverseApiRequest.call(this, 'GET', `/${table}(${recordIdentifier})`, undefined, qs);
}

/**
 * Get multiple records from Dataverse
 */
export async function getManyRecords(
	this: IExecuteFunctions,
	table: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const queryType = this.getNodeParameter('queryType', itemIndex) as string;
	const returnData: INodeExecutionData[] = [];

	if (queryType === 'odata') {
		const odataFilter = this.getNodeParameter('odataFilter', itemIndex, '') as string;
		const odataOrderBy = this.getNodeParameter('odataOrderBy', itemIndex, '') as string;
		const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
		const selectFields = this.getNodeParameter('selectFields', itemIndex, '') as string;

		const qs = buildODataQuery(odataFilter, odataOrderBy, selectFields, limit);

		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			`/${table}`,
			undefined,
			qs,
		)) as DataverseApiResponse;

		const records = (response.value || []) as IDataObject[];
		for (const record of records) {
			returnData.push({
				json: record,
				pairedItem: { item: itemIndex },
			});
		}
	} else {
		// FetchXML
		const fetchXml = this.getNodeParameter('fetchXml', itemIndex) as string;

		const response = (await dataverseApiRequest.call(this, 'GET', `/${table}`, undefined, {
			fetchXml: fetchXml,
		})) as DataverseApiResponse;

		const records = (response.value || []) as IDataObject[];
		for (const record of records) {
			returnData.push({
				json: record,
				pairedItem: { item: itemIndex },
			});
		}
	}

	return returnData;
}

/**
 * Update a record in Dataverse
 */
export async function updateRecord(
	this: IExecuteFunctions,
	table: string,
	itemIndex: number,
): Promise<IDataObject> {
	const recordId = this.getNodeParameter('recordId', itemIndex) as string;
	const updateFields = this.getNodeParameter('updateFields.field', itemIndex, []) as FieldValue[];
	const body = fieldsToObject(updateFields);

	const response = await dataverseApiRequest.call(
		this,
		'PATCH',
		`/${table}(${recordId})`,
		body,
	);

	return (response as IDataObject) || { success: true, id: recordId };
}

/**
 * Delete a record from Dataverse
 */
export async function deleteRecord(
	this: IExecuteFunctions,
	table: string,
	itemIndex: number,
): Promise<IDataObject> {
	const recordId = this.getNodeParameter('recordId', itemIndex) as string;

	await dataverseApiRequest.call(this, 'DELETE', `/${table}(${recordId})`);

	return { success: true, id: recordId };
}
