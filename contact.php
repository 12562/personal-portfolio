<?php
// contact.php — simple mail sender

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $name = htmlspecialchars(trim($_POST["name"]));
    $email = htmlspecialchars(trim($_POST["email"]));
    $message = htmlspecialchars(trim($_POST["message"]));

    if (!$name || !$email || !$message) {
        http_response_code(400);
        echo "Please fill in all fields.";
        exit;
    }

    $to = "your.email@example.com"; // <-- replace with your email
    $subject = "Portfolio Contact from $name";
    $body = "Name: $name\nEmail: $email\n\nMessage:\n$message";
    $headers = "From: $email";

    if (mail($to, $subject, $body, $headers)) {
        echo "success";
    } else {
        http_response_code(500);
        echo "Failed to send email.";
    }
}
?>
