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
	hub     *Hub
	conn    *websocket.Conn
	respond chan response
}

type response interface{}
type setSceneResponse struct {
	Requesting string
	Id         string
	X          float32
	Y          float32
	Obstacles  []obstacle
	Items      []item
}
type updateResponse struct {
	Requesting  string
	PlayersData []player
}
type removeResponse struct {
	Requesting string
	Type       string
	Id         string
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
			c.hub.requestChan <- updating
		}
	}
}

func (c *Client) toClient() {
	defer func() {
		c.hub.requestChan <- leaveRequest{client: c}
		err := c.conn.Close()
		if err != nil && !errors.Is(err, net.ErrClosed) {
			log.Println("ws connection unable to close:", err)
		} else if errors.Is(err, net.ErrClosed) {
			log.Println("client disconnected")
		}
	}()
	for {
		message := <-c.respond
		jsonMessage, err := json.Marshal(message)
		if err != nil {
			log.Println("error marshaling response: ", err)
			break
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
		hub:     hub,
		conn:    conn,
		respond: make(chan response),
	}
	client.hub.requestChan <- joinRequest{client: client, username: requestedUsername}

	go client.toClient()
	go client.fromClient()
}
