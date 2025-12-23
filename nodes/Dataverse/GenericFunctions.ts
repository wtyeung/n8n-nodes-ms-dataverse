import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodePropertyOptions,
	INodeListSearchResult,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { DataverseEntity, DataverseApiResponse } from './types';

/**
 * Make an authenticated API request to Dataverse
 */
export async function dataverseApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
	itemIndex?: number,
): Promise<IDataObject> {
	// Check if using custom authentication from options
	let useCustomAuth = false;
	let accessTokenOverride = '';
	let environmentUrl = '';

	if (itemIndex !== undefined && this.getNodeParameter) {
		const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
		useCustomAuth = options.useCustomAuth as boolean || false;
		accessTokenOverride = options.accessToken as string || '';
	}

	// Get environment URL from credentials
	const credentialType = 'dataverseOAuth2Api';
	try {
		const credentials = await this.getCredentials('dataverseOAuth2Api');
		environmentUrl = credentials.environmentUrl as string;
	} catch {
		if (!useCustomAuth) {
			throw new NodeOperationError(
				this.getNode(),
				'OAuth2 credentials are required when not using custom authentication.',
			);
		}
		throw new NodeOperationError(
			this.getNode(),
			'Environment URL is required. Please configure OAuth2 credentials to provide the environment URL.',
		);
	}

	const options: IHttpRequestOptions = {
		method,
		url: `${environmentUrl}/api/data/v9.2${endpoint}`,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		qs,
		body,
		json: true,
	};

	// If access token override is provided, use it instead of OAuth2
	if (accessTokenOverride) {
		options.headers!.Authorization = `Bearer ${accessTokenOverride}`;
	}

	if (method === 'POST' || method === 'PATCH') {
		options.headers!.Prefer = 'return=representation';
	}

	try {
		// Use direct HTTP request if custom auth is enabled, otherwise use OAuth2
		if (useCustomAuth && accessTokenOverride) {
			return await this.helpers.httpRequest(options);
		} else {
			return await this.helpers.httpRequestWithAuthentication.call(
				this,
				credentialType,
				options,
			);
		}
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error);
	}
}

/**
 * Search and load available tables from Dataverse
 */
export async function searchTables(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const returnData: INodePropertyOptions[] = [];

	try {
		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			'/EntityDefinitions',
			undefined,
			{
				$select: 'LogicalName,EntitySetName,DisplayName',
				$filter: 'IsValidForAdvancedFind eq true',
			},
		)) as DataverseApiResponse;

		const entities = (response.value || []) as unknown as DataverseEntity[];

		for (const entity of entities) {
			const name = entity.DisplayName?.UserLocalizedLabel?.Label || entity.LogicalName;
			const value = entity.EntitySetName || entity.LogicalName;

			if (filter) {
				if (
					name.toLowerCase().includes(filter.toLowerCase()) ||
					value.toLowerCase().includes(filter.toLowerCase())
				) {
					returnData.push({ name, value });
				}
			} else {
				returnData.push({ name, value });
			}
		}

		returnData.sort((a, b) => {
			if (a.name < b.name) return -1;
			if (a.name > b.name) return 1;
			return 0;
		});

		return { results: returnData };
	} catch (error) {
		throw new NodeOperationError(this.getNode(), `Failed to load tables: ${error.message}`);
	}
}

/**
 * Build record identifier for API calls (ID or alternate keys)
 */
export function buildRecordIdentifier(
	recordIdType: string,
	recordId?: string,
	alternateKeys?: Array<{ name: string; value: string }>,
): string {
	if (recordIdType === 'id' && recordId) {
		return recordId;
	}

	if (recordIdType === 'alternateKey' && alternateKeys) {
		const keyPairs = alternateKeys.map((key) => `${key.name}='${key.value}'`);
		return keyPairs.join(',');
	}

	throw new Error('Invalid record identifier configuration');
}

/**
 * Convert field array to object for API requests
 */
export function fieldsToObject(fields: Array<{ name: string; value: string }>): IDataObject {
	const body: IDataObject = {};
	for (const field of fields) {
		body[field.name] = field.value;
	}
	return body;
}

/**
 * Build OData query string parameters
 */
export function buildODataQuery(
	filter?: string,
	orderBy?: string,
	selectFields?: string,
	limit?: number,
): IDataObject {
	const qs: IDataObject = {};

	if (filter) {
		qs.$filter = filter;
	}
	if (orderBy) {
		qs.$orderby = orderBy;
	}
	if (selectFields) {
		qs.$select = selectFields;
	}
	if (limit) {
		qs.$top = limit;
	}

	return qs;
}
