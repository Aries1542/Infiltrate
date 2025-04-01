package main

const skipFactor = 3
const guardSpeed = 2

type infiltrateModel struct {
	obstacles []obstacle
}

func (m *infiltrateModel) actions(s state) []action {
	actions := make([]action, 0)
	var x float32
	var y float32
	for x = -1; x <= 1; x++ {
		// log.Println("x = -1; x <= 1; x++")
		for y = -1; y <= 1; y++ {
			// log.Println("y = -1; y <= 1; y++")
			deltaX := x * guardSpeed * skipFactor
			deltaY := y * guardSpeed * skipFactor
			if x != 0 && y != 0 {
				deltaX *= .70710678
				deltaY *= .70710678
			}
			newAction := action{deltaX: deltaX, deltaY: deltaY}
			if m.isValid(m.result(s, newAction)) {
				actions = append(actions, newAction)
			}
		}
	}
	return actions
}

func (m *infiltrateModel) isValid(s state) bool {
	guardRadius := float32(25)
	for _, obs := range m.obstacles {
		closestX := max(obs.X, min(s.x, obs.X+obs.Width))
		closestY := max(obs.Y, min(s.y, obs.Y+obs.Height))
		distanceX := s.x - closestX
		distanceY := s.y - closestY
		if (distanceX*distanceX + distanceY*distanceY) < (guardRadius * guardRadius) {
			return false
		}
	}
	return true
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
	return s.mnhtDistanceTo(gs)
}
