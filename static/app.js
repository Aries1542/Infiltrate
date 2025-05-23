const params = {
    fullscreen: true
};
const two = new Two(params);
two.renderer.domElement.style.background = '#ddd'

let clientX = .5 * two.width;
let clientY = .5 * two.height;

const game = {
    clientId: "",
    mouse: {x: 0, y: 0},
    moveSpeed: 2,
    clientGlobalPos: {x: 0, y: 0},
    gridSize: 20,
    grid: null,
    items: null,
    obstacles: null,
    players: null,
    guards: null,
    client: null,
    ui: null,
    socket: null,
}

const handleMessage = (event) => {
    const {requesting} = JSON.parse(event.data);
    switch (requesting) {
        case "setScene":
            const {player, obstacles, items} = JSON.parse(event.data);
            if (player.id) {
                game.clientId = player.id;
                game.grid.position.add(game.clientGlobalPos.x - player.x, game.clientGlobalPos.y -player.y);
                Object.assign(game.clientGlobalPos, {x: player.x, y: player.y});
                game.obstacles.position.set(player.x, player.y);
                game.items.position.set(player.x, player.y);
                game.players.position.set(player.x, player.y);
                game.guards.position.set(player.x, player.y);
            }
            drawMap(obstacles, items);
            break;
        case "update":
            const {players, guards} = JSON.parse(event.data);
            globalToLocalCoords(players, game.players);
            globalToLocalCoords(guards, game.guards);  
            updatePlayers(players);
            updateGuards(guards);
            updateScoreboard(players);
            break;
        case "remove":
            const {type, id: removeId} = JSON.parse(event.data);
            switch (type) {
                case "player":
                    game.players.children.ids[removeId].remove();
                    break;
                case "item":
                    game.items.children.ids[removeId].remove();
                    break;
            }
            break;
    }
};

const startGame = () => {
    console.log("Connected to server");
    setInterval(update, 15);
    document.getElementById("main-menu").remove();
    two.appendTo(document.body);
    two.play();
};

const connectionRefused = (event) => {
    game.socket.close();
    game.socket = null;
}

const attemptConnection = (username) => {
    fetch("/namecheck?username=" + encodeURIComponent(username), {method: "POST"})
        .then((response) => {
            if (response.ok) {
                game.socket = new WebSocket("/ws?username=" + encodeURIComponent(username));
                game.socket.onerror = connectionRefused;
                game.socket.onopen = startGame;
                game.socket.onmessage = handleMessage;
            } else {
                response.text().then((text) => {
                    const error = document.getElementById("error");
                    switch (text.trim()) {
                        case "username in use":
                            error.innerHTML = "Sorry, that username is already taken. Please enter a different name";
                            error.style.display = "block";
                            break;
                        case "username has bad length":
                            error.innerHTML = "Please input a username between 1 and 15 characters";
                            error.style.display = "block";
                            break;
                        case "username is inappropriate":
                            error.innerHTML = "Please input a username that is appropriate";
                            error.style.display = "block";
                            break;
                        default:
                            console.log("Unknown response: " + text);
                    }
                });
                return;
            }
        })
}

const onClickPlay = () => {
    const username = document.getElementById("username-field").value.trim() || "";
    if (username === "" || username.length > 15) {
        const error = document.getElementById("error");
        error.innerHTML = "Please input a username between 1 and 15 characters";
        error.style.display = "block";
        return;
    }
    attemptConnection(username);
}

const main = () => {
    game.grid = drawGrid(clientX, clientY)
    game.items = two.makeGroup()
    game.obstacles = two.makeGroup()
    game.players = two.makeGroup()
    game.guards = two.makeGroup()
    game.client = drawClient(clientX, clientY)
    game.ui = drawUI()
    document.getElementById("play-button").onclick = onClickPlay;
};

const keysDown = {
    "KeyW": false,
    "ArrowUp": false,
    "KeyA": false,
    "ArrowLeft": false,
    "KeyS": false,
    "ArrowDown": false,
    "KeyD": false,
    "ArrowRight": false,
};
onkeydown = onkeyup = (event) => {
    keysDown[event.code] = (event.type === "keydown");
};
onmousemove = (event) => {
    Object.assign(game.mouse, {x: event.x, y: event.y});
};

const getKeyInput = () => {
    const delta = {x: 0, y: 0};
    if (keysDown["KeyW"] || keysDown["ArrowUp"]) {
        delta.y -= 1;
    }
    if (keysDown["KeyA"] || keysDown["ArrowLeft"]) {
        delta.x -= 1;
    }
    if (keysDown["KeyS"] || keysDown["ArrowDown"]) {
        delta.y += 1;
    }
    if (keysDown["KeyD"] || keysDown["ArrowRight"]) {
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
    if (delta.x || delta.y) {
        game.client.rotation = Math.atan2(delta.y, delta.x) + .5*Math.PI;
    }
    collideDelta(delta);
    game.grid.position.subtract(delta);
    game.obstacles.position.subtract(delta);
    game.items.position.subtract(delta);
    game.players.position.subtract(delta);
    game.guards.position.subtract(delta);
    game.clientGlobalPos.x += delta.x;
    game.clientGlobalPos.y += delta.y;

    const itemId = updateItems();
    const guardId = detected();

    if (game.socket.readyState !== game.socket.OPEN) return;
    game.socket.send(JSON.stringify({
        Requesting: "update",
        X: game.clientGlobalPos.x,
        Y: game.clientGlobalPos.y,
        Rotation: game.client.rotation,
        Interaction: itemId || "",
        DetectedBy: guardId || "",
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

const detected = () => {
    for (const guard of game.guards.children) {
        if (guard.id === "") continue;
        const detectedId = detectedBy(guard);
        if (detectedId) return detectedId;
    }
    return "";
}

const detectedBy = (guard) => {
    if (!guard.children.ids["searchCone"].visible) return "";
    let x = 0
    let y = 0
    if ((guard.rotation).toFixed(4) == (0).toFixed(4)) {
        // North
        y = -1
    } else if ((guard.rotation).toFixed(4) == (Math.PI/4).toFixed(4)) {
        // NorthEast
        x = .70710678 // sqrt(1/2)
        y = -.70710678
    } else if ((guard.rotation).toFixed(4) == (Math.PI/2).toFixed(4)) {
        // East
        x = 1
    } else if ((guard.rotation).toFixed(4) == (3*Math.PI/4).toFixed(4)) {
        // SouthEast
        x = .70710678 
        y = .70710678
    } else if ((guard.rotation).toFixed(4) == (Math.PI).toFixed(4)) {
        // South
        y = 1
    } else if ((guard.rotation).toFixed(4) == (5*Math.PI/4).toFixed(4)) {
        // SouthWest
        x = -.70710678 
        y = .70710678
    } else if ((guard.rotation).toFixed(4) == (3*Math.PI/2).toFixed(4)) {
        // West
        x = -1
    } else if ((guard.rotation).toFixed(4) == (-Math.PI/4).toFixed(4)) {
        // NorthWest
        x = -.70710678
        y = -.70710678
    } else {
        console.log("not cardinal " + guard.rotation);
    }
    const coneLength = 250
    const guardX = game.guards.position.x + guard.position.x
    const guardY = game.guards.position.y + guard.position.y

    let xLow = guardX - 70
    let xHigh = guardX + 70
    let yLow = guardY - 70
    let yHigh = guardY + 70
    if (x) {
        xLow = Math.min(guardX+(x*coneLength), guardX)
        xHigh = Math.max(guardX+(x*coneLength), guardX)
    }
    if (y) {
        yLow = Math.min(guardY+(y*coneLength), guardY)
        yHigh = Math.max(guardY+(y*coneLength), guardY)
    }
    if (xLow > clientX || xHigh < clientX) return ""
    if (yLow > clientY || yHigh < clientY) return ""

    return guard.id
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

// Takes a list of data and intended parent and converts x and y for each item to local coordinates
const globalToLocalCoords = (data, parent) => {
    for (const datum of data) {
        datum.x = clientX + ((datum.x));
        datum.y = clientY + ((datum.y));
    }
};

main();
