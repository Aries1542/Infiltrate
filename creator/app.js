const params = {
    fullscreen: true,
    autostart: true
};
const two = new Two(params); // Base class used for all drawing
two.renderer.domElement.style.background = '#ddd'
two.appendTo(document.body)

const centerX = .5 * two.width;
const centerY = .5 * two.height;

const game = {
    gridSize: 20,
    grid: null,
    obstacles: null,
    items: null,
    nextId: 1,
    moveSpeed: 2,
    offset: {x: 0, y: 0},
}

const main = () => {
    game.grid = drawGrid();
    game.obstacles = two.makeGroup();
    game.items = two.makeGroup();
    drawPlayer(.5 * two.width, .5 * two.height, 0, "spawnReference");
    console.log("Options:\n\tV: make obstacle\n\tC: make coin\n\tR: delete\n\tP: print JSON data");
    console.log("Current mode: make obstacle");
    setInterval(update, 15);
};

const update = () => {
    const delta = getKeyInput();
    delta.x *= game.moveSpeed; delta.y *= game.moveSpeed;
    two.scene.position.subtract(delta);
    game.offset.x += delta.x;
    game.offset.y += delta.y;
}

const getKeyInput = () => {
    const delta = {x: 0, y: 0};
    if (keysDown["KeyW"]) {
        delta.y -= 1;
    }
    if (keysDown["KeyA"]) {
        delta.x -= 1;
    }
    if (keysDown["KeyS"]) {
        delta.y += 1;
    }
    if (keysDown["KeyD"]) {
        delta.x += 1;
    }
    if (delta.x && delta.y) {
        delta.x *= .70710678 // sqrt(1/2)
        delta.y *= .70710678
    }
    return delta;
}

window.addEventListener("resize", function(){
});

const keysDown = {
    "KeyW": false,
    "KeyA": false,
    "KeyS": false,
    "KeyD": false,
};
onkeydown = onkeyup = (event) => {
    keysDown[event.code] = (event.type === "keydown");
    switch (event.code) {
        case "KeyW":
        case "KeyA":
        case "KeyS":
        case "KeyD":
            break;
        case "Space":
            console.log("Resetting camera position");
            two.scene.position.set(0, 0);
            break;
        case "KeyV":
            mode = "makeObstacle";
            console.log("Switched to makeObstacle mode");
            break;
        case "KeyC":
            mode = "makeCoin";
            console.log("Switched to makeCoin mode");
            break;
        case "KeyR":
            mode = "delete";
            console.log("Switched to delete mode");
            break;
        case "KeyP":
            printData();
            break;
    }
};
let mode = "makeObstacle";

let startX = null;
let startY = null;
let preview = null;
onmousedown = (event) => {
    event = {x: event.x, y: event.y};
    console.log("Event: ", event);
    console.log("Before: ", event.x, event.y);
    console.log("Offset: ", game.offset.x, game.offset.y);
    event.x += game.offset.x;
    event.y += game.offset.y;
    console.log("After: ", event.x, event.y);
    switch (mode) {
        case "makeObstacle":
            makeObstacleBegin(event);
            break;
        case "delete":
            deleteBegin(event);
            break;
        case "makeCoin":
            makeCoin(event);
            break;
        default:
            console.error("Unknown mode: " + mode);
    }
};
onmousemove = (event) => {
    event = {x: event.x, y: event.y};
    event.x += game.offset.x;
    event.y += game.offset.y;
    switch (mode) {
        case "makeObstacle":
            makeObstaclePreview(event);
            break;
        case "delete":
            deletePreview(event);
            break;
        case "makeCoin":
            break;
        default:
            console.error("Unknown mode: " + mode);
    }
}
onmouseup = (event) => {
    event = {x: event.x, y: event.y};
    event.x += game.offset.x;
    event.y += game.offset.y;
    switch (mode) {
        case "makeObstacle":
            makeObstacleComplete(event);
            break;
        case "delete":
            deleteComplete(event);
            break;
        case "makeCoin":
            break;
        default:
            console.error("Unknown mode: " + mode);
    }
};

const makeCoin = (event) => {
    const coin = drawCoin({
        x: event.x,
        y: event.y,
        type: "coin",
        id: "coin" + game.nextId,
    });
    game.items.add(coin);
    game.nextId++;
}


const makeObstacleBegin = (event) => {
    startX = event.x;
    startY = event.y;
}
const makeObstaclePreview = (event) => {
    if (startX === null || startY === null) {
        return;
    }
    if (preview) preview.remove()
    preview = drawObstacle({
        x: startX - (startX % game.gridSize) - game.gridSize,
        y: startY - (startY % game.gridSize) - game.gridSize/2,
        width: event.x - startX + (game.gridSize - ((event.x - startX) % game.gridSize)) + game.gridSize,
        height: event.y - startY + (game.gridSize - ((event.y - startY) % game.gridSize)) + game.gridSize,
        color: "#0088",
    });
}
const makeObstacleComplete = (event) => {
    if (startX === null || startY === null) {
        return;
    }
    if (preview) game.obstacles.add(preview);
    preview.fill = "#008";
    startX = null;
    startY = null;
    preview = null;
}

const deleteBegin = (event) => {
    startX = event.x;
    startY = event.y;
}
const deletePreview = (event) => {
    if (startX === null || startY === null) {
        return;
    }
    if (preview) preview.remove()
    preview = drawObstacle({
        x: startX - (startX % game.gridSize) - game.gridSize,
        y: startY - (startY % game.gridSize) - game.gridSize/2,
        width: event.x - startX + (game.gridSize - ((event.x - startX) % game.gridSize)) + game.gridSize,
        height: event.y - startY + (game.gridSize - ((event.y - startY) % game.gridSize)) + game.gridSize,
        color: "#a008",
    });
    for (const obstacle of game.obstacles.children) {
        if (obstacle.position.x-obstacle.width/2 > preview.position.x+preview.width/2 ||
            obstacle.position.x+obstacle.width/2 < preview.position.x-preview.width/2 ||
            obstacle.position.y-obstacle.height/2 > preview.position.y+preview.height/2 ||
            obstacle.position.y+obstacle.height/2 < preview.position.y-preview.height/2
        ) obstacle.fill = "#008"
        else obstacle.fill = "#a00"
    }
    for (const item of game.items.children) {
        if (item.type === "coin" && (
            item.position.x-item.radius > preview.position.x+preview.width/2 ||
            item.position.x+item.radius < preview.position.x-preview.width/2 ||
            item.position.y-item.radius > preview.position.y+preview.height/2 ||
            item.position.y+item.radius < preview.position.y-preview.height/2)
        ) item.fill = "#fe7";
        else item.fill = "#a00";
    }
}
const deleteComplete = (event) => {
    if (startX === null || startY === null) {
        return;
    }
    for (const obstacle of game.obstacles.children) {
        if (obstacle.position.x-obstacle.width/2 > preview.position.x+preview.width/2 ||
            obstacle.position.x+obstacle.width/2 < preview.position.x-preview.width/2 ||
            obstacle.position.y-obstacle.height/2 > preview.position.y+preview.height/2 ||
            obstacle.position.y+obstacle.height/2 < preview.position.y-preview.height/2
        ) obstacle.fill = "#008";
        else obstacle.remove();
    }
    for (const item of game.items.children) {
        if (item.type === "coin" && (
            item.position.x-item.radius > preview.position.x+preview.width/2 ||
            item.position.x+item.radius < preview.position.x-preview.width/2 ||
            item.position.y-item.radius > preview.position.y+preview.height/2 ||
            item.position.y+item.radius < preview.position.y-preview.height/2)
        ) item.fill = "#fe7";
        else item.remove();
    }
    startX = null;
    startY = null;
    if (preview) preview.remove();
    preview = null;
}

printData = () => {
    const obstacles = []
    for (const obstacle of game.obstacles.children) {
        obstacles.push({
            x: obstacle.position.x - obstacle.width/2,
            y: obstacle.position.y - obstacle.height/2,
            width: obstacle.width,
            height: obstacle.height,
            color: obstacle.fill,
        });
    }
    localToGlobalCoords(obstacles)
    const items = []
    for (const item of game.items.children) {
        items.push({
            x: item.position.x,
            y: item.position.y,
            type: item.type,
            id: item.id,
        });
    }
    localToGlobalCoords(items)
    console.log(JSON.stringify({obstacles, items}));
};

const localToGlobalCoords = (data) => {
    for (const datum of data) {
        datum.x = (datum.x - centerX);
        datum.y = (datum.y - centerY);
    }
};


main();
