// Chatbot utilities using Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_ID = 'gemini-3-pro-preview';

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
 * @returns {Promise<string>} The complete chatbot response
 */
export async function sendChatMessage(messages, onChunk = null, signal = null) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

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
        temperature: 0.7,
        thinkingConfig: {
          thinkingLevel: "low" // Faster responses for chat
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
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
 * @returns {Promise<string>} A brief conversation name (4-5 words max)
 */
export async function generateConversationName(userMessage) {
  if (!GEMINI_API_KEY) {
    return 'New Conversation';
  }

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;

      const systemPrompt = "Create a brief, descriptive title for this conversation based on the user's first message. The title should be 3-5 words that capture the main topic or question. Do NOT use generic phrases like 'New Conversation', 'Chat', 'Untitled', or 'Conversation'. Be specific to what the user is asking about. Examples: 'Calculus Derivatives Help', 'Essay Writing Tips', 'Python Loop Question', 'History Project Research'. Return only the title, nothing else.";

      const response = await fetch(url, {
        method: 'POST',
        headers: {
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
            maxOutputTokens: 50,
            temperature: 0.3, // Lower temperature for more consistent naming
            thinkingConfig: {
              thinkingLevel: "low" // Fast naming, no complex reasoning needed
            }
          }
        })
      });

      if (!response.ok) {
        // If it's a 429 (Too Many Requests) or 5xx (Server Error), we should retry
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Retryable API error: ${response.status}`);
        }
        // For other errors (400, 401, 403), don't retry
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const result = await response.json();
      const conversationName = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'New Conversation';
      console.log('Generated conversation name:', conversationName);
      return conversationName;

    } catch (error) {
      attempt++;
      console.warn(`Attempt ${attempt} failed to generate conversation name:`, error);

      if (attempt >= maxRetries) {
        console.error('All attempts to generate conversation name failed.');
        return 'New Conversation';
      }

      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return 'New Conversation';
}
