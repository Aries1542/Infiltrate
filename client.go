package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	setScene chan setSceneResponse
	update   chan updateResponse
	remove   chan removeResponse
}

type setSceneResponse struct {
	Requesting string
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
		c.conn.Close()
		log.Println("fromClient() closing!")
	}()
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			log.Println("fromClient(), ReadMessage()", err)
			break
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
			request := updateRequest{client: c}
			err = json.Unmarshal(message, &request)
			if err != nil {
				log.Println("fromClient(), json.Unmarshal(&request)", err)
				break
			}
			c.hub.update <- request
		}
	}
}

func (c *Client) toClient() {
	defer func() {
		c.conn.Close()
		log.Println("toClient() closing!")
		c.hub.leave <- c
	}()
	for {
		select {
		case response := <-c.setScene:
			log.Println("setScene response outgoing", response)
			jsonResponse, err := json.Marshal(response)
			if err != nil {
				log.Println("toClient(), json.Marshal()", err)
			}
			err = c.conn.WriteMessage(websocket.TextMessage, jsonResponse)
			if err != nil {
				log.Println("toClient(), WriteMessage()", err)
				return
			}
		case response := <-c.update:
			jsonResponse, err := json.Marshal(response)
			if err != nil {
				log.Println("toClient(), json.Marshal()", err)
			}
			err = c.conn.WriteMessage(websocket.TextMessage, jsonResponse)
			if err != nil {
				log.Println("toClient(), WriteMessage()", err)
				return
			}
		case response := <-c.remove:
			jsonResponse, err := json.Marshal(response)
			if err != nil {
				log.Println("toClient(), json.Marshal()", err)
			}
			err = c.conn.WriteMessage(websocket.TextMessage, jsonResponse)
			if err != nil {
				log.Println("toClient(), WriteMessage()", err)
				return
			}
		}
	}
}

func connectClient(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil) // upgrade the connection to a websocket connection
	if err != nil {
		log.Print("upgrade failed: ", err)
		return
	}
	client := &Client{
		hub:      hub,
		conn:     conn,
		setScene: make(chan setSceneResponse),
		update:   make(chan updateResponse),
		remove:   make(chan removeResponse),
	}
	request := joinRequest{client: client}
	client.hub.join <- request

	go client.toClient()
	go client.fromClient()
}
