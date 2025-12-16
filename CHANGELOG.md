# Changelog

All notable changes to this project will be documented in this file.

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
