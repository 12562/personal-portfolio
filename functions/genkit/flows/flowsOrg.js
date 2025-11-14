import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import fetch from "node-fetch";

const client = new SecretManagerServiceClient();
let GEMINI_KEY; // lazy-loaded at runtime

// Fetch Gemini API key from Secret Manager
async function getGeminiKey() {
  if (GEMINI_KEY) return GEMINI_KEY;

  try {
    const [version] = await client.accessSecretVersion({
      name: "projects/303671941271/secrets/GEMINI_KEY/versions/latest",
    });
    GEMINI_KEY = version.payload.data.toString("utf8");
    return GEMINI_KEY;
  } catch (err) {
    console.error("Error accessing GEMINI_KEY from Secret Manager:", err);
    throw new Error("GEMINI_KEY not available");
  }
}

// Minimal wrapper for Google Gemini
async function callGeminiAPI(prompt) {
  const key = await getGeminiKey();

  const response = await fetch("https://gemini.googleapis.com/v1/ai:generateText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gemini-1", // adjust to correct model
      prompt,
      max_output_tokens: 512,
    }),
  });

  const data = await response.json();
  return data.output_text || data?.candidates?.[0]?.content || "No response";
}

// --- Chat Flow ---
export async function chatFlow(message) {
  if (!message) throw new Error("chatFlow requires a message");
  return await callGeminiAPI(message);
}

// --- Project Generation Flow ---
export async function projectGenFlow(prompt) {
  if (!prompt) throw new Error("projectGenFlow requires a prompt");
  return await callGeminiAPI(prompt);
}

// --- Search Flow ---
export async function searchFlow(query) {
  if (!query) throw new Error("searchFlow requires a query");
  return await callGeminiAPI(query);
}

// --- Resume Analysis Flow ---
export async function resumeAnalyzeFlow(resumeText) {
  if (!resumeText) throw new Error("resumeAnalyzeFlow requires resumeText");
  return await callGeminiAPI(resumeText);
}

