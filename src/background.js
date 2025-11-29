/**
 * Background service worker for OAuth authentication and Gemini API calls
 */

import { signInWithGoogleToken, signOutFromFirebase } from './utils/firebase.js';

const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Open sidebar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Handle authentication requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    handleAuthentication()
      .then(token => sendResponse(token))
      .catch(() => sendResponse(null));
    return true;
  }
});

async function handleAuthentication() {
  const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org`;
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.students',
    'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    'https://www.googleapis.com/auth/classroom.profile.emails',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/cloud-platform'
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'id_token token');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('prompt', 'consent');

  const redirectUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.href, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!responseUrl) {
          reject(new Error('No redirect URL received'));
        } else {
          resolve(responseUrl);
        }
      }
    );
  });

  const hashFragment = redirectUrl.split('#')[1];
  if (!hashFragment) {
    throw new Error('No hash fragment in redirect URL');
  }

  const params = new URLSearchParams(hashFragment);
  const accessToken = params.get('access_token');
  const idToken = params.get('id_token');

  if (!accessToken) {
    throw new Error('No access token in redirect URL');
  }
  if (!idToken) {
    throw new Error('No ID token in redirect URL');
  }

  try {
    const firebaseUser = await signInWithGoogleToken(idToken, accessToken);
    return { accessToken, idToken, firebaseUser };
  } catch (firebaseError) {
    return {
      accessToken,
      idToken,
      firebaseUser: null,
      error: 'Firebase authentication failed: ' + firebaseError.message
    };
  }
}

// Handle sign out requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'signOut') {
    handleSignOut()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleSignOut() {
  const result = await chrome.storage.local.get('accessToken');
  const token = result.accessToken;

  if (token) {
    await new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, resolve);
    });

    try {
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
        method: 'POST'
      });
    } catch {
      // Token revocation failed, continue with sign out
    }
  }

  await signOutFromFirebase();
  await new Promise((resolve) => {
    chrome.identity.clearAllCachedAuthTokens(resolve);
  });
  await chrome.storage.local.remove(['accessToken', 'firebaseUser']);
}

// Handle worksheet grading requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'gradeWorksheet') {
    handleGradeWorksheet(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Extract file ID from Google Drive URL
 */
function extractDriveFileId(url) {
  const patterns = [
    /\/file\/d\/([^\/\?]+)/,
    /[?&]id=([^&]+)/,
    /\/files\/([^\/\?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch a file from Google Drive and return as Blob
 */
async function fetchFileFromDrive(fileUrl, accessToken) {
  let fetchUrl = fileUrl;

  if (fileUrl.includes('drive.google.com') && !fileUrl.includes('googleapis.com')) {
    const fileId = extractDriveFileId(fileUrl);
    if (!fileId) {
      throw new Error('Could not extract file ID from Drive URL');
    }
    fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const response = await fetch(fetchUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch file (${response.status}): ${errorText}`);
  }

  return response.blob();
}

/**
 * Convert Blob to base64 string
 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Determine media type from blob
 */
function getMediaType(blob) {
  const type = blob.type;
  if (type.includes('pdf')) return 'application/pdf';
  if (type.includes('png')) return 'image/png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'image/jpeg';
  if (type.includes('webp')) return 'image/webp';
  if (type.includes('gif')) return 'image/gif';
  return 'application/pdf';
}

/**
 * Sanitize grading results - replace literal \n with double newlines for markdown line breaks
 */
function sanitizeGradingResults(results) {
  if (!results || !results.questions) return results;

  return {
    ...results,
    questions: results.questions.map(q => ({
      ...q,
      studentAnswer: q.studentAnswer?.replace(/\\n/g, '\n\n') || '',
      correctAnswer: q.correctAnswer?.replace(/\\n/g, '\n\n') || ''
    }))
  };
}

/**
 * Call Gemini API to grade worksheet
 */
async function callGeminiGrading(base64Data, mediaType, studentName, assignmentName, gradingStyle, customInstructions) {
  const modelId = 'gemini-2.5-pro';

  const systemPrompt = `You are an expert teacher's assistant helping to grade student worksheets. Your job is to evaluate each answer carefully, provide constructive feedback, and identify topics the student is struggling with.

${gradingStyle ? `[The teacher's grading style preference is: ${gradingStyle}]` : ''}

${customInstructions ? `[Additional instructions for this specific worksheet: ${customInstructions}]` : ''}

For each question:
1. Determine if the answer is correct, partially correct, or incorrect
2. Assign appropriate points based on the quality of the work
3. Provide specific, actionable feedback that helps the student improve.
   **CRITICAL: The "feedback" field must be straightforward PLAIN TEXT ONLY. Do NOT use any LaTeX ($...$), markdown formatting (**, ##, etc.), or any special delimiters. The feedback is NOT rendered with any formatter - it displays as raw text. Write feedback as simple, readable sentences.**
4. Identify the topic/concept being tested
5. For "studentAnswer", transcribe the student's work accurately using proper LaTeX formatting (see rules below)
6. For "correctAnswer", provide the correct solution using proper LaTeX formatting (see rules below)

**LaTeX Formatting Rules (CRITICAL - follow exactly):**
- ALWAYS use backslash before LaTeX commands: \\frac, \\sqrt, \\sum, \\int (NOT frac, sqrt, sum, int)
- ALWAYS use curly braces for ALL arguments: \\frac{a}{b}, x^{2}, \\sqrt{x}, a_{n}
- Use $...$ for inline math expressions
- NEVER include literal \\n or newline characters inside $ delimiters
- For multi-step work, put EACH STEP on its own line with SEPARATE $ delimiters (close $ before newline, open new $ after)

**Correct LaTeX Examples:**
- Fraction: $\\frac{9}{3} = 3$
- Exponent: $x^{2} + 2x + 1$
- Square root: $\\sqrt{16} = 4$
- Subscript: $a_{1} + a_{2}$
- Multi-step solution (each step gets its own line and $ delimiters):
  $3x + 5 = 14$
  $3x = 14 - 5$
  $3x = 9$
  $x = \\frac{9}{3}$
  $x = 3$

**WRONG (do NOT do this):**
- Missing backslash: $frac{9}{3}$ ← WRONG, must be $\\frac{9}{3}$
- Missing braces: $x^2$ ← WRONG, must be $x^{2}$
- Newlines inside LaTeX: $3x = 9\\nx = 3$ ← WRONG, split into separate lines

After grading all questions:
1. Calculate the overall score
2. Create a list of topics the student struggled with (questions they got wrong or partially correct)
`;

  const gradingTool = {
    name: "grade_worksheet",
    description: "Grade a student worksheet and return structured grading results with feedback for each question.",
    parameters: {
      type: "OBJECT",
      properties: {
        overallScore: {
          type: "NUMBER",
          description: "The overall score (sum of points awarded)"
        },
        totalPoints: {
          type: "NUMBER",
          description: "Total points possible (sum of all pointsPossible)"
        },
        strugglingTopics: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "List of topics the student struggled with"
        },
        questions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              questionNumber: { type: "NUMBER" },
              questionText: { type: "STRING" },
              studentAnswer: {
                type: "STRING",
                description: "Student's work in proper LaTeX format. Use \\frac{a}{b} for fractions, x^{2} for exponents, \\sqrt{x} for roots. Each step on separate line with its own $ delimiters. NEVER put \\n inside $ delimiters."
              },
              correctAnswer: {
                type: "STRING",
                description: "Correct solution in proper LaTeX format. Use \\frac{a}{b} for fractions, x^{2} for exponents, \\sqrt{x} for roots. Each step on separate line with its own $ delimiters. NEVER put \\n inside $ delimiters."
              },
              isCorrect: { type: "BOOLEAN" },
              pointsAwarded: { type: "NUMBER" },
              pointsPossible: { type: "NUMBER" },
              feedback: { type: "STRING" },
              topic: { type: "STRING" }
            },
            required: ["questionNumber", "questionText", "studentAnswer", "correctAnswer", "isCorrect", "pointsAwarded", "pointsPossible", "feedback", "topic"]
          }
        }
      },
      required: ["overallScore", "totalPoints", "strugglingTopics", "questions"]
    }
  };

  const parts = [
    {
      inlineData: {
        mimeType: mediaType,
        data: base64Data
      }
    },
    {
      text: `Please grade this worksheet for ${studentName}.

Assignment: ${assignmentName}

Analyze the attached worksheet document, identify all questions and the student's answers, then grade each one. Use the grade_worksheet tool to return structured results.`
    }
  ];

  const requestBody = {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    tools: [{ functionDeclarations: [gradingTool] }],
    toolConfig: {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: ["grade_worksheet"]
      }
    },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const functionCall = candidate?.content?.parts?.find(p => p.functionCall)?.functionCall;

  if (!functionCall || functionCall.name !== 'grade_worksheet') {
    throw new Error('Failed to get structured grading output from Gemini');
  }

  // Sanitize LaTeX formatting issues from AI output
  return sanitizeGradingResults(functionCall.args);
}

/**
 * Main handler for grading worksheet
 */
async function handleGradeWorksheet(data) {
  const { fileUrl, accessToken, studentName, assignmentName, gradingStyle, customInstructions } = data;

  const blob = await fetchFileFromDrive(fileUrl, accessToken);
  const base64Data = await blobToBase64(blob);
  const mediaType = getMediaType(blob);

  return await callGeminiGrading(
    base64Data,
    mediaType,
    studentName,
    assignmentName,
    gradingStyle,
    customInstructions
  );
}
