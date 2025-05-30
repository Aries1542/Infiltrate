package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	outgoing chan response
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
	username := r.URL.Query().Get("username")
	valid, reason := usernameValid(hub, username)
	if !valid {
		http.Error(w, reason, http.StatusBadRequest)
		return
	}
	log.Println(username, "has joined")
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade failed: ", err)
		return
	}
	client := &Client{
		hub:      hub,
		conn:     conn,
		outgoing: make(chan response),
	}
	client.hub.incoming <- joinRequest{client: client, username: username}

	go client.toClient()
	go client.fromClient()
}

func requestUsername(hub *Hub, w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	valid, reason := usernameValid(hub, username)
	if !valid {
		http.Error(w, reason, http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func usernameValid(hub *Hub, username string) (bool, string) {
	if len(username) < 1 || len(username) > 15 {
		return false, "username has bad length"
	}
	if hub.usernameExists(username) {
		return false, "username in use"
	}
	if usernameProfane(username) {
		return false, "username is inappropriate"
	}
	return true, ""
}

func usernameProfane(username string) bool {
	endpoint := "https://www.purgomalum.com/service/containsprofanity?text=" + url.QueryEscape(username)

	resp, err := http.Get(endpoint)
	if err != nil {
		log.Println("error making profanity request:", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Println("received non-OK response:", resp.Status)
		return false
	}
	hasProfanity, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Println("error reading profanity response:", err)
		return false
	}
	return string(hasProfanity) == "true"
}
