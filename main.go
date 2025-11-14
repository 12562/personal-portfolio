package main

import (
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"
)

func main() {
	http.HandleFunc("/contact", handleContact)
	fs := http.FileServer(http.Dir("./"))
	http.Handle("/", fs)

	fmt.Println("Server running at http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleContact(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request", http.StatusMethodNotAllowed)
		return
	}

	name := r.FormValue("name")
	email := r.FormValue("email")
	message := r.FormValue("message")

	if name == "" || email == "" || message == "" {
		http.Error(w, "Missing fields", http.StatusBadRequest)
		return
	}

	// SMTP config (replace with your credentials)
	from := "your.email@example.com"
	pass := os.Getenv("SMTP_PASS") // better to store in env var
	to := "your.email@example.com"

	body := fmt.Sprintf("Name: %s\nEmail: %s\n\nMessage:\n%s", name, email, message)
	auth := smtp.PlainAuth("", from, pass, "smtp.yourhost.com")

	err := smtp.SendMail("smtp.yourhost.com:587", auth, from, []string{to}, []byte(body))
	if err != nil {
		http.Error(w, "Failed to send email", http.StatusInternalServerError)
		return
	}

	fmt.Fprint(w, "success")
}

