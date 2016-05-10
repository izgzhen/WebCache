'use strict';

// // node.js
// if (typeof(module) != "undefined") {
//     var common = require("./common.js");
//     var isPowerOf2 = common.isPowerOf2;
//     var Table = common.Table;
//     var getRandomInt = common.getRandomInt;
//     var alert = console.log;
// }

class Simulator {
    constructor (logger) {
        this.logger = logger;
        // Read data counter
        this.rdatas = 0;
        // Write data counter
        this.wdatas = 0;
        // Read instruction counter
        this.rinsts = 0;
    }

    // Dispatch the commands to sub-cache
    execute (inst) {
        switch(inst.op) {
            case '0': this.dataCache.read(inst.addr); this.rdatas += 1; break;
            case '1': this.dataCache.write(inst.addr); this.wdatas += 1; break;
            case '2': this.instCache.read(inst.addr); this.rinsts += 1; break;
            default: alert("can't decode op: " + inst.op);
        }

    }

    // Gather reports from cache
    reports() {
        return {
            inst: this.instCache.report(),
            data: this.dataCache.report()
        };
    }
}

class Cache {
    constructor (logger, size, blockSize, eviction, assoc, writePolicy) {
        // Sanity Check
        console.assert(Number.isInteger(size) && isPowerOf2(size) , "Size must be integer which is power of 2");
        console.assert(Number.isInteger(blockSize) && isPowerOf2(size) , "Block size must be integer which is power of 2");
        console.assert(size >= blockSize, "Cache size must be bigger than block size");

        this.logger = logger;
        // Cache hits count
        this.hits = 0;
        // Cache miss count
        this.misses = 0;

        // Choose from different eviction policy implementation
        switch(eviction) {
            case "Random": this.findSlot = this.findSlotRandom; break;
            case "LRU": this.findSlot = this.findSlotLRU; break;
            case "FIFO": this.findSlot = this.findSlotFIFO; this.fifoSlot = 0; break;
            default: alert("Don't support eviction policy: " + eviction);
        }

        // Choose from different write policy implementation
        switch (writePolicy) {
            case "wb": this.write = this.writeBack; this.wbs = 0; break;
            case "wt": this.write = this.writeThrough; this.wts = 0; break;
            default: alert("Don't support write policy: " + writePolicy);
        }

        // Cache size in bytes
        this.size = size;
        // Block size in bytes
        this.blockSize = blockSize;
        // Number of blocks in total
        this.blockNum = this.size / this.blockSize;
        // Associativity
        this.assoc = assoc;
        // Number of cache sets
        this.setNum = this.blockNum / this.assoc;


        // A cache entry: tag | idx | offset
        // Length of offset field
        this.offsetLen = Math.log2(blockSize);
        // length of index field
        this.idxLen = Math.log2(this.setNum);

        // Initialize cache sets
        this.sets = [];
        for(var i = 0; i < this.setNum; i++) {
            var entries = [];
            for(var j = 0; j < this.assoc; j++) {
                entries.push({ tag: 0, dirty: false, access: 0, valid: false});
            }
            this.sets.push(entries);
        }

        // Initialize FIFO counter for each set if necessary
        if(this.findSlot == this.findSlotFIFO) {
            this.fifoCounts = [];
            for(var i = 0; i < this.setNum; i++) {
                this.fifoCounts.push(0);
            }            
        }
    }

    // Read an address
    read(addr) {
        this.refreshAccess();
        addr = this.segment(addr);

        var n = this.inCache(addr);
        if(n != null) {
            this.hits += 1;
            this.access(n, addr);
        } else {
            this.misses += 1;

            var slot = this.findSlot(addr);

            if(this.isDirty(slot, addr)) { // Write-back
                this.wbs += 1;
            }

            this.makeValid(slot, addr);
            this.cache(slot, addr);
            this.access(slot, addr);
        }
    }

    // Set valid bit of slot n addressed by addr
    makeValid(n, addr) {
        this.sets[addr.idx][n].valid = true;
    }

    // Update access bits of slot n addressed by addr
    access(n, addr) {
        this.sets[addr.idx][n].access = 0;
    }

    // Judge if slot n addressed by addr is dirty
    isDirty(slot, addr) {
        return this.sets[addr.idx][slot].dirty;
    }

    // Set dirty bit of slot n addressed by addr
    pollute(n, addr) {
        this.sets[addr.idx][n].dirty = true;
    }

    // Write back implementation
    writeBack(addr) {
        this.refreshAccess();
        addr = this.segment(addr);

        var n = this.inCache(addr);

        if (n != null) {
            this.hits += 1;
            this.pollute(n, addr);
            this.access(n, addr);
        } else {
            // Write-alloc by default
            this.misses += 1;

            var slot = this.findSlot(addr);

            if(this.isDirty(slot, addr)) { // Write-back
                this.wbs += 1;
            }

            this.makeValid(slot, addr);
            this.cache(slot, addr);
            this.pollute(slot, addr);
            this.access(slot, addr);
        }
    }

    // Write through implementation
    writeThrough(addr) {
        this.refreshAccess();
        addr = this.segment(addr);

        var n = this.inCache(addr);

        if (n != null) {
            this.hits += 1;
            this.access(n, addr);
        }

        // Write to main memory every time
        // Non-write-alloc by default
        this.wts += 1;
    }

    // Find if addr is in cache. if found, return the slot number, else return null
    inCache(addr) {
        console.assert(0 <= addr.idx && addr.idx < this.setNum, "Illegal index: " + addr.idx);

        var entries = this.sets[addr.idx];
        for(var i = 0; i < entries.length; i++) {
            if(addr.tag == entries[i].tag && entries[i].valid) {
                return i;
            }
        }

        return null;
    }

    // Random eviction implementation
    findSlotRandom(addr) {
        var invalid = this.findInvalidSlot(addr);
        if(invalid != null) {
            return invalid;
        } else {
            var entries = this.sets[addr.idx];
            var ret = getRandomInt(0, this.assoc);

            console.assert(0 <= ret && ret < this.assoc);
            return ret;
        }
    }

    // LRU eviction implementation
    findSlotLRU(addr) {
        var invalid = this.findInvalidSlot(addr);
        if(invalid != null) {
            return invalid;
        } else {
            var entries = this.sets[addr.idx];
            var maxPos = 0;
            var maxAcc = entries[0].access;

            for(var i = 1; i < entries.length; i++) {
                if(entries[i].access >= maxAcc) {
                    maxAcc = entries[i].access;
                    maxPos = i;
                }
            }

            console.assert(0 <= maxPos && maxPos < this.assoc);
            return maxPos;
        }
    }

    // FIFO eviction implementation
    findSlotFIFO(addr) {
        var invalid = this.findInvalidSlot(addr);
        if(invalid != null) {
            return invalid;
        } else {
            var fifoSlotOld = this.fifoCounts[addr.idx];
            this.fifoCounts[addr.idx] = (fifoSlotOld + 1) % this.assoc;

            console.assert(0 <= fifoSlotOld && fifoSlotOld < this.assoc);
            return fifoSlotOld;
        }
    }

    // Cache addr at slot
    cache(slot, addr) {
        this.sets[addr.idx][slot] = {
            tag : addr.tag,
            dirty : false,
            access: 0,
            valid: true
        };
    }

    // Aging access bits of each slot
    refreshAccess() {
        for(var i = 0; i < this.sets.length; i++) {
            for(var j = 0; j < this.sets[i].length; j++) {
                this.sets[i][j].access += 1;
            }
        }
    }

    // Report as a HTML <table> element
    report() {
        var table = new Table(2);
        table.insert(["hits count", this.hits]);
        table.insert(["misses count", this.misses]);
        table.insert(["miss rate", this.misses / (this.hits + this.misses)]);

        switch (this.write) {
            case this.writeThrough: table.insert(["write throughs", this.wts]); break;
            case this.writeBack: table.insert(["write backs", this.wbs]); break;
            default: alert("Invalid write policy implementation");
        }

        table.insert(["cache size", this.size]);
        table.insert(["block size", this.blockSize]);
        table.insert(["block number", this.blockNum]);
        table.insert(["associativity", this.assoc]);
        table.insert(["eviction policy", this.eviction]);
        return table.elem;
    }

    // Report as plain text
    reportText() {
        var report = "";
        report += "hits count: " + this.hits + "\n";
        report += "misses count: " + this.misses + "\n";
        report += "miss rate: " + this.misses / (this.hits + this.misses) + "\n";

        switch (this.write) {
            case this.writeThrough: report += "write throughs: " + this.wts + "\n"; break;
            case this.writeBack: report += "write backs: " + this.wbs + "\n"; break;
            default: alert("Invalid write policy implementation");
        }

        report += "cache size: " + this.size + "\n";
        report += "block size: " + this.blockSize + "\n";
        report += "block number: " + this.blockNum + "\n";
        report += "associativity: " + this.assoc + "\n";
        report += "eviction policy: " + this.eviction + "\n";
        return report;
    }

    // Segment addr according to cache config
    segment(addr) {
        return {
            offset: addr & (this.blockSize - 1),
            idx:    (addr >> this.offsetLen) & (this.setNum - 1),
            tag:    addr >> (this.offsetLen + this.idxLen)
        }
    }

    // Find an invalid slot
    findInvalidSlot(addr) {
        var entries = this.sets[addr.idx];

        for(var i = 0; i < entries.length; i++) {
            if(entries[i].valid == false) {
                return i;
            }
        }

        return null;
    }

    // Print name of eviction policy in use
    get eviction() {
        switch (this.findSlot) {
            case this.findSlotRandom: return "Random";
            case this.findSlotLRU: return "LRU";
            case this.findSlotFIFO: return "FIFO";
            default: alert("Invalid eviction policy implementation");
        }
    }
}


if (typeof(module) != "undefined") { // if node.js
    module.exports = {
        Cache : Cache,
        Simulator: Simulator
    }    
}

