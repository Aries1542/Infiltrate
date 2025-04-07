package main

import (
	"container/heap"
	"log"
	"math"
	"time"
)

func think(g *guard, m model) []action {
	if goalReached(g) {
		g.currentPoint = (g.currentPoint + 1) % len(g.patrolPoints)
		g.goal = g.patrolPoints[g.currentPoint]
	}
	currentState := state{
		x: g.X,
		y: g.Y,
	}
	actions := aStar(currentState, g.goal, m)
	return actions
}

func goalReached(g *guard) bool {
	leniency := float32(guardSpeed * skipFactor)
	return (g.X-g.goal.x)*(g.X-g.goal.x)+(g.Y-g.goal.y)*(g.Y-g.goal.y) < leniency*leniency
}

func aStar(state0 state, goal_state state, m model) []action {
	var startTime = time.Now()
	var goal_node *node = nil
	stored_states := make(map[state]bool)
	node0 := node{
		state:          state0,
		parent:         nil,
		action:         action{},
		depth:          0,
		cost:           0,
		estimated_cost: m.heuristic(state0, goal_state),
	}
	pq := make(PriorityQueue, 0)
	pq = append(pq, &node0)
	for pq.Len() != 0 {
		current := heap.Pop(&pq).(*node)

		if stored_states[current.state] {
			continue
		}
		stored_states[current.state] = true
		if current.depth > 150 {
			log.Println("Depth limit reached")
			break
		}
		if time.Since(startTime).Seconds() > 2 {
			log.Println("Time limit reached")
			break
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
		log.Println("No path found")
		return nil
	}
	return goal_node.create_action_sequence()
}
