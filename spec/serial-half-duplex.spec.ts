import { SerialHalfDuplex } from '../src/serial-half-duplex';
import { VirtualSerialPort } from './virtual-serial.port';


describe( 'Half duplex serial IO', () => {

    let port: VirtualSerialPort;

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

    it( 'rejects after timeout', () => {
        const shd = new SerialHalfDuplex( port );
        return expectAsync( shd.sendAndReceive( Buffer.from( 'foo' ), 20 ) ).toBeRejected();
    }, 100 );

    it( 'rejects after timeout, b', ( done ) => {
        const shd = new SerialHalfDuplex( port );
        shd.sendAndReceive( Buffer.from( 'foo' ), 20 )
            .then( () => {
                expect( true ).toBe( false );
            }, () => expect( true ).toBe( true ) )
            .finally( done );
    }, 100 );

    it( 'rejects after timeout, test', () => {
        const p = new Promise( ( resolve, reject ) => setTimeout( reject, 20 ) );
        return expectAsync( p ).toBeRejected();
    }, 100 );

    describe( 'sendAndReceiveMany', () => {

        it( 'can receive multiple lines', () => {
            const shd = new SerialHalfDuplex( port );
            setTimeout( () => port.writeToPipe( Buffer.from( '123\r\n' ) ), 10 );
            setTimeout( () => port.writeToPipe( Buffer.from( '45\r\n' ) ), 15 );
            setTimeout( () => port.writeToPipe( Buffer.from( '6\r\n' ) ), 20 );
            return expectAsync( shd.sendAndReceiveMany( Buffer.from( 'foo' ), 50, 3 ) ).toBeResolvedTo( [
                Buffer.from( '123' ),
                Buffer.from( '45' ),
                Buffer.from( '6' ),
            ] );
        } );

        it( 'resolves when at least one line is received', () => {
            const shd = new SerialHalfDuplex( port );
            setTimeout( () => port.writeToPipe( Buffer.from( '123\r\n' ) ), 10 );
            return expectAsync( shd.sendAndReceiveMany( Buffer.from( 'foo' ), 50, 3 ) ).toBeResolvedTo( [
                Buffer.from( '123' ),
            ] );
        } );

    } );

} );
