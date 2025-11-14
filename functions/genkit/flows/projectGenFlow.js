async function projectGenFlow({ params }, services) {
  const title = params?.title || "Untitled Project";
  const tech = params?.tech || "";
  const details = params?.details || "";

  const prompt = `Write a concise 2-3 sentence professional project description for a portfolio.
Title: ${title}
Technologies: ${tech}
Details: ${details}
Keep it recruiter-friendly.`;

  let responseText = "";
  try {
    const response = await services.genai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200
    });
    responseText = response.choices[0].message.content;
  } catch (err) {
    console.warn("OpenAI error:", err.message);
    responseText = "AI failed to generate project description.";
  }

  const docRef = await services.firestore.collection("projects").add({
    title,
    tech,
    details,
    generated_description: responseText,
    createdAt: new Date().toISOString()
  });

  return { generated: responseText, id: docRef.id };
}

module.exports = { projectGenFlow };

