# Half-Duplex Serial Port

This package uses [serialport](https://www.npmjs.com/package/serialport) and adds half-duplex functionality (i.e. send-and-receive).
It supports TypeScript.

For serial communication, one usually wants to send a command and wait for an answer. This Promise based
library does exactly that.

Half-duplex means that there can always be only one party sending data. Since the commands are asynchronous
and Promise based, they are protected internally with a Semaphore and not more than one caller can send and
receive data at the same time.

```javascript
const serial = new SerialHalfDuplex( SerialHalfDuplex.openSerialPort( '/dev/ttyUSB0' ) );
const timeoutMillis = 200;

serial.sendAndReceive( Buffer.from( 'Hello!' ), timeoutMillis )
    .then( ( answer ) => console.log( answer.toString() ) )
    .catch( ( err ) => console.error( err ) );
```

## API

See your favourite editor’s autocomplete support for the full documentation.

#### new SerialHalfDuplex( port : ISerialPort, args? : SerialHalfDuplexArgs )

Constructor. `args` allows to configure

* `delimiter` which marks the end of a response

#### sendAndReceive( cmd : Buffer, timeout : number ) : Promise&lt;Buffer&gt;

Send a command and wait for an answer.

The timeout is in milliseconds. It is required because serial communication
does not specify a request/response protocol and we just *assume* the client
will respond within a defined amount of time (but it might not reply at all,
for example because it is disconnected).

#### sendAndReceiveMany( …, expedtedLines : number ) : Promise&lt;Buffer[]&gt;

Send a command and wait for multiple answers.

For example, some beamers like the H5382BD send two lines in response when querying the beamer state,
the answer is `*001\rLAMP 0\r`.


#### send( cmd : Buffer ) : Promise&lt;void&gt;

Simply send a command without waiting for an answer.


## Changelog

### v1.2.0 (2019-11-27)

* Changed: `SerialHalfDuplex` accepts a configuration object to configure the response delimiter
* Changed: `SerialHalfDuplex.openSerialPort` now accepts arguments for serial port configuration.
