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
		// Extract detailed error information from Dataverse API response
		let errorMessage = 'Unknown error';
		let errorCode = '';
		let httpStatus = '';
		
		// Try to extract error from various possible locations in the error object
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const errorObj = error as any;
		
		// Check for Dataverse error in response body
		let dataverseError = null;
		if (errorObj?.cause?.response?.body?.error) {
			dataverseError = errorObj.cause.response.body.error;
		} else if (errorObj?.response?.data?.error) {
			dataverseError = errorObj.response.data.error;
		} else if (errorObj?.cause?.error) {
			dataverseError = errorObj.cause.error;
		} else if (errorObj?.error) {
			dataverseError = errorObj.error;
		}
		
		// Extract error details from Dataverse error object
		if (dataverseError) {
			if (dataverseError.message) {
				errorMessage = dataverseError.message;
			}
			if (dataverseError.code) {
				errorCode = dataverseError.code;
			}
		} else if (error instanceof Error) {
			errorMessage = error.message;
		}
		
		// Get HTTP status code
		if (errorObj?.cause?.response?.statusCode) {
			httpStatus = errorObj.cause.response.statusCode;
		} else if (errorObj?.response?.status) {
			httpStatus = errorObj.response.status;
		} else if (errorObj?.statusCode) {
			httpStatus = errorObj.statusCode;
		}
		
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

/**
 * Get choice field options for a specific field
 * Supports both Local Choice (OptionSet) and Global Choice (GlobalOptionSet)
 */
export async function getChoiceFieldOptions(
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

		// Get the choice field name that user wants to view
		const choiceFieldName = this.getNodeParameter('viewChoiceField', 0) as string;

		if (!choiceFieldName) {
			return [
				{
					name: 'Please select a field to view its options',
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

		// Fetch field metadata with expanded OptionSet/GlobalOptionSet
		let response: IDataObject;
		try {
			response = (await dataverseApiRequest.call(
				this,
				'GET',
				`/EntityDefinitions(LogicalName='${logicalName}')/Attributes(LogicalName='${choiceFieldName}')`,
				undefined,
				{
					$select: 'LogicalName,AttributeType',
					$expand: 'OptionSet($select=Options),GlobalOptionSet($select=Options,Name)',
				},
			)) as IDataObject;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			return [
				{
					name: `⚠️ Could not load field: ${choiceFieldName}`,
					value: '',
				},
				{
					name: `Error: ${errorMsg}`,
					value: '',
				},
			];
		}

		const attributeType = response.AttributeType as string;

		// Check if this is a choice field
		if (!['Picklist', 'State', 'Status'].includes(attributeType)) {
			return [
				{
					name: `⚠️ Field "${choiceFieldName}" is not a choice field`,
					value: '',
				},
				{
					name: `Type: ${attributeType}`,
					value: '',
				},
			];
		}

		// Get options from either OptionSet (local) or GlobalOptionSet (global)
		let options: Array<{ Value: number; Label: { UserLocalizedLabel: { Label: string } } }> = [];
		let choiceType = 'Local Choice';

		if (response.OptionSet && (response.OptionSet as IDataObject).Options) {
			options = ((response.OptionSet as IDataObject).Options as Array<{ Value: number; Label: { UserLocalizedLabel: { Label: string } } }>);
			choiceType = 'Local Choice';
		} else if (response.GlobalOptionSet && (response.GlobalOptionSet as IDataObject).Options) {
			options = ((response.GlobalOptionSet as IDataObject).Options as Array<{ Value: number; Label: { UserLocalizedLabel: { Label: string } } }>);
			const globalName = (response.GlobalOptionSet as IDataObject).Name as string;
			choiceType = `Global Choice (${globalName})`;
		}

		if (options.length === 0) {
			return [
				{
					name: 'No options available for this field',
					value: '',
				},
			];
		}

		// Add header showing choice type
		returnData.push({
			name: `━━━ ${choiceType} ━━━`,
			value: '',
		});

		// Format options as "Label (Value)"
		for (const option of options) {
			const label = option.Label?.UserLocalizedLabel?.Label || `Option ${option.Value}`;
			const value = option.Value;
			const name = `${label} (${value})`;

			returnData.push({
				name,
				value: value.toString(),
			});
		}

		return returnData;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		return [
			{
				name: `⚠️ Error loading choice options`,
				value: '',
			},
			{
				name: `${errorMsg}`,
				value: '',
			},
		];
	}
}

