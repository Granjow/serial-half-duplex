import { Semaphore } from 'semaphore-promise';
import { Transform } from 'stream';

const SerialPort = require( 'serialport' );
const Delimiter = require( '@serialport/parser-delimiter' );

export interface ISerialPort {
    on( eventName : string, f : Function ) : void;

    pipe( transform : Transform ) : any;

    write( data : Buffer ) : boolean;

    drain( f? : ( error : any ) => void ) : void;
}

export class SerialHalfDuplex {

    static findSuitablePort() : Promise<string> {
        return SerialPort.list().then( ( portInfo : any[] ) => {
            const uartPorts = portInfo.filter( ( el ) => el.vendorId === '10c4' );
            if ( uartPorts.length === 0 ) {
                throw new Error( `No UART devices found.` );
            } else {
                return uartPorts[ 0 ].comName;
            }
        } );
    }

    static openSerialPort( portName : string ) : ISerialPort {

        console.log( `Opening serial port ${portName} …` );

        return new SerialPort( portName, {
            baudRate: 9600, // default = 9600
            dataBits: 8, // default = 8
            parity: 'none', // default = none
            stopBits: 1, // default = 1
        }, ( error : Error ) => {
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
     */
    constructor( port : ISerialPort ) {

        port.on( 'error', () => {
            console.error( `Unhandled serial error` );
        } );

        const parser = port.pipe( new Delimiter( { delimiter: Buffer.from( '\r\n' ) } ) );
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
        const result : Promise<Buffer> = this._semaphore.acquire().then( ( releaseSemaphore ) => new Promise<Buffer>( ( resolve, reject ) => {
            if ( this.debugMode ) console.log( `Serial → ${cmd}` );

            this._port.write( cmd );

            const answerTimeout = setTimeout( () => {
                reject( 'Timeout; no answer received' );
                releaseSemaphore();
            }, timeout );

            this._currentReader = ( line : Buffer ) => {
                clearTimeout( answerTimeout );
                resolve( line );
                releaseSemaphore();
            };

        } ) );
        return result.finally( () => {
            this.resetReader()
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

    /**
     * When data is received on the serial port, it is forwarded to this._currentReader.
     * This reader can be customised for a sendAndReceive command so it receives the answer.
     * This method resets the reader to ignore incoming data.
     */
    private resetReader() {
        this._currentReader = ( line : Buffer ) => {
            if ( this.debugMode ) console.log( `Serial: Ignored line ${line}` );
        }
    }


    private _port : ISerialPort;
    private _semaphore : Semaphore = new Semaphore( 1 );
    private _currentReader : ( line : Buffer ) => void;

}