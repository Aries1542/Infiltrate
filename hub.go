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
	leave   chan *Client
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
		leave:   make(chan *Client),
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

		case leavingClient := <-h.leave:
			leavingClientId := h.clients[leavingClient]
			delete(h.clients, leavingClient)
			close(leavingClient.setScene)
			close(leavingClient.update)
			close(leavingClient.remove)
			for client := range h.clients {
				client.remove <- removeResponse{
					Requesting: "remove",
					Type:       "player",
					Id:         leavingClientId,
				}
			}

		case request := <-h.update:
			h.Lock()
			updatingPlayer := player{
				Id:       h.clients[request.client],
				X:        request.X,
				Y:        request.Y,
				Rotation: request.Rotation,
			}
			h.players[request.client] = updatingPlayer
			h.Unlock()

		}
	}
}

func (h *Hub) updateClients() {
	for {
		for receivingClient := range h.clients {
			players := make([]player, 0)
			h.RLock()
			for client := range h.clients {
				if receivingClient == client {
					continue
				}
				players = append(players, h.players[client])
			}
			h.RUnlock()
			receivingClient.update <- updateResponse{Requesting: "update", PlayersData: players}
		}
		time.Sleep(10 * time.Millisecond)
	}
}
