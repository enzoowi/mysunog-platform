
const axios = require("axios");
require("dotenv").config();
(async () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    const model = "gemini-1.5-flash";
    const systemPrompt = `You are an expert...`;
    
    // Simulate notification with no image
    const userPromptText = `ALERT: FIRE DETECTED
DETAILS: HIGH severity on camera "Generator". Confidence: 80%
TIME: 8/4/2026, 7:53:51 PM
TIME CONTEXT: NIGHTTIME operation
A CCTV frame image is attached (if available). Perform your two-phase visual analysis on this image and the data above, then give situation-specific tactical advice for the responding fire team.`;

    const userParts = [{ text: userPromptText }];
    
    // Simulate with image
    const fs = require("fs");
    // let imageBase64 = fs.readFileSync("path_to_image").toString("base64");

    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key,
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: userParts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
      },
      { headers: { "Content-Type": "application/json" } }
    );
    console.log(res.data.candidates[0].content.parts[0].text);
  } catch (e) {
    console.error("ERROR:", e.response ? JSON.stringify(e.response.data) : e.message);
  }
})();

