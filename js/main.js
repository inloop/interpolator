//Interpolator
//Written by Juraj Novák, inloop.eu

//Elements
var graph = document.getElementById("graph");
var editor = ace.edit("editor");
var editorElement = document.getElementById("editor-parent");
var delay = document.getElementById("delay");
var box = document.getElementById("box");
var removeVis = document.getElementById("remove-vis");
var errorIcon = document.getElementById("syntax-error-icon");
var library = document.getElementById("library");
var help = document.getElementById("help");
var ctx = graph.getContext("2d");

//Constants
var VISUALIZATION = { NONE:0, MOVEMENT: 1, SCALING:2, ROTATION:3, ALPHA:4  };
var GRAPH_PAD = 40;
var GRAPH_TEXT_PAD = 5;
var GRAPH_MAX_Y = 10, GRAPH_MAX_OVERFLOW_TOP = 10;
var GRAPH_MIN_Y = 0, GRAPH_MAX_OVERFLOW_BOTTOM = 10;
var GRAPH_MAX_TIME = 10, GRAPH_MIN_TIME = 0;
var GRAPH_FONT_SIZE = 8;
var GRAPH_WIDTH = (graph.width - (GRAPH_PAD * 2));
var MATH_PROPS = Object.getOwnPropertyNames(Math);

var lastValidEquation, startAnimTime, lastActiveBtn;
var movementNextPos = graph.height / 2 - box.clientHeight / 2;
var isAnimating = false, isReverseAnim = false;
var currentTestType = VISUALIZATION.NONE;
var updateDelayId;
var graphOverflowTop = 0, graphOverflowBottom = 0;

var EQUATIONS = { list:[
    {name:"[Basic]", value:null},
    {name:"Linear", value:"x"},
    {name:"Smoothstep", value:"x * x * (3 - 2 * x)"},
    {name:"Spring", value:"factor = 0.4\npow(2, -10 * x) * sin((x - factor / 4) * (2 * PI) / factor) + 1"},
    {name:"[Android]", value:null},
    {name:"AccelerateDecelerate", value:"(cos((x + 1) * PI) / 2.0) + 0.5"},
    {name:"Bounce", value:"//Use javascript syntax to create complex equations\nfunction bounce(t) { return t*t*8; }\n\nif (x < 0.3535)\n bounce(x)\nelse if (x < 0.7408)\n bounce(x - 0.54719) + 0.7\nelse if (x < 0.9644)\n bounce(x - 0.8526) + 0.9\nelse\n bounce(x - 1.0435) + 0.95"},
    {name:"Accelerate", value:"factor = 1.0\nif (factor == 1.0)\n x * x\nelse\n pow(x, 2 * factor)"},
    {name:"Anticipate", value:"tension = 2.0\nx * x * ((tension + 1) * x - tension)"},
    {name:"AnticipateOvershoot", value:"tension = 2.0 * 1.5\nfunction a(t,s) { return t * t * ((s + 1) * t - s); }\nfunction o(t,s) { return t * t * ((s + 1) * t + s); }\n\nif (x < 0.5)\n 0.5 * a(x * 2.0, tension)\nelse\n 0.5 * (o(x * 2.0 - 2.0, tension) + 2.0)"},
    {name:"Cycle", value:"cycles = 1.0\nsin(2 * cycles * PI * x)"},
    {name:"Decelerate", value:"factor = 1.0\nif (factor == 1.0)\n (1.0 - (1.0 - x) * (1.0 - x))\nelse\n (1.0 - pow((1.0 - x), 2 * factor))"},
    {name:"Overshoot", value:"tension = 2.0\n\nx -= 1.0\nx * x * ((tension + 1) * x + tension) + 1.0"},
    {name:"[Advanced]", value:null},
    {name:"CubicHermite", value:"function CubicHermite(t, p0, p1, m0, m1){\n   t2 = t*t;\n   t3 = t2*t;\n   return (2*t3 - 3*t2 + 1)*p0 + (t3-2*t2+t)*m0 + (-2*t3+3*t2)*p1 + (t3-t2)*m1;\n}\n\n//time, start, end, tangent0, tangent1\n//modify tangent0 and tangent1\nCubicHermite(x, 0, 1, 4, 4)"}
]};

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
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
    var section = (entry.value == null);
    var option = document.createElement("option");
    option.innerHTML = (!section ? "&nbsp;" : "") + entry.name;

    library.add(option);

    if (section) {
        option.style.color = "#8bc34a";
        option.disabled = true;
    }
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
    if (type == VISUALIZATION.ALPHA) {
        placeHolderStart.style.display = "none";
    } else {
        placeHolderStart.style.display = "block";
    }

    if (type == VISUALIZATION.MOVEMENT) {
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

function getZeroYPos() {
    return graph.height - GRAPH_PAD - (graphOverflowBottom * getGraphSpaceRow())
}

function getGraphSpaceRow() {
    return (graph.height - GRAPH_PAD * 2) / (GRAPH_MAX_Y + graphOverflowTop + graphOverflowBottom);
}

function drawGrid() {
    ctx.lineWidth = 1;
    ctx.textAlign = "left";
    ctx.strokeStyle = "#e0e0e0";

    var GRAPH_SPACE_ROW = getGraphSpaceRow();
    var GRAPH_SPACE_COL = (graph.height - GRAPH_PAD * 2) / (GRAPH_MAX_Y);

    ctx.beginPath();
    for (var i = GRAPH_MIN_Y - graphOverflowBottom; i <= GRAPH_MAX_Y + graphOverflowTop; i++) {
        var isTimeMax =  i < GRAPH_MIN_TIME || i > GRAPH_MAX_TIME;

        //Rows
        var y = getZeroYPos() - (i * GRAPH_SPACE_ROW);
        ctx.moveTo(GRAPH_PAD, y);
        ctx.lineTo(graph.width - GRAPH_PAD, y);

        //Cols
        var x = (i * GRAPH_SPACE_COL) - 1 + GRAPH_PAD;
        if (!isTimeMax) {
            ctx.moveTo(x, graph.height - GRAPH_PAD);
            ctx.lineTo(x, GRAPH_PAD);
        }

        //If Y overflows MaxY - mark max value bold
        if ((graphOverflowTop > 0 && i > GRAPH_MAX_Y) || (graphOverflowBottom > 0 && i < GRAPH_MIN_Y)) {
            ctx.fillStyle = "red";
        } else {
            ctx.fillStyle = "black";
        }

        if (i == GRAPH_MAX_Y || i == 0) {
            ctx.font = "bold " + GRAPH_FONT_SIZE + "pt verdana";
        } else {
            ctx.font = GRAPH_FONT_SIZE + "pt verdana";
        }

        //Legend
        var legend = (i / 10).toFixed(1);
        var legendWidth = ctx.measureText(legend).width;
        var legendHalfWidth = legendWidth / 2;
        if (!(i == 0 && graphOverflowBottom == 0)) { // do not draw zero If no Y overflow
            ctx.fillText(legend.toString(), GRAPH_PAD - GRAPH_TEXT_PAD - legendWidth, y + (GRAPH_FONT_SIZE / 2));
        }
        if (!isTimeMax && i != 0) {
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
    ctx.moveTo(GRAPH_PAD, getZeroYPos());
    ctx.lineTo(graph.width - GRAPH_PAD, getZeroYPos());
    ctx.fillText("time (x)", GRAPH_PAD + GRAPH_WIDTH / 2, GRAPH_WIDTH + GRAPH_PAD + GRAPH_TEXT_PAD + GRAPH_FONT_SIZE*3);

    ctx.stroke();
}

function getGraphMaxHeight() {
    var extraTop = (getGraphSpaceRow() * graphOverflowTop);
    var extraBottom = (getGraphSpaceRow() * graphOverflowBottom);

    return GRAPH_WIDTH - extraTop - extraBottom;
}

function drawGraph() {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#e51c23";

    ctx.beginPath();

    var maxOverflowTop = GRAPH_MAX_OVERFLOW_TOP / 10;
    var maxOverflowBottom = GRAPH_MAX_OVERFLOW_BOTTOM / 10;
    var maxGraphTop = GRAPH_MAX_Y / 10;
    var overflowToSetTop = 1, overflowToSetBottom = 0;

    for (var x = 0; x < GRAPH_WIDTH; x++) {
        var t = (fEval(x / GRAPH_WIDTH));
        var y = -t * getGraphMaxHeight();
        ctx.lineTo(x + GRAPH_PAD + 1, getZeroYPos() + y - 2);

        //Check if y overflows top or bottom value
        if (t > maxGraphTop && t <= (maxGraphTop + maxOverflowTop) && t > overflowToSetTop) {
            overflowToSetTop = t;
        } else if (t < GRAPH_MIN_Y && t >= GRAPH_MIN_Y - maxOverflowBottom && t < overflowToSetBottom) {
            overflowToSetBottom = t;
        }
    }

    //Resize grid/graph If overflows
    var overflowRelativeTop = Math.ceil(Math.abs((maxGraphTop - overflowToSetTop) * 10));
    var overflowRelativeBottom = Math.ceil(Math.abs((GRAPH_MIN_Y - overflowToSetBottom) * 10));

    if (overflowRelativeTop != graphOverflowTop || overflowRelativeBottom != graphOverflowBottom) {
        graphOverflowTop = overflowRelativeTop;
        graphOverflowBottom = overflowRelativeBottom;
        drawAll();
        return;
    }

    ctx.stroke();
}

function proxyMathFunctions(text) {
    if (text.length == 0) return text;

    for(var i in MATH_PROPS){
        text = text.replaceAll(MATH_PROPS[i], "Math." + MATH_PROPS[i]);
    }
    return text;
}

//noinspection JSUnusedLocalSymbols
function fEval(x) {
    var d = delay.value;
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
    var y = -(fEval(t) * getGraphMaxHeight());
    var xPos = (t * GRAPH_WIDTH ) + GRAPH_PAD + 1;
    var yPos = getZeroYPos() + y - 2;
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
            case VISUALIZATION.MOVEMENT:
                var movement = lerp(0, movementNextPos, t);
                setBoxTransform("translate(0, " + movement + "px)");
                break;
            case VISUALIZATION.SCALING:
                var scale = lerp(0, 1, t);
                setBoxTransform("scale(" + scale + ", " + scale + ")");
                break;
            case VISUALIZATION.ROTATION:
                var deg = lerp(0, 360, t);
                setBoxTransform("rotate(" + deg + "deg)");
                break;
            case VISUALIZATION.ALPHA:
                var opacity = lerp(0, 1, t);
                box.style.opacity = opacity;
                break;
            default: // do nothing
        }
    }
}

function lerp(p1, p2, t) {
    return (p1 + (p2 - p1)) * fEval(t);
}

function reverseAnim() {
    isReverseAnim = !isReverseAnim;
    updateData();
}

function setBoxTransform(transform) {
    box.style.webkitTransform = transform;
    box.style.transform = transform;
    box.style.msTransform = transform;
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
    setBoxTransform("none");
}

function toggleHelpBox() {
    if (help.style.display != "" && help.style.display != "none") {
        help.style.display = "none";
    } else {
        //Show help over canvas
        help.style.height = graph.height + "px";
        help.style.left = graph.getBoundingClientRect().left + "px";
        help.style.display = "inline";
    }
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