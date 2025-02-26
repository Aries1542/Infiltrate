package main

import (
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	outgoing chan response
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
		Id         string     `json:"id"`
		X          float32    `json:"x"`
		Y          float32    `json:"y"`
		Obstacles  []obstacle `json:"obstacles"`
		Items      []item     `json:"items"`
	}{
		Requesting: "setScene",
		Id:         response.Player.Id,
		X:          response.Player.X,
		Y:          response.Player.Y,
		Obstacles:  response.Obstacles,
		Items:      response.Items,
	})
	return jsonMessage, err
}

type updateResponse struct {
	PlayersData []player
}

func (response updateResponse) JSONFormat() ([]byte, error) {
	jsonMessage, err := json.Marshal(struct {
		Requesting  string   `json:"requesting"`
		PlayersData []player `json:"players"`
	}{
		Requesting:  "update",
		PlayersData: response.PlayersData,
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

// fromClient pumps messages from the websocket connection to the hub.
func (c *Client) fromClient() {
	defer func() {
		err := c.conn.Close()
		if err != nil && !errors.Is(err, net.ErrClosed) {
			log.Println("ws connection unable to close:", err)
		} else if errors.Is(err, net.ErrClosed) {
			log.Println("client disconnected")
		}
	}()
	for {
		_, message, err := c.conn.ReadMessage()
		var closeError *websocket.CloseError
		if err != nil {
			if !errors.As(err, &closeError) {
				log.Println("error reading msg from client:", err)
			}
			return
		}
		requesting := struct {
			Requesting string
		}{}
		err = json.Unmarshal(message, &requesting)
		if err != nil {
			log.Println("fromClient(), json.Unmarshal(&requesting)", err)
			break
		}
		switch requesting.Requesting {
		case "update":
			updating := updateRequest{client: c}
			err = json.Unmarshal(message, &updating)
			if err != nil {
				log.Println("error unmarshalling request:", err)
				break
			}
			c.hub.incoming <- updating
		}
	}
}

func (c *Client) toClient() {
	defer func() {
		c.hub.incoming <- leaveRequest{client: c}
		err := c.conn.Close()
		if err != nil && !errors.Is(err, net.ErrClosed) {
			log.Println("ws connection unable to close:", err)
		} else if errors.Is(err, net.ErrClosed) {
			log.Println("client disconnected")
		}
	}()
	for {
		message := <-c.outgoing
		jsonMessage, err := message.JSONFormat()
		if err != nil {
			log.Println("error marshaling response: ", err)
			continue
		}
		err = c.conn.WriteMessage(websocket.TextMessage, jsonMessage)
		if err != nil {
			if err.Error() != "websocket: close sent" {
				log.Println("msg to client failed:", err)
			}
			return
		}
	}
}

func connectClient(hub *Hub, w http.ResponseWriter, r *http.Request) {
	requestedUsername := r.URL.Query().Get("username")
	log.Println(requestedUsername, "has joined")
	conn, err := upgrader.Upgrade(w, r, nil) // upgrade the connection to a websocket connection
	if err != nil {
		log.Print("upgrade failed: ", err)
		return
	}
	client := &Client{
		hub:      hub,
		conn:     conn,
		outgoing: make(chan response),
	}
	client.hub.incoming <- joinRequest{client: client, username: requestedUsername}

	go client.toClient()
	go client.fromClient()
}
