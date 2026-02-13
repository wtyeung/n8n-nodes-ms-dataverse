# n8n-nodes-ms-dataverse — Development Plan

## Current Version: 0.4.0

## Completed Features

### v0.3.3
- [x] Fix 431 Request Header Fields Too Large — added `noDataExpression: true` to OAuth2 credential fields

### v0.4.0
- [x] **Webhook Resource** — Register endpoints, register steps, list/delete endpoints and steps, list SDK message filters
- [x] **Plugin Resource** — Upload DLL assemblies, register plugin steps, list/delete assemblies
- [x] **Web Resource** — Upload/update/list/delete web resources (JS, CSS, HTML, images, etc.)
- [x] Two-stage webhook registration (endpoint + step)
- [x] Filtering attributes for Update operations (webhook and plugin steps)
- [x] Auto base64 encoding for text-based web resources
- [x] Dynamic SDK message ID resolution (no hardcoded GUIDs)

## Architecture

```
nodes/Dataverse/
├── Dataverse.node.ts          # Main node — routing, properties, execute
├── GenericFunctions.ts        # API request helpers
├── descriptions.ts            # UI field definitions for all resources
├── types.ts                   # Shared TypeScript types
├── dataverse.svg              # Node icon
└── operations/
    ├── RecordOperations.ts    # CRUD operations on records
    ├── SqlOperations.ts       # TDS/SQL query execution
    ├── WebhookOperations.ts   # Webhook endpoint & step management
    ├── PluginOperations.ts    # DLL plugin assembly & step management
    └── WebResourceOperations.ts # Web resource upload/update/list/delete
```

## Resources & Operations

| Resource | Operations |
|----------|-----------|
| Record | Create, Get, Get Many, Update, Delete |
| SQL Query | Execute Query |
| Webhook | Register Endpoint, Register Step, List Endpoints, List Endpoint Steps, Delete Endpoint, Delete Step, List SDK Message Filters |
| Plugin | Upload Assembly, Register Step, List Assemblies, Delete Assembly |
| Web Resource | Upload, Update, List, Delete |

## Future Ideas

- [ ] Publish web resource after upload/update (publish customization API)
- [ ] Solution management (add components to solutions)
- [ ] Bulk operations (batch API)
- [ ] Entity metadata operations (create/modify tables and fields)
- [ ] Business process flow management
- [ ] Environment variable management
