package main

import (
	"encoding/json"
	"errors"
	"log"
	"math"
	"os"
	"sync"
	"time"
)

// The Hub processes requests and updates server data accordingly.
//
//	It also continually sends server data to clients
type Hub struct {
	sync.RWMutex
	incoming        chan request
	nextID          int
	players         map[*Client]*player
	guards          []guard
	obstacles       []obstacle
	restrictedAreas []obstacle
	items           []item
}

// a player is representation of the data needed to draw one client to another's screen
type player struct {
	Id       string  `json:"id"`
	Username string  `json:"username"`
	X        float32 `json:"x"`
	Y        float32 `json:"y"`
	Rotation float32 `json:"rotation"`
	Score    int     `json:"score"`
}

type guard struct {
	Id                     string  `json:"id"`
	X                      float32 `json:"x"`
	Y                      float32 `json:"y"`
	Rotation               float32 `json:"rotation"`
	Searching              bool    `json:"searching"`
	actions                []action
	goal                   state
	patrolPoints           []state
	currentPoint           int
	chasing                *player
	failedPathAttempts     int // # of patrol points guard cannot navigate to
	lastSuccessfulPathTime time.Time
	lastSuccessfulMoveTime time.Time
}

// An obstacle should be id-less, static, collidable, and rectangular.
// X and Y represent the top-left corner of the object.
// Anything not matching these should be made as an item.
type obstacle struct {
	X      float32 `json:"x"`
	Y      float32 `json:"y"`
	Width  float32 `json:"width"`
	Height float32 `json:"height"`
	Color  string  `json:"color"`
	Stroke string  `json:"stroke"`
}

// An item is anything that should be displayed and interacted with by the player, that does not fit as an obstacle.
// The Type field is used to determine how to display and interact with the item.
type item struct {
	Id   string  `json:"id"`
	Type string  `json:"type"`
	X    float32 `json:"x"`
	Y    float32 `json:"y"`
}

func newHub() *Hub {
	obstacles, items, guards, restrictedAreas, err := readWorldData()
	if err != nil {
		log.Println(err)
	}
	return &Hub{
		incoming:        make(chan request),
		nextID:          1,
		players:         make(map[*Client]*player),
		guards:          guards,
		obstacles:       obstacles,
		restrictedAreas: restrictedAreas,
		items:           items,
	}
}

func (h *Hub) handleMessages() {
	for {
		message := <-h.incoming
		message.Handle(h)
	}
}

func (h *Hub) update() {
	m := model{
		restrictedAreas: h.restrictedAreas,
		obstacles:       h.obstacles,
	}

	updateTicker := time.NewTicker(10 * time.Millisecond)
	moveTicker := time.NewTicker(20 * time.Millisecond)
	coinSpawnTicker := time.NewTicker(2 * time.Minute)
	for {
		select {
		case <-updateTicker.C:
			players := make([]player, 0)
			h.RLock()
			for client := range h.players {
				players = append(players, *h.players[client])
			}
			for receivingClient := range h.players {
				receivingClient.outgoing <- updateResponse{Players: players, Guards: h.guards}
			}
			h.RUnlock()
		case <-moveTicker.C:
			h.Lock()
			for i := range h.guards {
				if len(h.guards[i].actions) == 0 {
					continue
				}
				last := len(h.guards[i].actions) - 1

				newX := h.guards[i].X + h.guards[i].actions[last].deltaX
				newY := h.guards[i].Y + h.guards[i].actions[last].deltaY
				if m.isValid(state{x: newX, y: newY}) {
					h.guards[i].X = newX
					h.guards[i].Y = newY
					h.guards[i].Rotation = float32(math.Atan2(float64(h.guards[i].actions[last].deltaY), float64(h.guards[i].actions[last].deltaX)) + 0.5*math.Pi)
					h.guards[i].lastSuccessfulMoveTime = time.Now()
				}
				if h.guards[i].chasing != nil {
					gX := h.guards[i].X
					gY := h.guards[i].Y
					pX := h.guards[i].chasing.X
					pY := h.guards[i].chasing.Y
					if (state{x: gX, y: gY}).distanceTo(state{x: pX, y: pY}) < 50 {
						h.killPlayer(&h.guards[i], h.guards[i].chasing)
					}
				}
				if len(h.guards[i].actions) > 0 {
					h.guards[i].actions = h.guards[i].actions[:last]
				}
			}
			h.Unlock()
		case <-coinSpawnTicker.C:
			h.Lock()
			content, err := os.ReadFile("./mapData.json")
			if err != nil {
				log.Fatal("Error when opening file: ", err)
			}
			mapData := struct {
				Items []item
			}{}
			err = json.Unmarshal(content, &mapData)
			if err != nil {
				log.Println(err)
			}
			h.items = mapData.Items
			for receivingClient := range h.players {
				receivingClient.outgoing <- setSceneResponse{
					Items: h.items,
				}
			}
			h.Unlock()
		}
	}
}

func (h *Hub) handleGuardAI() {
	thinkTicker := time.NewTicker(200 * time.Millisecond)
	model := model{
		restrictedAreas: h.restrictedAreas,
		obstacles:       h.obstacles,
	}
	for range thinkTicker.C {
		for i := range h.guards {
			if !h.guards[i].Searching || len(h.guards[i].actions) == 0 {
				actions := think(&h.guards[i], model)
				h.Lock()
				h.guards[i].actions = actions
				h.Unlock()
			}
		}
	}
}

func readWorldData() ([]obstacle, []item, []guard, []obstacle, error) {
	content, err := os.ReadFile("./mapData.json")
	if err != nil {
		log.Fatal("Error when opening file: ", err)
	}
	mapData := struct {
		Obstacles []obstacle
		Items     []item
		Guards    []struct {
			Id           string  `json:"id"`
			X            float32 `json:"x"`
			Y            float32 `json:"y"`
			Rotation     float32 `json:"rotation"`
			PatrolPoints []struct {
				X float32 `json:"x"`
				Y float32 `json:"y"`
			}
		}
	}{}

	err = json.Unmarshal(content, &mapData)
	if err != nil {
		obstacles := make([]obstacle, 0)
		items := make([]item, 0)
		guards := make([]guard, 0)
		log.Println(err)
		return obstacles, items, guards, make([]obstacle, 0), errors.New("could not read file data, continuing with empty world")
	}

	guards := make([]guard, len(mapData.Guards))
	for i := range mapData.Guards {
		guards[i] = guard{
			Id:           mapData.Guards[i].Id,
			X:            mapData.Guards[i].X,
			Y:            mapData.Guards[i].Y,
			Rotation:     mapData.Guards[i].Rotation,
			Searching:    true,
			actions:      make([]action, 0),
			goal:         state{x: mapData.Guards[i].X, y: mapData.Guards[i].Y},
			patrolPoints: make([]state, 0),
			currentPoint: 0,
			chasing:      nil,
		}
		for j := range mapData.Guards[i].PatrolPoints {
			guards[i].patrolPoints = append(guards[i].patrolPoints, state{
				x: mapData.Guards[i].PatrolPoints[j].X,
				y: mapData.Guards[i].PatrolPoints[j].Y,
			})
		}
	}

	restrictedAreas := []obstacle{
		{
			X:      -11 * 20,
			Y:      -5 * 20,
			Width:  22 * 20,
			Height: 13 * 20,
			Color:  "",
			Stroke: "",
		},
	}

	return mapData.Obstacles, mapData.Items, guards, restrictedAreas, nil
}

func (h *Hub) handleDetection(guardId string, client *Client) {
	detected := -1
	h.RLock()
	for guardIndex := range h.guards {
		if h.guards[guardIndex].Id == guardId {
			detected = guardIndex
			break
		}
	}
	h.RUnlock()
	if detected == -1 {
		log.Println("detection requested with invalid id: ", guardId)
		return
	}
	if h.guards[detected].chasing != nil {
		return
	}
	if !canSee(&h.guards[detected], h.players[client], model{h.restrictedAreas, h.obstacles}) {
		return
	}
	h.Lock()
	h.guards[detected].Searching = false
	h.guards[detected].chasing = h.players[client]
	h.guards[detected].goal = state{
		x: h.players[client].X,
		y: h.players[client].Y,
	}
	h.guards[detected].actions = make([]action, 0)
	h.Unlock()

}

func (h *Hub) handleInteraction(interactionId string, client *Client) {
	interacted := -1
	h.RLock()
	for itemIndex := range h.items {
		if h.items[itemIndex].Id == interactionId {
			interacted = itemIndex
			break
		}
	}
	h.RUnlock()
	if interacted == -1 {
		log.Println("interaction requested with invalid id: ", interactionId)
		return
	}
	switch h.items[interacted].Type {
	case "coin":
		playerRadius := float32(50)
		coinRadius := float32(10)
		if (state{x: h.items[interacted].X, y: h.items[interacted].Y}).distanceTo(state{x: h.players[client].X, y: h.players[client].Y}) > (playerRadius + coinRadius) {
			log.Println("interaction requested with invalid distance: ", interactionId)
			return
		}
		h.Lock()

		h.items[interacted] = h.items[len(h.items)-1]
		h.items = h.items[:len(h.items)-1]

		updatingPlayer := h.players[client]
		updatingPlayer.Score++
		h.players[client] = updatingPlayer
		h.Unlock()

		for eachClient := range h.players {
			eachClient.outgoing <- removeResponse{
				Type: "item",
				Id:   interactionId,
			}
		}
	}
}

func (h *Hub) killPlayer(g *guard, p *player) {
	p.X = 0
	p.Y = 0
	p.Score = 0
	for client, player := range h.players {
		if player == p {
			client.outgoing <- setSceneResponse{
				Player: *p,
			}
		}
	}

	g.chasing = nil
	g.Searching = true
	g.currentPoint = 0
	g.goal = g.patrolPoints[0]
}

func (h *Hub) usernameExists(username string) bool {
	h.RLock()
	defer h.RUnlock()
	for _, player := range h.players {
		if player.Username == username {
			return true
		}
	}
	return false
}
