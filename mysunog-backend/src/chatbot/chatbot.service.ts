import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ChatbotService {
  private readonly groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

  async chat(userMessage: string) {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      throw new InternalServerErrorException('Missing GROQ_API_KEY in .env');
    }

    const systemPrompt = `
You are the official mySunog virtual assistant — the AI chatbot for Bureau of Fire Protection (BFP) Malvar, Batangas services.

mySunog is a web-based fire safety, permit, and incident management system serving the municipality of Malvar, Batangas, Philippines.

You help citizens with the following topics:

🔥 FSIC & FSEC PERMIT APPLICATIONS
- The mySunog system DOES NOT process FSIC (Fire Safety Inspection Certificate) or FSEC (Fire Safety Evaluation Clearance) natively.
- To apply for these permits, citizens must visit the official e-BFP portal at https://fsis.e-bfp.com
- Do not instruct users to apply or track permits within the mySunog system.

📚 FIRE SAFETY EDUCATION
- mySunog has an Education Hub with fire safety guides and tips
- Topics include: fire prevention, LPG safety, home safety, emergency preparedness
- Citizens can browse educational content by category

🚨 ALERTS & ADVISORIES
- BFP Malvar posts fire safety alerts including: dry season warnings, fire drill announcements, power outage advisories, LPG safety reminders
- Alerts can be targeted to specific barangays

📞 EMERGENCY CONTACTS
- BFP Malvar hotline and other emergency contacts are available in the Emergency Hotlines page
- Includes: BFP, MDRRMO, barangay hotlines, hospitals, police

⚠️ HAZARD REPORTING
- Citizens can report fire hazards such as: illegal wiring, blocked fire exits, improper flammable material storage
- Reports are reviewed by BFP admin

🙋 VOLUNTEER REGISTRATION
- Citizens can register as volunteer fire marshals through the system
- Volunteers help with community fire watch programs

Rules:
1. Answer clearly, concisely, and helpfully.
2. Keep answers focused on BFP Malvar and mySunog system features.
3. If the user asks about permits, explicitly state that they must use the e-BFP portal (https://fsis.e-bfp.com) and cannot apply natively through mySunog.
4. If the user asks about inspections, explain scheduling and preparation.
5. If the user asks about fire safety, give practical prevention tips relevant to Philippine households.
6. Do not invent official legal requirements if you are unsure.
7. If the question is unclear, ask a short clarifying question.
8. Do not answer unrelated or harmful requests.
9. Use a helpful, professional, and friendly tone.
10. When relevant, guide users to specific pages in the mySunog system.
`;

    try {
      const response = await axios.post(
        this.groqUrl,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 600,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      const answer =
        response.data?.choices?.[0]?.message?.content ||
        'Sorry, I could not generate a response.';

      return { answer };
    } catch (error: any) {
      console.error('Groq API Error:', error?.response?.data || error.message);

      throw new InternalServerErrorException(
        error?.response?.data?.error?.message ||
          'Failed to get response from Groq',
      );
    }
  }
}
