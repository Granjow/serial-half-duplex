import { Semaphore } from 'semaphore-promise';
import { Transform } from 'stream';

const SerialPort = require( 'serialport' );
const Delimiter = require( '@serialport/parser-delimiter' );

export interface ISerialPort {
    on( eventName: 'open' | 'error' | 'close' | 'data' | 'drain', f: Function ): void;

    pipe( transform: Transform ): any;

    write( data: Buffer ): boolean;

    drain( f?: ( error?: any ) => void ): void;

    close( f?: ( error?: any ) => void ): void;
}

export interface ISerialLogger {
    info( data: string ): void;

    error( data: string ): void;
}

export interface SerialHalfDuplexArgs {
    /** What is used by the communication endpoint to mark the end of a response? Often `\r` or `\r\n`. */
    inputDelimiter: string;
    /** When defined, data exchanged over the serial port is printed with the logger. */
    logger?: ISerialLogger;
}

export interface SerialPortArgs {
    baudRate?: number;
    dataBits?: number;
    parity?: string;
    stopBits?: number;
}

export interface OnMessageCallback {
    ( message: Buffer ): void;
}

/**
 * See
 * https://serialport.io/docs/api-stream#serialportlist
 */
export interface PortInfo {
    path: string;
    manufacturer: string | undefined;
    serialNumber: string | undefined;
    pnpId: string | undefined;
    locationId: string | undefined;
    productId: string | undefined;
    vendorId: string | undefined;
}

export interface PredicateFilter {
    ( info: PortInfo ): boolean;
}

export class TimeoutError extends Error {
    public readonly isTimeoutError = true;

    constructor( message: string ) {
        super( message );
    }
}

export class SerialHalfDuplex {

    static readonly defaultSerialPortArgs: SerialPortArgs = {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
    };

    static readonly consoleLogger: ISerialLogger = {
        error( data: string ): void {
            console.error( data.replace( /\n/g, '␊' ).replace( /\r/g, '␍' ) );
        },

        info( data: string ): void {
            console.log( data.replace( /\n/g, '␊' ).replace( /\r/g, '␍' ) );
        },
    };

    static readonly isCp210xUartBridge: PredicateFilter = ( info ) => info.vendorId === '10c4';

    static findSuitablePort( predicate: ( info: PortInfo ) => boolean = SerialHalfDuplex.isCp210xUartBridge ): Promise<string> {
        return SerialPort.list().then( ( portInfo: PortInfo[] ) => {
            const uartPorts = portInfo.filter( ( el ) => el.vendorId === '10c4' );
            if ( uartPorts.length === 0 ) {
                throw new Error( `No UART devices found.` );
            } else {
                return uartPorts[ 0 ].path;
            }
        } );
    }

    static async openSerialPort( portName: string, args?: SerialPortArgs ): Promise<ISerialPort> {

        console.log( `Opening serial port ${portName} …` );

        const settings: SerialPortArgs = Object.assign( {}, SerialHalfDuplex.defaultSerialPortArgs, args );
        console.log( `Settings for ${portName}:`, JSON.stringify( settings ) );

        return new Promise( ( resolve, reject ) => {
            const port = new SerialPort( portName, settings, ( error: Error ) => {
                if ( error ) {
                    reject( `Could not open port: ${error.message}` );
                } else {
                    console.log( `Serial port ${portName} opened.` );
                    resolve( port );
                }
            } );
        } );
    }

    /**
     * Get the underlying Serial Port object which is used for communication.
     * Use it to e.g. attach close/error callbacks.
     */
    public get port(): ISerialPort {
        return this._port;
    }

    /**
     * @param port Needs to be opened beforehand, e.g. with SerialHalfDuplex#openSerialPort
     * @param args Additional arguments to configure serial settings
     */
    constructor( port: ISerialPort, args?: SerialHalfDuplexArgs ) {

        this._logger = args?.logger;

        port.on( 'error', () => {
            ( this._logger ?? console ).error( `Unhandled serial error` );
        } );

        const parser = port.pipe( new Delimiter( { delimiter: Buffer.from( ( args && args.inputDelimiter ) || '\r\n' ) } ) );
        parser.on( 'data', ( data: any ) => {
            this._logger?.info( `Serial ← ${data}` );
            this._currentReader( Buffer.from( data ) );
        } );

        this._port = port;

        this.resetReader();
    }


    /**
     * Send a command and wait for an answer.
     * @param cmd Command to send
     * @param timeout How long to wait for an answer
     */
    sendAndReceive( cmd: Buffer, timeout: number = 20 ): Promise<Buffer> {
        return this.sendAndReceiveMany( cmd, timeout, 1 )
            .then( ( result ) => result[ 0 ] );
    }


    /**
     * Send a command and wait for an answer.
     * @param cmd Command to send
     * @param timeout How long to wait for an answer
     * @param expectedLines Specifies the number of expected lines. Some devices (like e.g. the H5382BD beamer) return two lines.
     */
    sendAndReceiveMany( cmd: Buffer, timeout: number = 20, expectedLines: number = 1 ): Promise<Buffer[]> {
        const result: Promise<Buffer[]> = this._semaphore.acquire().then( ( releaseSemaphore ) => new Promise<Buffer[]>( ( resolve, reject ) => {
            this._logger?.info( `Serial → ${cmd}` );

            this._port.write( cmd );

            const lines: Buffer[] = [];

            const answerTimeout = setTimeout( () => {
                if ( lines.length > 0 ) {
                    resolve( lines );
                } else {
                    reject( new TimeoutError( 'Timeout; no answer received' ) );
                }
                releaseSemaphore();
            }, timeout );

            this._currentReader = ( line: Buffer ) => {
                lines.push( line );

                if ( lines.length >= expectedLines ) {
                    clearTimeout( answerTimeout );
                    resolve( lines );
                    releaseSemaphore();
                }
            };

        } ) );
        return result.finally( () => {
            this.resetReader();
        } );
    }

    /**
     * Send a command, ignoring the answer
     * @param cmd Command to send
     */
    send( cmd: Buffer ): Promise<void> {
        return this._semaphore.acquire().then( ( release ) => {
            this._port.write( cmd );
            this._port.drain();
            release();
        } );
    }

    /**
     * Attach a callback to incoming messages which are not sent as answer to a command,
     * i.e. data which the device sends on its own.
     */
    onMessage( callback: OnMessageCallback ): void {
        this._onMessageCallbacks.push( callback );
    }

    /**
     * Close the serial port and remove callback listeners
     */
    close(): Promise<void> {
        this._onMessageCallbacks.length = 0;
        return new Promise( ( resolve, reject ) => {
            this._port.close( ( error: any ) => {
                if ( error ) reject( error );
                else resolve();
            } );
        } );
    }

    /**
     * When data is received on the serial port, it is forwarded to this._currentReader.
     * This reader can be customised for a sendAndReceive command so it receives the answer.
     * This method resets the reader to ignore incoming data.
     */
    private resetReader() {
        this._currentReader = ( line: Buffer ) => {
            this._logger?.info( `Serial: Received spontaneous data: ${line}` );
            for ( let callback of this._onMessageCallbacks ) {
                callback( line );
            }
        }
    }


    private readonly _logger: ISerialLogger | undefined;

    private readonly _port: ISerialPort;
    private readonly _semaphore: Semaphore = new Semaphore( 1 );
    private readonly _onMessageCallbacks: OnMessageCallback[] = [];

    private _currentReader!: ( line: Buffer ) => void;

}
