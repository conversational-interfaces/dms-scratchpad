
let worker = null;
let dmsEditor;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const CANVAS_SIZE = 1000


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
    dmsEditor.getSession().setValue(DEFAULT_DMS);
    canvas.width  = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE; 
    resetCanvas();
});

let resetCanvas = function() {
    ctx.fillStyle = "wheat";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

let stop = function() {
    if (worker) { 
        worker.terminate();
        worker = null;
        resetCanvas();
    }
}

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
                    if (dataJson['@act'] !== undefined) {
                        // console.log(JSON.stringify(dataJson['@act']));
                        let {object, action, params} = dataJson['@act'];
                        if (object === 'box' && action == 'draw') {
                            let {color, pos2d, size} = params;
                            size = size * 100;
                            ctx.fillStyle = color;

                            // let size = CANVAS_SIZE / 100;
                            ctx.fillRect(
                                parseFloat(pos2d[0]) * (CANVAS_SIZE / 10) - size/2, 
                                parseFloat(pos2d[1]) * (CANVAS_SIZE / 10) - size/2, 
                                size, size
                            );
                        }
                    } else if (dataJson['@set'] !== undefined) {
                        // console.log(`${dataJson['@set']} = ${JSON.stringify(dataJson['val'])}`);
                    }
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

const DEFAULT_DMS = `
once {
    // size of each agent (0.0 - 1.0)
    BLOCK_SIZE = 0.5
    
    // we have two agents, one chases the other -
    // notice their opposite distance preferences
    agents = [
        {
            pos2d: [1, 5],
            preferences: [
                // prefer 0 over 10
                [{distance: 0}, {distance: 10}]
            ],
            speed: 0.9,
            color: "#aa3a3a60"  // red
        },
        {
            pos2d: [5, 5],
            preferences: [
                // prefer 10 over 0
                [{distance: 10}, {distance: 0}]
            ],
            speed: 1,
            color: "#04aaaa60"  // blue
        }
    ]
    
    // represents the current agent
    agent_idx = 0
    
    // helper function to compute absolute value
    def abs(x) {
        if x < 0 {
            pop -1 * x
        }
        else {
            pop x
        }
    }
    
    // helper function to compute distance between points
    def compute_dist(p1, p2) {
        pop abs(p1[0] - p2[0]) + abs(p1[1] - p2[1])
    }
}

// get current agent's position
x, y = agents[agent_idx]["pos2d"]

// let the agent decide an optimal action
#{depth: 1, model: agents[agent_idx]["preferences"]}
fork {
    x > BLOCK_SIZE * agents[agent_idx]["speed"] {
        // walk left
        x = x - BLOCK_SIZE * agents[agent_idx]["speed"]
    }
    x < 10 - BLOCK_SIZE {
        // walk right
        x = x + BLOCK_SIZE * agents[agent_idx]["speed"]
    }
    y > BLOCK_SIZE * agents[agent_idx]["speed"] {
        // walk up
        y = y - BLOCK_SIZE * agents[agent_idx]["speed"]
    }
    y < 10 - BLOCK_SIZE {
        // walk down
        y = y + BLOCK_SIZE * agents[agent_idx]["speed"]
    }
}

// render the agent on the canvas
act {
    object: "box",
    action: "draw",
    params: {
        color: agents[agent_idx]["color"],
        pos2d: [x, y],
        size: BLOCK_SIZE
    }
}

// update the agent positions
agents = edit(agents, 
    edit(agents[agent_idx], [x, y], "pos2d"), 
    agent_idx)
    
// update the distance
distance = compute_dist(agents[0]["pos2d"], agents[1]["pos2d"])

// cycle through agents
agent_idx = (agent_idx + 1) % len(agents)

`;