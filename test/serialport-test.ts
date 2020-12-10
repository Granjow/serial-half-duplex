import { VrcConf } from 'vrc/dist/src/vrc-conf';

const SerialPort = require( 'serialport' );
const Readline = require( '@serialport/parser-readline' );

interface Conf {
    device : string;
}

const vrcConf = new VrcConf<Conf>( 'serialport-test', [
    { name: 'device', type: 'string', dflt: undefined, desc: 'Device to use (default: First available device)' },
] ).run();

const openPort = ( portName : string ) => {
    console.log( `Opening serial port ${portName} …` );
    const port = new SerialPort( portName, {
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

    port.debugMode = true;

    port.on( 'error', () => {
        console.error( `Unhandled serial error` );
    } );

    const parser = port.pipe( new Readline( { delimiter: '\r\n' } ) );
    parser.on( 'data', ( data : string ) => {
        console.log( `UART data received: ${data}` );
    } );

    port.write( 'EN\rV100\r' );
};

SerialPort.list().then( ( portInfo : any[] ) => {
    console.log( `List of serial ports:` );
    console.log( portInfo.map( ( el ) => `* ${el.comName}: ${JSON.stringify( el )}` ).join( '\n' ) );

    const uartPorts = portInfo.filter( ( el ) => el.vendorId === '10c4' );
    if ( vrcConf.conf.device !== undefined ) {
        openPort( vrcConf.conf.device );
    } else {
        if ( uartPorts.length === 0 ) {
            console.log( `No UART devices found.` );
        } else {
            openPort( uartPorts[ 0 ].path );
        }
    }
} );
