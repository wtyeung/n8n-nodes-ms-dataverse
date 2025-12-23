import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import * as sql from 'mssql';

export async function executeSqlQuery(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const sqlQuery = this.getNodeParameter('sqlQuery', itemIndex) as string;

	// Get credentials and access token
	const credentials = await this.getCredentials('microsoftDataverseOAuth2Api') as any;
	const environmentUrl = credentials.environmentUrl as string;
	const accessToken = credentials.oauthTokenData?.access_token as string;

	if (!accessToken) {
		throw new NodeOperationError(
			this.getNode(),
			'No access token available. Please authenticate with OAuth2.',
		);
	}

	// Extract organization name from environment URL
	// e.g., https://org.crm.dynamics.com -> org
	const urlMatch = environmentUrl.match(/https?:\/\/([^.]+)\./);
	if (!urlMatch) {
		throw new NodeOperationError(
			this.getNode(),
			'Invalid environment URL format. Expected format: https://org.crm.dynamics.com',
		);
	}
	const orgName = urlMatch[1];

	// TDS endpoint configuration for Dataverse
	const config: sql.config = {
		server: `${orgName}.api.crm.dynamics.com`,
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
		const returnData: INodeExecutionData[] = result.recordset.map((row: any) => ({
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
