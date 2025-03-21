const params = {
    fullscreen: true,
    autostart: true
};
const two = new Two(params); // Base class used for all drawing
two.renderer.domElement.style.background = '#ddd'
two.appendTo(document.body)

const centerX = .5 * two.width;
const centerY = .5 * two.height;

const filename = "mapData";

const game = {
    gridSize: 20,
    grid: null,
    obstacles: null,
    items: null,
    nextId: 1,
    moveSpeed: 2,
    offset: { x: 0, y: 0 },
}

const main = () => {
    game.grid = drawGrid();
    game.obstacles = two.makeGroup();
    game.items = two.makeGroup();
    loadData();
    drawPlayer(centerX, centerY, 0, "spawnReference");
    console.log("Options:\n\tC: make coin mode\n\tV: make obstacle mode\n\tB: make crate mode\n\tR: delete mode\n\tZ: abort action\n\n\tP: save data\n\tL: load data\n\n\tWASD: move camera\n\tShift: move faster\n\tSpace: reset camera");
    console.log("Current mode: make obstacle");
    setInterval(update, 15);
};

const update = () => {
    const delta = getKeyInput();
    delta.x *= game.moveSpeed; delta.y *= game.moveSpeed;
    if (keysDown["ShiftLeft"]) {
        delta.x *= 2; delta.y *= 2;
    }
    two.scene.position.subtract(delta);
    game.offset.x += delta.x;
    game.offset.y += delta.y;
}

const getKeyInput = () => {
    const delta = { x: 0, y: 0 };
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

window.addEventListener("resize", function () {
});

const keysDown = {
    "KeyW": false,
    "KeyA": false,
    "KeyS": false,
    "KeyD": false,
    "ShiftLeft": false,
};
onkeydown = (event) => {
    keysDown[event.code] = true;
    switch (event.code) {
        case "KeyW":
        case "KeyA":
        case "KeyS":
        case "KeyD":
            break;
        case "Space":
            haltAction();
            console.log("Resetting camera position");
            two.scene.position.set(0, 0);
            game.offset = { x: 0, y: 0 };
            break;
        case "KeyB":
            haltAction();
            mode = "makeCrate";
            console.log("Switched to makeCrate mode");
            break;
        case "KeyV":
            haltAction();
            mode = "makeObstacle";
            console.log("Switched to makeObstacle mode");
            break;
        case "KeyC":
            haltAction();
            mode = "makeCoin";
            console.log("Switched to makeCoin mode");
            break;
        case "KeyR":
            haltAction();
            mode = "delete";
            console.log("Switched to delete mode");
            break;
        case "KeyZ":
            haltAction();
            break;
        case "KeyP":
            saveData();
            break;
        case "KeyL":
            loadData();
            break;
    }
};
onkeyup = (event) => {
    keysDown[event.code] = false;
};
let mode = "makeObstacle";

let startX = null;
let startY = null;
let preview = null;
onmousedown = (event) => {
    event = { x: event.x, y: event.y };
    event.x += game.offset.x;
    event.y += game.offset.y;
    switch (mode) {
        case "makeObstacle":
            makeObstacleBegin(event);
            break;
        case "delete":
        case "makeCoin":
        case "makeCrate":
            break;
        default:
            console.error("Unknown mode: " + mode);
    }
};
onmousemove = (event) => {
    event = { x: event.x, y: event.y };
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
            makeCoinPreview(event)
            break;
        case "makeCrate":
            makeCratePreview(event)
            break;
        default:
            console.error("Unknown mode: " + mode);
    }
}
onmouseup = (event) => {
    event = { x: event.x, y: event.y };
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
            makeCoinComplete(event)
            break;
        case "makeCrate":
            makeCrateComplete(event)
            break;
        default:
            console.error("Unknown mode: " + mode);
    }
};


const makeCoinPreview = (event) => {
    if (!preview) {
        preview = drawCoin({
            x: event.x,
            y: event.y,
            type: "coin",
            id: "coin" + game.nextId,
        });
        preview.opacity = .8
    } else {
        preview.position.set(event.x, event.y)
    }
}
const makeCoinComplete = (event) => {
    if (preview === null) return;
    preview.opacity = 1;
    game.items.add(preview);
    game.nextId++;
    preview = null;
}


const makeObstacleBegin = (event) => {
    startX = Math.floor(event.x / game.gridSize) * game.gridSize;
    startY = Math.floor(event.y / game.gridSize) * game.gridSize;
}
const makeObstaclePreview = (event) => {
    if (startX === null || startY === null) {
        return;
    }
    if (preview) preview.remove()
    let left = startX;
    let top = startY;
    let right = Math.floor(event.x / game.gridSize + 1) * game.gridSize;
    let bottom = Math.floor(event.y / game.gridSize + 1) * game.gridSize;
    if (right <= left) {
        const temp = left + game.gridSize;
        left = right - game.gridSize;
        right = temp;
    }
    if (bottom <= top) {
        const temp = top + game.gridSize;
        top = bottom - game.gridSize;
        bottom = temp;
    }
    preview = drawObstacle({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        color: "#0088",
    });
}
const makeObstacleComplete = (event) => {
    if (startX === null || startY === null) {
        return;
    }
    console.log(preview)
    if (preview)
        if (preview.width >= game.gridSize && preview.height >= game.gridSize) {
            game.obstacles.add(preview);
            preview.fill = "#008";
        }
        else
            preview.remove();
    startX = null;
    startY = null;
    preview = null;
}

const makeCratePreview = (event) => {
    if (!preview) {
        preview = drawObstacle({
            x: event.x - 20,
            y: event.y - 20,
            width: 40,
            height: 40,
            color: "#b75",
            stroke: "#753"
        });
        preview.opacity = .8
    } else {
        preview.position.set(event.x, event.y)
    }
}
const makeCrateComplete = (event) => {
    if (preview === null) return;
    preview.opacity = 1
    game.obstacles.add(preview);
    game.nextId++;
    preview = null;
}


const deletePreview = (event) => {
    for (const obstacle of game.obstacles.children) {
        if (obstacle.position.x - obstacle.width / 2 > event.x ||
            obstacle.position.x + obstacle.width / 2 < event.x ||
            obstacle.position.y - obstacle.height / 2 > event.y ||
            obstacle.position.y + obstacle.height / 2 < event.y
        ) obstacle.opacity = 1;
        else obstacle.opacity = .5;
    }
    for (const item of game.items.children) {
        if (item.type === "coin"
            && ((event.x - item.position.x) ** 2 + (event.y - item.position.y) ** 2 > item.radius ** 2))
            item.opacity = 1;
        else item.opacity = .5;
    }
}
const deleteComplete = (event) => {
    deleted = []
    for (const obstacle of game.obstacles.children) {
        if (obstacle.position.x - obstacle.width / 2 > event.x ||
            obstacle.position.x + obstacle.width / 2 < event.x ||
            obstacle.position.y - obstacle.height / 2 > event.y ||
            obstacle.position.y + obstacle.height / 2 < event.y
        ) obstacle.opacity = 1;
        else deleted.push(obstacle);
    }
    for (const item of game.items.children) {
        if (item.type === "coin"
            && ((event.x - item.position.x) ** 2 + (event.y - item.position.y) ** 2 > item.radius ** 2))
            item.opacity = 1;
        else deleted.push(item);
    }
    for (const each of deleted) each.remove();
}

const haltAction = (event) => {
    for (const obstacle of game.obstacles.children) obstacle.opacity = 1;
    for (const item of game.items.children) item.opacity = 1;
    if (preview) {
        preview.remove();
        preview = null;
    }
    startX = null;
    startY = null;
}

const saveData = () => {
    const obstacles = []
    for (const obstacle of game.obstacles.children) {
        const obstacleData ={ 
            x: obstacle.position.x - obstacle.width / 2,
            y: obstacle.position.y - obstacle.height / 2,
            width: obstacle.width,
            height: obstacle.height,
            color: obstacle.fill,
        }
        if (obstacle.stroke) obstacleData.stroke = obstacle.stroke
        obstacles.push(obstacleData);
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
    console.log("Sent to server: ", JSON.stringify({ obstacles, items }));

    fetch("/save", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename: filename, data: JSON.stringify({ obstacles, items }) }),
    })

};

const loadData = () => {
    fetch("/load?filename=" + filename)
        .then(response => response.json())
        .then(data => {
            game.obstacles.remove(game.obstacles.children);
            game.items.remove(game.items.children);
            const { obstacles, items } = data;
            game.nextId = items[items.length-1] ? Number((items[items.length-1].id).substring(4)) + 1 : 1;
            two.scene.position.set(0, 0);
            drawMap(obstacles, items);
        });
};

const localToGlobalCoords = (data) => {
    for (const datum of data) {
        datum.x = (datum.x - centerX);
        datum.y = (datum.y - centerY);
    }
};

const globalToLocalCoords = (data) => {
    for (const datum of data) {
        datum.x = (datum.x + centerX);
        datum.y = (datum.y + centerY);
    }
};


main();
