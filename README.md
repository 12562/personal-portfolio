# AI-Powered Web Application with Firebase and Go

This is a web application that leverages the power of Google's Gemini AI API to provide several AI-powered features. The frontend is served using Firebase Hosting, the backend is powered by Firebase Functions, and a Go-based server is available for local development.

## Features

*   **AI-Powered Chat:** A chat interface that uses the Gemini AI to answer user queries.
*   **Project Generation:** Automatically generates project ideas or starter code based on user prompts.
*   **Smart Search:** A search functionality that uses AI to provide more relevant and contextual results.
*   **Resume Analysis:** An intelligent tool to analyze resumes and provide feedback or suggestions.
*   **Contact Form:** A functional contact form that sends emails using SMTP.

## Technologies Used

*   **Frontend:** HTML, CSS, JavaScript (served via Firebase Hosting)
*   **Backend:** Node.js with Express.js, Firebase Functions
*   **Local Development Server:** Go
*   **AI:** Google Gemini AI API
*   **Deployment:** Firebase

## Setup and Installation

### Prerequisites

*   [Go](https://golang.org/doc/install)
*   [Node.js](https://nodejs.org/en/download/)
*   [Firebase CLI](https://firebase.google.com/docs/cli#install)

### Local Development

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2.  **Set up the Go server:**

    *   Navigate to the root directory.
    *   Set the `SMTP_PASS` environment variable with your SMTP password.
    *   Run the server:

    ```bash
    go run main.go
    ```

    The server will be running at `http://localhost:8080`.

3.  **Set up the Firebase Functions:**

    *   Navigate to the `functions` directory:

    ```bash
    cd functions
    ```

    *   Install the dependencies:

    ```bash
    npm install
    ```

    *   Set up your Firebase project and configure the `GEMINI_KEY` secret in Google Secret Manager.
    *   To emulate the functions locally, run:

    ```bash
    firebase emulators:start
    ```

### Environment Variables

*   `SMTP_PASS`: Your SMTP password for the contact form email functionality (for the Go server).
*   `GEMINI_KEY`: Your Google Gemini AI API key (for the Firebase Functions). This should be stored in Google Secret Manager for production.

## Deployment

To deploy the application to Firebase, run the following command from the root directory:

```bash
firebase deploy
```

This will deploy both the hosting content and the Firebase Functions.
