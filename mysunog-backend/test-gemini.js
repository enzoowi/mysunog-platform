
const axios = require('axios');
require('dotenv').config();
(async () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash';
    const systemPrompt = \You are an expert fire scene analyst... (truncated for test)\;
    
    const userParts = [{ text: 'Write a paragraph about fire safety.' }];
    
    const res = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key,
      {
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log(res.data.candidates[0].content.parts[0].text);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
})();

