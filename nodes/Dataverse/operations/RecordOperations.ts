import type { IExecuteFunctions, IDataObject, INodeExecutionData, IBinaryKeyData } from 'n8n-workflow';
import {
	dataverseApiRequest,
	dataverseApiBinaryRequest,
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
		const imageFields: string[] = [];
		
		// If specific field names provided, use those
		if (imageFieldNames) {
			const fieldList = imageFieldNames.split(',').map(f => f.trim());
			for (const fieldName of fieldList) {
				if (record[fieldName]) {
					imageFields.push(fieldName);
				}
			}
		} else {
			// Auto-detect image fields - look for base64 encoded data (starts with / or i which are common JPEG/PNG base64 starts)
			// Also check for common image field patterns
			for (const key of Object.keys(record)) {
				const value = record[key];
				if (typeof value === 'string' && 
					value.length > 100 && // Reasonable minimum for image data
					!key.includes('_url') &&
					!key.includes('_timestamp') &&
					!key.endsWith('id') &&
					!key.endsWith('name')) {
					// Check if it looks like base64 image data (JPEG starts with /9j/, PNG with iVBOR)
					if (value.startsWith('/9j/') || value.startsWith('iVBOR') || 
						key.endsWith('_img') || key.endsWith('_image') || 
						key.includes('photo') || key.includes('picture') || 
						key.includes('avatar') || key === 'entityimage') {
						imageFields.push(key);
					}
				}
			}
		}

		// Convert each image field to binary
		for (const fieldName of imageFields) {
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
			} catch (error) {
				// Image field conversion failed, log error but continue
				console.error(`Failed to download image ${fieldName}:`, error);
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
	const recordId = this.getNodeParameter('recordId', itemIndex) as string;
	const updateFields = this.getNodeParameter('updateFields.field', itemIndex, []) as FieldValue[];
	const body = fieldsToObject(updateFields);

	const response = await dataverseApiRequest.call(
		this,
		'PATCH',
		`/${table}(${recordId})`,
		body,
		undefined,
		itemIndex,
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

	await dataverseApiRequest.call(this, 'DELETE', `/${table}(${recordId})`, undefined, undefined, itemIndex);

	return { success: true, id: recordId };
}
