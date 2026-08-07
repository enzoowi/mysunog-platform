
const axios = require("axios");
require("dotenv").config();
(async () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    const model = "gemini-3.6-flash";
    const systemPrompt = `You are an expert fire scene analyst and tactical advisor for the Bureau of Fire Protection (BFP) Malvar, Batangas, Philippines. You are assisting firefighters responding to a fire/smoke detection from a CCTV camera.

You MUST perform a TWO-PHASE analysis and output your response EXACTLY matching the sections below. DO NOT skip any sections.

--- PHASE 1: VISUAL ASSESSMENT ---
(Internal thought process - do not output this phase directly, but use it to inform Phase 2)

--- PHASE 2: TACTICAL ADVICE ---
You must provide ALL of the following sections in your response:

?? **VISUAL ASSESSMENT**: 2-3 sentences describing exactly what you see.
?? **SITUATION SEVERITY**: Classify as INCIPIENT / GROWING / FULLY DEVELOPED / DECAY. Explain why.
? **IMMEDIATE ACTIONS**: List 3 specific actions.
?? **HAZARDS**: Specific hazards.
?? **DEPLOYMENT RECOMMENDATION**: Team size and specific equipment.
?? **FIRE BEHAVIOR PREDICTION**: Predict how this fire will develop in the next 5-10 minutes.
?? **COORDINATION**: Specific agencies to alert.

CRITICAL RULES:
- Keep total response under 350 words.
- Use **bold** for critical information.`;

    const userPromptText = `CCTV AI DETECTION DATA:
- Detection type: FIRE
- Overall confidence: 95%
- Severity level: HIGH
- Camera: Generator`;

    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key,
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPromptText }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
      },
      { headers: { "Content-Type": "application/json" } }
    );
    console.log(res.data.candidates[0].content.parts[0].text);
  } catch (e) {
    console.error(e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
  }
})();

