const express = require('express')
const WebSocket = require('ws')
const environment = require('./environment')
const agent = require('./agent')

const app = express()
app.use(express.static('public'))
var server = app.listen(8080, function () {
    console.log("Server is running...")
})

const wss = new WebSocket.WebSocketServer({ server: server })

env = new environment.Environment()
env.rectObstacles.push(environment.makeCrate(200, 250))
env.enemies['e1'] = (new environment.Enemy(300, 300, Math.PI*.5))
// env.rectObstacles.push(environment.makeHorizontalWall(300, 250, 75))
// env.rectObstacles.push(environment.makeVerticalWall(300, 250, 200))
let enemyAgent = new agent.Agent()
enemyAgent.reset(300, 300, env.rectObstacles)


numClients = 0;
wss.on('connection', function (ws) {
    numClients += 1;
    playerID = "p" + numClients
    ws.player = playerID

    env.players[playerID] = new environment.Player(200, 150, 150)

    ws.send(JSON.stringify({
        type: 'setup',
        playerID: playerID,
        env: env
    }))

    ws.on('message', function (data, isBinary) {
        data = JSON.parse(data)
        updatePlayerAction(data.playerID, data.deltaX, data.deltaY, data.rotation)
    })
})

function broadcast() {
    step()
    for (client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'update',
                players: env.players,
                enemies: env.enemies
            }))
        }
    }
}

function step() {
    for (let playerID in env.players) {
        movePlayer(playerID)
    }
    if ('p1' in env.players) {
        moveEnemy('e1')
    }
}

setInterval(broadcast, 15)

function updatePlayerAction(playerID, deltaX, deltaY, rotation) {
    action = env.players[playerID].action
    action.deltaX = deltaX
    action.deltaY = deltaY
    action.rotation = rotation
}

function movePlayer(playerID) {
    var player = env.players[playerID]
    var deltaX = player.action.deltaX
    var deltaY = player.action.deltaY
    var rotation = player.action.rotation

    player.rotation = rotation
    let newX = player.x + deltaX
    let newY = player.y + deltaY
    let [fixedX, fixedY] = fixPosition(newX, newY)
    player.x = fixedX
    player.y = fixedY
}

function moveEnemy(enemyID) {
    var player = env.players['p1']

    var enemy = env.enemies[enemyID]
    enemyAgent.reset(player.x, player.y, env.rectObstacles)
    enemy.action = enemyAgent.agent_function(JSON.stringify({
        'x': enemy.x,
        'y': enemy.y
    }))
    
    var deltaX = enemy.action.deltaX
    var deltaY = enemy.action.deltaY
    var angle = Math.atan2(player.y - enemy.y, player.x - enemy.x) + .5*Math.PI;

    enemy.rotation = angle
    let newX = enemy.x + deltaX
    let newY = enemy.y + deltaY
    let [fixedX, fixedY] = fixPosition(newX, newY)
    enemy.x = fixedX
    enemy.y = fixedY
}

function fixPosition(x, y) {
    radius = 25  // Client-side radius of player
    
    var xModified = false
    var yModified = false
    
    let playerLeft = x - radius
    let playerRight = x + radius
    
    let playerTop = y - radius
    let playerBottom = y + radius

    for (var object of env.rectObstacles) {
        let wallLeft = object.x - object.width/2
        let wallRight = object.x + object.width/2
        let wallTop = object.y - object.height/2
        let wallBottom = object.y + object.height/2
        
        if ((!xModified && (playerTop < wallBottom-10 && playerBottom > wallTop+10) && !(playerLeft >= wallRight || playerRight <= wallLeft))) {
            // console.log("its happening (x)")
            if (playerLeft < wallRight && playerRight > wallRight) { // left side of player is clipping wall
                x = wallRight+radius
                xModified = true
            } else {
                x = wallLeft-radius
                xModified = true
            }
        }
        
        if ((!yModified && (playerLeft < wallRight-10 && playerRight > wallLeft+10) && !(playerTop >= wallBottom || playerBottom <= wallTop))) {
            // console.log("its happening (y)")
            if (playerTop < wallBottom && playerBottom > wallBottom) { // top side of player is clipping wall
                y = wallBottom+radius
                yModified = true
            } else {
                y = wallTop-radius
                yModified = true
            }
        }

        if (xModified && yModified) {break}
    }

    return [x, y]
}