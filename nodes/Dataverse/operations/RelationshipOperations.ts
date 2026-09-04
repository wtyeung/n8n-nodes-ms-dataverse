import type { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { dataverseApiRequest, buildRecordIdentifierAsync } from '../GenericFunctions';

/**
 * Associate two records in a many-to-many relationship
 */
export async function associateRecords(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const primaryTable = this.getNodeParameter('primaryTable', itemIndex, '', { extractValue: true }) as string;
	const primaryRecordIdType = this.getNodeParameter('primaryRecordIdType', itemIndex) as string;
	const relationshipName = this.getNodeParameter('relationshipName', itemIndex) as string;
	const relatedTable = this.getNodeParameter('relatedTable', itemIndex, '', { extractValue: true }) as string;
	const relatedRecordIdType = this.getNodeParameter('relatedRecordIdType', itemIndex) as string;

	// Get primary record identifier
	let primaryRecordIdentifier: string;
	if (primaryRecordIdType === 'id') {
		const primaryRecordId = this.getNodeParameter('primaryRecordId', itemIndex) as string;
		primaryRecordIdentifier = primaryRecordId;
	} else {
		const primaryAlternateKeys = this.getNodeParameter('primaryAlternateKeys.key', itemIndex, []) as Array<{ name: string; value: string }>;
		primaryRecordIdentifier = await buildRecordIdentifierAsync.call(this, primaryTable, 'alternateKey', undefined, primaryAlternateKeys, itemIndex);
	}

	// Get related record identifier
	let relatedRecordIdentifier: string;
	if (relatedRecordIdType === 'id') {
		const relatedRecordId = this.getNodeParameter('relatedRecordId', itemIndex) as string;
		relatedRecordIdentifier = relatedRecordId;
	} else {
		const relatedAlternateKeys = this.getNodeParameter('relatedAlternateKeys.key', itemIndex, []) as Array<{ name: string; value: string }>;
		relatedRecordIdentifier = await buildRecordIdentifierAsync.call(this, relatedTable, 'alternateKey', undefined, relatedAlternateKeys, itemIndex);
	}

	// Build the request body for Associate
	const body = {
		'@odata.id': `${relatedTable}(${relatedRecordIdentifier})`,
	};

	// Execute Associate request
	// POST /{primaryTable}({primaryRecordIdentifier})/{relationshipName}/$ref
	await dataverseApiRequest.call(
		this,
		'POST',
		`/${primaryTable}(${primaryRecordIdentifier})/${relationshipName}/$ref`,
		body,
		undefined,
		itemIndex,
	);

	return {
		success: true,
		primaryTable,
		primaryRecordIdentifier,
		relatedTable,
		relatedRecordIdentifier,
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
	const primaryRecordIdType = this.getNodeParameter('primaryRecordIdType', itemIndex) as string;
	const relationshipName = this.getNodeParameter('relationshipName', itemIndex) as string;
	const relatedTable = this.getNodeParameter('relatedTable', itemIndex, '', { extractValue: true }) as string;
	const relatedRecordIdType = this.getNodeParameter('relatedRecordIdType', itemIndex) as string;

	// Get primary record identifier
	let primaryRecordIdentifier: string;
	if (primaryRecordIdType === 'id') {
		const primaryRecordId = this.getNodeParameter('primaryRecordId', itemIndex) as string;
		primaryRecordIdentifier = primaryRecordId;
	} else {
		const primaryAlternateKeys = this.getNodeParameter('primaryAlternateKeys.key', itemIndex, []) as Array<{ name: string; value: string }>;
		primaryRecordIdentifier = await buildRecordIdentifierAsync.call(this, primaryTable, 'alternateKey', undefined, primaryAlternateKeys, itemIndex);
	}

	// Get related record identifier
	let relatedRecordIdentifier: string;
	if (relatedRecordIdType === 'id') {
		const relatedRecordId = this.getNodeParameter('relatedRecordId', itemIndex) as string;
		relatedRecordIdentifier = relatedRecordId;
	} else {
		const relatedAlternateKeys = this.getNodeParameter('relatedAlternateKeys.key', itemIndex, []) as Array<{ name: string; value: string }>;
		relatedRecordIdentifier = await buildRecordIdentifierAsync.call(this, relatedTable, 'alternateKey', undefined, relatedAlternateKeys, itemIndex);
	}

	// Execute Disassociate request
	// DELETE /{primaryTable}({primaryRecordIdentifier})/{relationshipName}({relatedRecordIdentifier})/$ref
	await dataverseApiRequest.call(
		this,
		'DELETE',
		`/${primaryTable}(${primaryRecordIdentifier})/${relationshipName}(${relatedRecordIdentifier})/$ref`,
		undefined,
		undefined,
		itemIndex,
	);

	return {
		success: true,
		primaryTable,
		primaryRecordIdentifier,
		relatedTable,
		relatedRecordIdentifier,
		relationshipName,
		action: 'disassociated',
	};
}
