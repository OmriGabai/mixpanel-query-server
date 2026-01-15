const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

const INTERPRETATION_PROMPT = `You are a Mixpanel query assistant. Given a natural language question about analytics data, determine the appropriate Mixpanel query parameters.

Return a JSON object with this structure:
{
  "query_type": "segmentation" | "funnels" | "retention" | "events",
  "params": {
    // For segmentation:
    "event": "event name",
    "from_date": "YYYY-MM-DD",
    "to_date": "YYYY-MM-DD",
    "on": "property to segment by (optional)",
    "where": "filter expression (optional)",
    "unit": "day" | "week" | "month"

    // For retention:
    "event": "return event name",
    "born_event": "initial event (optional)",
    "from_date": "YYYY-MM-DD",
    "to_date": "YYYY-MM-DD"

    // For events:
    // No additional params needed - just lists top events
  }
}

Important:
- Default to the last 7 days if no date range is specified
- Use "segmentation" for questions about event counts, trends, or breakdowns
- Use "retention" for questions about user retention or return rates
- Use "events" for questions about what events exist
- Today's date is: ${new Date().toISOString().split('T')[0]}

Return ONLY valid JSON, no explanation.`;

const SUMMARIZATION_PROMPT = `You are a data analyst. Given the user's original question and the raw data from Mixpanel, provide a concise natural language summary of the findings.

Guidelines:
- Be specific with numbers and percentages
- Highlight key trends or notable patterns
- Keep it brief (2-4 sentences)
- If the data is empty or shows no results, say so clearly`;

async function interpretQuestion(question) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: INTERPRETATION_PROMPT },
      { role: 'user', content: question }
    ],
    temperature: 0,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0].message.content;
  return JSON.parse(content);
}

async function summarizeResults(question, data) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SUMMARIZATION_PROMPT },
      {
        role: 'user',
        content: `Question: ${question}\n\nData:\n${JSON.stringify(data, null, 2)}`
      }
    ],
    temperature: 0.3
  });

  return response.choices[0].message.content;
}

module.exports = {
  interpretQuestion,
  summarizeResults
};
