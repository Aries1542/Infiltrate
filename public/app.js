////////////////////////////// GLOBAL VARIABLES \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
var clientID = null
var setup = false

var params = { fullscreen: true };
var elem = document.body;
var two = new Two(params).appendTo(elem); // Base class used for all drawing
two.play()

var centerX = two.width * 0.5
var centerY = two.height * 0.5

var objectGlobalpos

var scene = { // Stores graphics objects of every rendered object
    players: {},
    enemies: {},
    rectObstacles: []
}

////////////////////////////// SOCKET FUNCTIONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
var socket = new WebSocket("ws://localhost:8080")
socket.onmessage = (event) => {
    message = JSON.parse(event.data)
    var clientPlayer = null
    switch(message.type) {
        case 'setup':
            clientID = message.playerID
            env = message.env
            clientPlayer = env.players[clientID]

            setupObjects(env.rectObstacles, clientPlayer)
            updatePlayers(env.players, clientPlayer)
            updateEnemies(env.enemies, clientPlayer)
            setup = true

            break

        case 'update':
            clientPlayer = message.players[clientID]
            updateObjects(clientPlayer)
            updatePlayers(message.players, clientPlayer)
            updateEnemies(message.enemies, clientPlayer)
            break
    }
}


////////////////////////////// GRAPHICS OBJECTS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

function updatePlayers(players, clientPlayer) {
    for (let playerID in players) {
        if (!(playerID in scene.players)) {
            var circle = two.makeCircle(0, 0, 25);
            var triangle = two.makePolygon(0, -25, 20, 3);
            triangle.height = 30;
            circle.fill = triangle.fill = '#1188ee';
            circle.noStroke();
            triangle.noStroke();
            scene.players[playerID] = two.makeGroup(circle, triangle);
        }
        playerObj = players[playerID]
        let x = centerX + (playerObj.x - clientPlayer.x)
        let y = centerY + (playerObj.y - clientPlayer.y)
        scene.players[playerID].position.set(x, y)
        scene.players[playerID].rotation = playerObj.rotation
    }
}

function updateEnemies(enemies, clientPlayer) {
    for (let enemyID in enemies) {
        if (!(enemyID in scene.enemies)) {
            var circle = two.makeCircle(0, 0, 25);
            var triangle = two.makePolygon(0, -25, 20, 3);
            triangle.height = 30;
            circle.fill = triangle.fill = '#44eeaa';
            circle.noStroke();
            triangle.noStroke();
            scene.enemies[enemyID] = two.makeGroup(circle, triangle);
        }
        enemyObj = enemies[enemyID]
        let x = centerX + (enemyObj.x - clientPlayer.x)
        let y = centerY + (enemyObj.y - clientPlayer.y)
        scene.enemies[enemyID].position.set(x, y)
        scene.enemies[enemyID].rotation = enemyObj.rotation
    }
}

function setupObjects(objects, clientPlayer) {
    for (var object of objects) {
        let x = centerX + (object.x - clientPlayer.x)
        let y = centerY + (object.y - clientPlayer.y)
        let width = object.width
        let height = object.height
        var rect = two.makeRectangle(x, y, width, height)   
        rect.fill = object.color

        var obstacle = {}
        obstacle.data = object
        obstacle.graphics = rect

        scene.rectObstacles.push(obstacle)
    }
}

function updateObjects(clientPlayer) {
    console.log("before:", scene.rectObstacles)
    for (var object of scene.rectObstacles) {
        let x = centerX + (object.data.x - clientPlayer.x)
        let y = centerY + (object.data.y - clientPlayer.y)
        object.graphics.position.set(x, y)
    }
    console.log("after:", scene.rectObstacles)
}



////////////////////////////// OTHER FUNCTIONS \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\


// function updatePlayers(players) {
//     playerObj = players[clientPlayer]
//     playerID.position.set(playerObj.x, playerObj.y)
//     playerID.rotation = playerObj.rotation
// }

function requestMovement(deltaX, deltaY) {
    var angle = Math.atan2(mouseY - centerY, mouseX - centerX) + .5*Math.PI;
    socket.send(JSON.stringify({
        'playerID': clientID,
        'deltaX': deltaX,
        'deltaY': deltaY,
        'rotation': angle
    }))
}

var keysDown = {
    "KeyW": false,
    "KeyA": false,
    "KeyS": false,
    "KeyD": false,
};
onkeydown = onkeyup = (event) => {
    keysDown[event.code] = (event.type == "keydown")
};
var mouseX = 0
var mouseY = 0
onmousemove = (event) => {
    mouseX = event.x
    mouseY = event.y
};

function handleKeys () {
    deltaX = 0;
    deltaY = 0;
    if (keysDown["KeyW"]) {
        deltaY -= 2;
    }
    if (keysDown["KeyA"]) {
        deltaX -= 2;
    }
    if (keysDown["KeyS"]) {
        deltaY += 2;
    }
    if (keysDown["KeyD"]) {
        deltaX += 2;
    }
    deltaX *= 2
    deltaY *= 2
    requestMovement(deltaX, deltaY)
};

function update() {
    if (socket.readyState !== WebSocket.OPEN || !setup) {
        return
    }
    handleKeys()
}


setInterval(update, 15);