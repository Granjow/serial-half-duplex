import { ISerialPort } from '../src/serial-half-duplex';
import { Transform } from 'stream';

export class VirtualSerialPort implements ISerialPort {

    on( eventName : string, f : () => void ) : void {
    }

    pipe( dest : Transform ) : any {
        this._dest = dest;
        return dest;
    }

    writeToPipe( data : Buffer ) {
        this._dest._write( data, 'utf8', ( err : any ) => {
            if ( err ) throw new Error( err );
        } );
    }

    _dest : Transform;

    write( data : Buffer | string ) : boolean {
        return true;
    }

    drain( f? : ( error? : any ) => void ) : void {
    }

    close( f : ( error? : any ) => void ) : void {
        f();
    }
}