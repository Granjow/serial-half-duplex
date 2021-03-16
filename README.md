# Half-Duplex Serial Port

This package uses [serialport](https://www.npmjs.com/package/serialport) and adds half-duplex functionality (i.e. send-and-receive).
It supports TypeScript.

For serial communication, one usually wants to **send a command and wait for an
answer.** This Promise based library does exactly that.

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
* `logger` like `SerialHalfDuplex.consoleLogger` which logs communication
  details, if defined


#### debugMode : boolean

Enable debug mode (print incoming and outgoing messages).


#### sendAndReceive( cmd : Buffer, timeout : number ) : Promise&lt;Buffer&gt;

Send a command and wait for an answer.

The timeout is in milliseconds. It is required because serial communication
does not specify a request/response protocol and we just *assume* the client
will respond within a defined amount of time (but it might not reply at all,
for example because it is disconnected).


#### sendAndReceiveMany( …, expectedLines : number ) : Promise&lt;Buffer[]&gt;

Send a command and wait for multiple answers.

The command resolves when at least one line is returned within the timeout.

Waiting for multiple lines is useful in cases where a device returns multiple
lines to one command. For example, the Acer beamer H5382BD replies with
`*001\rLAMP 0\r` when querying the lamp state.


#### send( cmd : Buffer ) : Promise&lt;void&gt;

Simply send a command without waiting for an answer.


## Testing serial communication

Testing serial ports without the real target device can be done e.g.

* by programming an Arduino to behave like the real device
* with `socat` and `minicom`

Socat can open a pair of serial ports.

    socat -d -d pty,raw,echo=0 pty,raw,echo=0
    2019/12/22 09:57:26 socat[12018] N PTY is /dev/pts/3
    2019/12/22 09:57:26 socat[12018] N PTY is /dev/pts/4
    2019/12/22 09:57:26 socat[12018] N starting data transfer loop with FDs [5,5] and [7,7]

Minicom can then connect to one end and the application to the other end. Do
not forget to enable echo (`Ctrl+A E`) and disable hardware flow control
(`Ctrl+A O` → Serial port setup → Hardware Flow Control).

```
minicom -b 9600 -o -D /dev/pts/4
```

Be aware that minicom only sends carriage return `\r`, but not new lines `\n`
after commands. It therefore cannot be used for debugging.

To analyse the exact data which is sent through minicom, attach `strace` to the
minicom process ID. Note that also stdin/stdout data is shown with file
descriptors `0` and `1`.

```bash
strace -p PID -e read,write
```


## Changelog


### v3.0.0

* Changed: Constructor now takes a logger for debugging instead of a boolean flag.
  This does not force the usage of `console` anymore and allows to customise output.


### v2.1.0 (2021-03-03)

* Changed: `SerialHalfDuplex.findSuitablePort()` now accepts a predicate
  which determines if a port is suitable, instead of only listing CP210x UART bridges.
  (This is still the default filter, so the change is backwards compatible.)
* Changed: Dependencies updated

### v2.0.1 (2020-06-09)

* Changed: Updated packages (fixes bl vulnerability)
* Breaking: Updated `serialport` to v9 to support Node.js 14. This requires Node.js > 8.

### v1.3.1 (2019-12-22)

* Changed: Documentation updated

### v1.3.0 (2019-12-19)

* Added: `SerialHalfDuplex.sendAndReceiveMany`. Receives more than one line.

### v1.2.0 (2019-11-27)

* Changed: `SerialHalfDuplex` accepts a configuration object to configure the response delimiter
* Changed: `SerialHalfDuplex.openSerialPort` now accepts arguments for serial port configuration.
