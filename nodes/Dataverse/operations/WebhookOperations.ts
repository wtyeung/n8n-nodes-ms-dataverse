import type { IExecuteFunctions, IDataObject, INodeExecutionData, IHttpRequestOptions } from 'n8n-workflow';
import { dataverseApiRequest } from '../GenericFunctions';

/**
 * Get SDK Message Filter ID for a specific table and operation
 */
async function getSdkMessageFilterId(
	this: IExecuteFunctions,
	environmentUrl: string,
	table: string,
	operation: string,
): Promise<{ sdkmessagefilterid: string; sdkmessageid: string }> {
	const requestOptions: IHttpRequestOptions = {
		method: 'GET',
		url: `${environmentUrl}/api/data/v9.2/sdkmessagefilters`,
		headers: {
			'Content-Type': 'application/json',
			'OData-MaxVersion': '4.0',
			'OData-Version': '4.0',
		},
		qs: {
			$filter: `primaryobjecttypecode eq '${table}'`,
			$select: 'sdkmessagefilterid,primaryobjecttypecode',
			$expand: 'sdkmessageid($select=name,sdkmessageid)',
		},
		json: true,
	};

	// Resolve EntitySetName (plural) → LogicalName (singular) required by primaryobjecttypecode
	let logicalName = table;
	try {
		const entityMeta = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'dataverseOAuth2Api',
			{
				method: 'GET',
				url: `${environmentUrl}/api/data/v9.2/EntityDefinitions`,
				headers: { 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
				qs: { $select: 'LogicalName,EntitySetName', $filter: `EntitySetName eq '${table}'` },
				json: true,
			} as IHttpRequestOptions,
		)) as { value: Array<{ LogicalName: string }> };
		if (entityMeta.value?.length) {
			logicalName = entityMeta.value[0].LogicalName;
		}
	} catch {
		// fall back to raw table value
	}

	requestOptions.qs = {
		...requestOptions.qs as IDataObject,
		$filter: `primaryobjecttypecode eq '${logicalName}'`,
	};

	this.logger.debug(`[Dataverse] getSdkMessageFilterId REQUEST url=${requestOptions.url} table=${table} logicalName=${logicalName} filter=${(requestOptions.qs as IDataObject)?.$filter}`);

	let response: { value: Array<{ sdkmessagefilterid: string; sdkmessageid: { sdkmessageid: string; name: string } }> };
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'dataverseOAuth2Api',
			requestOptions,
		)) as typeof response;
		this.logger.debug(`[Dataverse] getSdkMessageFilterId RESPONSE count=${response.value?.length ?? 0} operations=[${response.value?.map((f) => f.sdkmessageid?.name).join(', ')}]`);
	} catch (err) {
		this.logger.debug(`[Dataverse] getSdkMessageFilterId ERROR message=${(err as Error).message}`);
		throw err;
	}

	if (!response.value || response.value.length === 0) {
		throw new Error(`No SDK message filter found for table: ${table}`);
	}

	const match = response.value.find((f) => f.sdkmessageid?.name === operation);
	if (!match) {
		throw new Error(`No SDK message filter found for table: ${table} and operation: ${operation}`);
	}

	this.logger.debug(`[Dataverse] SDK message filter found table=${table} operation=${operation} sdkmessagefilterid=${match.sdkmessagefilterid} sdkmessageid=${match.sdkmessageid.sdkmessageid}`);

	return {
		sdkmessagefilterid: match.sdkmessagefilterid,
		sdkmessageid: match.sdkmessageid.sdkmessageid,
	};
}

/**
 * Register a new webhook endpoint (ServiceEndpoint)
 * This creates a reusable webhook URL that can be associated with multiple tables/messages
 */
export async function registerEndpoint(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const endpointName = this.getNodeParameter('endpointName', itemIndex) as string;
	const webhookUrl = this.getNodeParameter('webhookUrl', itemIndex) as string;
	const authHeader = this.getNodeParameter('authHeader', itemIndex, '') as string;
	const description = this.getNodeParameter('endpointDescription', itemIndex, '') as string;

	// Create ServiceEndpoint
	const serviceEndpointBody: IDataObject = {
		name: endpointName,
		description: description || `Webhook endpoint: ${endpointName}`,
		contract: 8, // Webhook contract
		messageformat: 2, // JSON format
		url: webhookUrl,
		authtype: authHeader ? 4 : 0, // 4 = Custom header auth, 0 = None
	};

	if (authHeader) {
		serviceEndpointBody.authvalue = authHeader;
	}

	// Get environment URL from credentials
	const credentials = await this.getCredentials('dataverseOAuth2Api');
	const environmentUrl = (credentials.environmentUrl as string).replace(/\/$/, '');

	const requestOptions: IHttpRequestOptions = {
		method: 'POST',
		url: `${environmentUrl}/api/data/v9.2/serviceendpoints`,
		headers: {
			'Content-Type': 'application/json',
			'OData-MaxVersion': '4.0',
			'OData-Version': '4.0',
		},
		body: serviceEndpointBody,
		json: true,
		returnFullResponse: true,
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'dataverseOAuth2Api',
		requestOptions,
	)) as any;

	// Extract serviceendpointid from OData-EntityId response header
	// e.g. https://org.crm.dynamics.com/api/data/v9.2/serviceendpoints(xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
	const responseHeaders = response.headers as Record<string, string>;
	const entityIdHeader = responseHeaders['odata-entityid'] || responseHeaders['OData-EntityId'] || '';
	const serviceEndpointId = entityIdHeader.match(/\(([a-f0-9-]{36})\)/i)?.[1] || '';

	if (!serviceEndpointId) {
		throw new Error('Failed to create service endpoint - no ID returned in odata-entityid header');
	}

	return {
		json: {
			serviceendpointid: serviceEndpointId,
			name: endpointName,
			url: webhookUrl,
			authtype: authHeader ? 4 : 0,
			success: true,
		},
		pairedItem: { item: itemIndex },
	};
}

/**
 * Register a webhook step to link an endpoint with a table/message (create SDK Message Processing Step)
 */
export async function registerWebhookStep(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const table = this.getNodeParameter('table', itemIndex, '', { extractValue: true }) as string;
	const serviceEndpointId = this.getNodeParameter('serviceEndpointId', itemIndex) as string;
	const operation = this.getNodeParameter('webhookOperation', itemIndex) as string;
	const stepName = this.getNodeParameter('stepName', itemIndex, '') as string;
	const filteringAttributes = this.getNodeParameter('filteringAttributes', itemIndex, '') as string;

	// Get environment URL from credentials
	const credentials = await this.getCredentials('dataverseOAuth2Api');
	const environmentUrl = (credentials.environmentUrl as string).replace(/\/$/, '');

	this.logger.debug(`[Dataverse] registerWebhookStep: looking up SDK message filter table=${table} operation=${operation} serviceEndpointId=${serviceEndpointId}`);

	// Get SDK Message Filter ID using $expand to retrieve sdkmessageid GUID
	const { sdkmessagefilterid, sdkmessageid } = await getSdkMessageFilterId.call(this, environmentUrl, table, operation);

	this.logger.debug(`[Dataverse] registerWebhookStep: filter resolved sdkmessagefilterid=${sdkmessagefilterid} sdkmessageid=${sdkmessageid}`);

	// Create SDK Message Processing Step
	const stepBody: IDataObject = {
		name: stepName || `${table} ${operation} Webhook`,
		mode: 1, // Async mode
		rank: 1,
		stage: 40, // Post-operation
		supporteddeployment: 0, // Server only
		asyncautodelete: true,
		'eventhandler_serviceendpoint@odata.bind': `/serviceendpoints(${serviceEndpointId})`,
		'sdkmessageid@odata.bind': `/sdkmessages(${sdkmessageid})`,
		'sdkmessagefilterid@odata.bind': `/sdkmessagefilters(${sdkmessagefilterid})`,
	};

	if (filteringAttributes) {
		stepBody.filteringattributes = filteringAttributes;
	}

	const stepRequestOptions: IHttpRequestOptions = {
		method: 'POST',
		url: `${environmentUrl}/api/data/v9.2/sdkmessageprocessingsteps`,
		headers: {
			'Content-Type': 'application/json',
			'OData-MaxVersion': '4.0',
			'OData-Version': '4.0',
		},
		body: stepBody,
		json: true,
		returnFullResponse: true,
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const stepResponse = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'dataverseOAuth2Api',
		stepRequestOptions,
	)) as any;

	// Extract step ID from OData-EntityId response header
	const stepHeaders = stepResponse.headers as Record<string, string>;
	const stepEntityIdHeader = stepHeaders['odata-entityid'] || stepHeaders['OData-EntityId'] || '';
	const stepId = stepEntityIdHeader.match(/\(([a-f0-9-]{36})\)/i)?.[1] || '';

	this.logger.debug(`[Dataverse] registerWebhookStep: step created sdkmessageprocessingstepid=${stepId} serviceendpointid=${serviceEndpointId} sdkmessagefilterid=${sdkmessagefilterid} sdkmessageid=${sdkmessageid} table=${table} operation=${operation}`);

	return {
		json: {
			sdkmessageprocessingstepid: stepId,
			serviceendpointid: serviceEndpointId,
			sdkmessagefilterid,
			sdkmessageid,
			table,
			operation,
			success: true,
		},
		pairedItem: { item: itemIndex },
	};
}

/**
 * List all registered webhook endpoints (ServiceEndpoints)
 */
export async function listEndpoints(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;

	const qs: IDataObject = {
		$select: 'serviceendpointid,name,description,url,authtype,createdon,modifiedon',
		$filter: 'contract eq 8', // Filter to webhooks only (contract type 8)
	};

	if (!returnAll) {
		qs.$top = limit;
	}

	const response = (await dataverseApiRequest.call(
		this,
		'GET',
		'/serviceendpoints',
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
 * Delete a webhook endpoint and all its associated steps
 */
export async function deleteEndpoint(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const serviceEndpointId = this.getNodeParameter('serviceEndpointId', itemIndex) as string;

	// First, delete any associated SDK Message Processing Steps
	// Query for steps that use this service endpoint
	const stepsQs: IDataObject = {
		$select: 'sdkmessageprocessingstepid',
		$filter: `eventhandler_serviceendpoint/serviceendpointid eq ${serviceEndpointId}`,
	};

	const stepsResponse = (await dataverseApiRequest.call(
		this,
		'GET',
		'/sdkmessageprocessingsteps',
		undefined,
		stepsQs,
		itemIndex,
	)) as { value: Array<{ sdkmessageprocessingstepid: string }> };

	// Delete each step
	if (stepsResponse.value && stepsResponse.value.length > 0) {
		for (const step of stepsResponse.value) {
			await dataverseApiRequest.call(
				this,
				'DELETE',
				`/sdkmessageprocessingsteps(${step.sdkmessageprocessingstepid})`,
				undefined,
				undefined,
				itemIndex,
			);
		}
	}

	// Delete the service endpoint
	await dataverseApiRequest.call(
		this,
		'DELETE',
		`/serviceendpoints(${serviceEndpointId})`,
		undefined,
		undefined,
		itemIndex,
	);

	return {
		json: {
			serviceendpointid: serviceEndpointId,
			deleted: true,
			stepsDeleted: stepsResponse.value?.length || 0,
		},
		pairedItem: { item: itemIndex },
	};
}

/**
 * List SDK Message Filters for a table
 */
export async function listSdkMessageFilters(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const table = this.getNodeParameter('table', itemIndex, '', { extractValue: true }) as string;

	const qs: IDataObject = {
		$filter: `primaryobjecttypecode eq '${table}'`,
		$select: 'sdkmessagefilterid,primaryobjecttypecode',
		$expand: 'sdkmessageid($select=name)',
	};

	const response = (await dataverseApiRequest.call(
		this,
		'GET',
		'/sdkmessagefilters',
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
 * List SDK Message Processing Steps for an endpoint
 */
export async function listEndpointSteps(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const serviceEndpointId = this.getNodeParameter('serviceEndpointId', itemIndex) as string;
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;

	const qs: IDataObject = {
		$select: 'sdkmessageprocessingstepid,name,mode,rank,stage,asyncautodelete',
		$expand: 'sdkmessageid($select=name),sdkmessagefilterid($select=primaryobjecttypecode)',
		$filter: `eventhandler_serviceendpoint/serviceendpointid eq ${serviceEndpointId}`,
	};

	if (!returnAll) {
		qs.$top = limit;
	}

	const response = (await dataverseApiRequest.call(
		this,
		'GET',
		'/sdkmessageprocessingsteps',
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
 * Delete a specific SDK Message Processing Step
 */
export async function deleteStep(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const stepId = this.getNodeParameter('stepId', itemIndex) as string;

	await dataverseApiRequest.call(
		this,
		'DELETE',
		`/sdkmessageprocessingsteps(${stepId})`,
		undefined,
		undefined,
		itemIndex,
	);

	return {
		json: {
			sdkmessageprocessingstepid: stepId,
			deleted: true,
		},
		pairedItem: { item: itemIndex },
	};
}
