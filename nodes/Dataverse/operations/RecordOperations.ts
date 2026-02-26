import type { IExecuteFunctions, IDataObject, INodeExecutionData, IBinaryKeyData } from 'n8n-workflow';
import {
	dataverseApiRequest,
	dataverseApiBinaryRequest,
	getImageAndFileFields,
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
	const fieldsInputMode = this.getNodeParameter('fieldsInputMode', itemIndex, 'collection') as string;
	let body: IDataObject;

	if (fieldsInputMode === 'json') {
		const fieldsJson = this.getNodeParameter('fieldsJson', itemIndex, '{}') as string;
		body = typeof fieldsJson === 'string' ? JSON.parse(fieldsJson) : fieldsJson;
	} else {
		const fields = this.getNodeParameter('fields.field', itemIndex, []) as FieldValue[];
		body = fieldsToObject(fields);
	}

	return await dataverseApiRequest.call(this, 'POST', `/${table}`, body, undefined, itemIndex);
}

/**
 * Get a single record from Dataverse
 */
export async function getRecord(
	this: IExecuteFunctions,
	table: string,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const recordIdType = this.getNodeParameter('recordIdType', itemIndex) as string;
	const selectFields = this.getNodeParameter('selectFields', itemIndex, '') as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
	const downloadImages = options.downloadImages as string || 'none';
	const imageFieldNames = options.imageFieldNames as string || '';
	const downloadFiles = options.downloadFiles as boolean || false;
	const fileFieldNames = options.fileFieldNames as string || '';

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

	const record = await dataverseApiRequest.call(this, 'GET', `/${table}(${recordIdentifier})`, undefined, qs, itemIndex);

	const binaryData: IBinaryKeyData = {};

	// Download images if requested
	if (downloadImages !== 'none') {
		const imageFieldsToDownload: string[] = [];
		
		// If specific field names provided, use those
		if (imageFieldNames) {
			const fieldList = imageFieldNames.split(',').map(f => f.trim());
			for (const fieldName of fieldList) {
				if (record[fieldName]) {
					imageFieldsToDownload.push(fieldName);
				}
			}
		} else {
			// Auto-detect using entity metadata
			const metadata = await getImageAndFileFields.call(this, table, itemIndex);
			
			// Use image fields from metadata that exist in the record and have data
			for (const fieldName of metadata.imageFields) {
				const fieldValue = record[fieldName];
				// Skip if field is null, undefined, or empty string
				if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
					imageFieldsToDownload.push(fieldName);
				}
			}
			
			// Fallback: if no metadata fields found, use pattern matching
			if (imageFieldsToDownload.length === 0) {
				for (const key of Object.keys(record)) {
					const value = record[key];
					if (typeof value === 'string' && 
						value.length > 100 &&
						!key.includes('_url') &&
						!key.includes('_timestamp') &&
						!key.endsWith('id') &&
						!key.endsWith('name')) {
						// Check if it looks like base64 image data
						if (value.startsWith('/9j/') || value.startsWith('iVBOR')) {
							imageFieldsToDownload.push(key);
						}
					}
				}
			}
		}

		// Convert each image field to binary
		for (const fieldName of imageFieldsToDownload) {
			try {
				let imageBuffer: Buffer;
				
				if (downloadImages === 'thumbnails') {
					// Use the base64 thumbnail from the response
					const imageData = record[fieldName] as string;
					imageBuffer = Buffer.from(imageData, 'base64');
				} else {
					// Download full image using the Image download endpoint
					// Check if there's a URL field with the download link
					const urlFieldName = `${fieldName}_url`;
					let imageUrl = record[urlFieldName] as string;
					
					if (imageUrl) {
						// Add Full=true parameter to get full image instead of thumbnail
						if (!imageUrl.includes('Full=')) {
							imageUrl += '&Full=true';
						}
						// The URL is relative, prepend with /
						if (!imageUrl.startsWith('/')) {
							imageUrl = '/' + imageUrl;
						}
						// Remove /api/data/v9.2 prefix since this is not a Web API endpoint
						imageBuffer = await dataverseApiBinaryRequest.call(
							this,
							'GET',
							imageUrl,
							itemIndex,
						);
					} else {
						// Fallback: construct the download URL manually
						// Format: /Image/download.aspx?Entity=[entity]&Attribute=[field]&Id=[id]&Full=true
						const entityName = table.replace(/s$/, ''); // Remove plural 's' if present
						const downloadUrl = `/Image/download.aspx?Entity=${entityName}&Attribute=${fieldName}&Id=${recordIdentifier}&Full=true`;
						imageBuffer = await dataverseApiBinaryRequest.call(
							this,
							'GET',
							downloadUrl,
							itemIndex,
						);
					}
				}

				// Create a clean binary property name - keep the full field name for clarity
				// Remove common prefixes but keep the meaningful part
				let binaryPropertyName = fieldName;
				if (fieldName.includes('_')) {
					// For fields like crb1b_img, keep the full name or just the suffix
					const parts = fieldName.split('_');
					// If it's a custom field with prefix, use the full name, otherwise use suffix
					binaryPropertyName = parts.length > 2 ? fieldName : parts[parts.length - 1];
				}
				binaryPropertyName = binaryPropertyName.replace('entityimage', 'image');
				
				// Get record ID for filename
				let recordId = '';
				if (recordIdType === 'id') {
					recordId = this.getNodeParameter('recordId', itemIndex) as string;
				} else {
					// For alternate keys, use the first key value or the record's primary key from response
					const primaryKeyField = Object.keys(record).find(key => key.endsWith('id') && !key.includes('_'));
					recordId = primaryKeyField ? (record[primaryKeyField] as string) : 'record';
				}
				
				// Create filename with recordId_fieldname.jpg format
				const fileName = `${recordId}_${fieldName}.jpg`;
				
				const binary = await this.helpers.prepareBinaryData(
					imageBuffer,
					fileName,
					'image/jpeg',
				);

				binaryData[binaryPropertyName] = binary;
			} catch {
				// Image field conversion failed, continue with other fields
				// Error is silently ignored to not break the workflow
			}
		}
	}

	// Download files if requested
	if (downloadFiles) {
		const fileFieldsToDownload: string[] = [];
		
		// If specific field names provided, use those
		if (fileFieldNames) {
			const fieldList = fileFieldNames.split(',').map(f => f.trim());
			for (const fieldName of fieldList) {
				if (record[fieldName]) {
					fileFieldsToDownload.push(fieldName);
				}
			}
		} else {
			// Auto-detect using entity metadata
			const metadata = await getImageAndFileFields.call(this, table, itemIndex);
			
			// Use file fields from metadata that exist in the record and have data
			for (const fieldName of metadata.fileFields) {
				const fieldValue = record[fieldName];
				// Skip if field is null, undefined, or empty string
				if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
					fileFieldsToDownload.push(fieldName);
				}
			}
		}

		// Download each file field
		for (const fieldName of fileFieldsToDownload) {
			try {
				const mimeType = 'application/octet-stream';
				
				// Get record ID for filename
				const fileRecordId = recordIdType === 'id' 
					? this.getNodeParameter('recordId', itemIndex) as string
					: (() => {
						const primaryKeyField = Object.keys(record).find(key => key.endsWith('id') && !key.includes('_'));
						return primaryKeyField ? (record[primaryKeyField] as string) : 'record';
					})();
				
				// Files use the Web API /$value endpoint
				// Format: /api/data/v9.2/[entity]([id])/[field]/$value
				const fileEndpoint = `/${table}(${recordIdentifier})/${fieldName}/$value`;
				
				const fileBuffer = await dataverseApiBinaryRequest.call(
					this,
					'GET',
					fileEndpoint,
					itemIndex,
				);
				
				// Try to get filename from record
				const fileNameField = `${fieldName}_name`;
				const fileName = (record[fileNameField] as string) || `${fileRecordId}_${fieldName}`;
				
				const binary = await this.helpers.prepareBinaryData(
					fileBuffer,
					fileName,
					mimeType,
				);

				// Create a clean binary property name
				let binaryPropertyName = fieldName;
				if (fieldName.includes('_')) {
					const parts = fieldName.split('_');
					binaryPropertyName = parts.length > 2 ? fieldName : parts[parts.length - 1];
				}

				binaryData[binaryPropertyName] = binary;
			} catch {
				// File download failed, continue with other fields
				// Error is silently ignored to not break the workflow
			}
		}
	}

	// Return in n8n execution data format
	return {
		json: record,
		binary: Object.keys(binaryData).length > 0 ? binaryData : undefined,
		pairedItem: { item: itemIndex },
	};
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
			itemIndex,
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
		}, itemIndex)) as DataverseApiResponse;

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
	const recordIdType = this.getNodeParameter('recordIdType', itemIndex) as string;
	const fieldsInputMode = this.getNodeParameter('fieldsInputMode', itemIndex, 'collection') as string;
	let body: IDataObject;

	if (fieldsInputMode === 'json') {
		const updateFieldsJson = this.getNodeParameter('updateFieldsJson', itemIndex, '{}') as string;
		body = typeof updateFieldsJson === 'string' ? JSON.parse(updateFieldsJson) : updateFieldsJson;
	} else {
		const updateFields = this.getNodeParameter('updateFields.field', itemIndex, []) as FieldValue[];
		body = fieldsToObject(updateFields);
	}

	let recordIdentifier = '';

	if (recordIdType === 'alternateKey') {
		const alternateKeys = this.getNodeParameter('alternateKeys.key', itemIndex, []) as AlternateKey[];
		recordIdentifier = buildRecordIdentifier('alternateKey', undefined, alternateKeys);
	} else {
		const recordId = this.getNodeParameter('recordId', itemIndex) as string;
		recordIdentifier = buildRecordIdentifier('id', recordId);
	}

	const response = await dataverseApiRequest.call(
		this,
		'PATCH',
		`/${table}(${recordIdentifier})`,
		body,
		undefined,
		itemIndex,
	);

	return (response as IDataObject) || { success: true, id: recordIdentifier };
}

/**
 * Delete a record from Dataverse
 */
export async function deleteRecord(
	this: IExecuteFunctions,
	table: string,
	itemIndex: number,
): Promise<IDataObject> {
	const recordIdType = this.getNodeParameter('recordIdType', itemIndex) as string;

	let recordIdentifier = '';

	if (recordIdType === 'alternateKey') {
		const alternateKeys = this.getNodeParameter('alternateKeys.key', itemIndex, []) as AlternateKey[];
		recordIdentifier = buildRecordIdentifier('alternateKey', undefined, alternateKeys);
	} else {
		const recordId = this.getNodeParameter('recordId', itemIndex) as string;
		recordIdentifier = buildRecordIdentifier('id', recordId);
	}

	await dataverseApiRequest.call(this, 'DELETE', `/${table}(${recordIdentifier})`, undefined, undefined, itemIndex);

	return { success: true, id: recordIdentifier };
}

/**
 * Upsert a record in Dataverse (create if not exists, update if exists)
 * Requires alternate key to identify the record
 */
export async function upsertRecord(
	this: IExecuteFunctions,
	table: string,
	itemIndex: number,
): Promise<IDataObject> {
	const recordIdType = this.getNodeParameter('recordIdType', itemIndex) as string;
	const fieldsInputMode = this.getNodeParameter('fieldsInputMode', itemIndex, 'collection') as string;
	let body: IDataObject;

	if (fieldsInputMode === 'json') {
		const upsertFieldsJson = this.getNodeParameter('upsertFieldsJson', itemIndex, '{}') as string;
		body = typeof upsertFieldsJson === 'string' ? JSON.parse(upsertFieldsJson) : upsertFieldsJson;
	} else {
		const upsertFields = this.getNodeParameter('upsertFields.field', itemIndex, []) as FieldValue[];
		body = fieldsToObject(upsertFields);
	}

	let recordIdentifier = '';

	if (recordIdType === 'alternateKey') {
		const alternateKeys = this.getNodeParameter('alternateKeys.key', itemIndex, []) as AlternateKey[];
		recordIdentifier = buildRecordIdentifier('alternateKey', undefined, alternateKeys);
	} else {
		const recordId = this.getNodeParameter('recordId', itemIndex) as string;
		recordIdentifier = buildRecordIdentifier('id', recordId);
	}

	const response = await dataverseApiRequest.call(
		this,
		'PATCH',
		`/${table}(${recordIdentifier})`,
		body,
		undefined,
		itemIndex,
	);

	return (response as IDataObject) || { success: true, id: recordIdentifier };
}
