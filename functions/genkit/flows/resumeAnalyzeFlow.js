async function resumeAnalyzeFlow({ params }, services) {
  const jobText = params?.jobText || "";

  let resumeSummary = "";
  try {
    const doc = await services.firestore.collection("meta").doc("resumeSummary").get();
    if (doc.exists) resumeSummary = doc.data()?.text || "";
  } catch (err) {
    console.warn("Could not fetch resume summary:", err.message);
  }

  const prompt = `You are an expert recruiter. Compare the following resume summary with the job posting and produce:
1) A one-line alignment score (Low/Medium/High)
2) 3 bullet points listing strong matches
3) 3 bullet points listing missing or weak areas

Job posting: ${jobText}
Resume summary: ${resumeSummary}`;

  let analysis = "";
  try {
    const response = await services.genai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400
    });
    analysis = response.choices[0].message.content;
  } catch (err) {
    console.warn("OpenAI error:", err.message);
    analysis = "AI failed to analyze resume.";
  }

  return { analysis };
}

module.exports = { resumeAnalyzeFlow };

