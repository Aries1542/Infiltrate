const drawClient = (x, y) => {
    return drawActor(x, y, 0, "#18e");
};

const updatePlayers = (playersData) => {
    for (const player of playersData) {
        if (player.Id === 0) {
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
    player = drawActor(x, y, rotation, "#6c6");
    player.id = id;
    return player;
};

const drawGuard = (x, y, rotation, id) => {
    guard = drawActor(x, y, rotation, "#d80");
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
    globalToLocalCoords(mapData);
    for (const obstacleData of mapData) {
        obstacles.add(drawObstacle(obstacleData));
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