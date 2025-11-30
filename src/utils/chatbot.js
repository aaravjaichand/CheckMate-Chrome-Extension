/**
 * Chatbot utilities using Gemini API
 */

import { generateEmbedding, searchSimilar } from './embeddings';
import { getRagDocuments } from './firebase';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_ID = 'gemini-2.5-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const CHUNK_BATCH_DELAY = 50;

/**
 * Tool definitions for lesson plan actions
 */
const LESSON_PLAN_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'generate_lesson_plan',
        description: 'Generate a new lesson plan for a specific class. Use this when the teacher explicitly asks to create or generate a NEW lesson plan. Requires class context.',
        parameters: {
          type: 'OBJECT',
          properties: {
            classId: {
              type: 'STRING',
              description: 'The ID of the class to generate the lesson plan for'
            },
            className: {
              type: 'STRING',
              description: 'The name of the class'
            },
            focusTopics: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'Optional specific topics to focus on in the lesson plan'
            }
          },
          required: ['classId', 'className']
        }
      }
    ]
  }
];

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
 * RAG system prompt for teaching assistant
 */
const RAG_SYSTEM_PROMPT = `You are a teaching assistant for CheckMate, an AI grading tool for Google Classroom.

CONTEXT DATA:
{retrievedDocuments}

CLASSES:
{availableClasses}

DATA TYPES YOU MAY SEE:
- Student grades: individual scores, strong topics (excelled), struggling topics (needs work)
- Class summaries: averages, common strong/struggling topics across students
- Lesson plans: previously generated plans addressing specific topics
  IF THE TEACHER HAS ANY OF THESE, you will be able to view it, so if they are not there, the teacher doesn't have it


RESPONSE RULES:
1. If context says "No student data available" and teacher asks about grades/performance/analytics: tell them they haven't graded any assignments yet and suggest using the Grade tab to get started
2. When data exists: cite specific names, scores, and topics
3. Be concise - teachers are busy
4. Use markdown formatting and LaTeX for math

TOOL: generate_lesson_plan
- Only use when teacher explicitly asks to CREATE/GENERATE a NEW lesson plan
- Requires valid classId and className from CLASSES list
- If class is unclear, ask which one`;

/**
 * Send a message to the chatbot with RAG-enhanced context and tool support
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} teacherId - Teacher ID for retrieving their documents
 * @param {Array} courses - Available courses for the teacher (for lesson plan generation context)
 * @param {Function} onChunk - Callback function called with batched chunks of text
 * @param {Function} onRetrievalStart - Callback when RAG retrieval starts
 * @param {Function} onRetrievalComplete - Callback when RAG retrieval completes
 * @param {AbortSignal} signal - Optional abort signal to cancel the stream
 * @returns {Promise<{response: string, retrievedDocs: Array, toolCalls: Array}>} The response, retrieved docs, and tool calls
 */
export async function sendChatMessageWithRAG(
  messages,
  teacherId,
  courses = [],
  onChunk = null,
  onRetrievalStart = null,
  onRetrievalComplete = null,
  signal = null
) {
  // Get the latest user message for embedding
  const latestUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!latestUserMessage) {
    throw new Error('No user message found');
  }

  let retrievedDocs = [];
  let contextString = 'No student data available yet. Answer based on general teaching knowledge.';

  // Perform RAG retrieval if teacherId is provided
  if (teacherId) {
    try {
      if (onRetrievalStart) onRetrievalStart();

      // Embed the user's query
      const queryEmbedding = await generateEmbedding(latestUserMessage.content);

      // Fetch all teacher's RAG documents
      const allDocuments = await getRagDocuments(teacherId);

      if (allDocuments.length > 0) {
        // Search for similar documents
        retrievedDocs = searchSimilar(queryEmbedding, allDocuments, 10);

        // Build context string from retrieved documents
        if (retrievedDocs.length > 0) {
          contextString = retrievedDocs
            .filter(doc => doc.score > 0.3) // Only include reasonably relevant docs
            .map((doc, idx) => {
              const meta = doc.metadata || {};
              const type = doc.type || 'unknown';
              let docInfo = `[${idx + 1}] (${type})`;
              
              if (meta.className) {
                docInfo += ` (${meta.className})`;
              }
              
              docInfo += ` ${doc.content}`;
              return docInfo;
            })
            .join('\n\n');

          if (!contextString.trim()) {
            contextString = 'No highly relevant student data found for this query. Answer based on general teaching knowledge.';
          }
        }
      }

      if (onRetrievalComplete) onRetrievalComplete(retrievedDocs);
    } catch (err) {
      // RAG retrieval failed, continue without context
      console.warn('RAG retrieval failed:', err.message);
      if (onRetrievalComplete) onRetrievalComplete([]);
    }
  }

  // Build available classes string
  const classesString = courses.length > 0
    ? courses.map(c => `- ${c.name} (classId: ${c.id})`).join('\n')
    : 'No classes available.';

  // Build the system prompt with retrieved context
  const systemPrompt = RAG_SYSTEM_PROMPT
    .replace('{retrievedDocuments}', contextString)
    .replace('{availableClasses}', classesString);

  const url = `${GEMINI_API_URL}/${GEMINI_MODEL_ID}:streamGenerateContent?alt=sse`;

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

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
      tools: LESSON_PLAN_TOOLS,
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
  const toolCalls = [];
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
          const parts = data.candidates?.[0]?.content?.parts || [];
          
          for (const part of parts) {
            // Handle text parts
            if (part.text) {
              fullText += part.text;
              if (batchHandler) {
                batchHandler.updateChunk(part.text);
              }
            }
            
            // Handle function call parts
            if (part.functionCall) {
              const fc = part.functionCall;
              toolCalls.push({
                type: fc.name,
                ...fc.args
              });
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

  return { response: fullText, retrievedDocs, toolCalls };
}

/**
 * Generate a brief conversation name based on the first exchange
 * @param {string} userMessage - The first message from the user
 * @param {string} assistantResponse - Optional snippet of the assistant's response (first ~200 chars)
 * @returns {Promise<string>} A brief conversation name (2-3 words)
 */
export async function generateConversationName(userMessage, assistantResponse = '') {
  const maxRetries = 2;
  let attempt = 0;

  // Build context from both user message and AI response snippet
  let context = `User: ${userMessage}`;
  if (assistantResponse) {
    // Take first ~200 chars of response for context
    const snippet = assistantResponse.slice(0, 200).trim();
    context += `\n\nAssistant response preview: ${snippet}`;
  }

  while (attempt < maxRetries) {
    try {
      // Use a simpler model for title generation - faster and doesn't waste tokens on "thinking"
      const url = `${GEMINI_API_URL}/gemini-2.0-flash-lite:generateContent`;

      const systemPrompt = `Generate a 2-3 word title for this conversation based on the exchange below. Rules:
- EXACTLY 2-3 words, no more
- Be specific to the main topic being discussed
- No generic words like "Help", "Question", "Chat", "Conversation", "Assistance"
- No punctuation or special characters
- Capitalize each word

Examples: "Quadratic Equations", "Essay Structure", "Python Arrays", "Cell Division", "French Revolution"

Return ONLY the title, nothing else.`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: context }]
          }],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            maxOutputTokens: 30,
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
      const rawTitle = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!rawTitle) {
        throw new Error('Empty title returned');
      }

      // Sanitize: remove special chars (keep letters, numbers, spaces), limit to 3 words, max 40 chars
      const sanitized = rawTitle
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(word => word.length > 0)
        .slice(0, 3)
        .join(' ')
        .slice(0, 40);

      if (!sanitized || sanitized.length < 2) {
        // Fallback: use first few words of user message
        const fallback = userMessage
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .split(' ')
          .filter(w => w.length > 2)
          .slice(0, 2)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        return fallback || 'New Conversation';
      }

      return sanitized;

    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        return 'New Conversation';
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return 'New Conversation';
}
