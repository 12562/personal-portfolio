import * as functions from "firebase-functions/v2";
import express from "express";
import cors from "cors";

import {
  chatFlow,
  projectGenFlow,
  searchFlow,
  resumeAnalyzeFlow,
} from "./genkit/flows/flows.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json()); // Parse JSON bodies

function asyncHandler(fn) {
  return (req, res) => {
    fn(req, res).catch((err) => {
      console.error("AI function error:", err);
      res.status(500).json({ error: err.message });
    });
  };
}

// Chat Flow
app.post("/chat", asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) throw new Error("Missing 'message' in request body");
  const response = await chatFlow(message);
  res.json({ response });
}));

// Project Generation Flow
app.post("/projectGen", asyncHandler(async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) throw new Error("Missing 'prompt' in request body");
  const response = await projectGenFlow(prompt);
  res.json({ response });
}));

// Search Flow
app.post("/search", asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!query) throw new Error("Missing 'query' in request body");
  const response = await searchFlow(query);
  res.json({ response });
}));

// Resume Analysis Flow
app.post("/resumeAnalyze", asyncHandler(async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText) throw new Error("Missing 'resumeText' in request body");
  const response = await resumeAnalyzeFlow(resumeText);
  res.json({ response });
}));

// Export as v2 HTTPS Firebase Function
export const generateContent = functions.https.onRequest(app, {
  memory: "512Mi",
  timeoutSeconds: 120,
  secrets: ["GEMINI_KEY"], // secure access to Gemini key
});

