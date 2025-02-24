const params = {
    fullscreen: true, 
    autostart: true
};
const elem = document.body;
const two = new Two(params).appendTo(elem); // Base class used for all drawing
two.renderer.domElement.style.background = '#ddd'

let clientX = .5 * two.width;
let clientY = .5 * two.height;

const gameData = {
    clientId: "",
    mouse: {x: 0, y: 0},
    moveSpeed: 2,
    clientGlobalPos: {x: 0, y: 0},
    grid: drawGrid(clientX, clientY),
    items: two.makeGroup(),
    obstacles: two.makeGroup(),
    players: two.makeGroup(),
    client: drawClient(clientX, clientY),
    ui: drawUI(),
    socket: new WebSocket("/ws"),
}

gameData.socket.onmessage = (event) => {
    const {Requesting} = JSON.parse(event.data);
    switch (Requesting) {
        case "setScene":
            const {Id: myId, X, Y, Obstacles, Items} = JSON.parse(event.data);
            console.log(myId);
            if (myId) {
                gameData.clientId = myId
                Object.assign(gameData.clientGlobalPos, {x: X, y: Y});
            }
            const mapData = {obstacles: Obstacles, items: Items};
            drawMap(mapData);
            break;
        case "update":
            const {PlayersData} = JSON.parse(event.data);
            globalToLocalCoords(PlayersData);
            updatePlayers(PlayersData);
            updateScoreboard(PlayersData);
            break;
        case "remove":
            const {Type, Id: removeId} = JSON.parse(event.data);
            switch (Type) {
                case "player":
                    gameData.players.getById(removeId).remove();
                    break;
                case "item":
                    gameData.items.getById(removeId).remove();
                    break;
            }
            break;
    }
};

gameData.socket.onopen = () => {
    console.log("Connected to server");
};

const main = () => {
    setInterval(update, 15);
};

window.addEventListener("resize", function(){
    clientX = .5 * two.width;
    clientY = .5 * two.height;
    Object.assign(gameData.client.position, {x: clientX, y: clientY});
});

const keysDown = {
    "KeyW": false,
    "KeyA": false,
    "KeyS": false,
    "KeyD": false,
};
onkeydown = onkeyup = (event) => {
    keysDown[event.code] = (event.type === "keydown");
};
onmousemove = (event) => {
    Object.assign(gameData.mouse, {x: event.x, y: event.y});
};

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

const update = () => {
    let delta = getKeyInput();
    delta.x *= gameData.moveSpeed; delta.y *= gameData.moveSpeed;
    collideDelta(delta);
    gameData.grid.position.subtract(delta);
    gameData.obstacles.position.subtract(delta);
    gameData.items.position.subtract(delta);
    gameData.clientGlobalPos.x += delta.x;
    gameData.clientGlobalPos.y += delta.y;
    gameData.client.rotation = Math.atan2(gameData.mouse.y - clientY, gameData.mouse.x - clientX) + .5*Math.PI;

    const id = updateItems();

    if (gameData.socket.readyState !== gameData.socket.OPEN) return;
    gameData.socket.send(JSON.stringify({
        Requesting: "update",
        X: gameData.clientGlobalPos.x,
        Y: gameData.clientGlobalPos.y,
        Rotation: gameData.client.rotation,
        Interaction: id,
    }));
};

const collideDelta = (delta) => {
    const clientR = 25
    const nextX = clientX + delta.x;
    const nextY = clientY + delta.y;
    for (let obstacle of gameData.obstacles.children) {
        const obstacleX = obstacle.position.x + gameData.obstacles.position.x;
        const obstacleY = obstacle.position.y + gameData.obstacles.position.y;
        const distX = Math.abs(clientX - obstacleX);
        const distY = Math.abs(clientY - obstacleY);
        const nextDistX = Math.abs(nextX - obstacleX);
        const nextDistY = Math.abs(nextY - obstacleY);

        if ((distY < ((obstacle.height*.5)+clientR)) && (nextDistX <= (obstacle.width*.5)+clientR)) { // collision on x-axis
            delta.x = (distX - ((obstacle.width*.5)+clientR))*(delta.x/gameData.moveSpeed);
        }
        if ((distX < ((obstacle.width*.5)+clientR)) && (nextDistY <= ((obstacle.height*.5)+clientR))) { // collision on y-axis
            delta.y = (distY - ((obstacle.height*.5)+clientR))*(delta.y/gameData.moveSpeed);
        }
    }
    return delta
}

const updateItems = () => {
    for (const item of gameData.items.children) {
        switch (item.type) {
            case "coin":
                const id = updateCoin(item);
                if (id) return id;
                break;
            default:
                console.log("unknown item type " + item.type + ", skipping update");
        }
    }
    return "";
}

const updateCoin = (coin) => {
    const clientR = 25
    const coinR = 10
    const coinX = coin.position.x + gameData.items.position.x
    const coinY = coin.position.y + gameData.items.position.y
    const centerDistSq = (clientX - coinX)**2 + (clientY - coinY)**2
    if (centerDistSq < (clientR+coinR)**2) {
        return coin.id;
    }
    return null
}

// Takes a List of data and converts x and y for each item to local coordinates
// Note: Needs to be refactored later to recurse through any data structure
// Or at least work for single objects as well
const globalToLocalCoords = (data) => {
    for (const datum of data) {
        datum.X = clientX + (datum.X - gameData.clientGlobalPos.x);
        datum.Y = clientY + (datum.Y - gameData.clientGlobalPos.y);
    }
};

main();
