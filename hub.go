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
	client *Client
}
type updateRequest struct {
	client      *Client
	X           float32
	Y           float32
	Rotation    float32
	Interaction string
}

//type exampleJsonStruct struct {
//	X        float32 `json:"x"`
//	Y        float32 `json:"y"`
//}

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
				X:        0,
				Y:        0,
				Rotation: 0,
				Score:    0,
			}
			h.nextID++
			h.Unlock()

			client.setScene <- setSceneResponse{
				Requesting: "setScene",
				Id:         h.players[client].Id,
				X:          0,
				Y:          0,
				Obstacles:  h.obstacles,
				Items:      h.items,
			}

		case leavingClient := <-h.leave:
			leavingClientId := h.players[leavingClient].Id
			delete(h.players, leavingClient)
			close(leavingClient.setScene)
			close(leavingClient.update)
			close(leavingClient.remove)
			for client := range h.players {
				client.remove <- removeResponse{
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
	for {
		players := make([]player, 0)
		h.RLock()
		for client := range h.players {
			players = append(players, h.players[client])
		}
		h.RUnlock()
		for receivingClient := range h.players {
			receivingClient.update <- updateResponse{Requesting: "update", PlayersData: players}
		}
		time.Sleep(10 * time.Millisecond)
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
	for itemIndex := range h.items {
		if h.items[itemIndex].Id == interactionId {
			interacted = itemIndex
			break
		}
	}
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
			eachClient.remove <- removeResponse{
				Requesting: "remove",
				Type:       "item",
				Id:         interactionId,
			}
		}
	}
}
