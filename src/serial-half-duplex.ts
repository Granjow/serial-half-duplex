import { Semaphore } from 'semaphore-promise';
import { Transform } from 'stream';

const SerialPort = require( 'serialport' );
const Delimiter = require( '@serialport/parser-delimiter' );

export interface ISerialPort {
    on( eventName : string, f : Function ) : void;

    pipe( transform : Transform ) : any;

    write( data : Buffer ) : boolean;

    drain( f? : ( error? : any ) => void ) : void;

    close( f? : ( error? : any ) => void ) : void;
}

export interface SerialHalfDuplexArgs {
    /** What is used by the communication endpoint to mark the end of a response? Often `\r` or `\r\n`. */
    delimiter : string;
}

export interface SerialPortArgs {
    baudRate : number;
    dataBits : number;
    parity : string;
    stopBits : number;
}

export interface OnMessageCallback {
    ( message : Buffer ) : void;
}

/**
 * See
 * https://serialport.io/docs/api-stream#serialportlist
 */
export interface PortInfo {
    path : string;
    manufacturer : string | undefined;
    serialNumber : string | undefined;
    pnpId : string | undefined;
    locationId : string | undefined;
    productId : string | undefined;
    vendorId : string | undefined;
}

export interface PredicateFilter {
    ( info : PortInfo ) : boolean;
}

export class SerialHalfDuplex {

    static readonly defaultSerialPortArgs : SerialPortArgs = {
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
    };

    static readonly isCp210xUartBridge : PredicateFilter = ( info ) => info.vendorId === '10c4';

    static findSuitablePort( predicate : ( info : PortInfo ) => boolean = SerialHalfDuplex.isCp210xUartBridge ) : Promise<string> {
        return SerialPort.list().then( ( portInfo : PortInfo[] ) => {
            const uartPorts = portInfo.filter( ( el ) => el.vendorId === '10c4' );
            if ( uartPorts.length === 0 ) {
                throw new Error( `No UART devices found.` );
            } else {
                return uartPorts[ 0 ].path;
            }
        } );
    }

    static openSerialPort( portName : string, args? : SerialPortArgs ) : ISerialPort {

        console.log( `Opening serial port ${portName} …` );

        const settings : SerialPortArgs = Object.assign( {}, SerialHalfDuplex.defaultSerialPortArgs, args );
        console.log( 'Settings:', JSON.stringify( settings ) );

        return new SerialPort( portName, settings, ( error : Error ) => {
            if ( error ) {
                console.log( `Could not open port: ${error.message}` );
            } else {
                console.log( `Serial port opened.` );
            }
        } );
    }


    // When set to true, data that is sent and received over the serial port is printed.
    debugMode : boolean = false;

    /**
     * @param port Needs to be opened beforehand, e.g. with SerialHalfDuplex#openSerialPort
     * @param args Additional arguments to configure serial settings
     */
    constructor( port : ISerialPort, args? : SerialHalfDuplexArgs ) {

        port.on( 'error', () => {
            console.error( `Unhandled serial error` );
        } );

        const parser = port.pipe( new Delimiter( { delimiter: Buffer.from( ( args && args.delimiter ) || '\r\n' ) } ) );
        parser.on( 'data', ( data : any ) => {
            if ( this.debugMode ) console.log( `Serial ← ${data}` );
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
    sendAndReceive( cmd : Buffer, timeout : number = 20 ) : Promise<Buffer> {
        return this.sendAndReceiveMany( cmd, timeout, 1 )
            .then( ( result ) => result[ 0 ] );
    }


    /**
     * Send a command and wait for an answer.
     * @param cmd Command to send
     * @param timeout How long to wait for an answer
     * @param expectedLines Specifies the number of expected lines. Some devices (like e.g. the H5382BD beamer) return two lines.
     */
    sendAndReceiveMany( cmd : Buffer, timeout : number = 20, expectedLines : number = 1 ) : Promise<Buffer[]> {
        const result : Promise<Buffer[]> = this._semaphore.acquire().then( ( releaseSemaphore ) => new Promise<Buffer[]>( ( resolve, reject ) => {
            if ( this.debugMode ) console.log( `Serial → ${cmd}` );

            this._port.write( cmd );

            const lines : Buffer[] = [];

            const answerTimeout = setTimeout( () => {
                if ( lines.length > 0 ) {
                    resolve( lines );
                } else {
                    reject( 'Timeout; no answer received' );
                }
                releaseSemaphore();
            }, timeout );

            this._currentReader = ( line : Buffer ) => {
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
    send( cmd : Buffer ) : Promise<void> {
        return this._semaphore.acquire().then( ( release ) => {
            this._port.write( cmd );
            this._port.drain();
            release();
        } );
    }

    onMessage( callback : OnMessageCallback ) : void {
        this._onMessageCallbacks.push( callback );
    }

    /**
     * Close the serial port.
     */
    close() : Promise<void> {
        return new Promise( ( resolve, reject ) => {
            this._port.close( ( error : any ) => {
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
        this._currentReader = ( line : Buffer ) => {
            if ( this.debugMode ) console.log( `Serial: Received spontaneous data: ${line}` );
            for ( let callback of this._onMessageCallbacks ) {
                callback( line );
            }
        }
    }


    private _port : ISerialPort;
    private _semaphore : Semaphore = new Semaphore( 1 );
    private _currentReader : ( line : Buffer ) => void;
    private _onMessageCallbacks : OnMessageCallback[] = [];

}