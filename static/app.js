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
                Object.assign(game.clientGlobalPos, {x: player.x, y: player.y});
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
    game.players.position.subtract(delta);
    game.guards.position.subtract(delta);
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

// Takes a list of data and intended parent and converts x and y for each item to local coordinates
const globalToLocalCoords = (data, parent) => {
    for (const datum of data) {
        datum.x = clientX + ((datum.x));
        datum.y = clientY + ((datum.y));
    }
};

main();
