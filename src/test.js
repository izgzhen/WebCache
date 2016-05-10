// Test script in node.js

var Cache = require('./sim.js').Cache;
var Simulator = require('./sim.js').Simulator;


function logger(s) {
    console.log("[LOG] " + s);
}

var cache = new Cache(logger, 1024, 64, "Random", 2, "wt");


var seg = cache.segment(0b1111111);

// console.assert(seg.offset == 63 && seg.idx == 15 && seg.tag == 1);

// console.log(cache.sets);

for(var i = 0; i < 16; i++) {
    cache.read(0b111111 + (i << 6));
}


for(var steps = 0; steps < 100; steps++) {
    for(var i = 0; i < 16; i++) {
        cache.read(0b111111 + (i << 6));
    }

    for(var i = 16; i < 32; i++) {
        cache.read(0b111111 + (i << 6));
    }    
}

console.log(cache.reportText());
