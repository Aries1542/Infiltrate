package main

import "math"

type action struct {
	deltaX float32
	deltaY float32
}

type state struct {
	x float32
	y float32
}

func (s state) mnhtDistanceTo(other state) float32 {
	return float32(math.Abs(float64(s.x-other.x)) + math.Abs(float64(s.y-other.y)))
}

type node struct {
	index          int
	state          state
	parent         *node
	action         action
	depth          int
	cost           float32
	estimated_cost float32
}

func (current node) create_action_sequence() []action {
	if current.parent == nil {
		return []action{}
	} else {
		actions := []action{}
		for range skipFactor {
			actions = append(actions, action{
				deltaX: current.action.deltaX / skipFactor,
				deltaY: current.action.deltaY / skipFactor,
			})
		}
		return append(actions, current.parent.create_action_sequence()...)
	}
}

type PriorityQueue []*node

func (pq PriorityQueue) Len() int { return len(pq) }
func (pq PriorityQueue) Less(i, j int) bool {
	return (pq[i].cost + pq[i].estimated_cost) < (pq[j].cost + pq[j].estimated_cost)
}
func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}

func (pq *PriorityQueue) Push(x any) {
	n := len(*pq)
	node := x.(*node)
	node.index = n
	*pq = append(*pq, node)
}

func (pq *PriorityQueue) Pop() any {
	old := *pq
	n := len(old)
	node := old[n-1]
	old[n-1] = nil  // don't stop the GC from reclaiming the item eventually
	node.index = -1 // for safety
	*pq = old[0 : n-1]
	return node
}
