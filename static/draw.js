const drawClient = (x, y) => {
    return drawActor(x, y, 0, "#18e");
};

const updatePlayers = (players, playersData) => {
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

const drawGuard = (x, y, rotation) => {
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

const drawGrid = () => {
    const grid = two.makeGroup();
    for (let i = -two.width; i < 2*two.width; i += 50) {
        const line = two.makeLine(i, -two.height, i, 2*two.height);
        line.stroke = "#333";
        grid.add(line);
    }
    for (let i = -two.height; i < 2*two.height; i += 50) {
        const line = two.makeLine(-two.width, i, 2*two.width, i);
        line.stroke = "#333";
        grid.add(line);
    }
    return grid;
};