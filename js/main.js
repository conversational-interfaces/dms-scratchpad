
let worker = null;
let dmsEditor;
const CANVAS_SIZE = 1000
const canvas = document.getElementById('canvas');
const dmplOutputDiv = document.getElementById('dmpl-output');
const messagesDiv = document.getElementById('messages');
const messagesListDiv = document.getElementById('messages-list');
const ctx = canvas.getContext('2d');
const canvasTabItem = document.getElementById('canvas-tab-item');
const dmplTabItem = document.getElementById('dmpl-tab-item');
const messagesTabItem = document.getElementById('messages-tab-item');
var input = document.getElementById('intent-input');
var demosDropdownMenu = document.getElementById('demos-dropdown-menu');
var topLeftText2 = document.getElementById('top-left-text2');

input.addEventListener('keyup', function(event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        sendIntent(input.value);
        input.value = '';
    }
});

let resetCanvas = function() {
    canvas.width  = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE; 
    ctx.fillStyle = "wheat";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
resetCanvas();

let configureEditor = function(editor) {
    editor.setTheme("ace/theme/textmate");
    editor.setOptions({fontSize: "14pt"});
    editor.setOption("showPrintMargin", false);
    editor.setOption("highlightActiveLine", false);
    editor.setOption("showLineNumbers", true);
    editor.setOption("wrap", true);
    editor.setOption('enableBasicAutocompletion', true);
    editor.setOption('enableLiveAutocompletion', true);
    editor.commands.removeCommand('gotoline');
    editor.setKeyboardHandler("ace/keyboard/sublime");
    editor.session.setMode("ace/mode/dmpl");
    editor.session.setUseWorker(true);
    editor.getSession().on('change', function() {
        const text = editor.getSession().getValue();
        let errors = [];
        
        try {
            let dmpl = Compiler(text);
            console.log(dmpl);
            dmplOutputDiv.innerHTML = prettyPrintJson.toHtml(dmpl);
            start(dmpl, true);
        } catch (e) {
            dmpl = undefined;
            stop();
            let {type, result} = e;
            if (type) {
                errors.push({
                    row: result.index.line - 1,
                    column: result.index.column,
                    text: "expected: " + JSON.stringify(result.expected),
                    type: "error"
                });
            }
        }
        editor.getSession().setAnnotations(errors);
    });
};

document.addEventListener('DOMContentLoaded', (event) => {
    dmsEditor = ace.edit("editor");
    configureEditor(dmsEditor);
    onClearClicked();
    resetCanvas();
    updateDemosDropdown();
});

let onDemoItemClicked = function(name, filename, type, description) {
    readTextFile(`demos/${filename}`, dmsCode => {
        dmsEditor.getSession().setValue(dmsCode);
        topLeftText2.innerText = `${name}: ${description}`;
        if (type == DMS_TYPE_2D) {
            onCanvasClicked();
        } else if (type == DMS_TYPE_CHAT) {
            onMessagesClicked();
        }
    });
};

function readTextFile(file, callback) {
    // https://stackoverflow.com/questions/14446447/how-to-read-a-local-text-file
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function () {
        if (rawFile.readyState === 4) {
            if (rawFile.status === 200 || rawFile.status == 0) {
                var allText = rawFile.responseText;
                callback(allText);
            }
        }
    }
    rawFile.send(null);
}

let updateDemosDropdown = function() {
    DMS_EXAMPLES.forEach(({name, filename, type, description}) => {
        demosDropdownMenu.innerHTML += `
        <li class="menu-item">
            <a href="#" onclick="return onDemoItemClicked('${name}', '${filename}', '${type}', '${description}')">
                ${name}
            </a>
        </li>
        `;
    })
};

let onCanvasClicked = function(e) {
    canvasTabItem.classList.add('active');
    canvas.classList.remove("hidden");

    dmplTabItem.classList.remove('active');
    dmplOutputDiv.classList.add("hidden");

    messagesTabItem.classList.remove('active');
    messagesDiv.classList.add("hidden");
};

let onDMPLClicked = function(e) {
    canvasTabItem.classList.remove('active');
    canvas.classList.add("hidden");

    dmplTabItem.classList.add('active');
    dmplOutputDiv.classList.remove("hidden");

    messagesTabItem.classList.remove('active');
    messagesDiv.classList.add("hidden");
}

let onMessagesClicked = function(e) {
    canvasTabItem.classList.remove('active');
    canvas.classList.add("hidden");

    dmplTabItem.classList.remove('active');
    dmplOutputDiv.classList.add("hidden");

    messagesTabItem.classList.add('active');
    messagesDiv.classList.remove("hidden");
}

let stop = function() {
    if (worker) { 
        worker.terminate();
        worker = null;
        resetCanvas();
        messagesListDiv.innerHTML = '';
    }
}

let sendIntent = function(intent) {
    if (worker) {
        worker.postMessage({
            type: 'handle-event', 
            input: intent 
        });
        messagesListDiv.innerHTML += '<div class="user-intent"><pre>' + intent + '</pre></div>';
    }
};

let start = function(dmpl, debug_mode) {
    if (debug_mode === undefined) {
        debug_mode = true;
    }
    stop();
    worker = new Worker('js/worker.js');
    worker.onmessage = function(msg) {
        let { data } = msg;
        switch(data.type) {
            case 'print':
                try {
                    let dataJson = JSON.parse(data.text);
                    let formattedMessage = `<pre>${prettyPrintJson.toHtml(dataJson)}</pre>`;
                    if (dataJson['@act'] !== undefined) {
                        if (typeof dataJson['@act'] == 'string') {
                            formattedMessage = `<pre class="act-message">${dataJson['@act']}</pre>`
                        } else {
                            formattedMessage = `<pre class="act-message">${prettyPrintJson.toHtml(dataJson['@act'])}</pre>`
                        }
                        let {object, action, params} = dataJson['@act'];
                        if (object === 'box' && action == 'draw') {
                            let {color, pos2d, size} = params;
                            size = size * 100;
                            ctx.fillStyle = color;

                            ctx.fillRect(
                                parseFloat(pos2d[0]) * (CANVAS_SIZE / 10) - size/2, 
                                parseFloat(pos2d[1]) * (CANVAS_SIZE / 10) - size/2, 
                                size, size
                            );
                        }
                    } else if (dataJson['@set'] !== undefined) {
                        // console.log(`${dataJson['@set']} = ${JSON.stringify(dataJson['val'])}`);
                    }

                    messagesListDiv.innerHTML += formattedMessage;
                    if (messagesListDiv.innerHTML.length > 10000) {
                        messagesListDiv.innerHTML = messagesListDiv.innerHTML.substr(5000);
                    }
                    messagesListDiv.scrollTop = messagesListDiv.scrollHeight;
                } catch (e) {
                    // console.log(data.text);
                }
                
                break;
            default:
                throw new Error('Unknown message from worker: ' + JSON.stringify(data));
        }
    };
    worker.postMessage({
        type: 'start', 
        dependencies: {
            "__main__": dmpl
        },
        debug_mode: debug_mode
    });
}

var onClearClicked = function() {
    dmsEditor.getSession().setValue(DEFAULT_DMS);
    topLeftText2.innerText = "";
    onMessagesClicked();
    return true;
};

const DEFAULT_DMS = `// Welcome to the scratchpad.
// All code you write here automatically runs through an interpreter.
// Check out the other demos by selecting from the dropdown above.

// Here's the GitHub repo for this webapp:
//         https://github.com/conversational-interfaces/dms-scratchpad

once {
    // Code in a once-block only runs once
    is_user_greeted = false
}

// Everything else runs in a loop

if !is_user_greeted {
    act "Hello"
    is_user_greeted = true
} else {
    act "Hi again!"
}

input -> intent {
    intent == "hi" {
        act "Nice to meet you"
    }
    intent == "bye" {
        act "Goodbye!"
        pop true
    }
    _ {
        act "Interesting."
    }
}
`;
