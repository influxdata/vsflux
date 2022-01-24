export enum InfluxVersion {
    V2 = 0,
    V1 = 1
}
export interface IInstance {
    readonly id : string;
    readonly name : string;
    readonly hostNport : string;
    readonly token : string;
    readonly org : string;
    readonly orgID ?: string;
    isActive : boolean;
    // Until there is a way to "migrate" this data, it may not
    // exist in the data store
    readonly disableTLS : boolean | undefined;
}

export interface IMigration {
    readonly name : string;
    readonly appliedOn : Date;
}
