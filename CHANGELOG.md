# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2] - 2024-12-17

### Added
- **Custom Authentication Option**: New "Options" section with toggle for custom access token
- Access token field in Options (appears when "Use Custom Authentication" is enabled)
- Support for using tokens from webhooks or previous nodes via expressions
- Safe fallback to OAuth2 if custom auth is enabled but no token provided

### Changed
- Added collapsible Options section (similar to other n8n nodes)
- Access token can be dynamically mapped from workflow data
- Updated documentation with custom authentication examples

### Use Cases
- Receive API calls with bearer tokens in webhooks and use them to interact with Dataverse
- Chain authentication from other nodes without storing credentials
- Dynamic token-based workflows

## [0.1.1] - 2024-12-16

### Fixed
- Linting errors: updated to use IHttpRequestOptions
- Added proper icon to credentials

## [0.1.0] - 2024-12-16

### Added
- Initial release of Microsoft Dataverse node
- Microsoft Dataverse OAuth2 credentials extending Microsoft OAuth2
- CRUD operations (Create, Read, Update, Delete) for Dataverse records
- Dynamic table discovery using OData metadata endpoint
- OData query support for filtering, sorting, and field selection
- FetchXML query support for complex queries
- Get single record by ID or alternate key-set
- Get many records with OData or FetchXML
- Automatic table list loading with search functionality
- Comprehensive error handling and continue-on-fail support

### Features
- **Create**: Create new records with custom fields
- **Get**: Retrieve single records using GUID or alternate keys
- **Get Many**: Query multiple records with OData filters or FetchXML
- **Update**: Update existing records with new field values
- **Delete**: Remove records by ID
- **Table Discovery**: Automatically loads available tables from your environment
- **Field Selection**: Choose specific fields to return in queries
