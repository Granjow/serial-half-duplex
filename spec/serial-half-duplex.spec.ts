import { Transform } from 'stream';
import { ISerialPort, SerialHalfDuplex } from '../src/serial-half-duplex';


class VirtualSerialPort implements ISerialPort {

    on( eventName : string, f : () => void ) : void {
    }

    pipe( dest : Transform ) : any {
        this._dest = dest;
        return dest;
    }

    writeToPipe( data : Buffer ) {
        this._dest._write( data, 'utf8', ( err:any ) => {
            if ( err ) throw new Error( err );
        } );
    }

    _dest : Transform;

    write( data : Buffer | string ) : boolean {
        return true;
    }

    drain( f? : ( error : any ) => void ) : void {
    }
}

describe( 'Half duplex serial IO', () => {

    let port : VirtualSerialPort;

    beforeEach( () => {
        port = new VirtualSerialPort();
    } );

    it( 'can be initialised', () => {
        expect( () => new SerialHalfDuplex( port ) ).not.toThrow();
    } );

    it( 'can send data', () => {
        const shd = new SerialHalfDuplex( port );
        return expectAsync( shd.send( Buffer.from( 'foo' ) ) ).toBeResolved();
    } );

    it( 'can receive data', () => {
        const shd = new SerialHalfDuplex( port );
        setTimeout( () => {
            port.writeToPipe( Buffer.from( '123\r\n' ) );
        }, 10 );
        return expectAsync( shd.sendAndReceive( Buffer.from( 'foo' ), 50 ) ).toBeResolvedTo( Buffer.from( '123' ) );
    } );

} );