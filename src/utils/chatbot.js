/**
 * Chatbot utilities using Gemini API
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_ID = 'gemini-2.5-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const CHUNK_BATCH_DELAY = 50;

/**
 * Creates a debounced chunk callback to batch streaming updates
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
    timeoutId = setTimeout(flush, CHUNK_BATCH_DELAY);
  };

  return { updateChunk, flush };
}

/**
 * Send a message to the chatbot and get a streaming response
 * @param {Array} messages - Array of message objects with role and content
 * @param {Function} onChunk - Callback function called with batched chunks of text
 * @param {AbortSignal} signal - Optional abort signal to cancel the stream
 * @returns {Promise<string>} The complete chatbot response
 */
export async function sendChatMessage(messages, onChunk = null, signal = null) {
  const url = `${GEMINI_API_URL}/${GEMINI_MODEL_ID}:streamGenerateContent?alt=sse`;

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const systemPrompt = "Assist with the user's request in a meaningful manner. Use markdown for text formatting and latex for math when applicable.";

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7
      }
    }),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

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
        } catch {
          // Ignore parse errors for partial chunks
        }
      }
    }
  }

  if (batchHandler) {
    batchHandler.flush();
  }

  return fullText;
}

/**
 * Generate a brief conversation name based on the first user message
 * @param {string} userMessage - The first message from the user
 * @returns {Promise<string>} A brief conversation name (4-5 words max)
 */
export async function generateConversationName(userMessage) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const url = `${GEMINI_API_URL}/${GEMINI_MODEL_ID}:generateContent`;

      const systemPrompt = "Create a brief, descriptive title for this conversation based on the user's first message. The title should be 3-5 words that capture the main topic or question. Do NOT use generic phrases like 'New Conversation', 'Chat', 'Untitled', or 'Conversation'. Be specific to what the user is asking about. Examples: 'Calculus Derivatives Help', 'Essay Writing Tips', 'Python Loop Question', 'History Project Research'. Return only the title, nothing else.";

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
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
            maxOutputTokens: 50,
            temperature: 0.3
          }
        })
      });

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Retryable API error: ${response.status}`);
        }
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'New Conversation';

    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        return 'New Conversation';
      }
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return 'New Conversation';
}
