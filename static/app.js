const params = {
    fullscreen: true
};
const two = new Two(params); // Base class used for all drawing
two.renderer.domElement.style.background = '#ddd'

let clientX = .5 * two.width;
let clientY = .5 * two.height;

const game = {
    clientId: "",
    mouse: {x: 0, y: 0},
    moveSpeed: 2,
    clientGlobalPos: {x: 0, y: 0},
    grid: null,
    items: null,
    obstacles: null,
    players: null,
    client: null,
    ui: null,
    socket: null,
}

const handleMessage = (event) => {
    const {Requesting} = JSON.parse(event.data);
    switch (Requesting) {
        case "setScene":
            const {Id: myId, X, Y, Obstacles, Items} = JSON.parse(event.data);
            console.log(myId);
            if (myId) {
                game.clientId = myId
                Object.assign(game.clientGlobalPos, {x: X, y: Y});
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
                    game.players.getById(removeId).remove();
                    break;
                case "item":
                    game.items.getById(removeId).remove();
                    break;
            }
            break;
    }
};

const onConnection = () => {
    console.log("Connected to server");
    setInterval(update, 15);
    two.play();
};

const startGame = (username) => {
    two.appendTo(document.body)

    game.grid = drawGrid(clientX, clientY)
    game.items = two.makeGroup()
    game.obstacles = two.makeGroup()
    game.players = two.makeGroup()
    game.client = drawClient(clientX, clientY)
    game.ui = drawUI()

    game.socket = new WebSocket("/ws?username=" + username);
    game.socket.onopen = onConnection;
    game.socket.onmessage = handleMessage;

}

const onClickPlay = () => {
    const username = document.getElementById("username-field").value;
    if (username === "" || username.length >= 15) {
        return;
    }
    document.getElementById("main-menu").remove();
    startGame(username);
}

const main = () => {
    document.getElementById("play-button").onclick = onClickPlay;
};

window.addEventListener("resize", function(){
    clientX = .5 * two.width;
    clientY = .5 * two.height;
    Object.assign(game.client.position, {x: clientX, y: clientY});
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
    Object.assign(game.mouse, {x: event.x, y: event.y});
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
    delta.x *= game.moveSpeed; delta.y *= game.moveSpeed;
    collideDelta(delta);
    game.grid.position.subtract(delta);
    game.obstacles.position.subtract(delta);
    game.items.position.subtract(delta);
    game.clientGlobalPos.x += delta.x;
    game.clientGlobalPos.y += delta.y;
    game.client.rotation = Math.atan2(game.mouse.y - clientY, game.mouse.x - clientX) + .5*Math.PI;

    const id = updateItems();

    if (game.socket.readyState !== game.socket.OPEN) return;
    game.socket.send(JSON.stringify({
        Requesting: "update",
        X: game.clientGlobalPos.x,
        Y: game.clientGlobalPos.y,
        Rotation: game.client.rotation,
        Interaction: id,
    }));
};

const collideDelta = (delta) => {
    const clientR = 25
    const nextX = clientX + delta.x;
    const nextY = clientY + delta.y;
    for (let obstacle of game.obstacles.children) {
        const obstacleX = obstacle.position.x + game.obstacles.position.x;
        const obstacleY = obstacle.position.y + game.obstacles.position.y;
        const distX = Math.abs(clientX - obstacleX);
        const distY = Math.abs(clientY - obstacleY);
        const nextDistX = Math.abs(nextX - obstacleX);
        const nextDistY = Math.abs(nextY - obstacleY);

        if ((distY < ((obstacle.height*.5)+clientR)) && (nextDistX <= (obstacle.width*.5)+clientR)) { // collision on x-axis
            delta.x = (distX - ((obstacle.width*.5)+clientR))*(delta.x/game.moveSpeed);
        }
        if ((distX < ((obstacle.width*.5)+clientR)) && (nextDistY <= ((obstacle.height*.5)+clientR))) { // collision on y-axis
            delta.y = (distY - ((obstacle.height*.5)+clientR))*(delta.y/game.moveSpeed);
        }
    }
    return delta
}

const updateItems = () => {
    for (const item of game.items.children) {
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
    const coinX = coin.position.x + game.items.position.x
    const coinY = coin.position.y + game.items.position.y
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
        datum.X = clientX + (datum.X - game.clientGlobalPos.x);
        datum.Y = clientY + (datum.Y - game.clientGlobalPos.y);
    }
};

main();
