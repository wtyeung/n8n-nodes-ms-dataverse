import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { dataverseApiRequest } from '../GenericFunctions';

/**
 * Upload a plugin assembly (DLL) to Dataverse
 */
export async function uploadPluginAssembly(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const assemblyName = this.getNodeParameter('assemblyName', itemIndex) as string;
	const dllFile = this.getNodeParameter('dllFile', itemIndex) as string;
	const sourceType = this.getNodeParameter('sourceType', itemIndex) as number;
	const isolationMode = this.getNodeParameter('isolationMode', itemIndex) as number;

	const body: IDataObject = {
		name: assemblyName,
		content: dllFile,
		sourcetype: sourceType,
		isolationmode: isolationMode,
		version: '1.0.0.0', // Default version
	};

	const response = await dataverseApiRequest.call(
		this,
		'POST',
		'/pluginassemblies',
		body,
		undefined,
		itemIndex,
	);

	const assemblyId = (response as unknown as { pluginassemblyid: string }).pluginassemblyid;

	return {
		json: {
			pluginassemblyid: assemblyId,
			name: assemblyName,
			success: true,
		},
		pairedItem: { item: itemIndex },
	};
}

/**
 * Register a plugin step for a table/operation
 */
export async function registerPluginStep(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const table = this.getNodeParameter('table', itemIndex, '', { extractValue: true }) as string;
	const pluginAssemblyId = this.getNodeParameter('pluginAssemblyId', itemIndex) as string;
	const pluginTypeName = this.getNodeParameter('pluginTypeName', itemIndex) as string;
	const stepName = this.getNodeParameter('stepName', itemIndex) as string;
	const eventOperation = this.getNodeParameter('eventOperation', itemIndex) as number;
	const stage = this.getNodeParameter('stage', itemIndex) as number;
	const filteringAttributes = this.getNodeParameter('filteringAttributes', itemIndex, '') as string;

	// Map event operation number to SDK message name
	const eventOperationNames: Record<number, string> = {
		1: 'Create',
		2: 'Update',
		3: 'Delete',
	};
	const operationName = eventOperationNames[eventOperation];
	if (!operationName) {
		throw new Error(`Unsupported event operation: ${eventOperation}`);
	}

	// Query SDK message filters for the table, matching the operation name
	const filterQs: IDataObject = {
		$filter: `primaryobjecttypecode eq '${table}'`,
		$select: 'sdkmessagefilterid',
		$expand: 'sdkmessageid($select=name,sdkmessageid)',
	};

	const filterResponse = (await dataverseApiRequest.call(
		this,
		'GET',
		'/sdkmessagefilters',
		undefined,
		filterQs,
		itemIndex,
	)) as { value: Array<{ sdkmessagefilterid: string; sdkmessageid: { name: string; sdkmessageid: string } }> };

	if (!filterResponse.value || filterResponse.value.length === 0) {
		throw new Error(`No SDK message filter found for table: ${table}`);
	}

	// Find the filter matching the operation
	const matchingFilter = filterResponse.value.find(
		(item) => item.sdkmessageid.name === operationName,
	);

	if (!matchingFilter) {
		throw new Error(`No SDK message filter found for table: ${table} and operation: ${operationName}`);
	}

	const sdkMessageFilterId = matchingFilter.sdkmessagefilterid;
	const sdkMessageId = matchingFilter.sdkmessageid.sdkmessageid;

	// Get the plugin type from the assembly
	const typeQs: IDataObject = {
		$filter: `_pluginassemblyid_value eq ${pluginAssemblyId} and name eq '${pluginTypeName}'`,
		$select: 'plugintypeid',
	};

	const typeResponse = (await dataverseApiRequest.call(
		this,
		'GET',
		'/plugintypes',
		undefined,
		typeQs,
		itemIndex,
	)) as { value: Array<{ plugintypeid: string }> };

	if (!typeResponse.value || typeResponse.value.length === 0) {
		throw new Error(`Plugin type '${pluginTypeName}' not found in assembly ${pluginAssemblyId}`);
	}

	const pluginTypeId = typeResponse.value[0].plugintypeid;

	// Create the SDK message processing step
	const stepBody: IDataObject = {
		name: stepName,
		mode: 0, // Synchronous
		rank: 1,
		stage,
		supporteddeployment: 0, // Server only
		'eventhandler_plugintype@odata.bind': `/plugintypes(${pluginTypeId})`,
		'sdkmessageid@odata.bind': `/sdkmessages(${sdkMessageId})`,
		'sdkmessagefilterid@odata.bind': `/sdkmessagefilters(${sdkMessageFilterId})`,
	};

	// Add filtering attributes if specified (for Update operations)
	if (filteringAttributes) {
		stepBody.filteringattributes = filteringAttributes;
	}

	const stepResponse = await dataverseApiRequest.call(
		this,
		'POST',
		'/sdkmessageprocessingsteps',
		stepBody,
		undefined,
		itemIndex,
	);

	return {
		json: {
			pluginassemblyid: pluginAssemblyId,
			plugintypeid: pluginTypeId,
			sdkmessagefilterid: sdkMessageFilterId,
			sdkmessageid: sdkMessageId,
			table,
			operation: operationName,
			step: stepResponse,
			success: true,
		},
		pairedItem: { item: itemIndex },
	};
}

/**
 * List all plugin assemblies
 */
export async function listPluginAssemblies(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;

	const qs: IDataObject = {
		$select: 'pluginassemblyid,name,version,createdon,modifiedon,isolationmode,sourcetype',
	};

	if (!returnAll) {
		qs.$top = limit;
	}

	const response = (await dataverseApiRequest.call(
		this,
		'GET',
		'/pluginassemblies',
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
 * Delete a plugin assembly
 */
export async function deletePluginAssembly(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const assemblyId = this.getNodeParameter('assemblyId', itemIndex) as string;

	await dataverseApiRequest.call(
		this,
		'DELETE',
		`/pluginassemblies(${assemblyId})`,
		undefined,
		undefined,
		itemIndex,
	);

	return {
		json: {
			pluginassemblyid: assemblyId,
			deleted: true,
		},
		pairedItem: { item: itemIndex },
	};
}
