package main

import (
	"container/heap"
	"log"
	"math"
)

type GuardAI struct {
	model infiltrateModel
}

func NewGuardAI(obstacles []obstacle) *GuardAI {
	return &GuardAI{
		model: infiltrateModel{
			obstacles: obstacles,
		},
	}
}

func (g *GuardAI) GetGuardActions(s state, gs state) []action {
	actions := aStar(s, gs, g.model)
	return actions
}

func aStar(state0 state, goal_state state, m infiltrateModel) []action {
	var goal_node *node = nil
	stored_states := make(map[state]bool)
	node0 := node{
		state:          state0,
		parent:         nil,
		action:         action{},
		depth:          0,
		cost:           0,
		estimated_cost: state0.mnhtDistanceTo(goal_state),
	}
	pq := make(PriorityQueue, 0)
	pq = append(pq, &node0)
	for pq.Len() != 0 {
		// log.Println("pq.Len() != 0")
		current := heap.Pop(&pq).(*node)
		// log.Println("depth: ", current.depth)

		if stored_states[current.state] {
			continue
		}
		stored_states[current.state] = true
		if current.depth > 400 {
			log.Println("Depth limit reached")
			break
		}

		if math.Abs(float64(current.state.mnhtDistanceTo(goal_state))) < float64(2*skip) {
			goal_node = current
			break
		}
		for _, action := range m.actions(current.state) {
			// log.Println("_, action := range m.actions(current.state)")
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
