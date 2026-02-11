import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DataverseOAuth2Api implements ICredentialType {
	name = 'dataverseOAuth2Api';

	extends = ['microsoftOAuth2Api'];

	displayName = 'Dataverse OAuth2 API';

	icon = 'file:dataverse.svg' as const;

	documentationUrl = 'https://docs.microsoft.com/en-us/power-apps/developer/data-platform/authenticate-oauth';

	properties: INodeProperties[] = [
		{
			displayName: 'Environment URL',
			name: 'environmentUrl',
			type: 'string',
			default: '',
			placeholder: 'https://org.crm.dynamics.com',
			description: 'The URL of your Dataverse environment (e.g., https://yourorg.crm.dynamics.com)',
			required: true,
			noDataExpression: true,
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
			noDataExpression: true,
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
			required: true,
			noDataExpression: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
			required: true,
			noDataExpression: true,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: '={{$self["environmentUrl"]}}/.default offline_access',
			noDataExpression: true,
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: 'response_mode=query',
			noDataExpression: true,
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
			noDataExpression: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Prefer: 'return=representation',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.environmentUrl}}',
			url: '/api/data/v9.2/WhoAmI',
			method: 'GET',
		},
	};
}
