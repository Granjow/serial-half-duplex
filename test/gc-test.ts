import { SerialHalfDuplex } from '../src/serial-half-duplex';
import { VirtualSerialPort } from '../spec/virtual-serial.port';


const run = ( runs : number ) => {
    let fails = 0;
    let oks = 0;

    new Array( runs ).fill( 0 ).map( () => {
        const port = new VirtualSerialPort();
        const shd = new SerialHalfDuplex( port );
        return shd.sendAndReceive( Buffer.from( Math.random().toString( 10 ) ), 50 )
            .then(
                () => oks++,
                () => fails++
            );
    } );

    setTimeout( () => {
        console.log( `${fails} of ${runs} failed, ${runs - fails - oks} pending.` );
    }, 1000 );
};

setTimeout( () => run( 10000 ), 100 );
setTimeout( () => console.log( `Exiting.` ), 3000 );
