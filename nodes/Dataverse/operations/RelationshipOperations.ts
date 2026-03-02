import type { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { dataverseApiRequest } from '../GenericFunctions';

/**
 * Associate two records in a many-to-many relationship
 */
export async function associateRecords(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const primaryTable = this.getNodeParameter('primaryTable', itemIndex, '', { extractValue: true }) as string;
	const primaryRecordId = this.getNodeParameter('primaryRecordId', itemIndex) as string;
	const relationshipName = this.getNodeParameter('relationshipName', itemIndex) as string;
	const relatedTable = this.getNodeParameter('relatedTable', itemIndex, '', { extractValue: true }) as string;
	const relatedRecordId = this.getNodeParameter('relatedRecordId', itemIndex) as string;

	// Build the request body for Associate
	const body = {
		'@odata.id': `${relatedTable}(${relatedRecordId})`,
	};

	// Execute Associate request
	// POST /{primaryTable}({primaryRecordId})/{relationshipName}/$ref
	await dataverseApiRequest.call(
		this,
		'POST',
		`/${primaryTable}(${primaryRecordId})/${relationshipName}/$ref`,
		body,
		undefined,
		itemIndex,
	);

	return {
		success: true,
		primaryTable,
		primaryRecordId,
		relatedTable,
		relatedRecordId,
		relationshipName,
		action: 'associated',
	};
}

/**
 * Disassociate two records in a many-to-many relationship
 */
export async function disassociateRecords(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const primaryTable = this.getNodeParameter('primaryTable', itemIndex, '', { extractValue: true }) as string;
	const primaryRecordId = this.getNodeParameter('primaryRecordId', itemIndex) as string;
	const relationshipName = this.getNodeParameter('relationshipName', itemIndex) as string;
	const relatedTable = this.getNodeParameter('relatedTable', itemIndex, '', { extractValue: true }) as string;
	const relatedRecordId = this.getNodeParameter('relatedRecordId', itemIndex) as string;

	// Execute Disassociate request
	// DELETE /{primaryTable}({primaryRecordId})/{relationshipName}({relatedRecordId})/$ref
	await dataverseApiRequest.call(
		this,
		'DELETE',
		`/${primaryTable}(${primaryRecordId})/${relationshipName}(${relatedRecordId})/$ref`,
		undefined,
		undefined,
		itemIndex,
	);

	return {
		success: true,
		primaryTable,
		primaryRecordId,
		relatedTable,
		relatedRecordId,
		relationshipName,
		action: 'disassociated',
	};
}
