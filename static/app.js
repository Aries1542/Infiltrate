const params = {
    fullscreen: true, 
    autostart: true
};
const elem = document.body;
const two = new Two(params).appendTo(elem); // Base class used for all drawing
two.renderer.domElement.style.background = '#ddd'
let clientX = .5 * two.width;
let clientY = .5 * two.height;
let mouseX = 0, mouseY = 0;
const moveSpeed = 2;
const clientGlobalPos = {x: 0, y: 0};
const grid = drawGrid(clientX, clientY);
const obstacles = two.makeGroup();
const players = two.makeGroup();
const client = drawClient(clientX, clientY);

const socket = new WebSocket("/ws");
socket.onmessage = (event) => {
    const {Requesting} = JSON.parse(event.data);
    switch (Requesting) {
        case "setScene":
            const {X, Y, Obstacles: mapData} = JSON.parse(event.data);
            Object.assign(clientGlobalPos, {x: X, y: Y});
            drawMap(mapData)
            break;
        case "remove":
            const {Type, Id} = JSON.parse(event.data);
            switch (Type) {
                case "player":
                    players.getById(Id).remove();
                    break;
            }
            break;
        case "update":
            const {PlayersData} = JSON.parse(event.data);
            globalToLocalCoords(PlayersData);
            updatePlayers(PlayersData);
            break;
    }
};

socket.onopen = (event) => {
    console.log("Connected to server");
};

const main = () => {
    setInterval(update, 15);
};

window.addEventListener("resize", function(){
    clientX = .5 * two.width;
    clientY = .5 * two.height;
    Object.assign(client.position, {x: clientX, y: clientY});
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
    mouseX = event.x;
    mouseY = event.y;
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
    delta.x *= moveSpeed; delta.y *= moveSpeed;
    collideDelta(delta);
    grid.position.subtract(delta);
    obstacles.position.subtract(delta);
    clientGlobalPos.x += delta.x;
    clientGlobalPos.y += delta.y;

    client.rotation = Math.atan2(mouseY - clientY, mouseX - clientX) + .5*Math.PI;

    if (socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify({
        Requesting: "update",
        X: clientGlobalPos.x,
        Y: clientGlobalPos.y,
        Rotation: client.rotation,
    }));
};

const collideDelta = (delta) => {
    const clientR = 25
    const nextX = clientX + delta.x;
    const nextY = clientY + delta.y;
    for (let obstacle of obstacles.children) {
        const obstacleX = obstacle.position.x + obstacles.position.x;
        const obstacleY = obstacle.position.y + obstacles.position.y;
        const distX = Math.abs(clientX - obstacleX);
        const distY = Math.abs(clientY - obstacleY);
        const nextDistX = Math.abs(nextX - obstacleX);
        const nextDistY = Math.abs(nextY - obstacleY);

        if ((distY < ((obstacle.height*.5)+clientR)) && (nextDistX <= (obstacle.width*.5)+clientR)) { // collision on x-axis
            delta.x = (distX - ((obstacle.width*.5)+clientR))*(delta.x/moveSpeed);
        }
        if ((distX < ((obstacle.width*.5)+clientR)) && (nextDistY <= ((obstacle.height*.5)+clientR))) { // collision on y-axis
            delta.y = (distY - ((obstacle.height*.5)+clientR))*(delta.y/moveSpeed);
        }
    }
    return delta
}


// Takes a List of data and converts x and y for each item to local coordinates
// Note: Needs to be refactored later to recurse through any data structure
// Or at least work for single objects as well
const globalToLocalCoords = (data) => {
    for (const datum of data) {
        datum.X = clientX + (datum.X - clientGlobalPos.x);
        datum.Y = clientY + (datum.Y - clientGlobalPos.y);
    }
};

main();
