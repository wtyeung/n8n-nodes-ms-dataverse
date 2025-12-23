import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { searchTables } from './GenericFunctions';
import {
	resourceDescription,
	operationDescription,
	tableDescription,
	createOperationFields,
	getOperationFields,
	updateOperationFields,
	getManyOperationFields,
	optionsDescription,
	sqlOperationDescription,
	sqlQueryFields,
} from './descriptions';
import {
	createRecord,
	getRecord,
	getManyRecords,
	updateRecord,
	deleteRecord,
} from './operations/RecordOperations';
import { executeSqlQuery } from './operations/SqlOperations';
import type { Operation } from './types';

export class Dataverse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Dataverse',
		name: 'dataverse',
		icon: 'file:dataverse.png',
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
			tableDescription,
			...createOperationFields,
			...getOperationFields,
			...updateOperationFields,
			...getManyOperationFields,
			...sqlQueryFields,
			optionsDescription,
		],
	};

	methods = {
		listSearch: {
			searchTables,
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
							const getResult = await getRecord.call(this, table, i);
							result = { json: getResult, pairedItem: { item: i } };
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
