package main

const skipFactor = 12
const guardSpeed = 2

type model struct {
	restrictedAreas []obstacle
	obstacles       []obstacle
}

func (m *model) actions(s state) []action {
	actions := make([]action, 0)
	var x float32
	var y float32
	for x = -1; x <= 1; x++ {
		for y = -1; y <= 1; y++ {
			deltaX := x * guardSpeed
			deltaY := y * guardSpeed
			if x != 0 && y != 0 {
				deltaX *= .70710678
				deltaY *= .70710678
			}
			valid := true
			for i := range skipFactor {
				newAction := action{deltaX: deltaX * float32(i), deltaY: deltaY * float32(i)}
				if !m.isValid(m.result(s, newAction)) {
					valid = false
					break
				}
			}
			if !valid {
				continue
			}
			actions = append(actions, action{deltaX: deltaX * skipFactor, deltaY: deltaY * skipFactor})
		}
	}
	return actions
}

func (m *model) isValid(s state) bool {
	guardRadius := float32(25)

	for _, area := range m.restrictedAreas {
		closestX := max(area.X, min(s.x, area.X+area.Width))
		closestY := max(area.Y, min(s.y, area.Y+area.Height))
		distanceX := s.x - closestX
		distanceY := s.y - closestY
		if (distanceX*distanceX + distanceY*distanceY) < (guardRadius * guardRadius) {
			return false
		}
	}

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

func (m *model) result(s state, a action) state {
	return state{
		x: s.x + a.deltaX,
		y: s.y + a.deltaY,
	}
}

func (m *model) step_cost(s state, a action, rs state) float32 {
	_, _, _ = s, a, rs
	return guardSpeed * skipFactor
}

func (m *model) heuristic(s state, gs state) float32 {
	return s.distanceTo(gs)
}
