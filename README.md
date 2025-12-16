# n8n-nodes-ms-dataverse

This is an n8n community node that lets you interact with Microsoft Dataverse (Power Platform) in your n8n workflows.

Microsoft Dataverse is a cloud-based data storage service that provides a secure and scalable way to store and manage business data. It's the underlying data platform for Power Apps, Power Automate, and Dynamics 365.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Node Installation

1. Go to **Settings > Community Nodes** in your n8n instance
2. Select **Install**
3. Enter `n8n-nodes-ms-dataverse` in the **Enter npm package name** field
4. Agree to the risks and select **Install**

## Operations

This node supports the following operations on Dataverse records:

### Record Operations

- **Create**: Create a new record in a table
- **Delete**: Delete a record by ID
- **Get**: Retrieve a single record by ID or alternate key
- **Get Many**: Retrieve multiple records using OData queries or FetchXML
- **Update**: Update an existing record

### Features

- **Dynamic Table Discovery**: Automatically loads available tables from your Dataverse environment using the OData metadata endpoint
- **OData Support**: Use OData query syntax for filtering, sorting, and selecting fields
- **FetchXML Support**: Execute complex queries using FetchXML
- **Alternate Keys**: Retrieve records using alternate keys instead of GUIDs
- **Field Selection**: Choose specific fields to return in queries

## Credentials

This node uses Microsoft OAuth2 authentication to connect to Dataverse.

### Prerequisites

1. A Microsoft Dataverse environment (part of Power Platform or Dynamics 365)
2. An Azure AD app registration with appropriate permissions

### Setting up Azure AD App Registration

1. Go to the [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **New registration**
4. Enter a name (e.g., "n8n Dataverse Integration")
5. Set **Redirect URI** to: `https://your-n8n-instance.com/rest/oauth2-credential/callback`
6. Click **Register**
7. Note the **Application (client) ID**
8. Go to **Certificates & secrets** and create a new client secret
9. Note the secret value (you won't be able to see it again)
10. Go to **API permissions** and add:
    - **Dynamics CRM > user_impersonation** (Delegated)
11. Grant admin consent if required

### Configuring Credentials in n8n

1. In n8n, create new credentials of type **Microsoft Dataverse OAuth2 API**
2. Enter your **Environment URL** (e.g., `https://yourorg.crm.dynamics.com`)
3. Enter the **Client ID** from your Azure app registration
4. Enter the **Client Secret** from your Azure app registration
5. Click **Connect my account** and authorize the application
6. Test the connection

## Compatibility

- Minimum n8n version: 1.0.0
- Tested with n8n version: 1.0.0+
- Dataverse API version: 9.2

## Usage

### Creating a Record

1. Select **Create** operation
2. Choose your table from the dropdown (or enter manually)
3. Add fields and their values
4. Execute the workflow

### Retrieving Records with OData

1. Select **Get Many** operation
2. Choose **OData** as query type
3. Use the filter field to add OData filters (e.g., `name eq 'Contoso'`)
4. Optionally add ordering and field selection
5. Set the limit for maximum records to return

### Retrieving Records with FetchXML

1. Select **Get Many** operation
2. Choose **FetchXML** as query type
3. Enter your complete FetchXML query
4. Execute the workflow

### Using Alternate Keys

1. Select **Get** operation
2. Choose **Alternate Key** as Record ID Type
3. Add your alternate key name-value pairs
4. Execute the workflow

### Example: Get Account by Email

```
Operation: Get
Table: accounts
Record ID Type: Alternate Key
Alternate Keys:
  - Key Name: emailaddress1
  - Key Value: contact@example.com
```

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Microsoft Dataverse Web API Reference](https://docs.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview)
- [OData Query Options](https://docs.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api)
- [FetchXML Reference](https://docs.microsoft.com/en-us/power-apps/developer/data-platform/fetchxml/overview)
- [Authenticate with OAuth](https://docs.microsoft.com/en-us/power-apps/developer/data-platform/authenticate-oauth)
