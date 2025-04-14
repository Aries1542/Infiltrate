package main

import (
	"container/heap"
	"errors"
	"log"
	"math"
	"math/rand/v2"
	"time"
)

func think(g *guard, m model) []action {
	if g.chasing == nil { // Guard is patrolling
		g.Searching = true
		if goalReached(g) {
			g.currentPoint = (g.currentPoint + 1) % len(g.patrolPoints)
			g.goal = g.patrolPoints[g.currentPoint]
		}
	} else if canSee(g, g.chasing, m) { // Guard is in pursuit
		g.Searching = false
		g.goal = state{
			x: g.chasing.X,
			y: g.chasing.Y,
		}
	} else { // Guard is in pursuit but has lost sight
		g.Searching = true
		if goalReached(g) {
			g.chasing = nil
		}
	}
	currentState := state{
		x: g.X,
		y: g.Y,
	}
	actions, err := aStar(currentState, g.goal, m)
	lost := false
	if err != nil {
		log.Println("Guard AI error:", err)
		g.failedPathAttempts++
		if time.Since(g.lastSuccessfulPathTime) > 1*time.Minute {
			g.currentPoint = 0
			g.goal = g.patrolPoints[0]
			g.X = g.patrolPoints[0].x
			g.Y = g.patrolPoints[0].y
			log.Println("Too lost, tping...")
		} else if g.failedPathAttempts > len(g.patrolPoints) {
			lost = true
			g.currentPoint = closestPatrolPoint(g)
			xDist := g.patrolPoints[g.currentPoint].x - g.X
			yDist := g.patrolPoints[g.currentPoint].y - g.Y
			g.goal = state{
				x: (g.X + rand.Float32()*xDist) + (rand.Float32()*xDist/4 - xDist/8),
				y: (g.Y + rand.Float32()*yDist) + (rand.Float32()*yDist/4 - yDist/8),
			}
			log.Println("Trying random point: ", g.goal)
		} else {
			g.chasing = nil
			g.currentPoint = (g.currentPoint + 1) % len(g.patrolPoints)
			g.goal = g.patrolPoints[g.currentPoint]
			log.Println("Trying patrol point: ", g.goal)
		}
		actions = make([]action, 0)
	} else {
		g.failedPathAttempts = 0
	}
	if !lost {
		g.lastSuccessfulPathTime = time.Now()
	}
	return actions
}

func goalReached(g *guard) bool {
	leniency := float32(guardSpeed * skipFactor)
	return (g.X-g.goal.x)*(g.X-g.goal.x)+(g.Y-g.goal.y)*(g.Y-g.goal.y) < leniency*leniency
}

func canSee(g *guard, p *player, m model) bool {
	x1, y1, x2, y2 := g.X, g.Y, p.X, p.Y
	if x1 > x2 {
		x1, y1, x2, y2 = x2, y2, x1, y1
	}
	if x2-x1 < 50 {
		mid := (x1 + x2) / 2
		x2 = mid + 25
		x1 = mid - 25
	}

	slope := (y2 - y1) / (x2 - x1)
	b := y1 - slope*x1

	for x := x1; x <= x2; x += 5 {
		y := (slope * x) + b
		for _, obs := range m.obstacles {
			if obs.X < x && obs.X+obs.Width > x && obs.Y < y && obs.Y+obs.Height > y {
				return false
			}
		}
	}

	return true
}

func closestPatrolPoint(g *guard) int {
	closest := 0
	currentState := state{
		x: g.X,
		y: g.Y,
	}
	minDistance := math.Abs(float64(currentState.distanceTo(g.patrolPoints[closest])))
	for i, point := range g.patrolPoints {
		distance := math.Abs(float64(currentState.distanceTo(point)))
		if distance < minDistance {
			minDistance = distance
			closest = i
		}
	}
	return closest
}

func aStar(state0 state, goal_state state, m model) ([]action, error) {
	var startTime = time.Now()
	var goal_node *node = nil
	stored_states := make(map[state]bool)
	node0 := &node{
		state:          state0,
		parent:         nil,
		action:         action{},
		depth:          0,
		cost:           0,
		estimated_cost: m.heuristic(state0, goal_state),
	}
	pq := make(PriorityQueue, 0)
	heap.Push(&pq, node0)
	for pq.Len() != 0 {
		current := heap.Pop(&pq).(*node)

		if stored_states[current.state] {
			continue
		}
		stored_states[current.state] = true
		if current.depth > 150 {
			return nil, errors.New("depth limit reached")
		}
		if time.Since(startTime).Seconds() > 2 {
			return nil, errors.New("time limit reached")
		}

		if math.Abs(float64(current.state.distanceTo(goal_state))) < float64(skipFactor*guardSpeed) {
			goal_node = current
			break
		}
		for _, action := range m.actions(current.state) {
			result_state := m.result(current.state, action)
			result_cost := m.step_cost(current.state, action, result_state) + current.cost
			result_hueristic := m.heuristic(result_state, goal_state)
			result_node := &node{
				state:          result_state,
				parent:         current,
				action:         action,
				depth:          current.depth + 1,
				cost:           result_cost,
				estimated_cost: result_hueristic,
			}
			heap.Push(&pq, result_node)
		}
	}
	if goal_node == nil {
		return nil, errors.New("no path found")
	}
	return goal_node.create_action_sequence(), nil
}
