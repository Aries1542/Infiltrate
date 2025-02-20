const drawUI = () => {
    const UI = two.makeGroup();
    UI.add(drawScoreBoard());
    return UI;
}

const drawScoreBoard = () => {
    const scoreboard = two.makeGroup();
    scoreboard.id = "scoreboard";

    const background = two.makeRectangle(0, 0, 200, 300)
    background.origin.set(-.5*background.width, -.5*background.height);
    background.opacity = .7;
    background.fill = "#000";
    scoreboard.add(background)
    const temp = scoreboard.children[scoreboard.children.length - 1]

    const title = two.makeText("Leaderboard", 20, 20, {
        fill: "#fff",
        size: 32,
        alignment: "left",
        baseline: "top",
    });
    scoreboard.add(title)

    const leaders = getScoreboardLeaders()
    for (let i = 1; i < leaders.length+1; i++) {
        const score = two.makeText((i)+". "+leaders[i-1], 20, title.position.y + (i)*30, {
            fill: "#fff",
            size: 28,
            alignment: "left",
            baseline: "top",
        });
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

const getScoreboardLeaders = () => {
    return ["abc: 11", "bcd: 8", "aries1542: 1", "-", "-"]
}

const drawClient = (x, y) => {
    return drawActor(x, y, 0, "#18e");
};

const updatePlayers = (playersData) => {
    for (const player of playersData) {
        if (player.Id === '' || player.Id === clientId) {
            continue;
        }
        if (players.getById(player.Id) === null) {
            let newPlayer = drawPlayer(player.X, player.Y, player.Rotation, player.Id)
            players.add(newPlayer);
            continue;
        }
        players.getById(player.Id).position.set(player.X, player.Y);
        players.getById(player.Id).rotation = player.Rotation;
    }
};

const drawPlayer = (x, y, rotation, id) => {
    const player = drawActor(x, y, rotation, "#6c6");
    player.id = id;
    return player;
};

const drawGuard = (x, y, rotation, id) => {
    const guard = drawActor(x, y, rotation, "#d80");
    guard.id = id;
    return guard;
};

const drawActor = (x, y, rotation, color) => {
    const circle = two.makeCircle(0, 0, 25);
    const triangle = two.makePolygon(0, -25, 20, 3);
    triangle.height = 30;
    const actor = two.makeGroup(circle, triangle);
    actor.fill = color;
    actor.noStroke();
    actor.position.set(x, y);
    actor.rotation = rotation;
    return actor;
};

const drawMap = (mapData) => {
    globalToLocalCoords(mapData.obstacles);
    globalToLocalCoords(mapData.items);
    for (const obstacleData of mapData.obstacles) {
        obstacles.add(drawObstacle(obstacleData));
    }
    for (const itemData of mapData.items) {
        items.add(drawItem(itemData))
    }
}

const drawObstacle = (obstacleData) => {
    const { X, Y, Width, Height, Color } = obstacleData;
    const adjustedX = X + Width*.5, adjustedY = Y + Height*.5;
    const obstacle = two.makeRectangle(adjustedX, adjustedY, Width, Height);
    obstacle.fill = Color;
    obstacle.noStroke();
    return obstacle;
}

const drawItem = (itemData) => {
    switch (itemData.Type) {
        case "coin":
            return drawCoin(itemData)
        default:
            console.log("unknown item type " + itemData.Type + ", skipping draw");
    }
}

const drawCoin = (coinData) => {
    const circle = two.makeCircle(coinData.X, coinData.Y, 10);
    circle.fill = "#fe7";
    circle.stroke = "#ea2";
    circle.type = coinData.Type;
    circle.id = coinData.Id;
    return circle;
}

const drawGrid = () => {
    const grid = two.makeGroup();
    const adjustedHeight = 2*two.height - ((2*two.height)%105);
    const adjustedWidth = 2*two.width - ((2*two.width)%105);
    for (let i = -adjustedWidth*.5; i < adjustedWidth; i += 105) {
        const line = two.makeLine(i, -adjustedHeight*.5, i, adjustedHeight);
        line.stroke = "#333";
        line.lineWidth = 10;
        grid.add(line);
    }
    for (let i = -adjustedHeight*.5; i < adjustedHeight; i += 105) {
        const line = two.makeLine(-adjustedWidth*.5, i, adjustedWidth, i);
        line.stroke = "#333";
        line.lineWidth = 10;
        grid.add(line);
    }
    grid.position.set(clientX-52.5, clientY+52.5)
    return grid;
};