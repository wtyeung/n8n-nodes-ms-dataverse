import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { searchTables, getTableFieldsForDisplay, getTableFieldNames, getAlternateKeyFields } from './GenericFunctions';
import {
	resourceDescription,
	operationDescription,
	tableDescription,
	fieldSchemaSelector,
	createOperationFields,
	getOperationFields,
	updateOperationFields,
	getManyOperationFields,
	upsertOperationFields,
	shareOperationFields,
	optionsDescription,
	sqlQueryFields,
	sqlOperationDescription,
	webhookOperationDescription,
	webhookOperationFields,
	pluginOperationDescription,
	pluginOperationFields,
	webResourceOperationDescription,
	webResourceOperationFields,
} from './descriptions';
import {
	createRecord,
	getRecord,
	getManyRecords,
	updateRecord,
	upsertRecord,
	deleteRecord,
	shareRecord,
} from './operations/RecordOperations';
import {
	uploadPluginAssembly,
	registerPluginStep,
	listPluginAssemblies,
	deletePluginAssembly,
} from './operations/PluginOperations';
import {
	uploadWebResource,
	updateWebResource,
	listWebResources,
	deleteWebResource,
} from './operations/WebResourceOperations';
import { executeSqlQuery } from './operations/SqlOperations';
import {
	registerEndpoint,
	registerWebhookStep,
	listEndpoints,
	deleteEndpoint,
	listEndpointSteps,
	deleteStep,
	listSdkMessageFilters,
} from './operations/WebhookOperations';

export type RecordIdType = 'id' | 'alternateKey';
export type QueryType = 'odata' | 'fetchxml';
export type Operation = 'create' | 'delete' | 'get' | 'getMany' | 'update' | 'upsert' | 'share' | 'executeQuery' | 'registerEndpoint' | 'registerWebhookStep' | 'listEndpoints' | 'deleteEndpoint' | 'listEndpointSteps' | 'deleteStep' | 'listSdkMessageFilters' | 'uploadPluginAssembly' | 'registerPluginStep' | 'listPluginAssemblies' | 'deletePluginAssembly' | 'uploadWebResource' | 'updateWebResource' | 'listWebResources' | 'deleteWebResource';

export class Dataverse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Dataverse',
		name: 'dataverse',
		icon: 'file:dataverse.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Dataverse (Power Platform)',
		defaults: {
			name: 'Dataverse',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'dataverseOAuth2Api',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.environmentUrl}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			resourceDescription,
			operationDescription,
			sqlOperationDescription,
			pluginOperationDescription,
			...pluginOperationFields,
			webResourceOperationDescription,
			...webResourceOperationFields,
			webhookOperationDescription,
			...webhookOperationFields,
			tableDescription,
			fieldSchemaSelector,
			...createOperationFields,
			...getOperationFields,
			...updateOperationFields,
			...upsertOperationFields,
			...shareOperationFields,
			...getManyOperationFields,
			...sqlQueryFields,
			optionsDescription,
		],
	};

	methods = {
		listSearch: {
			searchTables,
		},
		loadOptions: {
			getTableFieldsForDisplay,
			getTableFieldNames,
			getAlternateKeyFields,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0) as Operation;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'sql') {
					// Handle SQL query execution
					const sqlResults = await executeSqlQuery.call(this, i);
					returnData.push(...sqlResults);
				} else if (resource === 'record') {
					const table = this.getNodeParameter('table', i, '', { extractValue: true }) as string;
					let result: INodeExecutionData | INodeExecutionData[];

					switch (operation) {
						case 'create': {
							const createResult = await createRecord.call(this, table, i);
							result = { json: createResult, pairedItem: { item: i } };
							break;
						}

						case 'get': {
							result = await getRecord.call(this, table, i);
							break;
						}

						case 'getMany': {
							result = await getManyRecords.call(this, table, i);
							break;
						}

						case 'update': {
							const updateResult = await updateRecord.call(this, table, i);
							result = { json: updateResult, pairedItem: { item: i } };
							break;
						}

						case 'upsert': {
							const upsertResult = await upsertRecord.call(this, table, i);
							result = { json: upsertResult, pairedItem: { item: i } };
							break;
						}

						case 'share': {
							const shareResult = await shareRecord.call(this, table, i);
							result = { json: shareResult, pairedItem: { item: i } };
							break;
						}

						case 'delete': {
							const deleteResult = await deleteRecord.call(this, table, i);
							result = { json: deleteResult, pairedItem: { item: i } };
							break;
						}

						default:
							throw new NodeOperationError(
								this.getNode(),
								`The operation "${operation}" is not supported`,
							);
					}

					if (Array.isArray(result)) {
						returnData.push(...result);
					} else {
						returnData.push(result);
					}
				} else if (resource === 'webhook') {
					// Handle Webhook operations
					let result: INodeExecutionData | INodeExecutionData[];

					switch (operation) {
						case 'registerEndpoint': {
							result = await registerEndpoint.call(this, i);
							break;
						}

						case 'registerWebhookStep': {
							result = await registerWebhookStep.call(this, i);
							break;
						}

						case 'listEndpoints': {
							result = await listEndpoints.call(this, i);
							break;
						}

						case 'deleteEndpoint': {
							result = await deleteEndpoint.call(this, i);
							break;
						}

						case 'listEndpointSteps': {
							result = await listEndpointSteps.call(this, i);
							break;
						}

						case 'deleteStep': {
							result = await deleteStep.call(this, i);
							break;
						}

						case 'listSdkMessageFilters': {
							result = await listSdkMessageFilters.call(this, i);
							break;
						}

						default:
							throw new NodeOperationError(
								this.getNode(),
								`The webhook operation "${operation}" is not supported`,
							);
					}

					if (Array.isArray(result)) {
						returnData.push(...result);
					} else {
						returnData.push(result);
					}
				} else if (resource === 'plugin') {
					// Handle Plugin operations
					let result: INodeExecutionData | INodeExecutionData[];

					switch (operation) {
						case 'uploadPluginAssembly': {
							result = await uploadPluginAssembly.call(this, i);
							break;
						}

						case 'registerPluginStep': {
							result = await registerPluginStep.call(this, i);
							break;
						}

						case 'listPluginAssemblies': {
							result = await listPluginAssemblies.call(this, i);
							break;
						}

						case 'deletePluginAssembly': {
							result = await deletePluginAssembly.call(this, i);
							break;
						}

						default:
							throw new NodeOperationError(
								this.getNode(),
								`The plugin operation "${operation}" is not supported`,
							);
					}

					if (Array.isArray(result)) {
						returnData.push(...result);
					} else {
						returnData.push(result);
					}
				} else if (resource === 'webresource') {
					// Handle Web Resource operations
					let result: INodeExecutionData | INodeExecutionData[];

					switch (operation) {
						case 'uploadWebResource': {
							result = await uploadWebResource.call(this, i);
							break;
						}

						case 'updateWebResource': {
							result = await updateWebResource.call(this, i);
							break;
						}

						case 'listWebResources': {
							result = await listWebResources.call(this, i);
							break;
						}

						case 'deleteWebResource': {
							result = await deleteWebResource.call(this, i);
							break;
						}

						default:
							throw new NodeOperationError(
								this.getNode(),
								`The web resource operation "${operation}" is not supported`,
							);
					}

					if (Array.isArray(result)) {
						returnData.push(...result);
					} else {
						returnData.push(result);
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}
