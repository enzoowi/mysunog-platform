
const axios = require("axios");
require("dotenv").config();
(async () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    const model = "gemini-3.1-flash-lite";
    const systemPrompt = `You are an expert fire scene analyst...`;
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key,
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: "TEST" }] }]
      },
      { headers: { "Content-Type": "application/json" } }
    );
    console.log(res.data.candidates[0].content.parts[0].text);
  } catch (e) {
    console.error(e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
  }
})();

