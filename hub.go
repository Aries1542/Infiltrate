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
	incoming  chan request
	nextID    int
	players   map[*Client]player
	guards    []guard
	obstacles []obstacle
	items     []item
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
	Id       string  `json:"id"`
	X        float32 `json:"x"`
	Y        float32 `json:"y"`
	Rotation float32 `json:"rotation"`
	actions  []action
	goal     state
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
	obstacles, items, err := readObstacles()
	guards := make([]guard, 0)
	if err != nil {
		log.Println(err)
	}
	return &Hub{
		incoming:  make(chan request),
		nextID:    1,
		players:   make(map[*Client]player),
		guards:    guards,
		obstacles: obstacles,
		items:     items,
	}
}

func (h *Hub) handleMessages() {
	for {
		message := <-h.incoming
		message.Handle(h)
	}
}

func (h *Hub) update() {
	updateTicker := time.NewTicker(10 * time.Millisecond)
	moveTicker := time.NewTicker(20 * time.Millisecond)
	coinSpawnTicker := time.NewTicker(2 * time.Minute)
	for {
		select {
		case <-updateTicker.C:
			players := make([]player, 0)
			h.RLock()
			for client := range h.players {
				players = append(players, h.players[client])
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
				h.guards[i].X += h.guards[i].actions[last].deltaX
				h.guards[i].Y += h.guards[i].actions[last].deltaY
				h.guards[i].Rotation = float32(math.Atan2(float64(h.guards[i].actions[last].deltaY), float64(h.guards[i].actions[last].deltaX)) + 0.5*math.Pi)
				h.guards[i].actions = h.guards[i].actions[:last]
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
	thinkTicker := time.NewTicker(500 * time.Millisecond)
	GuardAI := NewGuardAI(h.obstacles)
	for range thinkTicker.C {
		for i := range h.guards {
			newActions := GuardAI.GetGuardActions(state{x: h.guards[i].X, y: h.guards[i].Y}, h.guards[i].goal)
			h.Lock()
			h.guards[i].actions = newActions
			h.Unlock()
		}
	}
}

func readObstacles() ([]obstacle, []item, error) {
	content, err := os.ReadFile("./mapData.json")
	if err != nil {
		log.Fatal("Error when opening file: ", err)
	}
	mapData := struct {
		Obstacles []obstacle
		Items     []item
	}{}

	err = json.Unmarshal(content, &mapData)
	if err != nil {
		obstacles := make([]obstacle, 0)
		items := make([]item, 0)
		log.Println(err)
		return obstacles, items, errors.New("could not read file data, continuing with empty obstacles")
	}
	return mapData.Obstacles, mapData.Items, nil
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
