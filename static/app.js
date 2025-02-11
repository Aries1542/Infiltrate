const params = {
    fullscreen: true, 
    autostart: true
};
const elem = document.body;
const two = new Two(params).appendTo(elem); // Base class used for all drawing
let clientX = .5 * two.width;
let clientY = .5 * two.height;
let mouseX = 0, mouseY = 0;
const clientGlobalPos = {x: 0, y: 0};
const grid = drawGrid(clientX, clientY);
const objects = two.makeGroup();
const players = two.makeGroup();
const client = drawClient(clientX, clientY);

const socket = new WebSocket("/ws");
socket.onmessage = (event) => {
    const {Requesting} = JSON.parse(event.data);
    switch (Requesting) {
        case "setScene":
            const {X, Y} = JSON.parse(event.data);
            Object.assign(clientGlobalPos, {x: X, y: Y});
            break;
        case "update":
            const {PlayersData} = JSON.parse(event.data);
            console.log("my position: ", clientGlobalPos);
            console.log("their position", PlayersData);
            globalToLocalCoords(clientGlobalPos, PlayersData);
            console.log("their adjusted position", PlayersData);
            updatePlayers(players, PlayersData);
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
    return delta;
}

const update = () => {
    const moveSpeed = 1;
    const delta = getKeyInput();
    delta.x *= moveSpeed; delta.y *= moveSpeed;
    grid.position.subtract(delta);
    objects.position.subtract(delta);
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

const globalToLocalCoords = (clientGlobalPos, data) => {
    for (item of data) {
        item.X = clientX + (item.X - clientGlobalPos.x);
        item.Y = clientY + (item.Y - clientGlobalPos.y);
    }
};

main();
