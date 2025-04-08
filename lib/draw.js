const gridWidth = 1285.5999755859375; // Taken from screen size used to draw map
const gridHeight = 695.2000122070312; // Taken from screen size used to draw map

const drawUI = () => {
    const UI = two.makeGroup();
    UI.add(drawScoreboard());
    return UI;
}

const updateScoreboard = (players) => {
    players.sort((p1, p2) => {
        if (p2.score !== p1.score) return p2.score - p1.score;
        return (p1.username.toLowerCase() > p2.username.toLowerCase()) ? 1:-1;
    })
    const scoreboard = game.ui.children.ids['scoreboard']
    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        scoreboard.children.ids["pos" + (i + 1)].value = (i+1)+". "+player.username+": "+player.score;
    }
    if (players.length < 6) for (let i = players.length; i < 5; i++) {
        scoreboard.children.ids["pos" + (i+1)].value = (i+1)+". -";
    }
}

const drawScoreboard = () => {
    const scoreboard = two.makeGroup();
    scoreboard.id = "scoreboard";

    const background = two.makeRectangle(0, 0, 200, 300)
    background.origin.set(-.5*background.width, -.5*background.height);
    background.opacity = .7;
    background.fill = "#000";
    scoreboard.add(background)

    const title = two.makeText("Leaderboard", 20, 20, {
        fill: "#fff",
        size: 32,
        alignment: "left",
        baseline: "top",
    });
    scoreboard.add(title)

    for (let i = 1; i < 6; i++) {
        const score = two.makeText((i)+". "+"-", 20, title.position.y + (i)*30, {
            fill: "#fff",
            size: 28,
            alignment: "left",
            baseline: "top",
        });
        score.id = "pos"+i
        scoreboard.add(score)
    }

    const totalWidth = Math.max(...(scoreboard.children.map((text) => {return text.getBoundingClientRect().width})))
    const totalHeight = scoreboard.children[scoreboard.children.length - 1].position.y
                      + scoreboard.children[scoreboard.children.length - 1].getBoundingClientRect().height;
    background.width = totalWidth+20;
    background.height = totalHeight+20;
    background.origin.set(-.5*background.width, -.5*background.height);

    return scoreboard;
}

const drawClient = (x, y) => {
    return drawActor(x, y, 0, "#18e");
};

const updatePlayers = (players) => {
    for (const player of players) {
        if (player.id === '' || player.id === game.clientId) {
            continue;
        }
        if (game.players.children.ids[player.id] === undefined) {
            let newPlayer = drawPlayer(player.x, player.y, player.rotation, player.id)
            game.players.add(newPlayer);
            continue;
        }
        game.players.children.ids[player.id].position.set(player.x, player.y);
        game.players.children.ids[player.id].rotation = player.rotation;
    }
};

const updateGuards = (guards) => {
    for (const guard of guards) {
        if (guard.id === '') {
            continue;
        }
        if (game.guards.children.ids[guard.id] === undefined) {
            let newGuard = drawGuard(guard.x, guard.y, guard.rotation, guard.id)
            game.guards.add(newGuard);
            continue;
        }
        game.guards.children.ids[guard.id].position.set(guard.x, guard.y);
        game.guards.children.ids[guard.id].rotation = guard.rotation;
        game.guards.children.ids[guard.id].children.ids["searchCone"].visible = guard.searching;
    }
}

const drawPlayer = (x, y, rotation, id) => {
    const player = drawActor(x, y, rotation, "#6c6");
    player.id = id;
    return player;
};

const drawGuard = (x, y, rotation, id) => {
    const guard = drawActor(x, y, rotation, "#d80", true);
    guard.id = id;
    return guard;
};

const drawActor = (x, y, rotation, color, guard=false) => {
    let searchCone = null;
    if (guard) {
        searchCone = two.makePolygon(0, -100, 100, 3);
    }

    const circle = two.makeCircle(0, 0, 25);
    const triangle = two.makePolygon(0, -25, 20, 3);
    triangle.height = 30;
    const actor = searchCone ? two.makeGroup(searchCone, circle, triangle) : two.makeGroup(circle, triangle);
    actor.fill = color;
    actor.noStroke();

    if (searchCone) {
        searchCone.rotation = Math.PI;
        searchCone.width = 150;
        searchCone.stroke = "#333";
        searchCone.linewidth = 3;
        searchCone.fill = "#dd0";
        searchCone.opacity = .5;
        searchCone.id = "searchCone";
    }

    actor.position.set(x, y);
    actor.rotation = rotation;
    return actor;
};

const drawMap = (obstacles, items) => {
    if (obstacles) {
        globalToLocalCoords(obstacles, game.obstacles);
        for (const obstacle of obstacles) {
            game.obstacles.add(drawObstacle(obstacle));
        }
    }
    if (items) {
        globalToLocalCoords(items, game.items);
        for (const item of items) {
            game.items.add(drawItem(item))
        }
    }
}

const drawObstacle = (obstacleData) => {
    const { x, y, width, height, color, stroke } = obstacleData;
    const adjustedX = x + width*.5, adjustedY = y + height*.5;
    const obstacle = two.makeRectangle(adjustedX, adjustedY, width, height);
    obstacle.fill = color;
    if (stroke) {
        obstacle.stroke = stroke
        obstacle.linewidth = 3;
    }
    else obstacle.noStroke();
    return obstacle;
}

const drawItem = (item) => {
    switch (item.type) {
        case "coin":
            if (!game.items.children.ids[item.id]){
                return drawCoin(item)
            }
            break;
        default:
            console.log("unknown item type " + item.type + ", skipping draw");
    }
}

const drawCoin = (coin) => {
    const circle = two.makeCircle(coin.x, coin.y, 10);
    circle.fill = "#fe7";
    circle.stroke = "#ea2";
    circle.type = coin.type;
    circle.id = coin.id;
    return circle;
}

const drawGrid = () => {
    const grid = two.makeGroup();
    const adjustedHeight = 1.5*gridHeight - ((1.5*gridHeight)%game.gridSize);
    const adjustedWidth = 1.0*gridWidth - ((1.0*gridWidth)%game.gridSize);
    for (let i = -adjustedWidth; i <= adjustedWidth; i += game.gridSize) {
        const line = two.makeLine(i, -adjustedHeight, i, adjustedHeight);
        line.stroke = "#333";
        grid.add(line);
    }
    for (let i = -adjustedHeight; i <= adjustedHeight; i += game.gridSize) {
        const line = two.makeLine(-adjustedWidth, i, adjustedWidth, i);
        line.stroke = "#333";
        grid.add(line);
    }
    grid.position.add((two.width - gridWidth)/2, (two.height - gridHeight)/2);
    return grid;
};