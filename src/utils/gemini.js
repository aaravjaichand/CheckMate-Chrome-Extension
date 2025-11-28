/**
 * Vertex AI (Gemini) API utilities
 */

const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = 'us-central1';
const MODEL_ID = 'gemini-2.5-pro';

/**
 * Test the Gemini API connection via Vertex AI
 * @param {string} accessToken - Google OAuth access token
 * @returns {Promise<string>} The response from Gemini
 */
export async function testGeminiConnection(accessToken) {
  if (!accessToken) {
    throw new Error('Access token required for Vertex AI.');
  }

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: "Explain derivatives in a couple sentences" }]
      }],
      generationConfig: {
        maxOutputTokens: 200
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
}
