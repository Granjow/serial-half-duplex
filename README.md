# Half-Duplex Serial Port

This package uses [serialport](https://www.npmjs.com/package/serialport) and adds half-duplex functions.


#### sendAndReceive( cmd : Buffer, timeout : number ) : Promise&lt;Buffer&gt;

Send a command and wait for an answer. The timeout is in milliseconds.

#### send( cmd : Buffer ) : Promise&lt;void&gt;

Simply send a command without waiting for an answer.
