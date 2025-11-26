// Chatbot utilities using Vertex AI (Gemini 1.5 Pro)
const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID || 'checkmate-app-a6beb';
const LOCATION = 'us-central1';
const MODEL_ID = 'gemini-2.5-flash';

const CHUNK_BATCH_DELAY = 50; // Batch chunks for 50ms to prevent jank

/**
 * Creates a debounced chunk callback to batch streaming updates
 * This prevents layout thrashing by batching multiple small chunks together
 * @param {Function} callback - Original callback function
 * @returns {Object} Object with updateChunk and flush methods
 */
function createBatchedChunkHandler(callback) {
  let batchedText = '';
  let timeoutId = null;

  const flush = () => {
    if (batchedText) {
      callback(batchedText);
      batchedText = '';
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const updateChunk = (chunk) => {
    batchedText += chunk;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      flush();
    }, CHUNK_BATCH_DELAY);
  };

  return { updateChunk, flush };
}

/**
 * Send a message to the chatbot and get a streaming response
 * @param {Array} messages - Array of message objects with role and content
 * @param {Function} onChunk - Callback function called with batched chunks of text
 * @param {AbortSignal} signal - Optional abort signal to cancel the stream
 * @param {string} accessToken - Google OAuth access token
 * @returns {Promise<string>} The complete chatbot response
 */
export async function sendChatMessage(messages, onChunk = null, signal = null, accessToken) {
  if (!accessToken) {
    throw new Error('Access token required for Vertex AI.');
  }

  try {
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:streamGenerateContent?alt=sse`;

    // Convert messages to Gemini format
    // Gemini expects { role: "user" | "model", parts: [{ text: "..." }] }
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const systemPrompt = "Assist with the user's request in a meaningful manner. Use markdown for text formatting and latex for math when applicable.";

    const requestBody = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI API error (${response.status}): ${errorText}`);
    }

    // Handle streaming response (SSE)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    const batchHandler = onChunk ? createBatchedChunkHandler(onChunk) : null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (textPart) {
              fullText += textPart;
              if (batchHandler) {
                batchHandler.updateChunk(textPart);
              }
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    if (batchHandler) {
      batchHandler.flush();
    }

    return fullText;

  } catch (error) {
    if (error.name === 'AbortError' || error.message === 'Stream aborted') {
      throw error;
    }
    console.error('Chatbot API error:', error);
    throw new Error(`Failed to get chatbot response: ${error.message}`);
  }
}

/**
 * Generate a brief conversation name based on the first user message
 * @param {string} userMessage - The first message from the user
 * @param {string} accessToken - Google OAuth access token
 * @returns {Promise<string>} A brief conversation name (4-5 words max)
 */
export async function generateConversationName(userMessage, accessToken) {
  if (!accessToken) {
    // Fallback if no token provided (though it should be)
    return 'New Conversation';
  }

  try {
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:generateContent`;

    const systemPrompt = "Name this user's conversation based on their first message. Respond in a simple EXTREMELY brief conversation name (4-5 words max, keep short). Respond in ONLY and I MEAN ONLY the conversation name and nothing else";

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: userMessage }]
        }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          maxOutputTokens: 50
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Vertex AI API error: ${response.status}`);
    }

    const result = await response.json();
    const conversationName = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'New Conversation';
    return conversationName;

  } catch (error) {
    console.error('Error generating conversation name:', error);
    return 'New Conversation';
  }
}
