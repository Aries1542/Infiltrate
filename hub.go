package main

import (
	"sync"
	"time"
)

// Hub Each request type will have its own type and channel
//
//	The hub processes requests and updates server data accordingly
//	It will also continually send data to clients
type Hub struct {
	sync.RWMutex
	join    chan joinRequest
	update  chan updateRequest
	clients map[*Client]int
	nextID  int
	players map[*Client]player
	objects []any
}

type player struct {
	Id       int
	X        float32
	Y        float32
	Rotation float32
}

type joinRequest struct {
	client *Client
}
type updateRequest struct {
	client   *Client
	X        float32
	Y        float32
	Rotation float32
}

func newHub() *Hub {
	return &Hub{
		join:    make(chan joinRequest),
		update:  make(chan updateRequest),
		clients: make(map[*Client]int),
		nextID:  1,
		players: make(map[*Client]player),
		objects: make([]any, 0),
	}
}

func (h *Hub) run() {
	for {
		select {
		case request := <-h.join:
			h.Lock()
			client := request.client
			h.clients[client] = h.nextID
			h.nextID++
			h.Unlock()

			client.setScene <- setSceneResponse{Requesting: "setScene", X: 0, Y: 0}
		case request := <-h.update:
			h.Lock()
			player := player{
				Id:       h.clients[request.client],
				X:        request.X,
				Y:        request.Y,
				Rotation: request.Rotation,
			}
			h.players[request.client] = player
			h.Unlock()
		}
	}
}

func (h *Hub) updateClients() {
	for {
		for clienti := range h.clients {
			players := make([]player, 0)
			h.RLock()
			for clientj := range h.clients {
				if clienti == clientj {
					continue
				}
				players = append(players, h.players[clientj])
			}
			h.RUnlock()
			clienti.update <- updateResponse{Requesting: "update", PlayersData: players}
		}
		time.Sleep(15 * time.Millisecond)
	}
}
