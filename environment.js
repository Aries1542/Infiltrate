class Environment {
    constructor() {
        this.players = {}
        this.enemies = {}
        this.rectObstacles = []
    }

    toJSON() {
        var returnJSON = {}
        for (var i in this) {
            returnJSON[i] = this[i]
        }
        return returnJSON
    }
}

class Player {
    constructor(x, y, rotation) {
        this.x = x
        this.y = y
        this.rotation = rotation
    }

    toJSON() {
        var returnJSON = {}
        for (var i in this) {
            returnJSON[i] = this[i]
        }
        return returnJSON
    }
}

class RoomTemplate {
    constructor(x, y) {
        this.x = x
        this.y = y
        this.rectObstacles = []
        this.enemies = []
    }

    getGlobalRectObstacles() {
        globalRectObstacles = []
        this.rectObstacles.forEach((rect) => {
            x = rect.x + this.x
            y = rect.y + this.y
            height = rect.height
            width = rect.width
            color = rect.color
            globalRectObstacles.push(RectObstacle(x, y, height, width, color))
        })
        return globalRectObstacles
    }

    getGlobalEnemies() {
        globalEnemies = []
        this.enemies.forEach((enemy) => {
            x = rect.x + this.x
            y = rect.y + this.y
            height = rect.height
            width = rect.width
            color = rect.color
            globalEnemies.push(enemy(x, y, height, width, color))
        })
        return globalEnemies
    }
}

class Enemy {
    constructor(x, y, rotation) {
        this.x = x
        this.y = y
        this.rotation = rotation
        this.mode = 'patrol'
        this.patrol_points = []
    }

    toJSON() {
        var returnJSON = {}
        for (var i in this) {
            returnJSON[i] = this[i]
        }
        return returnJSON
    }
}


class RectObstacle {
    constructor(x, y, height, width, color) {
        this.x = x
        this.y = y
        this.height = height
        this.width = width
        this.color = color
    }

    toJSON() {
        var returnJSON = {}
        for (var i in this) {
            returnJSON[i] = this[i]
        }
        return returnJSON
    }
}

function makeCrate(x, y) {
    return new RectObstacle(x, y, 40, 40, '#cd853f')
}

function makeVerticalWall(x, y, length) {
    return new RectObstacle(x, y, 10, length, '#836953')
}

function makeHorizontalWall(x, y, length) {
    return new RectObstacle(x, y, length, 10, "#836953")
}

module.exports = {
    Environment : Environment,
    Player : Player,
    RoomTemplate : RoomTemplate,
    Enemy: Enemy,
    RectObstacle : RectObstacle,
    makeCrate: makeCrate,
    makeHorizontalWall: makeHorizontalWall,
    makeVerticalWall: makeVerticalWall
}