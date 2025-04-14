package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

func saveData(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if r.Body == nil {
		http.Error(w, "Please send a request body", http.StatusBadRequest)
		return
	}

	var body struct {
		Filename string `json:"filename"`
		Data     string `json:"data"`
	}

	// Try to decode the request body into the struct. If there is an error,
	// respond to the client with the error message and a 400 status code.
	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	log.Println(body)

	if strings.ContainsAny(body.Filename, "!@#$%^&*(){}[]|\\;:\"'<>,.?/`~+= ") {
		http.Error(w, "Invalid filename, please do not use special characters (the file extension will be added automatically)", http.StatusBadRequest)
		return
	}
	body.Filename += ".json"

	dataBytes := []byte(body.Data)
	err = os.WriteFile(body.Filename, dataBytes, 0644)
	if err != nil {
		log.Println("Error writing file: ", err)
		return
	}

}

func loadData(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	filename := r.URL.Query().Get("filename")
	if filename == "" {
		http.Error(w, "Please provide a filename", http.StatusBadRequest)
		return
	}
	if strings.ContainsAny(filename, "!@#$%^&*(){}[]|\\;:\"'<>,.?/`~+=") {
		http.Error(w, "Invalid filename, please do not use special characters (the file extension will be added automatically)", http.StatusBadRequest)
		return
	}
	filename += ".json"

	dataBytes, err := os.ReadFile(filename)
	if err != nil {
		log.Println("Error reading file: ", err)
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(dataBytes)
}

func noCache(fs http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")

		fs.ServeHTTP(w, r)
	}
}

func main() {

	http.Handle("/", noCache(http.FileServer(http.Dir("static")))) // serve the static directory to the client
	http.HandleFunc("/save", saveData)
	http.HandleFunc("/load", loadData)

	log.Println("Creator server started!")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Println("Sever failed: ", err)
		return
	}

}
