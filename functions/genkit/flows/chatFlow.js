async function chatFlow(data, services) {
  if (!data?.message) throw new Error("No prompt provided");
  if (!services?.genai) throw new Error("GenAI not initialized");

  const prompt = data.message;

  // Fetch projects from Firestore
  let userProjects = [];
  try {
    const snapshot = await services.firestore.collection("projects").get();
    userProjects = snapshot.docs.map(doc => doc.data());
  } catch (err) {
    console.warn("Could not fetch projects:", err.message);
  }

  // Call OpenAI API
  let aiResponse = "";
  try {
    const response = await services.genai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200
    });
    aiResponse = response.choices[0].message.content;
  } catch (err) {
    console.warn("OpenAI error:", err.message);
    aiResponse = "Sorry, AI service failed.";
  }

  return { text: aiResponse, projects: userProjects };
}

module.exports = { chatFlow };

