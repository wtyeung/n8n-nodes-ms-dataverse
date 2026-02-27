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

- **Assign**: Assign a record to a user or team (change ownership)
- **Create**: Create a new record in a table
- **Delete**: Delete a record by ID or alternate key
- **Get**: Retrieve a single record by ID or alternate key
- **Get Many**: Retrieve multiple records using OData queries or FetchXML
- **Update**: Update an existing record by ID or alternate key
- **Upsert**: Create a new record or update if it exists (based on alternate key)
- **Share Access Add**: Grant access to a record for a user or team
- **Share Access List**: List all users and teams who have access to a record
- **Share Access Revoke**: Revoke access to a record from a user or team

#### Choice Field Helper

When working with choice (picklist) fields in Create, Update, or Upsert operations:
- **View Choice Field**: Select a field name to view its available options
- **Choice Options Viewer**: Displays options in "Label (Value)" format
- Supports both Local Choice (OptionSet) and Global Choice (GlobalOptionSet)
- Copy the numeric value to use in your field values

### Global Choice Operations

Manage global choice option sets (reusable picklists across multiple tables):

- **List**: List all global choices with their options
- **Get**: Retrieve a specific global choice with all its options
- **Create**: Create a new global choice with initial options
- **Add Option**: Add a new option to an existing global choice
- **Update Option**: Update the label of an existing option
- **Delete Option**: Remove an option from a global choice
- **Delete**: Delete an entire global choice

### SQL Query via TDS (Read-Only)

- **Execute Query**: Run SQL queries directly against Dataverse using the Tabular Data Stream (TDS) endpoint
  - Supports standard SQL SELECT statements
  - Read-only access (no INSERT, UPDATE, DELETE)
  - Requires TDS endpoint to be enabled in your Dataverse environment

### Webhook Operations

Manage webhook endpoints and steps for real-time event notifications from Dataverse.

- **Register Endpoint**: Create a reusable webhook URL (ServiceEndpoint)
- **Register Step**: Link an endpoint to a specific table and operation (SDK Message Processing Step)
- **List Endpoints**: List all registered webhook endpoints
- **List Endpoint Steps**: List steps associated with an endpoint
- **Delete Endpoint**: Delete a webhook endpoint and all its associated steps
- **Delete Step**: Delete a specific SDK message processing step
- **List SDK Message Filters**: List available message filters for a table

**Two-stage registration:**
1. First, register a reusable endpoint (webhook URL)
2. Then, register one or more steps to link that endpoint to table events (Create, Update, Delete, Assign, SetState)

For Update operations, you can specify **Filtering Attributes** — a comma-separated list of field names that trigger the webhook (e.g., `name,emailaddress1`).

### Plugin Operations

Manage DLL plugin assemblies and their registration steps.

- **Upload Assembly**: Upload a DLL plugin assembly to Dataverse
- **Register Step**: Register a plugin step for a table/operation
- **List Assemblies**: List all plugin assemblies
- **Delete Assembly**: Delete a plugin assembly

Plugin steps support:
- **Event Operations**: Create, Update, Delete
- **Execution Stages**: Pre-Validation, Pre-Operation, Post-Operation
- **Filtering Attributes**: Specify which fields trigger the plugin (Update only)

### Web Resource Operations

Upload and manage web resources (JavaScript, CSS, HTML, images, etc.).

- **Upload**: Create a new web resource
- **Update**: Update content of an existing web resource
- **List**: List web resources with optional type filter
- **Delete**: Delete a web resource

Supported web resource types: HTML, CSS, JavaScript, XML, PNG, JPG, GIF, XAP (Silverlight), XSL, ICO, SVG, RESX.

For text-based types (JS, CSS, HTML, XML), provide raw code — it will be base64-encoded automatically. For binary types (images), provide pre-encoded base64 content.

### Features

- **Dynamic Table Discovery**: Automatically loads available tables from your Dataverse environment using the OData metadata endpoint
- **Dynamic Field Selection**: Field names load from table metadata with dropdowns showing display name, logical name, and type
- **Alternate Key Support**: All record operations (Get, Update, Delete, Share) support alternate keys with dynamic field selection
- **Image & File Downloads**: Automatically detect and download image and file fields as binary data
- **OData Support**: Use OData query syntax for filtering, sorting, and selecting fields
- **FetchXML Support**: Execute complex queries using FetchXML
- **TDS/SQL Support**: Execute SQL queries for complex data retrieval and analysis
- **JSON Input Mode**: Create, Update, and Upsert operations support both field collection and JSON input modes
- **Access Control**: Share records with users/teams, list access, and revoke access with UPN/team name lookup
- **Custom Authentication**: Use custom environment URL and access token for environments without OAuth2 setup
- **Enhanced Error Messages**: Detailed error messages with HTTP status codes and Dataverse error codes

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

### Configuring Authentication in n8n

#### Option 1: OAuth2 (Default - Recommended)

1. In n8n, create new credentials of type **Microsoft Dataverse OAuth2 API**
2. Enter your **Environment URL** (e.g., `https://yourorg.crm.dynamics.com`)
3. Enter the **Client ID** from your Azure app registration
4. Enter the **Client Secret** from your Azure app registration
5. Click **Connect my account** and authorize the application
6. Test the connection

#### Option 2: Custom Authentication (For test/sandbox environments)

Use this option when you have an access token but don't have OAuth2 configured in the target environment (e.g., test/sandbox environments).

1. In the node, scroll to **Options** section at the bottom
2. Click **Add Option** and enable **Use Custom Authentication**
3. Enter your **Environment URL** (e.g., `https://yourorg.crm.dynamics.com`)
4. In the **Access Token** field, provide the token:
   - From webhook header: `={{$json.headers.authorization.replace("Bearer ", "")}}`
   - From previous node: `={{$node["PreviousNode"].json["access_token"]}}`
   - Or paste a token directly (for testing)

**Note:** 
- Access tokens typically expire after 1 hour. For production use with automatic token refresh, use OAuth2 method instead.
- No OAuth2 credentials are required when using custom authentication.

**Example Use Case:** 
- Copy an access token from a production environment (with OAuth2 configured)
- Use it to test against a sandbox environment (without OAuth2 setup)
- Receive a webhook from Power Automate with an Authorization header and use that token

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

Alternate keys allow you to identify records using business keys instead of GUIDs. Supported operations: Get, Update, Delete, Upsert, Share Access Add, Share Access List, Share Access Revoke.

1. Select any supported operation
2. Choose **Alternate Key** as Record ID Type
3. Select key name from dropdown (loads from table's defined alternate keys)
4. Enter the key value
5. Execute the workflow

### Example: Get Account by Email

```
Operation: Get
Table: accounts
Record ID Type: Alternate Key
Alternate Keys:
  - Key Name: emailaddress1 (selected from dropdown)
  - Key Value: contact@example.com
```

### Using Upsert Operation

Upsert creates a new record if it doesn't exist, or updates it if it does (based on alternate keys).

**With Alternate Keys** (Update or Create):
```
Operation: Upsert
Table: ssl_certs
Alternate Keys:
  - Key Name: domain
  - Key Value: example.com
Fields:
  - Field Name: status
  - Field Value: active
```

**Without Alternate Keys** (Always Create):
```
Operation: Upsert
Table: contacts
Fields:
  - Field Name: firstname
  - Field Value: John
```

### Managing Record Access

#### Share Access with User (by Email/UPN)

```
Operation: Share Access Add
Table: accounts
Record ID Type: Primary Key (ID)
Record ID: abc-123-def-456
Principal Type: User
Principal ID Type: UPN (User Principal Name)
User Principal Name: user@example.com
Access Rights: Read, Write
```

#### Share Access with Team (by Name)

```
Operation: Share Access Add
Table: accounts
Record ID Type: Alternate Key
Alternate Keys:
  - Key Name: accountnumber
  - Key Value: ACC-001
Principal Type: Team
Team Name: Sales Team
Access Rights: Read, Write, Delete
```

#### List Who Has Access

```
Operation: Share Access List
Table: accounts
Record ID: abc-123-def-456
```

Returns all users and teams with access and their permission levels.

#### Revoke Access

```
Operation: Share Access Revoke
Table: accounts
Record ID: abc-123-def-456
Principal Type: User
Principal ID Type: UPN
User Principal Name: user@example.com
```

### Executing SQL Queries via TDS

#### Prerequisites

1. **Enable TDS Endpoint** in your Dataverse environment:
   - Go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com/)
   - Select your environment
   - Go to **Settings** → **Product** → **Features**
   - Enable **"Tabular Data Stream (TDS) endpoint"**
   - Save changes

2. **Configure IP Firewall** (if applicable):
   - Ensure your n8n instance IP is allowed in Dataverse firewall rules

3. **OAuth2 Scope**: Ensure your OAuth2 token includes the scope: `https://yourorg.crm.dynamics.com/.default`

#### Using SQL Queries

1. Select **SQL Query via TDS (Read-Only)** as the resource
2. Select **Execute Query** operation
3. Enter your SQL query (e.g., `SELECT TOP 10 name, emailaddress1 FROM account`)
4. Execute the workflow

#### Example SQL Queries

**Get top 10 accounts:**
```sql
SELECT TOP 10 accountid, name, emailaddress1, createdon 
FROM account 
ORDER BY createdon DESC
```

**Filter with WHERE clause:**
```sql
SELECT name, revenue, industrycode 
FROM account 
WHERE revenue > 1000000 
AND statecode = 0
```

**Join tables:**
```sql
SELECT a.name, c.fullname, c.emailaddress1
FROM account a
INNER JOIN contact c ON a.accountid = c.parentcustomerid
WHERE a.statecode = 0
```

**Note:** TDS endpoint is read-only. INSERT, UPDATE, and DELETE operations are not supported.

### Viewing Table Field Schemas

To discover available fields and their logical names for a table:

1. Select any operation (Create, Get, Update, Get Many, or SQL Query)
2. Choose a table from the dropdown
3. Look for the **View Table Fields (Reference Only)** dropdown
4. Click to load and browse all available fields
5. Each field shows:
   - Display Name (e.g., "Account Name")
   - Logical Name (e.g., "name") - use this in your queries
   - Field Type (e.g., "String", "Lookup", "DateTime")
   - Permissions: [C] = Create, [U] = Update, [R] = Read

**Note:** This field is for reference only and doesn't affect the operation. Use the logical names you discover here in your field mappings and queries.

### Downloading Images and Files

The **Get** operation can automatically download image and file fields as binary data, making them available for further processing in your workflow.

#### Downloading Images

1. Select **Get** operation
2. In **Options**, find **Download Images** and choose:
   - **None**: Don't download images (default)
   - **Thumbnails Only**: Download base64-encoded thumbnails from the response
   - **Full Images (Download via API)**: Download full-resolution images via separate API calls

3. **Auto-detect** (recommended): Leave **Image Field Names** empty to automatically detect all image fields using metadata
4. **Manual specification**: Enter comma-separated field names (e.g., `crb1b_img,entityimage`)

**Example:**
```
Operation: Get
Table: contacts
Record ID: abc123...
Options:
  - Download Images: Full Images (Download via API)
  - Image Field Names: (leave empty for auto-detect)
```

Binary data will be available as `$binary.entityimage`, `$binary.crb1b_img`, etc.

#### Downloading Files

1. Select **Get** operation
2. In **Options**, enable **Download Files**
3. **Auto-detect** (recommended): Leave **File Field Names** empty to automatically detect all file fields using metadata
4. **Manual specification**: Enter comma-separated field names (e.g., `crb1b_document,attachment`)

**Example:**
```
Operation: Get
Table: crb1b_academicprograms
Record ID: def456...
Options:
  - Download Files: true
  - File Field Names: (leave empty for auto-detect)
```

Binary data will be available as `$binary.document`, `$binary.attachment`, etc.

#### How It Works

- **Metadata-based detection**: The node queries the EntityDefinitions API to identify Virtual attributes that are images (have `_url` and `_timestamp` fields) or files (have `_name` field)
- **Empty field handling**: Null or empty fields are automatically skipped
- **Filename preservation**: Original filenames are preserved when available (e.g., from `fieldname_name`)
- **Binary property naming**: Clean property names are generated (e.g., `crb1b_document` becomes `document`)
- **Multiple fields**: Download multiple image and file fields from a single record

#### Technical Details

- **Images**: Downloaded via PowerApps Image endpoint (`/Image/download.aspx?Full=true`)
- **Files**: Downloaded via Web API endpoint (`/[entity]([id])/[field]/$value`)
- **Format**: Binary data is properly formatted for n8n's binary data system
- **Error handling**: Download failures are logged but don't stop the workflow

### Using Custom Authentication

See the [Custom Authentication section](#option-2-custom-authentication-for-testsandbox-environments) under Credentials for detailed instructions on using custom environment URLs and access tokens.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Microsoft Dataverse Web API Reference](https://docs.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview)
- [OData Query Options](https://docs.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api)
- [FetchXML Reference](https://docs.microsoft.com/en-us/power-apps/developer/data-platform/fetchxml/overview)
- [Authenticate with OAuth](https://docs.microsoft.com/en-us/power-apps/developer/data-platform/authenticate-oauth)
