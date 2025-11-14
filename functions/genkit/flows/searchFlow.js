async function searchFlow({ params }, services) {
  const query = params?.query || "";

  let projects = [];
  try {
    const snapshot = await services.firestore.collection("projects").get();
    projects = snapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      details: doc.data().details || "",
      tech: doc.data().tech || ""
    }));
  } catch (err) {
    console.warn("Could not fetch projects:", err.message);
  }

  const contextText = projects.map(p => `${p.title}: ${p.details}`).join("\n\n");

  const prompt = `Search query: ${query}
Given these projects, find the top 3 most relevant projects and summarize why they match the query in 2 lines each:

${contextText}`;

  let responseText = "";
  try {
    const response = await services.genai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400
    });
    responseText = response.choices[0].message.content;
  } catch (err) {
    console.warn("OpenAI error:", err.message);
    responseText = "AI failed to search projects.";
  }

  return { results: responseText };
}

module.exports = { searchFlow };

