'use strict';

// Clear and set the msg box content
function setTextArea(s) {
    var e = document.getElementById("msg");
    e.readOnly = false;
    e.innerHTML = s;
    e.readOnly = true;
}

// Append a line of text to msg box content
function appendTextArea(s) { 
    var e = document.getElementById("msg");
    e.readOnly = false;
    e.innerHTML += (s + "\n");
    e.readOnly = true;
}

// Run to the end
function run() {
    if (finished) {
        resetSimulator();
    }

    if(instructions.length == 0) {
        alert("Loading not completed yet!")
        return;
    }

    appendTextArea('Start executing...');
    for(var i = pc; i < instructions.length; i++) {
        simulator.execute(instructions[i]);
    }

    appendTextArea("Execution complete");
    appendTextArea("Read data " + simulator.rdatas + " times");
    appendTextArea("Write data " + simulator.wdatas + " times");
    appendTextArea("Read instruction " + simulator.rinsts + " times");

    var instParent = document.getElementById("inst-cache");
    var dataParent = document.getElementById("data-cache");
    var reports = simulator.reports();
    instParent.innerHTML = '';
    instParent.appendChild(reports.inst);
    dataParent.innerHTML = '';
    dataParent.appendChild(reports.data);

    finished = true;
}

// Single step execution
function singleStep() {
    if(instructions.length == 0) {
        alert("Loading not completed yet!")
        return;
    }

    if (finished) {
        alert("Already finished execution; Please reset");
        return;
    }

    appendTextArea('Single stepping...');

    simulator.execute(instructions[pc]);
    pc = pc + 1;

    var instParent = document.getElementById("inst-cache");
    var dataParent = document.getElementById("data-cache");
    var reports = simulator.reports();
    instParent.innerHTML = '';
    instParent.appendChild(reports.inst);
    dataParent.innerHTML = '';
    dataParent.appendChild(reports.data);
}

// Load data if necessary
function load() {
    if (instructions.length == 0) {
        var file = document.getElementById("din").files[0];
        var reader = new FileReader;

        reader.onload = function (event) {
            setTextArea("Load complete.\n");
            instructions = process(event.target.result);
        }

        setTextArea("Loading file......");
        reader.readAsText(file);
    } else
        setTextArea('');
}

// Input file parser
function process(text) {
    var lines = text.split('\n')
                    .map(function(line) { return line.split(' '); })
                    .filter(function (words) { return words.length >= 2; });
    var insts = lines.map(function (words) {
        return {
            op: words[0],
            addr: parseInt('0x' + words[1]),
        };
    });

    return insts;
}

// Read user-control and initialize instruction cache object
function instCacheControlSave() {
    var cacheSize = parseInt(document.getElementById("inst-cache-size").value);
    var blockSize = parseInt(document.getElementById("inst-block-size").value);
    var assoc     = parseInt(document.getElementById("inst-assoc").value);
    var eviction  = getSelected("eviction-inst");

    simulator.instCache = new Cache(appendTextArea, cacheSize, blockSize, eviction, assoc, "wb");
}


// Read user-control and initialize data cache object
function dataCacheControlSave() {
    var cacheSize   = parseInt(document.getElementById("data-cache-size").value);
    var blockSize   = parseInt(document.getElementById("data-block-size").value);
    var assoc       = parseInt(document.getElementById("data-assoc").value);
    var writePolicy = getSelected("write-data");
    var eviction    = getSelected("eviction-data");

    simulator.dataCache = new Cache(appendTextArea, cacheSize, blockSize, eviction, assoc, writePolicy);
}

// Process new input file
function newUpload() {
    reset();

    var e = document.getElementById("uploaded");
    var file = document.getElementById("din").files[0];
    e.innerHTML = "已上传：" + file.name;

    instructions = [];

    load();
}

// Reset the application state
function reset() {
    setTextArea("Simulator ready. Please upload .din file.\n");
    resetSimulator();
    var instParent = document.getElementById("inst-cache");
    var dataParent = document.getElementById("data-cache");
    instParent.innerHTML = '数据暂无';
    dataParent.innerHTML = '数据暂无';
    var e = document.getElementById("uploaded");
    e.innerHTML = '';
}

// Reset the simulator state
function resetSimulator() {
    simulator = new Simulator(appendTextArea);
    pc = 0;
    instCacheControlSave();
    dataCacheControlSave();
}

// Reset after a running session
function resetAfterRun() {
    reset();
    load();
    setTextArea('Reset complete.\n')
    instCacheControlSave();
    dataCacheControlSave();
    finished = false;
}

var simulator = null;
var instructions = [];
var pc = 0;
var finished = false;
