const express = require('express')
const WebSocket = require('ws')
const environment = require('./environment')

const app = express()
app.use(express.static('public'))
var server = app.listen(8080, function () {
    console.log("Server is running...")
})

const wss = new WebSocket.WebSocketServer({ server: server })

env = new environment.Environment()
env.rectObstacles.push(environment.makeCrate(200, 250))
env.rectObstacles.push(environment.makeHorizontalWall(200, 150, 75))
env.rectObstacles.push(environment.makeVerticalWall(200, 150, 200))


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
        movePlayer(data.playerID, data.deltaX, data.deltaY, data.rotation)
        for (client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'update',
                    players: env.players,
                    enemies: env.enemies
                }))
            }
        }
    })
})

function movePlayer(playerID, deltaX, deltaY, rotation) {
    player = env.players[playerID]
    player.rotation = rotation
    player.x += deltaX
    player.y += deltaY
    // if (!positionAvailable(new_x, new_y)) {

    // }
}

// function positionAvailable(x, y) {
//     radius = 25  // Client-side radius of player
//     for (var object of env.rectObstacles) {
//         left = object.x
//         right = object.x + object.width
//         if (x-25 > 3)
//     }
// }