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
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: '=offline_access {{$self.environmentUrl}}/.default',
		},
		{
			displayName: 'Environment URL',
			name: 'environmentUrl',
			type: 'string',
			default: '',
			placeholder: 'https://org.crm.dynamics.com',
			description: 'The URL of your Dataverse environment (e.g., https://yourorg.crm.dynamics.com)',
			required: true,
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
