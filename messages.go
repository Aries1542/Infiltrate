package main

import (
	"encoding/json"
	"strconv"
)

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

type response interface {
	JSONFormat() ([]byte, error)
}

type setSceneResponse struct {
	Player    player
	Obstacles []obstacle
	Items     []item
}

func (response setSceneResponse) JSONFormat() ([]byte, error) {
	jsonMessage, err := json.Marshal(struct {
		Requesting string     `json:"requesting"`
		Player     player     `json:"player"`
		Obstacles  []obstacle `json:"obstacles"`
		Items      []item     `json:"items"`
	}{
		Requesting: "setScene",
		Player:     response.Player,
		Obstacles:  response.Obstacles,
		Items:      response.Items,
	})
	return jsonMessage, err
}

type updateResponse struct {
	Players []player
	Guards  []guard
}

func (response updateResponse) JSONFormat() ([]byte, error) {
	jsonMessage, err := json.Marshal(struct {
		Requesting string   `json:"requesting"`
		Players    []player `json:"players"`
		Guards     []guard  `json:"guards"`
	}{
		Requesting: "update",
		Players:    response.Players,
		Guards:     response.Guards,
	})
	return jsonMessage, err
}

type removeResponse struct {
	Type string
	Id   string
}

func (response removeResponse) JSONFormat() ([]byte, error) {
	jsonMessage, err := json.Marshal(struct {
		Requesting string `json:"requesting"`
		Type       string `json:"type"`
		Id         string `json:"id"`
	}{
		Requesting: "remove",
		Type:       response.Type,
		Id:         response.Id,
	})
	return jsonMessage, err
}
