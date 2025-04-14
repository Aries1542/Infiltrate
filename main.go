package main

import (
	"log"
	"net/http"
)

func noCache(fs http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")

		fs.ServeHTTP(w, r)
	}
}

func main() {

	hub := newHub()
	go hub.handleMessages()
	go hub.update()
	go hub.handleGuardAI()

	http.Handle("/", noCache(http.FileServer(http.Dir("static")))) // serve the static directory to the client
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		connectClient(hub, w, r)
	})
	http.HandleFunc("/namecheck", func(w http.ResponseWriter, r *http.Request) {
		requestUsername(hub, w, r)
	})

	log.Println("Server started!")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Println("Sever failed: ", err)
		return
	}

}
