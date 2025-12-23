import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import * as sql from 'mssql';

interface OAuth2Credentials extends IDataObject {
	environmentUrl: string;
	oauthTokenData?: {
		access_token: string;
	};
}

export async function executeSqlQuery(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const sqlQuery = this.getNodeParameter('sqlQuery', itemIndex) as string;

	// Check if using custom authentication
	let environmentUrl = '';
	let accessToken = '';
	
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
	const useCustomAuth = options.useCustomAuth as boolean || false;
	
	if (useCustomAuth) {
		// Use custom authentication
		environmentUrl = options.customEnvironmentUrl as string || '';
		accessToken = options.accessToken as string || '';
		
		if (!environmentUrl) {
			throw new NodeOperationError(
				this.getNode(),
				'Environment URL is required when using custom authentication.',
			);
		}
		if (!accessToken) {
			throw new NodeOperationError(
				this.getNode(),
				'Access Token is required when using custom authentication.',
			);
		}
	} else {
		// Get credentials and access token from OAuth2
		const credentials = await this.getCredentials('dataverseOAuth2Api') as OAuth2Credentials;
		environmentUrl = credentials.environmentUrl;
		accessToken = credentials.oauthTokenData?.access_token || '';

		if (!accessToken) {
			throw new NodeOperationError(
				this.getNode(),
				'No access token available. Please authenticate with OAuth2.',
			);
		}
	}

	// Extract domain from environment URL
	// e.g., https://org.crm.dynamics.com -> org.crm.dynamics.com
	const urlMatch = environmentUrl.match(/https?:\/\/([^/]+)/);
	if (!urlMatch) {
		throw new NodeOperationError(
			this.getNode(),
			'Invalid environment URL format. Expected format: https://org.crm.dynamics.com',
		);
	}
	const domain = urlMatch[1];
	
	// Extract organization name for database
	const orgMatch = domain.match(/^([^.]+)\./);
	const orgName = orgMatch ? orgMatch[1] : domain;

	// TDS endpoint configuration for Dataverse
	const config: sql.config = {
		server: domain,
		port: 5558,
		authentication: {
			type: 'azure-active-directory-access-token',
			options: {
				token: accessToken,
			},
		},
		database: orgName,
		options: {
			encrypt: true,
			trustServerCertificate: false,
			enableArithAbort: true,
			connectTimeout: 30000,
			requestTimeout: 30000,
		},
	};

	let pool: sql.ConnectionPool | undefined;

	try {
		// Create connection pool
		pool = await sql.connect(config);

		// Execute query
		const result = await pool.request().query(sqlQuery);

		// Convert results to n8n format
		const returnData: INodeExecutionData[] = result.recordset.map((row: IDataObject) => ({
			json: row,
			pairedItem: { item: itemIndex },
		}));

		return returnData;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		
		// Provide helpful error messages
		if (errorMessage.includes('Failed to connect') || errorMessage.includes('timeout')) {
			throw new NodeOperationError(
				this.getNode(),
				`Failed to connect to Dataverse TDS endpoint at ${domain}:5558. Please verify:\n` +
				`1. TDS endpoint is enabled in your Dataverse environment\n` +
				`2. Your IP address is allowed in Dataverse firewall rules\n` +
				`3. The OAuth2 token has the correct scope (${environmentUrl}/.default)\n` +
				`Error: ${errorMessage}`,
			);
		}
		
		throw new NodeOperationError(
			this.getNode(),
			`SQL query execution failed: ${errorMessage}`,
		);
	} finally {
		// Close connection pool
		if (pool) {
			await pool.close();
		}
	}
}
