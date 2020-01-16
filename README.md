# dms-scratchpad

A scrachpad to try out DM Script online.

## Usage

First, host a webserver

    $ python -m SimpleHttpServer   # for Python 2

    $ python -m http.server        # for Python 3


Then, open [http://localhost:8000](http://localhost:8000) in a browser


## Development

The `index.html` page contains a div with the id `editor`, which is the input area where users may write code (using the handy [ace](https://ace.c9.io/) library).


The `js/main.js` script used by the index page connects the dependencies together to drive the webapp.


The `js/dms-compiler.js` script is used by `main.js` to compile code written in [DM Script](https://www.w3.org/2019/11/dms/) into [DMPL](https://www.w3.org/2019/04/dmpl/)-compliant JSON.
You can find more development information about the compiler in the [dms-compiler repo](https://github.com/conversational-interfaces/dms-compiler).


The `js/dm.js` script is the DMPL runtime. Some properties include:

* runs in the background, using a web worker `js/worker.js`.
* compiled from C++ using Emscripten, currently to asm.js (but, will transition to WebAssembly).
* outputs messages to be received by the user.




