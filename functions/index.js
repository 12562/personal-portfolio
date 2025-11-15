// ✅ Correct imports
import { onRequest } from "firebase-functions/v2/https";
import logger from "firebase-functions/logger";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { GoogleAuth } from "google-auth-library";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// --- Secret Manager ---
const client = new SecretManagerServiceClient();
let GEMINI_KEY;

// Google Auth for Application Default Credentials (service account)
const googleAuth = new GoogleAuth();

async function getAccessToken() {
  try {
    // Create auth client with explicit scope for Gemini API
    const client = await googleAuth.getClient({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const at = await client.getAccessToken();
    const token = typeof at === "string" ? at : at?.token;
    if (!token) {
      logger.warn("Got null/undefined token from ADC getAccessToken");
      return null;
    }
    logger.info("Successfully acquired ADC token for Gemini API");
    return token || null;
  } catch (err) {
    logger.warn("ADC access token fetch failed:", err?.message || err);
    if (err?.message?.includes('insufficient authentication scopes')) {
      logger.error("Service account lacks required scope. Enable Cloud Platform scope or grant roles/aiplatform.user.");
    }
    return null;
  }
}

async function getGeminiKey() {
  // Prefer the environment-injected secret if present (v2 secret env variable)
  if (process.env.GEMINI_KEY) {
    GEMINI_KEY = process.env.GEMINI_KEY;
    return GEMINI_KEY;
  }

  if (GEMINI_KEY) return GEMINI_KEY;
  // Fallback to Secret Manager client if the env var isn't set.
  const [version] = await client.accessSecretVersion({
    name: "projects/303671941271/secrets/GEMINI_KEY/versions/latest",
  });
  GEMINI_KEY = version.payload.data.toString("utf8");
  return GEMINI_KEY;
}

// Diagnostic helper: list available models from the Vertex AI API
async function listModels(key) {
  const projectId = process.env.GCLOUD_PROJECT;
  const region = process.env.FUNCTION_REGION || "us-central1";

  if (!projectId) {
    logger.error("GCLOUD_PROJECT environment variable not set for listModels.");
    return null;
  }

  const listUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models`;
  try {
    // Try Bearer first
    let r = await fetch(listUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
    });

    if (r.status === 401) {
      // Retry with API key param
      const urlWithKey = `${listUrl}?key=${encodeURIComponent(key)}`;
      r = await fetch(urlWithKey, { method: "GET" });
    }

    const body = await r.json();
    return body;
  } catch (err) {
    logger.error("listModels failed:", err);
    return null;
  }
}

// --- Gemini API Call ---
async function callGeminiAPI(prompt) {
  const apiKey = await getGeminiKey();
  if (!apiKey) {
    logger.warn("GEMINI_KEY is not available - outgoing request may fail if no ADC token.");
  }

  // Prefer ADC access token for Bearer auth
  const accessToken = await getAccessToken();

  let res;
  // Construct the Vertex AI endpoint using environment variables
  const projectId = process.env.GCLOUD_PROJECT;
  const region = process.env.FUNCTION_REGION || "us-central1";
  const modelId = "gemini-1.5-flash"; // Use a supported model for Vertex

  if (!projectId) {
    logger.error("GCLOUD_PROJECT environment variable not set.");
    return "Configuration error";
  }

  const baseUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:generateContent`;

  // Attempt with ADC Bearer token first if available
  if (accessToken) {
    try {
      res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
    } catch (err) {
      logger.error("Error while fetching Gemini API (ADC Bearer attempt):", err);
      return "No response";
    }
  } else if (apiKey) {
    // No ADC token — fall back to trying the stored secret as Bearer first
    try {
      res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
    } catch (err) {
      logger.error("Error while fetching Gemini API (Bearer attempt with secret):", err);
      return "No response";
    }
  } else {
    logger.error("No ADC token and no GEMINI_KEY available");
    return "No response";
  }

  // If we got an unauthenticated response, retry using API key query param
  if (res.status === 401) {
    logger.warn("Bearer auth failed (401). Retrying with API key as query param.");
    if (!apiKey) {
      logger.error("No API key available to retry with ?key");
      return "No response";
    }
    try {
      const urlWithKey = `${baseUrl}?key=${encodeURIComponent(apiKey)}`;
      res = await fetch(urlWithKey, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
    } catch (err) {
      logger.error("Error while fetching Gemini API (API key retry):", err);
      return "No response";
    }
  }

  // Also check for permission denied (403) which suggests scope issues
  if (res.status === 403) {
    logger.error("Permission denied (403) from Gemini API. This usually means the service account lacks required scope.");
    logger.error("Fix: Grant roles/aiplatform.user to the service account or update ADC token scopes.");
    // Fall back to API key
    if (apiKey) {
      logger.info("Attempting API key fallback after 403...");
      try {
        const urlWithKey = `${baseUrl}?key=${encodeURIComponent(apiKey)}`;
        res = await fetch(urlWithKey, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });
      } catch (err) {
        logger.error("Error during API key fallback:", err);
        return "No response (auth failed)";
      }
    }
  }

  // If model/method not found (404), attempt to list available models for diagnostics
  if (res.status === 404) {
    logger.warn("Model not found with attempted endpoint; fetching ListModels for diagnosis.");
    try {
      const models = await listModels(apiKey || "");
      if (models) {
        logger.debug("Available models:", JSON.stringify(models));
      }
    } catch (err) {
      logger.error("ListModels diagnostic failed:", err);
    }
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    logger.error("Failed to parse Gemini response as JSON:", err);
    logger.debug("Raw response status:", res.status, "statusText:", res.statusText);
    return "No response";
  }

  logger.debug("Gemini API response status:", res.status);
  logger.debug("Gemini API response body:", JSON.stringify(data));

  // Attempt to pull text from known response shape; if found, return it.
  const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (candidateText) return candidateText;

  // If no candidate text was present, return the full response JSON as a string
  // to help diagnose unexpected response shapes (safer than silently returning
  // "No response" which provides no debug info).
  logger.warn('No candidate text found in Gemini response; returning raw body for diagnosis.');
  try {
    return JSON.stringify(data);
  } catch (err) {
    logger.error('Failed to stringify Gemini response for debug return:', err);
    return "No response";
  }
}

// --- Routes ---
const asyncHandler = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    logger.error("❌ AI function error:", err);
    res.status(500).json({ error: err.message });
  });

app.post("/chat", asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) throw new Error("Missing message");
  const response = await callGeminiAPI(message);
  res.json({ response });
}));

app.post("/projectGen", asyncHandler(async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) throw new Error("Missing prompt");
  const response = await callGeminiAPI(prompt);
  res.json({ response });
}));

app.post("/search", asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!query) throw new Error("Missing query");
  const response = await callGeminiAPI(query);
  res.json({ response });
}));

app.post("/resumeAnalyze", asyncHandler(async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText) throw new Error("Missing resumeText");
  const response = await callGeminiAPI(resumeText);
  res.json({ response });
}));

// ✅ Correct export for Firebase v2 HTTPS function
export const generateContent = onRequest(
  {
    memory: "512Mi",
    timeoutSeconds: 120,
    secrets: ["GEMINI_KEY"],
  },
  app
);

