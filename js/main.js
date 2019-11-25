
let worker = null;
let dmsEditor;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const CANVAS_SIZE = 1000
canvas.width  = CANVAS_SIZE;
canvas.height = CANVAS_SIZE; 

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
    resetCanvas();
    dmsEditor = ace.edit("editor");
    configureEditor(dmsEditor);
    dmsEditor.getSession().setValue(DEFAULT_DMS);
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
    BLOCK_SIZE = 0.5
    
    def draw(pos2d, color) {
        pop {
            object: "box",
            action: "draw",
            params: {
                color: color,
                pos2d: pos2d,
                size: BLOCK_SIZE
            }
        }
    }
    
    agents = [
        {
            pos2d: [1, 5],
            preferences: [
                [{dist: 0}, {dist: 10}]
            ],
            speed: 0.9,
            color: "#aa3a3a60"
        },
        {
            pos2d: [5, 5],
            preferences: [
               [{dist: 10}, {dist: 0}]
            ],
            speed: 1.0,
            color: "#04aaaa60"
        }
    ]
    
    agent_idx = 0
    
    def abs(x) {
        if x < 0 {
            pop -1 * x
        }
        else {
            pop x
        }
    }
    
    def compute_dist(p1, p2) {
        pop abs(p1[0] - p2[0]) + abs(p1[1] - p2[1])
    }
}

agent = agents[agent_idx]
pos2d = agent["pos2d"]
speed = agent["speed"]
x, y = pos2d

#{depth: 2, model: agent["preferences"]}
fork {
    x > BLOCK_SIZE {
        x = x - BLOCK_SIZE * speed
    }
    x < 10 - BLOCK_SIZE {
        x = x + BLOCK_SIZE * speed
    }
    y > BLOCK_SIZE {
        y = y - BLOCK_SIZE * speed
    }
    y < 10 - BLOCK_SIZE {
        y = y + BLOCK_SIZE * speed
    }
}

dist = compute_dist(agents[0]["pos2d"], agents[1]["pos2d"])

agent = edit(agent, pos2d, "prev_pos2d")
pos2d = [x, y]
act draw(pos2d, agent["color"])
agent = edit(agent, pos2d, "pos2d")
agents = edit(agents, agent, agent_idx)

agent_idx = (agent_idx + 1) % len(agents)
`;