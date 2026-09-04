import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { DataverseEntity, DataverseApiResponse } from './types';

/**
 * Extract the real Dataverse/OData error message, code, and HTTP status from a thrown error.
 *
 * n8n's `httpRequestWithAuthentication` wraps API errors in a `NodeApiError` whose top-level
 * `message` is a generic, canned string based only on the HTTP status code (e.g. "Bad request -
 * please check your parameters" for ANY 400 response). The actual error returned by the
 * Dataverse Web API is preserved separately (typically on `.description`, `.context.data`, or
 * nested inside `.cause`/`.response`), so we need to look there first to avoid surfacing a
 * useless generic message to the user.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDataverseErrorDetails(errorObj: any): {
	errorMessage: string;
	errorCode: string;
	httpStatus: string;
} {
	let errorMessage = 'Unknown error';
	let errorCode = '';
	let httpStatus = '';

	// Check for a Dataverse OData error object in the various places it can end up
	let dataverseError = null;
	if (errorObj?.cause?.response?.body?.error) {
		dataverseError = errorObj.cause.response.body.error;
	} else if (errorObj?.response?.data?.error) {
		dataverseError = errorObj.response.data.error;
	} else if (errorObj?.context?.data?.error) {
		dataverseError = errorObj.context.data.error;
	} else if (errorObj?.cause?.error) {
		dataverseError = errorObj.cause.error;
	} else if (errorObj?.error) {
		dataverseError = errorObj.error;
	}

	if (dataverseError?.message) {
		errorMessage = dataverseError.message;
		if (dataverseError.code) {
			errorCode = dataverseError.code;
		}
	} else if (errorObj?.description && typeof errorObj.description === 'string') {
		// n8n's NodeApiError stores the real API error message here, while `.message` is
		// replaced with a generic status-code message (e.g. "Bad request - please check your
		// parameters"). Prefer this over the generic message.
		errorMessage = errorObj.description;
	} else if (Array.isArray(errorObj?.messages) && errorObj.messages.length > 0) {
		// NodeApiError also preserves the original pre-generic-overwrite message(s) here.
		errorMessage = errorObj.messages.join(' | ');
	} else if (errorObj instanceof Error) {
		errorMessage = errorObj.message;
	}

	// Get HTTP status code
	if (errorObj?.httpCode) {
		httpStatus = errorObj.httpCode;
	} else if (errorObj?.cause?.response?.statusCode) {
		httpStatus = errorObj.cause.response.statusCode;
	} else if (errorObj?.response?.status) {
		httpStatus = errorObj.response.status;
	} else if (errorObj?.statusCode) {
		httpStatus = errorObj.statusCode;
	}

	return { errorMessage, errorCode, httpStatus };
}

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
	let customEnvironmentUrl = '';
	let environmentUrl = '';

	// For ILoadOptionsFunctions, use index 0, for IExecuteFunctions use the provided itemIndex
	const paramIndex = itemIndex !== undefined ? itemIndex : 0;
	
	try {
		const options = this.getNodeParameter('options', paramIndex, {}) as IDataObject;
		useCustomAuth = options.useCustomAuth as boolean || false;
		accessTokenOverride = options.accessToken as string || '';
		customEnvironmentUrl = options.customEnvironmentUrl as string || '';
	} catch {
		// Options parameter might not exist yet, continue with default values
	}

	// Get environment URL - use custom if provided, otherwise from credentials
	if (useCustomAuth) {
		if (!customEnvironmentUrl) {
			throw new NodeOperationError(
				this.getNode(),
				'Environment URL is required when using custom authentication. Please add it in the Options.',
			);
		}
		if (!accessTokenOverride) {
			throw new NodeOperationError(
				this.getNode(),
				'Access Token is required when using custom authentication. Please add it in the Options.',
			);
		}
		environmentUrl = customEnvironmentUrl;
	} else {
		// Try to get credentials, but don't fail if custom auth might be used
		try {
			const credentials = await this.getCredentials('dataverseOAuth2Api');
			environmentUrl = credentials.environmentUrl as string;
		} catch {
			// If we can't get credentials and custom auth is not enabled, throw error
			throw new NodeOperationError(
				this.getNode(),
				'OAuth2 credentials are required. Please configure Dataverse OAuth2 API credentials.',
			);
		}
	}

	// Remove trailing slash from environment URL if present
	const cleanEnvironmentUrl = environmentUrl.replace(/\/$/, '');
	
	const options: IHttpRequestOptions = {
		method,
		url: `${cleanEnvironmentUrl}/api/data/v9.2${endpoint}`,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'OData-MaxVersion': '4.0',
			'OData-Version': '4.0',
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
				'dataverseOAuth2Api',
				options,
			);
		}
	} catch (error) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const errorObj = error as any;

		const { errorMessage, errorCode, httpStatus } = extractDataverseErrorDetails(errorObj);

		// Build comprehensive error message
		let fullErrorMessage = `Dataverse API request failed: ${errorMessage}`;
		if (httpStatus) {
			fullErrorMessage += ` (HTTP ${httpStatus})`;
		}
		if (errorCode) {
			fullErrorMessage += ` [Error Code: ${errorCode}]`;
		}
		fullErrorMessage += `\nURL: ${options.url}`;

		throw new NodeOperationError(this.getNode(), fullErrorMessage);
	}
}

/**
 * Make an authenticated API request to Dataverse, returning full response including headers
 * Used for POST operations where the entity ID is in the odata-entityid response header
 */
export async function dataverseApiRequestFull(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	itemIndex?: number,
): Promise<{ body: IDataObject; headers: Record<string, string> }> {
	let useCustomAuth = false;
	let accessTokenOverride = '';
	let customEnvironmentUrl = '';
	let environmentUrl = '';

	const paramIndex = itemIndex !== undefined ? itemIndex : 0;

	try {
		const opts = this.getNodeParameter('options', paramIndex, {}) as IDataObject;
		useCustomAuth = opts.useCustomAuth as boolean || false;
		accessTokenOverride = opts.accessToken as string || '';
		customEnvironmentUrl = opts.customEnvironmentUrl as string || '';
	} catch {
		// ignore
	}

	if (useCustomAuth) {
		environmentUrl = customEnvironmentUrl;
	} else {
		try {
			const credentials = await this.getCredentials('dataverseOAuth2Api');
			environmentUrl = credentials.environmentUrl as string;
		} catch {
			throw new NodeOperationError(this.getNode(), 'OAuth2 credentials are required.');
		}
	}

	const cleanEnvironmentUrl = environmentUrl.replace(/\/$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${cleanEnvironmentUrl}/api/data/v9.2${endpoint}`,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'OData-MaxVersion': '4.0',
			'OData-Version': '4.0',
		},
		body,
		json: true,
		returnFullResponse: true,
	};

	if (accessTokenOverride) {
		options.headers!.Authorization = `Bearer ${accessTokenOverride}`;
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let response: any;
		if (useCustomAuth && accessTokenOverride) {
			response = await this.helpers.httpRequest(options);
		} else {
			response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				'dataverseOAuth2Api',
				options,
			);
		}
		return { body: response.body as IDataObject, headers: response.headers as Record<string, string> };
	} catch (error) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const errorObj = error as any;
		const { errorMessage, errorCode, httpStatus } = extractDataverseErrorDetails(errorObj);

		let fullErrorMessage = `Dataverse API request failed: ${errorMessage}`;
		if (httpStatus) {
			fullErrorMessage += ` (HTTP ${httpStatus})`;
		}
		if (errorCode) {
			fullErrorMessage += ` [Error Code: ${errorCode}]`;
		}
		fullErrorMessage += `\nURL: ${options.url}`;

		throw new NodeOperationError(this.getNode(), fullErrorMessage);
	}
}

/**
 * Download binary data (like images) from Dataverse
 */
export async function dataverseApiBinaryRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	endpoint: string,
	itemIndex?: number,
): Promise<Buffer> {
	// Check if using custom authentication from options
	let useCustomAuth = false;
	let accessTokenOverride = '';
	let customEnvironmentUrl = '';
	let environmentUrl = '';

	// For ILoadOptionsFunctions, use index 0, for IExecuteFunctions use the provided itemIndex
	const paramIndex = itemIndex !== undefined ? itemIndex : 0;
	
	try {
		const options = this.getNodeParameter('options', paramIndex, {}) as IDataObject;
		useCustomAuth = options.useCustomAuth as boolean || false;
		accessTokenOverride = options.accessToken as string || '';
		customEnvironmentUrl = options.customEnvironmentUrl as string || '';
	} catch {
		// Options parameter might not exist yet, continue with default values
	}

	// Get environment URL - use custom if provided, otherwise from credentials
	if (useCustomAuth) {
		if (!customEnvironmentUrl) {
			throw new NodeOperationError(
				this.getNode(),
				'Environment URL is required when using custom authentication. Please add it in the Options.',
			);
		}
		if (!accessTokenOverride) {
			throw new NodeOperationError(
				this.getNode(),
				'Access Token is required when using custom authentication. Please add it in the Options.',
			);
		}
		environmentUrl = customEnvironmentUrl;
	} else {
		// Try to get credentials
		try {
			const credentials = await this.getCredentials('dataverseOAuth2Api');
			environmentUrl = credentials.environmentUrl as string;
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				'OAuth2 credentials are required. Please configure Dataverse OAuth2 API credentials.',
			);
		}
	}

	// Remove trailing slash from environment URL if present
	const cleanEnvironmentUrl = environmentUrl.replace(/\/$/, '');
	
	// Check if endpoint already includes /api/data/v9.2 or is a different endpoint (like /Image/download.aspx)
	const fullUrl = endpoint.startsWith('/api/') || endpoint.startsWith('/Image/') 
		? `${cleanEnvironmentUrl}${endpoint}`
		: `${cleanEnvironmentUrl}/api/data/v9.2${endpoint}`;
	
	// Use axios directly for binary data to avoid any string conversion
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const axios = require('axios');
	
	const axiosConfig: {
		method: string;
		url: string;
		headers: Record<string, string>;
		responseType: string;
	} = {
		method: method.toLowerCase(),
		url: fullUrl,
		headers: {
			Accept: 'image/jpeg, image/png, image/*',
		},
		responseType: 'arraybuffer', // Critical: get response as ArrayBuffer
	};

	// Add authentication
	if (useCustomAuth && accessTokenOverride) {
		axiosConfig.headers.Authorization = `Bearer ${accessTokenOverride}`;
	} else {
		// Get OAuth2 token
		const credentials = await this.getCredentials('dataverseOAuth2Api') as IDataObject;
		const oauthData = credentials.oauthTokenData as IDataObject;
		const token = oauthData?.access_token as string;
		if (token) {
			axiosConfig.headers.Authorization = `Bearer ${token}`;
		}
	}

	try {
		const response = await axios(axiosConfig);
		// Convert ArrayBuffer to Buffer
		return Buffer.from(response.data);
	} catch (error) {
		// Add more context to the error
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new NodeOperationError(
			this.getNode(),
			`Dataverse binary request failed: ${errorMessage}. URL: ${fullUrl}`,
		);
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
			const displayName = entity.DisplayName?.UserLocalizedLabel?.Label || entity.LogicalName;
			const logicalName = entity.LogicalName;
			// Use EntitySetName for record operations (plural form needed for API)
			const value = entity.EntitySetName || entity.LogicalName;
			const name = `${displayName} (${logicalName})`;

			if (filter) {
				if (
					name.toLowerCase().includes(filter.toLowerCase()) ||
					value.toLowerCase().includes(filter.toLowerCase()) ||
					logicalName.toLowerCase().includes(filter.toLowerCase())
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
 * Resolve a table value entered via the "By Name"/"By ID" resource locator modes to the
 * EntitySetName (plural collection name) required by Dataverse Web API record endpoints.
 *
 * The "From List" mode already resolves to EntitySetName, but "By Name"/"By ID" let users type
 * either the LogicalName (singular, e.g. "account") or the EntitySetName (plural, e.g.
 * "accounts") directly. Record CRUD endpoints require the EntitySetName in the URL, so passing a
 * LogicalName through unresolved results in a 404 "Resource not found for the segment" error.
 */
export async function resolveEntitySetName(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	table: string,
	itemIndex?: number,
): Promise<string> {
	try {
		const entityResponse = (await dataverseApiRequest.call(
			this,
			'GET',
			'/EntityDefinitions',
			undefined,
			{
				$select: 'LogicalName,EntitySetName',
				$filter: `LogicalName eq '${table}' or EntitySetName eq '${table}'`,
			},
			itemIndex,
		)) as DataverseApiResponse;

		if (entityResponse.value && entityResponse.value.length > 0) {
			const entitySetName = (entityResponse.value[0] as { EntitySetName: string }).EntitySetName;
			if (entitySetName) {
				return entitySetName;
			}
		}
	} catch {
		// If the lookup fails, fall back to using the value as-is
	}

	return table;
}

/**
 * Get image and file fields from entity metadata
 */
export async function getImageAndFileFields(
	this: IExecuteFunctions,
	table: string,
	itemIndex: number,
): Promise<{ imageFields: string[]; fileFields: string[] }> {
	const imageFields: string[] = [];
	const fileFields: string[] = [];

	try {
		// Get the logical name from entity set name
		let logicalName = table;
		try {
			const entityResponse = (await dataverseApiRequest.call(
				this,
				'GET',
				'/EntityDefinitions',
				undefined,
				{
					$select: 'LogicalName,EntitySetName',
					$filter: `EntitySetName eq '${table}'`,
				},
				itemIndex,
			)) as DataverseApiResponse;
			
			if (entityResponse.value && entityResponse.value.length > 0) {
				logicalName = (entityResponse.value[0] as { LogicalName: string }).LogicalName;
			}
		} catch {
			// Continue with table name as logical name
		}

		// Fetch field metadata
		// Note: AttributeType is returned as a string like "Image" or "File", not as an enum
		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			`/EntityDefinitions(LogicalName='${logicalName}')/Attributes`,
			undefined,
			{
				$select: 'LogicalName,AttributeType',
			},
			itemIndex,
		)) as DataverseApiResponse;

		const attributes = (response.value || []) as Array<{
			LogicalName: string;
			AttributeType?: string;
		}>;

		// Build a map of field names for quick lookup
		const fieldNameSet = new Set(attributes.map(a => a.LogicalName));
		
		for (const attr of attributes) {
			const fieldName = attr.LogicalName;
			const attrType = attr.AttributeType;

			// In Dataverse, file and image columns are Virtual attributes
			// We can identify them by checking if they have associated metadata fields
			if (attrType === 'Virtual' && fieldName) {
				// Check if this is an image field (has _url and _timestamp)
				const hasImgUrl = fieldNameSet.has(`${fieldName}_url`);
				const hasImgTimestamp = fieldNameSet.has(`${fieldName}_timestamp`);
				
				if (hasImgUrl && hasImgTimestamp) {
					imageFields.push(fieldName);
				}
				// Check if this is a file/document field (has _name)
				else if (fieldNameSet.has(`${fieldName}_name`)) {
					fileFields.push(fieldName);
				}
			}
		}
	} catch {
		// If metadata fetch fails, return empty arrays
		// Error is silently ignored to allow fallback to pattern matching
	}

	return { imageFields, fileFields };
}

/**
 * Get table fields for display in dropdown
 */
export async function getTableFieldsForDisplay(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const returnData: INodePropertyOptions[] = [];

	try {
		const table = this.getNodeParameter('table', 0) as { mode: string; value: string };
		const tableValue = table?.value;

		if (!tableValue) {
			return [
				{
					name: 'Please select a table first',
					value: '',
				},
			];
		}

		// First, get the entity definition to find the LogicalName from EntitySetName
		let logicalName = tableValue;
		try {
			const entityResponse = (await dataverseApiRequest.call(
				this,
				'GET',
				'/EntityDefinitions',
				undefined,
				{
					$select: 'LogicalName,EntitySetName',
					$filter: `EntitySetName eq '${tableValue}'`,
				},
			)) as DataverseApiResponse;
			
			if (entityResponse.value && entityResponse.value.length > 0) {
				logicalName = (entityResponse.value[0] as { LogicalName: string }).LogicalName;
			}
		} catch {
			// If we can't find it, assume tableValue is already the LogicalName
		}

		// Try to fetch attributes
		let response: DataverseApiResponse;
		try {
			response = (await dataverseApiRequest.call(
				this,
				'GET',
				`/EntityDefinitions(LogicalName='${logicalName}')/Attributes`,
				undefined,
				{
					$select: 'LogicalName,DisplayName,AttributeType,IsValidForCreate,IsValidForUpdate,IsValidForRead',
					$filter: 'IsValidForRead eq true',
					$orderby: 'LogicalName',
				},
			)) as DataverseApiResponse;
		} catch (error) {
			// If authentication fails or other error, show helpful message
			const errorMsg = error instanceof Error ? error.message : String(error);
			const isAuthError = errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Unauthorized');
			
			if (isAuthError) {
				return [
					{
						name: '⚠️ Authentication failed - field list unavailable',
						value: '',
					},
					{
						name: 'Workaround: Execute the node once, then close and reopen to refresh the list',
						value: '',
					},
					{
						name: 'Note: This is reference only - you can still execute the workflow',
						value: '',
					},
				];
			}
			
			return [
				{
					name: `⚠️ Could not load fields for table: ${tableValue}`,
					value: '',
				},
				{
					name: `Error: ${errorMsg}`,
					value: '',
				},
				{
					name: 'Note: This is reference only - you can still execute the workflow',
					value: '',
				},
			];
		}

		const attributes = (response.value || []) as Array<{
			LogicalName: string;
			DisplayName?: { UserLocalizedLabel?: { Label?: string } };
			AttributeType?: string;
			IsValidForCreate?: boolean;
			IsValidForUpdate?: boolean;
			IsValidForRead?: boolean;
		}>;

		if (attributes.length === 0) {
			return [
				{
					name: 'No fields found for this table',
					value: '',
				},
			];
		}

		for (const attr of attributes) {
			const displayName = attr.DisplayName?.UserLocalizedLabel?.Label || attr.LogicalName;
			const logicalName = attr.LogicalName;
			const type = attr.AttributeType || 'Unknown';
			const flags = [];

			if (attr.IsValidForCreate) flags.push('C');
			if (attr.IsValidForUpdate) flags.push('U');
			if (attr.IsValidForRead) flags.push('R');

			const flagStr = flags.length > 0 ? ` [${flags.join('')}]` : '';
			const name = `${displayName} (${logicalName}) - ${type}${flagStr}`;

			returnData.push({
				name,
				value: logicalName,
			});
		}

		return returnData;
	} catch (error) {
		// Return a more helpful error message
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return [
			{
				name: `⚠️ Error: ${errorMessage}`,
				value: '',
			},
			{
				name: 'Please check your credentials and table selection',
				value: '',
			},
		];
	}
}

/**
 * Get table field names for field collection inputs
 */
export async function getTableFieldNames(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const returnData: INodePropertyOptions[] = [];

	try {
		const table = this.getNodeParameter('table', 0) as { mode: string; value: string };
		const tableValue = table?.value;

		if (!tableValue) {
			return [
				{
					name: 'Please select a table first',
					value: '',
				},
			];
		}

		// Get the logical name from entity set name
		let logicalName = tableValue;
		try {
			const entityResponse = (await dataverseApiRequest.call(
				this,
				'GET',
				'/EntityDefinitions',
				undefined,
				{
					$select: 'LogicalName,EntitySetName',
					$filter: `EntitySetName eq '${tableValue}'`,
				},
			)) as DataverseApiResponse;
			
			if (entityResponse.value && entityResponse.value.length > 0) {
				logicalName = (entityResponse.value[0] as { LogicalName: string }).LogicalName;
			}
		} catch {
			// Continue with table name as logical name
		}

		// Fetch attributes
		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			`/EntityDefinitions(LogicalName='${logicalName}')/Attributes`,
			undefined,
			{
				$select: 'LogicalName,DisplayName,AttributeType',
				$filter: 'IsValidForRead eq true',
				$orderby: 'LogicalName',
			},
		)) as DataverseApiResponse;

		const attributes = (response.value || []) as Array<{
			LogicalName: string;
			DisplayName?: { UserLocalizedLabel?: { Label?: string } };
			AttributeType?: string;
		}>;

		if (attributes.length === 0) {
			return [
				{
					name: 'No fields found',
					value: '',
				},
			];
		}

		for (const attr of attributes) {
			const displayName = attr.DisplayName?.UserLocalizedLabel?.Label || attr.LogicalName;
			const logicalName = attr.LogicalName;
			const type = attr.AttributeType || 'Unknown';
			const name = `${displayName} (${logicalName}) - ${type}`;

			returnData.push({
				name,
				value: logicalName,
			});
		}

		return returnData;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return [
			{
				name: `Error loading fields: ${errorMessage}`,
				value: '',
			},
		];
	}
}

/**
 * Get alternate key fields for a table
 */
export async function getAlternateKeyFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const returnData: INodePropertyOptions[] = [];

	try {
		const table = this.getNodeParameter('table', 0) as { mode: string; value: string };
		const tableValue = table?.value;

		if (!tableValue) {
			return [
				{
					name: 'Please select a table first',
					value: '',
				},
			];
		}

		// Get the logical name from entity set name
		let logicalName = tableValue;
		try {
			const entityResponse = (await dataverseApiRequest.call(
				this,
				'GET',
				'/EntityDefinitions',
				undefined,
				{
					$select: 'LogicalName,EntitySetName',
					$filter: `EntitySetName eq '${tableValue}'`,
				},
			)) as DataverseApiResponse;
			
			if (entityResponse.value && entityResponse.value.length > 0) {
				logicalName = (entityResponse.value[0] as { LogicalName: string }).LogicalName;
			}
		} catch {
			// Continue with table name as logical name
		}

		// Fetch entity metadata including alternate keys
		let response: IDataObject;
		try {
			response = (await dataverseApiRequest.call(
				this,
				'GET',
				`/EntityDefinitions(LogicalName='${logicalName}')`,
				undefined,
				{
					$select: 'LogicalName',
					$expand: 'Keys($select=LogicalName,KeyAttributes)',
				},
			)) as IDataObject;
		} catch (apiError) {
			const apiErrorMsg = apiError instanceof Error ? apiError.message : String(apiError);
			return [
				{
					name: `⚠️ Could not load alternate keys: ${apiErrorMsg}`,
					value: '',
				},
				{
					name: 'Tip: You can still type the field name manually',
					value: '',
				},
			];
		}

		const keys = (response.Keys as IDataObject[]) || [];

		if (keys.length === 0) {
			return [
				{
					name: '⚠️ No alternate keys defined on this table',
					value: '',
				},
				{
					name: 'Tip: Define alternate keys in Dataverse or type field name manually',
					value: '',
				},
			];
		}

		// Collect all unique field names from all alternate keys
		const fieldSet = new Set<string>();
		for (const key of keys) {
			// KeyAttributes can be an array of strings or objects with LogicalName property
			const keyAttributes = key.KeyAttributes;
			
			if (Array.isArray(keyAttributes)) {
				for (const attr of keyAttributes) {
					// Handle both string and object formats
					const fieldName = typeof attr === 'string' ? attr : (attr as IDataObject).LogicalName as string;
					if (fieldName) {
						fieldSet.add(fieldName);
					}
				}
			}
		}

		if (fieldSet.size === 0) {
			return [
				{
					name: '⚠️ No key attributes found',
					value: '',
				},
				{
					name: 'Tip: You can type the field name manually',
					value: '',
				},
			];
		}

		// Convert to options array
		for (const fieldName of Array.from(fieldSet).sort()) {
			returnData.push({
				name: fieldName,
				value: fieldName,
			});
		}

		return returnData;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return [
			{
				name: `Error loading alternate keys: ${errorMessage}`,
				value: '',
			},
		];
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
		// Escape single quotes per OData string literal rules (a literal `'` is represented as `''`)
		const keyPairs = alternateKeys.map((key) => `${key.name}='${key.value.replace(/'/g, "''")}'`);
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
 * Resolve a table value (LogicalName or EntitySetName) to its LogicalName, as required by the
 * `EntityDefinitions(LogicalName='...')` metadata endpoints.
 */
async function resolveLogicalName(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	table: string,
	itemIndex?: number,
): Promise<string> {
	try {
		const entityResponse = (await dataverseApiRequest.call(
			this,
			'GET',
			'/EntityDefinitions',
			undefined,
			{
				$select: 'LogicalName,EntitySetName',
				$filter: `LogicalName eq '${table}' or EntitySetName eq '${table}'`,
			},
			itemIndex,
		)) as DataverseApiResponse;

		if (entityResponse.value && entityResponse.value.length > 0) {
			return (entityResponse.value[0] as { LogicalName: string }).LogicalName;
		}
	} catch {
		// If the lookup fails, fall back to using the value as-is
	}

	return table;
}

/**
 * Get a map of lookup field LogicalNames to their target entity LogicalName(s) for a table.
 * Queries the metadata endpoint cast to `LookupAttributeMetadata`, which covers Lookup, Customer,
 * and Owner attribute types and exposes the `Targets` the field can point to.
 */
async function getLookupFieldTargets(
	this: IExecuteFunctions,
	logicalName: string,
	itemIndex?: number,
): Promise<Map<string, string[]>> {
	const lookupTargets = new Map<string, string[]>();

	try {
		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			`/EntityDefinitions(LogicalName='${logicalName}')/Attributes/Microsoft.Dynamics.CRM.LookupAttributeMetadata`,
			undefined,
			{ $select: 'LogicalName,Targets' },
			itemIndex,
		)) as DataverseApiResponse;

		for (const attr of (response.value || []) as Array<{ LogicalName: string; Targets?: string[] }>) {
			if (attr.LogicalName && attr.Targets && attr.Targets.length > 0) {
				lookupTargets.set(attr.LogicalName, attr.Targets);
			}
		}
	} catch {
		// If metadata lookup fails, fall back to treating all fields as non-lookup values
	}

	return lookupTargets;
}

/**
 * Get a map of field LogicalNames to their AttributeType (e.g. "Boolean", "Integer", "Picklist")
 * for a table, used to coerce string field values entered in the UI into the JSON types
 * Dataverse expects.
 */
async function getFieldAttributeTypes(
	this: IExecuteFunctions,
	logicalName: string,
	itemIndex?: number,
): Promise<Map<string, string>> {
	const attributeTypes = new Map<string, string>();

	try {
		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			`/EntityDefinitions(LogicalName='${logicalName}')/Attributes`,
			undefined,
			{ $select: 'LogicalName,AttributeType' },
			itemIndex,
		)) as DataverseApiResponse;

		for (const attr of (response.value || []) as Array<{ LogicalName: string; AttributeType?: string }>) {
			if (attr.LogicalName && attr.AttributeType) {
				attributeTypes.set(attr.LogicalName, attr.AttributeType);
			}
		}
	} catch {
		// If metadata lookup fails, fall back to treating all fields as raw string values
	}

	return attributeTypes;
}

const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Build the identifier used inside an `@odata.bind` reference for a lookup field, supporting
 * either a raw GUID or a JSON object of alternate key field/value pairs on the target table
 * (e.g. `{"accountnumber": "12345"}` or `{"key1": "value1", "key2": "value2"}`). JSON is used
 * (rather than a custom delimited string) so standard JSON escaping rules apply to values that
 * contain commas, quotes, or other special characters.
 */
function buildLookupBindIdentifier(rawValue: string): string {
	const trimmed = rawValue.trim();
	if (GUID_REGEX.test(trimmed)) {
		return trimmed;
	}

	const invalidValueError = new Error(
		`Invalid lookup value "${rawValue}". Expected a GUID or a JSON object of alternate key field/value pairs, e.g. {"keyname": "value"}.`,
	);

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		throw invalidValueError;
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw invalidValueError;
	}

	const alternateKeys = Object.entries(parsed as Record<string, unknown>).map(([name, value]) => ({
		name,
		value: String(value),
	}));

	if (alternateKeys.length === 0) {
		throw new Error(`Invalid lookup value "${rawValue}". The alternate key object must have at least one field.`);
	}

	return buildRecordIdentifier('alternateKey', undefined, alternateKeys);
}

/**
 * Resolve a choice (Picklist/State/Status) field's option label (e.g. "Active") to its
 * underlying integer value, so users can enter a human-readable label instead of looking up the
 * numeric value themselves. Supports both Local Choice (OptionSet) and Global Choice
 * (GlobalOptionSet) fields.
 */
async function resolveChoiceLabelToValue(
	this: IExecuteFunctions,
	logicalName: string,
	fieldName: string,
	label: string,
	itemIndex?: number,
): Promise<number | null> {
	try {
		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			`/EntityDefinitions(LogicalName='${logicalName}')/Attributes(LogicalName='${fieldName}')`,
			undefined,
			{
				$select: 'LogicalName,AttributeType',
				$expand: 'OptionSet($select=Options),GlobalOptionSet($select=Options,Name)',
			},
			itemIndex,
		)) as IDataObject;

		const optionSet = (response.OptionSet ?? response.GlobalOptionSet) as IDataObject | undefined;
		const options = (optionSet?.Options ?? []) as Array<{
			Value: number;
			Label?: { UserLocalizedLabel?: { Label?: string } };
		}>;

		const normalizedLabel = label.trim().toLowerCase();
		const match = options.find(
			(option) => option.Label?.UserLocalizedLabel?.Label?.trim().toLowerCase() === normalizedLabel,
		);

		return match ? match.Value : null;
	} catch {
		return null;
	}
}

/**
 * Coerce a raw field value (as entered in the UI) into the JSON type Dataverse expects for a
 * given attribute type. Sending e.g. the string "true" for a Boolean field, or "1" for a
 * Picklist field, is rejected by Dataverse's OData parser, which requires actual JSON
 * booleans/numbers rather than quoted strings. Also resolves Choice field display labels (e.g.
 * "Active") to their underlying numeric value, and ensures numbers entered for text fields are
 * sent as strings.
 */
async function coerceFieldValue(
	this: IExecuteFunctions,
	value: unknown,
	attributeType: string | undefined,
	logicalName: string,
	fieldName: string,
	itemIndex?: number,
): Promise<unknown> {
	const isEmpty = value === '' || value === undefined || value === null;

	switch (attributeType) {
		case 'Boolean':
			if (isEmpty) {
				return null;
			}
			return ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());
		case 'Integer':
		case 'BigInt':
		case 'Decimal':
		case 'Double':
		case 'Money': {
			if (isEmpty) {
				return null;
			}
			const numericValue = Number(value);
			return Number.isNaN(numericValue) ? value : numericValue;
		}
		case 'Picklist':
		case 'State':
		case 'Status': {
			if (isEmpty) {
				return null;
			}
			const numericValue = Number(value);
			if (!Number.isNaN(numericValue)) {
				return numericValue;
			}
			// Not a number - treat it as a choice display label and resolve it to its value
			const resolvedValue = await resolveChoiceLabelToValue.call(
				this,
				logicalName,
				fieldName,
				String(value),
				itemIndex,
			);
			return resolvedValue ?? value;
		}
		default:
			// Text-like fields (String, Memo) or unrecognized types: ensure non-string
			// primitives (e.g. numbers resolved from an expression) are sent as strings,
			// rather than as JSON numbers/booleans.
			if (typeof value === 'number' || typeof value === 'boolean') {
				return String(value);
			}
			return value;
	}
}

/**
 * Convert a field array into an API request body, resolving lookup fields to the `@odata.bind`
 * navigation-property syntax Dataverse requires (e.g. `"field@odata.bind": "/accounts(guid)"`)
 * instead of sending the raw GUID as a primitive value, and coercing values for Boolean/
 * numeric/Picklist fields into their proper JSON types instead of quoted strings. Sending the
 * wrong JSON type is rejected by Dataverse's OData parser with errors like "A 'PrimitiveValue'
 * node with non-null value was found... however, a 'StartArray' node, a 'StartObject' node...
 * was expected."
 */
export async function fieldsToRequestBody(
	this: IExecuteFunctions,
	table: string,
	fields: Array<{ name: string; value: string }>,
	itemIndex?: number,
): Promise<IDataObject> {
	const body: IDataObject = {};
	if (fields.length === 0) {
		return body;
	}

	const logicalName = await resolveLogicalName.call(this, table, itemIndex);
	const [lookupTargets, attributeTypes] = await Promise.all([
		getLookupFieldTargets.call(this, logicalName, itemIndex),
		getFieldAttributeTypes.call(this, logicalName, itemIndex),
	]);

	for (const field of fields) {
		const targets = lookupTargets.get(field.name);
		if (targets && targets.length > 0) {
			if (!field.value) {
				// Clear the lookup by binding it to null
				body[`${field.name}@odata.bind`] = null;
				continue;
			}
			const targetEntitySet = await resolveEntitySetName.call(this, targets[0], itemIndex);
			const identifier = buildLookupBindIdentifier(field.value);
			body[`${field.name}@odata.bind`] = `/${targetEntitySet}(${identifier})`;
		} else {
			body[field.name] = (await coerceFieldValue.call(
				this,
				field.value,
				attributeTypes.get(field.name),
				logicalName,
				field.name,
				itemIndex,
			)) as string | number | boolean | null;
		}
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

/**
 * Get list of global choices for dropdown
 */
export async function getGlobalChoicesForDropdown(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	try {
		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			'/GlobalOptionSetDefinitions',
			undefined,
			{
				$select: 'Name,DisplayName,Description',
			},
		)) as DataverseApiResponse;

		const choices = response.value as Array<{
			Name: string;
			DisplayName: {
				UserLocalizedLabel: {
					Label: string;
				};
			};
		}>;

		if (!choices || choices.length === 0) {
			return [
				{
					name: 'No global choices found',
					value: '',
				},
			];
		}

		return choices.map((choice) => {
			const displayName = choice.DisplayName?.UserLocalizedLabel?.Label || choice.Name;
			return {
				name: `${displayName} (${choice.Name})`,
				value: choice.Name,
			};
		});
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const isAuthError = errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Unauthorized');
		
		if (isAuthError) {
			return [
				{
					name: '⚠️ Authentication failed - global choice list unavailable',
					value: '',
				},
				{
					name: 'Workaround: Execute the node once, then close and reopen to refresh the list',
					value: '',
				},
				{
					name: 'Note: You can still type the choice name manually',
					value: '',
				},
			];
		}
		
		return [
			{
				name: `⚠️ Error loading global choices: ${errorMsg}`,
				value: '',
			},
			{
				name: 'Note: You can still type the choice name manually',
				value: '',
			},
		];
	}
}

/**
 * Get list of many-to-many relationships for dropdown
 */
export async function getRelationships(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	try {
		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			'/RelationshipDefinitions/Microsoft.Dynamics.CRM.ManyToManyRelationshipMetadata',
			undefined,
			{
				$select: 'SchemaName,Entity1LogicalName,Entity2LogicalName',
			},
		)) as DataverseApiResponse;

		const relationships = response.value as Array<{
			SchemaName: string;
			Entity1LogicalName: string;
			Entity2LogicalName: string;
		}>;

		if (!relationships || relationships.length === 0) {
			return [
				{
					name: 'No many-to-many relationships found',
					value: '',
				},
			];
		}

		return relationships.map((rel) => ({
			name: `${rel.SchemaName} (${rel.Entity1LogicalName} ↔ ${rel.Entity2LogicalName})`,
			value: rel.SchemaName,
		}));
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const isAuthError = errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Unauthorized');
		
		if (isAuthError) {
			return [
				{
					name: '⚠️ Authentication failed - relationship list unavailable',
					value: '',
				},
				{
					name: 'Note: You can still type the relationship name manually',
					value: '',
				},
			];
		}
		
		return [
			{
				name: `⚠️ Error loading relationships: ${errorMsg}`,
				value: '',
			},
			{
				name: 'Note: You can still type the relationship name manually',
				value: '',
			},
		];
	}
}

/**
 * Get list of solutions for dropdown
 */
export async function getSolutions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	try {
		// Query solutions table - only unmanaged solutions can have new tables added
		const response = (await dataverseApiRequest.call(
			this,
			'GET',
			'/solutions',
			undefined,
			{
				$select: 'solutionid,uniquename,friendlyname,ismanaged',
				$filter: 'ismanaged eq false',
				$orderby: 'friendlyname asc',
				$top: 100,
			},
		)) as DataverseApiResponse;

		const solutions = response.value as Array<{
			solutionid: string;
			uniquename: string;
			friendlyname: string;
			ismanaged: boolean;
		}>;

		if (!solutions || solutions.length === 0) {
			return [
				{
					name: 'ℹ️ No unmanaged solutions found - creating in default solution',
					value: '',
				},
			];
		}

		// Add option to use default solution
		const options: INodePropertyOptions[] = [
			{
				name: '(Default Solution)',
				value: '',
			},
		];

		// Add all unmanaged solutions
		solutions.forEach((solution) => {
			options.push({
				name: solution.friendlyname,
				value: solution.uniquename,
			});
		});

		return options;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		// Return helpful error with option to proceed without solution
		return [
			{
				name: '(Default Solution - recommended)',
				value: '',
			},
			{
				name: `⚠️ Could not load solutions: ${errorMsg}`,
				value: '',
			},
		];
	}
}

