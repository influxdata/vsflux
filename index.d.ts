// import {Stream} from 'stream';

declare module '@influxdata/flux-lsp-cli' {
    export default class CLI {
        constructor(options : { 'disable-folding' : boolean })
        createStream : () => any
        on : (event : 'log', cb : (msg : string) => void) => void
        registerBucketsCallback : (fn : () => Promise<string[]>) => void
    }
}
