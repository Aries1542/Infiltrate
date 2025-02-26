package main

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"strconv"
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

// An obstacle should be id-less, static, collidable, and rectangular.
// X and Y represent the top-left corner of the object.
// Anything not matching these should be made as an item.
type obstacle struct {
	X      float32 `json:"x"`
	Y      float32 `json:"y"`
	Width  float32 `json:"width"`
	Height float32 `json:"height"`
	Color  string  `json:"color"`
}

// An item is anything that should be displayed and interacted with by the player, that does not fit as an obstacle.
// The Type field is used to determine how to display and interact with the item.
type item struct {
	Id   string  `json:"id"`
	Type string  `json:"type"`
	X    float32 `json:"x"`
	Y    float32 `json:"y"`
}

type request interface {
	Handle(h *Hub)
}
type joinRequest struct {
	client   *Client
	username string
}

func (joining joinRequest) Handle(h *Hub) {
	h.Lock()
	client := joining.client
	h.players[client] = player{
		Id:       "player" + strconv.Itoa(h.nextID),
		Username: joining.username,
		X:        0,
		Y:        0,
		Rotation: 0,
		Score:    0,
	}
	h.nextID++
	h.Unlock()

	client.outgoing <- setSceneResponse{
		Player:    h.players[client],
		Obstacles: h.obstacles,
		Items:     h.items,
	}
}

type leaveRequest struct {
	client *Client
}

func (leaving leaveRequest) Handle(h *Hub) {
	leavingClientId := h.players[leaving.client].Id
	h.Lock()
	delete(h.players, leaving.client)
	h.Unlock()
	close(leaving.client.outgoing)
	for client := range h.players {
		client.outgoing <- removeResponse{
			Type: "player",
			Id:   leavingClientId,
		}
	}
}

type updateRequest struct {
	client      *Client
	X           float32
	Y           float32
	Rotation    float32
	Interaction string
}

func (updating updateRequest) Handle(h *Hub) {
	h.Lock()
	updatingPlayer := h.players[updating.client]
	updatingPlayer.X = updating.X
	updatingPlayer.Y = updating.Y
	updatingPlayer.Rotation = updating.Rotation
	h.players[updating.client] = updatingPlayer
	h.Unlock()
	if updating.Interaction != "" {
		h.handleInteraction(updating.Interaction, updating.client)
	}
}

func newHub() *Hub {
	obstacles, items, err := readObstacles()
	if err != nil {
		log.Println(err)
	}
	return &Hub{
		incoming:  make(chan request),
		nextID:    1,
		players:   make(map[*Client]player),
		obstacles: obstacles,
		items:     items,
	}
}

func (h *Hub) run() {
	for {
		message := <-h.incoming
		message.Handle(h)
	}
}

func (h *Hub) updateClients() {
	updateTicker := time.NewTicker(10 * time.Millisecond)
	coinSpawnTicker := time.NewTicker(90 * time.Second)
	for {
		select {
		case <-updateTicker.C:
			players := make([]player, 0)
			h.RLock()
			for client := range h.players {
				players = append(players, h.players[client])
			}
			for receivingClient := range h.players {
				receivingClient.outgoing <- updateResponse{PlayersData: players}
			}
			h.RUnlock()
		case <-coinSpawnTicker.C:
			h.Lock()
			h.items = generateCoins()
			h.Unlock()
			h.RLock()
			for receivingClient := range h.players {
				receivingClient.outgoing <- setSceneResponse{
					Items: h.items,
				}
			}
			h.RUnlock()
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
	mapData.Items = append(mapData.Items, generateCoins()...)
	return mapData.Obstacles, mapData.Items, nil
}

func generateCoins() []item {
	items := make([]item, 0)
	id := 1
	var x, y float32
	for x = -1000; x < 1000; x += 200 {
		for y = -1000; y < 1000; y += 200 {
			items = append(items, item{
				Id:   "coin" + strconv.Itoa(id),
				Type: "coin",
				X:    x,
				Y:    y,
			})
			id++
		}
	}
	return items
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
