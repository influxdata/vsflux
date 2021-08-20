export enum InfluxConnectionVersion {
    V2 = 0,
    V1 = 1
}
export interface IConnection {
    readonly version : InfluxConnectionVersion;
    readonly id : string;
    readonly name : string;
    readonly hostNport : string;
    readonly token : string;
    readonly org : string;
    readonly user : string;
    readonly pass : string;
    isActive : boolean;
}