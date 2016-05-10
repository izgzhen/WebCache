'use strict';

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

class Table {
    constructor(rowSize) {
        this.table = document.createElement("table");
        this.rowCount = 0;
        this.rowSize = rowSize;
    }

    insert(arr) {
        var row = this.table.insertRow(this.rowCount);
        this.rowCount += 1;

        for(var i = 0; i < this.rowSize; i++) {
            var cell = row.insertCell(i);
            cell.appendChild(document.createTextNode(arr[i]));
        }
    }

    get elem() {
        return this.table;
    }
}

// Home-made runtime assert
if(console.assert == null) {
    console.assert = function (cond, errMsg) {
        if(!cond) {
            alert("[ERROR]: " + errMsg ? errMsg : "");
        }
    }
}

function isPowerOf2(x) { return Number.isInteger(Math.log2(x)) ;}

// Code-sharing between nodejs and browser
if(typeof(module) != "undefined") {
    module.exports = {
        isPowerOf2: isPowerOf2,
        Table: Table,
        getRandomInt: getRandomInt
    }
}

function getSelected(name) {
    var nodes = document.getElementsByName(name);
    for(var i = 0; i < nodes.length; i++) {
        if(nodes[i].checked) {
            return nodes[i].value;
        }
    }
}
