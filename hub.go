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

// Hub Each request type will have its own type and channel
//
//	The hub processes requests and updates server data accordingly
//	It will also continually send data to clients
type Hub struct {
	sync.RWMutex
	join      chan joinRequest
	leave     chan *Client
	update    chan updateRequest
	nextID    int
	players   map[*Client]player
	obstacles []obstacle
	items     []item
}

// a player is representation of the data needed to draw one client to another's screen
type player struct {
	Id       string
	Username string
	X        float32
	Y        float32
	Rotation float32
	Score    int
}

// An obstacle should be id-less, static, collidable, and rectangular.
// X and Y represent the top-left corner of the object
// Anything not matching these should be made as an item (to be implemented)
type obstacle struct {
	X      float32
	Y      float32
	Width  float32
	Height float32
	Color  string
}

// An item is anything that should be displayed and interacted with by the player, that does not fit as an obstacle.
// The client will use the Type field to determine how to display and interact with the item
type item struct {
	Id   string
	Type string
	X    float32
	Y    float32
}

type joinRequest struct {
	client   *Client
	username string
}
type updateRequest struct {
	client      *Client
	X           float32
	Y           float32
	Rotation    float32
	Interaction string
}

func newHub() *Hub {
	obstacles, items, err := readObstacles()
	if err != nil {
		log.Println(err)
	}
	return &Hub{
		join:      make(chan joinRequest),
		leave:     make(chan *Client),
		update:    make(chan updateRequest),
		nextID:    1,
		players:   make(map[*Client]player),
		obstacles: obstacles,
		items:     items,
	}
}

func (h *Hub) run() {
	for {
		select {
		case request := <-h.join:
			h.Lock()
			client := request.client
			h.players[client] = player{
				Id:       "player" + strconv.Itoa(h.nextID),
				Username: request.username,
				X:        0,
				Y:        0,
				Rotation: 0,
				Score:    0,
			}
			h.nextID++
			h.Unlock()

			client.respond <- setSceneResponse{
				Requesting: "setScene",
				Id:         h.players[client].Id,
				X:          0,
				Y:          0,
				Obstacles:  h.obstacles,
				Items:      h.items,
			}

		case leavingClient := <-h.leave:
			leavingClientId := h.players[leavingClient].Id
			h.Lock()
			delete(h.players, leavingClient)
			h.Unlock()
			close(leavingClient.respond)
			for client := range h.players {
				client.respond <- removeResponse{
					Requesting: "remove",
					Type:       "player",
					Id:         leavingClientId,
				}
			}

		case request := <-h.update:
			h.Lock()
			updatingPlayer := h.players[request.client]
			updatingPlayer.X = request.X
			updatingPlayer.Y = request.Y
			updatingPlayer.Rotation = request.Rotation
			h.players[request.client] = updatingPlayer
			h.Unlock()
			if request.Interaction != "" {
				h.handleInteraction(request.Interaction, request.client)
			}
		}
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
				receivingClient.respond <- updateResponse{Requesting: "update", PlayersData: players}
			}
			h.RUnlock()
		case <-coinSpawnTicker.C:
			h.Lock()
			h.items = generateCoins()
			h.Unlock()
			h.RLock()
			for receivingClient := range h.players {
				receivingClient.respond <- setSceneResponse{
					Requesting: "setScene",
					Items:      h.items,
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
			eachClient.respond <- removeResponse{
				Requesting: "remove",
				Type:       "item",
				Id:         interactionId,
			}
		}
	}
}
