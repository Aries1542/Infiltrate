const {
    PriorityQueue,
    MinPriorityQueue,
    MaxPriorityQueue,
} = require('@datastructures-js/priority-queue');

class Node {
    constructor(state, parent, action, depth, cost, estimated_cost) {
        this.state = state
        this.parent = parent
        this.action = action
        this.depth = depth
        this.cost = cost
        this.estimated_cost = estimated_cost
    }
}

class Agent {
    constructor() {
        this.model = new AgentModel()
        this.actions = []
    }

    reset(goalX, goalY, objects) {
        this.model.reset(goalX, goalY, objects)
        this.actions = []
    }

    createActionSequence(current) {
        if (current.parent === null)
            return []
        else
            return [current.action].concat(this.createActionSequence(current.parent))
    }

    aStarSearch(state0) {
        if (this.model.GOAL_TEST(state0)) {
            return [{'deltaX': 0, 'deltaY': 0}]
        } 
        var goalNode = null
        var storedStates = {}
        var node0 = new Node(state0, null, null, 0, 0, this.model.HUERISTIC(state0))
        const frontier = new MinPriorityQueue((node) => (node.cost + node.estimated_cost))
        frontier.enqueue(node0)
        while (!frontier.isEmpty()) {
            var current = frontier.dequeue()
            if (current.state in storedStates) continue
            else storedStates[current.state] = 1

            if (this.model.GOAL_TEST(current.state) || current.depth == 20) {
                goalNode = current
                break
            }
            for (var action of this.model.ACTIONS(current.state)) {
                let resultState = this.model.RESULT(current.state, action)
                let resultCost = this.model.STEP_COST(current.state, action, resultState) + current.cost
                let resultHueristic = this.model.HUERISTIC(resultState)
                let resultNode = new Node(resultState, current, action, current.depth+1, resultCost, resultHueristic)

                frontier.enqueue(resultNode)
            }
        }
        return this.createActionSequence(goalNode)
    }

    agent_function(state) {
        if (this.actions.length == 0) this.actions = this.aStarSearch(state)
        let action = this.actions.pop()
        return action
    }
}

class AgentModel {
    constructor() {
        this.goalX = null
        this.goalY = null
        this.objects = null
    }

    reset(goalX, goalY, objects) {
        this.goalX = goalX
        this.goalY = goalY
        this.objects = objects
    }

    encodeState(state) {
        return JSON.stringify(state)
    }

    decodeState(state) {
        return JSON.parse(state)
    }

    ACTIONS(state) {
        return [
            {
                'deltaX': 2,
                'deltaY': 0
            },
            {
                'deltaX': -2,
                'deltaY': 0
            },
            {
                'deltaX': 0,
                'deltaY': 2
            },
            {
                'deltaX': 0,
                'deltaY': -2
            },
            {
                'deltaX': 2,
                'deltaY': 2
            },
            {
                'deltaX': 2,
                'deltaY': -2
            },
            {
                'deltaX': -2,
                'deltaY': 2
            },
            {
                'deltaX': -2,
                'deltaY': -2
            }
        ]
    }

    RESULT(state, action) {
        state = this.decodeState(state)
        var newX = state.x += action.deltaX
        var newY = state.y += action.deltaY
        let [fixedX, fixedY] = fixPosition(newX, newY, this.objects)
        state.x = fixedX
        state.y = fixedY
        return this.encodeState(state)
    }

    GOAL_TEST(state) {
        state = this.decodeState(state)
        let xDistance = Math.abs((state.x - this.goalX) / 2)
        let yDistance = Math.abs((state.y - this.goalY) / 2)
        return ((xDistance < 20) && (yDistance < 20))
    }

    STEP_COST(state, action, result) {
        return 1
    }

    HUERISTIC(state) {
        state = this.decodeState(state)
        let xDistance = Math.abs((state.x - this.goalX) / 2)
        let yDistance = Math.abs((state.y - this.goalY) / 2)
        return (xDistance + yDistance)
    }
}
    

function fixPosition(x, y, objects) {
    radius = 25  // Client-side radius of player
    
    var xModified = false
    var yModified = false
    
    let playerLeft = x - radius
    let playerRight = x + radius
    
    let playerTop = y - radius
    let playerBottom = y + radius

    for (var object of objects) {
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


module.exports = {
    Agent : Agent
}