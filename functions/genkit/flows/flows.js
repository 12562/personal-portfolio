import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import fetch from "node-fetch";

const client = new SecretManagerServiceClient();
let GEMINI_KEY;

async function getGeminiKey() {
  if (GEMINI_KEY) return GEMINI_KEY;
  const [version] = await client.accessSecretVersion({
    name: "projects/303671941271/secrets/GEMINI_KEY/versions/latest",
  });
  GEMINI_KEY = version.payload.data.toString("utf8");
  return GEMINI_KEY;
}

async function callGeminiAPI(prompt) {
  const key = await getGeminiKey();
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
}

export async function chatFlow(message) { return callGeminiAPI(message); }
export async function projectGenFlow(prompt) { return callGeminiAPI(prompt); }
export async function searchFlow(query) { return callGeminiAPI(query); }
export async function resumeAnalyzeFlow(resumeText) { return callGeminiAPI(resumeText); }

