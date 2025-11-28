// Background service worker for handling OAuth authentication and Vertex AI API calls

import { signInWithGoogleToken, signOutFromFirebase } from './utils/firebase.js';

// Get environment variables (injected by webpack)
const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID || 'checkmate-app-a6beb';

// Open sidebar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    handleAuthentication()
      .then(token => sendResponse(token))
      .catch(error => {
        console.error('Authentication error:', error);
        sendResponse(null);
      });
    return true; // Keep the message channel open for async response
  }
});

async function handleAuthentication() {
  try {
    // Step 1: Get OAuth client ID from environment
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google Client ID not configured');
    }

    // Step 2: Construct OAuth URL for ID token using implicit flow
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org`;
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
      'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
      'https://www.googleapis.com/auth/classroom.rosters.readonly',
      'https://www.googleapis.com/auth/classroom.profile.emails',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/cloud-platform'
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'id_token token'); // Request both ID token and access token
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('prompt', 'select_account'); // Always show account picker

    console.log('Launching OAuth flow...');

    // Step 3: Launch web auth flow
    const redirectUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.href,
          interactive: true
        },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            console.error('WebAuthFlow error:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!responseUrl) {
            reject(new Error('No redirect URL received'));
          } else {
            resolve(responseUrl);
          }
        }
      );
    });

    console.log('OAuth flow completed, parsing tokens...');

    // Step 4: Extract tokens from redirect URL hash fragment
    // Format: https://<extension-id>.chromiumapp.org/#access_token=...&id_token=...&token_type=Bearer&expires_in=3599
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

    console.log('Tokens extracted successfully');

    // Step 5: Sign in to Firebase using the ID token
    try {
      const firebaseUser = await signInWithGoogleToken(idToken, accessToken);
      console.log('Firebase authentication successful:', firebaseUser.uid);

      // Return both tokens and Firebase user info
      return {
        accessToken: accessToken,
        idToken: idToken,
        firebaseUser: firebaseUser
      };
    } catch (firebaseError) {
      console.error('Firebase sign-in failed, but OAuth succeeded:', firebaseError);
      // Still return the tokens so Google Classroom API calls can work
      return {
        accessToken: accessToken,
        idToken: idToken,
        firebaseUser: null,
        error: 'Firebase authentication failed: ' + firebaseError.message
      };
    }
  } catch (error) {
    console.error('Error during authentication:', error.message || error);
    throw error;
  }
}

// Optional: Handle token removal/sign out
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'signOut') {
    handleSignOut()
      .then(() => {
        console.log('Successfully signed out from all services');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error during sign out:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function handleSignOut() {
  try {
    // Step 1: Get the current token from storage
    const result = await chrome.storage.local.get('accessToken');
    const token = result.accessToken;

    if (token) {
      // Step 2: Revoke the token from Google's servers
      await new Promise((resolve, reject) => {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          if (chrome.runtime.lastError) {
            console.warn('Error removing cached token:', chrome.runtime.lastError.message);
          }
          resolve();
        });
      });

      // Step 3: Revoke token via Google's revocation endpoint
      try {
        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
          method: 'POST'
        });
        console.log('Token revoked from Google servers');
      } catch (revokeError) {
        console.warn('Error revoking token from Google:', revokeError);
      }
    }

    // Step 4: Sign out from Firebase
    await signOutFromFirebase();

    // Step 5: Clear all cached auth tokens
    await new Promise((resolve) => {
      chrome.identity.clearAllCachedAuthTokens(() => resolve());
    });

    // Step 6: Clear local storage
    await chrome.storage.local.remove(['accessToken', 'firebaseUser']);

    console.log('Sign out complete');
  } catch (error) {
    console.error('Error during sign out:', error);
    throw error;
  }
}

// Handle worksheet grading
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'gradeWorksheet') {
    handleGradeWorksheet(request.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => {
        console.error('Grading error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

/**
 * Extract file ID from Google Drive URL
 */
function extractDriveFileId(url) {
  const pattern1 = /\/file\/d\/([^\/\?]+)/;
  const match1 = url.match(pattern1);
  if (match1) return match1[1];

  const pattern2 = /[?&]id=([^&]+)/;
  const match2 = url.match(pattern2);
  if (match2) return match2[1];

  const pattern3 = /\/files\/([^\/\?]+)/;
  const match3 = url.match(pattern3);
  if (match3) return match3[1];

  return null;
}

/**
 * Fetch a file from Google Drive and return as Blob
 */
async function fetchFileFromDrive(fileUrl, accessToken) {
  let fetchUrl = fileUrl;

  // If it's a Drive shareable link, convert to API endpoint
  if (fileUrl.includes('drive.google.com') && !fileUrl.includes('googleapis.com')) {
    const fileId = extractDriveFileId(fileUrl);
    if (!fileId) {
      throw new Error('Could not extract file ID from Drive URL');
    }
    fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  console.log('Fetching file from:', fetchUrl);

  const response = await fetch(fetchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
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
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
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

  // Map common MIME types to Anthropic-supported formats
  if (type.includes('pdf')) return 'application/pdf';
  if (type.includes('png')) return 'image/png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'image/jpeg';
  if (type.includes('webp')) return 'image/webp';
  if (type.includes('gif')) return 'image/gif';

  // Default to PDF for documents
  return 'application/pdf';
}

/**
 * Call Vertex AI (Gemini) to grade worksheet
 */
async function callGeminiGrading(base64Data, mediaType, studentName, assignmentName, gradingStyle, customInstructions, accessToken) {
  const projectId = GOOGLE_PROJECT_ID || 'your-project-id'; // Fallback or from env
  const location = 'us-central1';
  const modelId = 'gemini-2.5-pro';

  if (!accessToken) {
    throw new Error('Access token required for Vertex AI');
  }

  // Build system prompt
  const systemPrompt = `You are an expert teacher's assistant helping to grade student worksheets. Your job is to evaluate each answer carefully, provide constructive feedback, and identify topics the student is struggling with.

[Optional: The teacher's grading style preference is: ${gradingStyle}]

[Optional: Additional instructions for this specific worksheet: ${customInstructions}]

For each question:
1. Determine if the answer is correct, partially correct, or incorrect
2. Assign appropriate points based on the quality of the work
3. Provide specific, actionable feedback that helps the student improve. IMPORTANT: Do NOT use LaTeX formatting in the feedback. Keep it plain text or simple markdown so it is easy for the teacher to edit.
4. Identify the topic/concept being tested
5. For "studentAnswer", transcribe the student's work accurately, but CONVERT any mathematical expressions into LaTeX format (enclosed in $ or $$). For example, if the student wrote "x^2", you should return "$x^2$".
6. For "correctAnswer", provide the correct solution using LaTeX formatting (enclosed in $ or $$) for all mathematical expressions.

After grading all questions:
1. Calculate the overall score
2. Create a list of topics the student struggled with (questions they got wrong or partially correct)

Be fair, encouraging, and focus on helping students learn from their mistakes.`;

  // Define the grading tool schema (Gemini Function Declaration)
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
              studentAnswer: { type: "STRING" },
              correctAnswer: { type: "STRING" },
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

  // Build content parts
  const parts = [];

  // Add document/image
  parts.push({
    inlineData: {
      mimeType: mediaType,
      data: base64Data
    }
  });

  // Add text prompt
  parts.push({
    text: `Please grade this worksheet for ${studentName}.

Assignment: ${assignmentName}

Analyze the attached worksheet document, identify all questions and the student's answers, then grade each one. Use the grade_worksheet tool to return structured results.`
  });

  const requestBody = {
    contents: [{
      role: "user",
      parts: parts
    }],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    tools: [{
      functionDeclarations: [gradingTool]
    }],
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

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;

  console.log('Calling Vertex AI:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  console.log('==================== RAW VERTEX AI RESPONSE ====================');
  console.log('Full response object:', JSON.stringify(result, null, 2));
  console.log('================================================================');

  // Extract tool call from response
  // Gemini response structure: candidates[0].content.parts[0].functionCall
  const candidate = result.candidates?.[0];
  const functionCall = candidate?.content?.parts?.find(p => p.functionCall)?.functionCall;

  if (!functionCall || functionCall.name !== 'grade_worksheet') {
    console.error('Tool use not found in response.');
    throw new Error('Failed to get structured grading output from Gemini');
  }

  console.log('==================== TOOL USE EXTRACTION ====================');
  console.log('Tool use found:', functionCall.name);
  console.log('Tool args:', JSON.stringify(functionCall.args, null, 2));
  console.log('=============================================================');

  return functionCall.args;
}

/**
 * Main handler for grading worksheet
 */
async function handleGradeWorksheet(data) {
  const { fileUrl, accessToken, studentName, assignmentName, gradingStyle, customInstructions } = data;

  console.log('Starting grading process...');
  console.log('File URL:', fileUrl);

  // Step 1: Fetch file from Google Drive
  const blob = await fetchFileFromDrive(fileUrl, accessToken);
  console.log('File fetched, size:', blob.size, 'bytes, type:', blob.type);

  // Step 2: Convert to base64
  const base64Data = await blobToBase64(blob);
  const mediaType = getMediaType(blob);
  console.log('File converted to base64, media type:', mediaType);

  // Step 3: Grade with Vertex AI (Gemini)
  console.log('Calling Vertex AI for grading...');
  const gradingResult = await callGeminiGrading(
    base64Data,
    mediaType,
    studentName,
    assignmentName,
    gradingStyle,
    customInstructions,
    accessToken
  );
  console.log('Grading complete');
  console.log('Final grading result to return:', gradingResult);

  // Verify the result structure before returning
  if (gradingResult && typeof gradingResult === 'object') {
    console.log('Result structure verified.');
  }

  return gradingResult;
}