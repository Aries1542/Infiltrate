package main

type model interface {
	actions(s state) []action
	result(s state, a action) state
	step_cost(s state, a action, gs state) float32
	heuristic(s state, gs state) float32
}

const skip = 3

type infiltrateModel struct {
	obstacles []obstacle
}

func (m *infiltrateModel) actions(s state) []action {
	actions := make([]action, 0)
	var x float32
	var y float32
	for x = -1; x <= 1; x++ {
		for y = -1; y <= 1; y++ {
			deltaX := x * skip
			deltaY := y * skip
			if x != 0 && y != 0 {
				deltaX *= .70710678
				deltaY *= .70710678
			}
			newAction := action{deltaX: deltaX, deltaY: deltaY}
			actions = append(actions, newAction)
		}
	}
	return actions
}

func (m *infiltrateModel) result(s state, a action) state {
	return state{
		x: s.x + a.deltaX,
		y: s.y + a.deltaY,
	}
}

func (m *infiltrateModel) step_cost(s state, a action, rs state) float32 {
	return 2
}

func (m *infiltrateModel) heuristic(s state, gs state) float32 {
	return s.sqDistanceTo(gs) / skip
}
