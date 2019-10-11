# Half-Duplex Serial Port

This package uses [serialport](https://www.npmjs.com/package/serialport) and adds half-duplex functions.

Half-duplex means that there can always be only one party sending data. Since the commands are asynchronous
and Promise based, they are protected internally with a Semaphore and not more than one caller can send and
receive data at the same time.


#### sendAndReceive( cmd : Buffer, timeout : number ) : Promise&lt;Buffer&gt;

Send a command and wait for an answer. The timeout is in milliseconds.

#### send( cmd : Buffer ) : Promise&lt;void&gt;

Simply send a command without waiting for an answer.
