import type { IDataObject } from 'n8n-workflow';

export interface DataverseEntity {
	LogicalName: string;
	EntitySetName: string;
	DisplayName?: { UserLocalizedLabel?: { Label: string } };
	PrimaryIdAttribute?: string;
	Attributes?: Array<{
		LogicalName: string;
		AttributeType: string;
		DisplayName?: { UserLocalizedLabel?: { Label: string } };
	}>;
}

export interface DataverseApiResponse {
	value?: IDataObject[];
	[key: string]: unknown;
}

export interface FieldValue {
	name: string;
	value: string;
}

export interface AlternateKey {
	name: string;
	value: string;
}

export type RecordIdType = 'id' | 'alternateKey';
export type QueryType = 'odata' | 'fetchxml';
export type Operation = 'create' | 'delete' | 'get' | 'getMany' | 'update';
