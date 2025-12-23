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

	// Get credentials and access token
	const credentials = await this.getCredentials('microsoftDataverseOAuth2Api') as OAuth2Credentials;
	const environmentUrl = credentials.environmentUrl;
	const accessToken = credentials.oauthTokenData?.access_token;

	if (!accessToken) {
		throw new NodeOperationError(
			this.getNode(),
			'No access token available. Please authenticate with OAuth2.',
		);
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
			port: 5558,
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
		throw new NodeOperationError(
			this.getNode(),
			`SQL query execution failed: ${error.message}`,
		);
	} finally {
		// Close connection pool
		if (pool) {
			await pool.close();
		}
	}
}
