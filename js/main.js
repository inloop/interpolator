//Interpolator v0.1 (22.10.2014)
//Written by Juraj Novák, inloop.eu
//

//Elements
var graph = document.getElementById("graph");
var editor = ace.edit("editor");
var editorElement = document.getElementById("editor-parent");
var delay = document.getElementById("delay");
var box = document.getElementById("box");
var removeVis = document.getElementById("remove-vis");
var errorIcon = document.getElementById("syntax-error-icon");
var library = document.getElementById("library");
var ctx = graph.getContext("2d");

//Constants
var GRAPH_PAD = 40;
var GRAPH_TEXT_PAD = 5;
var GRAPH_MAX_Y = 10;
var GRAPH_MAX_OVERFLOW_Y = 10;
var GRAPH_MAX_TIME = 10;
var GRAPH_FONT_SIZE = 8;
var GRAPH_WIDTH = (graph.width - (GRAPH_PAD * 2));
var MATH_PROPS = Object.getOwnPropertyNames(Math);
console.log(MATH_PROPS.join("|"));

var lastValidEquation, startAnimTime, lastActiveBtn;
var movementNextPos = graph.height / 2 - box.clientHeight / 2;
var isAnimating = false, isReverseAnim = false;
var currentTestType = -1;
var updateDelayId;
var graphOverflowY = 0;

var EQUATIONS = { list:[
    {name:"Linear", value:"x"},
    {name:"Smoothstep", value:"x * x * (3 - 2 * x)"},
    {name:"Spring", value:"factor = 0.4\npow(2, -10 * x) * sin((x - factor / 4) * (2 * PI) / factor) + 1"},
    {name:"Bounce", value:"//Use javascript syntax to create complex equations\nfunction bounce(t) { return t*t*8; }\n\nif (x < 0.3535)\n bounce(x)\nelse if (x < 0.7408)\n bounce(x - 0.54719) + 0.7\nelse if (x < 0.9644)\n bounce(x - 0.8526) + 0.9\nelse\n bounce(x - 1.0435) + 0.95"}]
};

// --------------------------- //

//Initialize editor
editor.setTheme("ace/theme/chrome");
editor.renderer.setShowGutter(false);
editor.renderer.setPadding(8);
editor.renderer.setScrollMargin(4, 0, 0, 0);
editor.setHighlightActiveLine(false);
editor.getSession().setUseWrapMode(true);
editor.getSession().setMode("ace/mode/javascript");

//Draw graph
drawAll();
drawBox();

updateBoxPlaceholders(-1);

//Fill entries in library
EQUATIONS.list.forEach(function (entry) {
    var option = document.createElement("option");
    option.text = entry.name;
    library.add(option);
});

setEquationFromLib(1);
updateData();

// --------------------------- //

editor.addEventListener("input", function () {
    updateDelay();
});

delay.addEventListener("input", function () {
    updateDelay();
});

function updateDelay() {
    clearTimeout(updateDelayId);
    updateDelayId = window.setTimeout(function () {
        updateData();
    }, 50);
}

function setEquationFromLib(index) {
    if (typeof index === "undefined") {
        index = library.selectedIndex;
    } else {
        library.options[index].selected = true;
    }

    editor.getSession().setValue(EQUATIONS.list[index].value);
}

function updateBoxPlaceholders(type) {
    var container = document.getElementById("container");
    var placeHolderStart = document.getElementById("box-placeholder-start");
    var placeHolderEnd = document.getElementById("box-placeholder-end");
    var boxCenterPos = (container.offsetLeft / 2 - (box.clientWidth / 2)) + "px";
    var elements = document.getElementsByClassName("box");
    for (var i = 0; i < elements.length; i++) {
        elements[i].style.left = boxCenterPos;
    }
    if (type == 4) {
        placeHolderStart.style.display = "none";
    } else {
        placeHolderStart.style.display = "block";
    }

    if (type == 1) {
        placeHolderEnd.style.top = (movementNextPos + box.clientHeight) + "px";
        placeHolderEnd.style.display = "block";
    } else {
        placeHolderEnd.style.display = "none";
    }
}

function updateData() {
    drawAll();
    startAnimTime = Date.now();
    drawBox();
}

function drawAll() {
    ctx.clearRect(0, 0, graph.width, graph.height);
    resetFontStyle();

    drawGrid();
    drawAxis();
    drawGraph();
}

function resetFontStyle() {
    ctx.fillStyle = "black";
    ctx.font = GRAPH_FONT_SIZE + "pt verdana";
}

function drawGrid() {
    ctx.lineWidth = 1;
    ctx.textAlign = "left";
    ctx.strokeStyle = "#e0e0e0";

    var GRAPH_SPACE_ROW = (graph.height - GRAPH_PAD * 2) / (GRAPH_MAX_Y + graphOverflowY);
    var GRAPH_SPACE_COL = (graph.height - GRAPH_PAD * 2) / (GRAPH_MAX_Y);

    ctx.beginPath();
    for (var i = 1; i <= GRAPH_MAX_Y + graphOverflowY; i++) {
        var isTimeMax = i > GRAPH_MAX_TIME;

        //Rows
        var y = graph.height - GRAPH_PAD - (i * GRAPH_SPACE_ROW);
        ctx.moveTo(GRAPH_PAD, y);
        ctx.lineTo(graph.width - GRAPH_PAD, y);

        //Cols
        var x = (i * GRAPH_SPACE_COL) - 1 + GRAPH_PAD;
        if (!isTimeMax) {
            ctx.moveTo(x, graph.height - GRAPH_PAD);
            ctx.lineTo(x, GRAPH_PAD);
        }

        //If Y overflows MaxY - mark max value bold
        if (graphOverflowY > 0 && i > GRAPH_MAX_Y) {
            ctx.fillStyle = "red";
        }

        if (i == GRAPH_MAX_Y) {
            ctx.font = "bold " + GRAPH_FONT_SIZE + "pt verdana";
        } else {
            ctx.font = GRAPH_FONT_SIZE + "pt verdana";
        }

        //Legend
        var legend = (i / 10).toFixed(1);
        var legendWidth = ctx.measureText(legend).width;
        var legendHalfWidth = legendWidth / 2;
        ctx.fillText(legend.toString(), GRAPH_PAD - GRAPH_TEXT_PAD - legendWidth, y + (GRAPH_FONT_SIZE / 2));
        if (!isTimeMax) {
            ctx.fillStyle = "black";
            ctx.fillText(legend.toString(), x - legendHalfWidth, graph.height - GRAPH_PAD + GRAPH_FONT_SIZE + GRAPH_TEXT_PAD);
        }
    }
    ctx.stroke();
}

function drawAxis() {
    resetFontStyle();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "black";
    ctx.textAlign = "center";
    ctx.fillStyle = "silver";

    ctx.beginPath();
    ctx.moveTo(GRAPH_PAD, GRAPH_PAD);
    ctx.lineTo(GRAPH_PAD, graph.height - GRAPH_PAD);
    ctx.lineTo(graph.width - GRAPH_PAD, graph.height - GRAPH_PAD);
    ctx.fillText("time (x)", GRAPH_PAD + GRAPH_WIDTH / 2, GRAPH_WIDTH + GRAPH_PAD + GRAPH_TEXT_PAD + GRAPH_FONT_SIZE*3);

    ctx.stroke();
}

function getGraphMaxHeight() {
    var GRAPH_SPACE_ROW = (graph.height - GRAPH_PAD * 2) / (GRAPH_MAX_Y + graphOverflowY);
    var extraTop = (GRAPH_SPACE_ROW * graphOverflowY);

    return GRAPH_WIDTH - extraTop;
}

function drawGraph() {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#e51c23";

    ctx.beginPath();

    var maxOverflowY = GRAPH_MAX_OVERFLOW_Y / 10;
    var maxGraphY = GRAPH_MAX_Y / 10;
    var overflowToSet = 1;

    for (var x = 0; x < GRAPH_WIDTH; x++) {
        var t = (f(x / GRAPH_WIDTH));
        var y = -t * getGraphMaxHeight();
        ctx.lineTo(x + GRAPH_PAD + 1, graph.height - GRAPH_PAD + y - 2);

        //Check if y overflows
        if (t > maxGraphY && t < (maxGraphY + maxOverflowY) && t > overflowToSet) {
            overflowToSet = t;
        }
    }

    //Resize grid/graph If overflows
    var overflowRelative = Math.ceil(Math.abs((maxGraphY - overflowToSet) * 10));
    if (overflowRelative != graphOverflowY) {
        graphOverflowY = overflowRelative;
        drawAll();
        return;
    }

    ctx.stroke();
}

function proxyMathFunctions(text) {
    for(var i in MATH_PROPS){
        text = text.replace(MATH_PROPS[i], "Math." + MATH_PROPS[i]);
    }
    return text;
}

//noinspection JSUnusedLocalSymbols
function f(x) {
    try {
        var equationData = proxyMathFunctions(editor.getSession().getValue());
        var val = eval(equationData);
        lastValidEquation = equationData;
        editorElement.classList.remove("has-error");
        editorElement.classList.add("has-success");
        errorIcon.style.display = "none";

        return val;
    } catch (e) {
        errorIcon.title = e.message;
        errorIcon.style.display = "inline";
        editorElement.classList.remove("has-success");
        editorElement.classList.add("has-error");

        return eval(lastValidEquation);
    }
}

function drawCurrentPlot(t) {
    ctx.fillStyle = "yellow";
    var y = -(f(t) * getGraphMaxHeight());
    var xPos = (t * GRAPH_WIDTH ) + GRAPH_PAD + 1;
    var yPos = graph.height - GRAPH_PAD + y - 2;
    ctx.fillRect(xPos - 1, yPos - 1, 2, 2);
}

function setAnimationEnabled(enabled) {
    isAnimating = enabled;
    if (enabled) {
        resetBox();
        drawBox();
    }
    drawAll();
}

function drawBox() {
    var delayVal = parseFloat(delay.value);
    if (delayVal <= 0.0 || !isAnimating) {
        return;
    }

    var t = (Date.now() - startAnimTime) / delayVal;
    t = isReverseAnim ? 1.0 - t : t;

    if (t > 1.0 || t < 0) {
        updateData();
    } else {
        requestAnimFrame(drawBox);
        drawCurrentPlot(t);

        switch (currentTestType) {
            case 1:
                var movement = lerp(0, movementNextPos, t);
                box.style.transform = "translate(0, " + movement + "px)";
                break;
            case 2:
                var scale = lerp(0, 1, t);
                box.style.transform = "scale(" + scale + ", " + scale + ")";
                break;
            case 3:
                var deg = lerp(0, 360, t);
                box.style.transform = "rotate(" + deg + "deg)";
                break;
            case 4:
                var opacity = lerp(0, 1, t);
                box.style.opacity = opacity;
                break;
        }
    }
}

function lerp(p1, p2, t) {
    return (p1 + (p2 - p1)) * f(t);
}

function reverseAnim() {
    isReverseAnim = !isReverseAnim;
    updateData();
}

function setBoxAnim(event) {
    if (lastActiveBtn) {
        lastActiveBtn.classList.remove("active");
        lastActiveBtn.classList.remove("btn-primary");
    }

    if (typeof event.value === "undefined") {
        setAnimationEnabled(false);
        resetBox();
        isReverseAnim = false;
        removeVis.style.display = "none";
        updateBoxPlaceholders(0);
    } else {
        currentTestType = parseInt(event.value);
        event.classList.add("active");
        event.classList.add("btn-primary");
        lastActiveBtn = event;
        removeVis.style.display = "inline";
        setAnimationEnabled(true);
        updateBoxPlaceholders(currentTestType);
    }
}

function resetBox() {
    startAnimTime = Date.now();
    box.style.opacity = "1";
    box.style.transform = "none";
}

window.requestAnimFrame = function(){
    return (
    window.requestAnimationFrame       ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame    ||
    window.oRequestAnimationFrame      ||
    window.msRequestAnimationFrame     ||
    function(/* function */ callback){
        window.setTimeout(callback, 1000 / 60);
    }
    );
}();