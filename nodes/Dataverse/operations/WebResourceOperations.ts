import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { dataverseApiRequest } from '../GenericFunctions';

// Text-based web resource types that need base64 encoding
const TEXT_TYPES = [1, 2, 3, 4, 8, 9, 12]; // HTML, CSS, JS, XML, XAP, XSL, RESX

/**
 * Encode content to base64 if it's a text-based web resource type
 */
function encodeContent(content: string, webResourceType: number): string {
	if (TEXT_TYPES.includes(webResourceType)) {
		return Buffer.from(content, 'utf-8').toString('base64');
	}
	// Binary types (images, etc.) are expected to already be base64
	return content;
}

/**
 * Upload a new web resource
 */
export async function uploadWebResource(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const displayName = this.getNodeParameter('webResourceDisplayName', itemIndex) as string;
	const name = this.getNodeParameter('webResourceName', itemIndex) as string;
	const webResourceType = this.getNodeParameter('webResourceType', itemIndex) as number;
	const content = this.getNodeParameter('webResourceContent', itemIndex) as string;
	const description = this.getNodeParameter('webResourceDescription', itemIndex, '') as string;

	const body: IDataObject = {
		displayname: displayName,
		name,
		webresourcetype: webResourceType,
		content: encodeContent(content, webResourceType),
	};

	if (description) {
		body.description = description;
	}

	const response = await dataverseApiRequest.call(
		this,
		'POST',
		'/webresourceset',
		body,
		undefined,
		itemIndex,
	);

	const webResourceId = (response as unknown as { webresourceid: string }).webresourceid;

	return {
		json: {
			webresourceid: webResourceId,
			displayname: displayName,
			name,
			webresourcetype: webResourceType,
			success: true,
		},
		pairedItem: { item: itemIndex },
	};
}

/**
 * Update an existing web resource content
 */
export async function updateWebResource(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const webResourceId = this.getNodeParameter('webResourceId', itemIndex) as string;
	const content = this.getNodeParameter('webResourceContent', itemIndex) as string;

	// First get the existing web resource to determine its type
	const existing = (await dataverseApiRequest.call(
		this,
		'GET',
		`/webresourceset(${webResourceId})`,
		undefined,
		{ $select: 'webresourcetype' },
		itemIndex,
	)) as { webresourcetype: number };

	const body: IDataObject = {
		content: encodeContent(content, existing.webresourcetype),
	};

	await dataverseApiRequest.call(
		this,
		'PATCH',
		`/webresourceset(${webResourceId})`,
		body,
		undefined,
		itemIndex,
	);

	return {
		json: {
			webresourceid: webResourceId,
			updated: true,
		},
		pairedItem: { item: itemIndex },
	};
}

/**
 * List web resources
 */
export async function listWebResources(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
	const typeFilter = this.getNodeParameter('webResourceTypeFilter', itemIndex, 0) as number;

	const qs: IDataObject = {
		$select: 'webresourceid,name,displayname,webresourcetype,description,createdon,modifiedon',
	};

	if (typeFilter > 0) {
		qs.$filter = `webresourcetype eq ${typeFilter}`;
	}

	if (!returnAll) {
		qs.$top = limit;
	}

	const response = (await dataverseApiRequest.call(
		this,
		'GET',
		'/webresourceset',
		undefined,
		qs,
		itemIndex,
	)) as { value: IDataObject[] };

	const results: INodeExecutionData[] = [];

	if (response.value && response.value.length > 0) {
		for (const item of response.value) {
			results.push({
				json: item,
				pairedItem: { item: itemIndex },
			});
		}
	}

	return results;
}

/**
 * Delete a web resource
 */
export async function deleteWebResource(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const webResourceId = this.getNodeParameter('webResourceId', itemIndex) as string;

	await dataverseApiRequest.call(
		this,
		'DELETE',
		`/webresourceset(${webResourceId})`,
		undefined,
		undefined,
		itemIndex,
	);

	return {
		json: {
			webresourceid: webResourceId,
			deleted: true,
		},
		pairedItem: { item: itemIndex },
	};
}
