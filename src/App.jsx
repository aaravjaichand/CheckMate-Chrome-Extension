import { useState, useEffect } from 'react';
import { GraduationCap, BarChart3, Settings, Check, X, MessageSquare, ClipboardList } from 'lucide-react';
import { GoogleClassroomAPI, authenticate, getStoredAuthData, storeAuthData, clearToken } from './utils/googleClassroom';
import { testGeminiConnection } from './utils/gemini';
import { sendChatMessage, generateConversationName } from './utils/chatbot';
import { saveGrade, saveAIGradingResult, saveStrugglingTopics, getGradesByClass, signInWithGoogleToken, createConversation, getConversations, getConversation, addMessageToConversation, updateConversationTitle, listenToConversations, listenToGradesByClass, deleteConversation } from './utils/firebase';
import GradeTab from './components/GradeTab';
import GradesTab from './components/GradesTab';
import AnalyticsTab from './components/AnalyticsTab';
import AssistantTab from './components/AssistantTab';
import SettingsTab from './components/SettingsTab';

const App = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [api, setApi] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState('grade');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data state
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  // Grade tab state
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [gradingStyle, setGradingStyle] = useState('Be encouraging and constructive. Focus on what the student did well before pointing out mistakes. Use simple language and provide specific examples of how to improve.');
  const [gradingResult, setGradingResult] = useState(null);
  const [rawAIResponse, setRawAIResponse] = useState(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncToClassroom, setSyncToClassroom] = useState(false);

  // Grades tab state
  const [selectedClassForGrades, setSelectedClassForGrades] = useState(null);
  const [gradesHistory, setGradesHistory] = useState([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);

  // Analytics tab state
  const [selectedClassForAnalytics, setSelectedClassForAnalytics] = useState(null);

  // Anthropic test state
  const [testResponse, setTestResponse] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Chatbot state
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [abortController, setAbortController] = useState(null);

  // Conversation history state
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationUnsubscribe, setConversationUnsubscribe] = useState(null);
  const [gradesUnsubscribe, setGradesUnsubscribe] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);

  // Check for existing token on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Load courses when authenticated
  useEffect(() => {
    if (api) {
      loadCourses();
    }
  }, [api]);

  // Set up real-time listener for conversations
  useEffect(() => {
    if (!firebaseUser) return;

    const unsubscribe = listenToConversations(firebaseUser.uid, (updatedConversations) => {
      setConversations(updatedConversations);
      setIsLoadingConversations(false);
    });

    setConversationUnsubscribe(() => unsubscribe);

    return () => {
      unsubscribe();
    };
  }, [firebaseUser]);

  // Clean up grades listener when component unmounts or class selection changes
  useEffect(() => {
    return () => {
      if (gradesUnsubscribe) {
        gradesUnsubscribe();
      }
    };
  }, [selectedClassForGrades]);

  // Periodic refresh for courses (every 2 minutes)
  useEffect(() => {
    if (!api) return;

    const intervalId = setInterval(() => {
      loadCourses();
    }, 120000); // 120 seconds = 2 minutes

    return () => clearInterval(intervalId);
  }, [api]);

  // Periodic refresh for assignments (every 1 minute)
  useEffect(() => {
    if (!api || !selectedCourse) return;

    const intervalId = setInterval(async () => {
      try {
        const assignmentsData = await api.getAssignments(selectedCourse.id);
        setAssignments(assignmentsData);
      } catch (error) {
        console.error('Error refreshing assignments:', error);
      }
    }, 60000); // 60 seconds = 1 minute

    return () => clearInterval(intervalId);
  }, [api, selectedCourse]);

  // Periodic refresh for submissions (every 30 seconds)
  useEffect(() => {
    if (!api || !selectedCourse || !selectedAssignment) return;

    const intervalId = setInterval(async () => {
      try {
        const submissionsData = await api.getSubmissions(selectedCourse.id, selectedAssignment.id);

        // Fetch student names for each submission
        const submissionsWithNames = await Promise.all(
          submissionsData.map(async (submission) => {
            let studentInfo = await api.getCourseStudent(selectedCourse.id, submission.userId);

            if (!studentInfo) {
              studentInfo = await api.getStudentProfile(submission.userId);
            }

            const name = studentInfo?.profile?.name?.fullName ||
              studentInfo?.name?.fullName ||
              'Unknown Student';

            const email = studentInfo?.profile?.emailAddress ||
              studentInfo?.emailAddress ||
              null;

            // Get attachments for this submission
            const attachments = api.getSubmissionAttachments(submission);

            return {
              ...submission,
              studentName: name,
              studentEmail: email,
              attachments: attachments
            };
          })
        );

        setSubmissions(submissionsWithNames);
      } catch (error) {
        console.error('Error refreshing submissions:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [api, selectedCourse, selectedAssignment]);

  async function checkAuth() {
    try {
      const authData = await getStoredAuthData();
      if (authData.accessToken) {
        const classroomApi = new GoogleClassroomAPI(authData.accessToken);
        setApi(classroomApi);
        setAccessToken(authData.accessToken);

        // Re-authenticate with Firebase if we have the ID token
        if (authData.idToken) {
          try {
            console.log('Re-authenticating with Firebase using stored ID token...');
            const firebaseUser = await signInWithGoogleToken(authData.idToken, authData.accessToken);
            setFirebaseUser(firebaseUser);
            console.log('Firebase re-authentication successful:', firebaseUser.uid);
          } catch (firebaseError) {
            console.error('Failed to re-authenticate with Firebase:', firebaseError);
            // Fall back to stored user data
            setFirebaseUser(authData.firebaseUser);
          }
        } else {
          // No ID token, use stored user data
          setFirebaseUser(authData.firebaseUser);
          console.log('No ID token available, using stored user data');
        }

        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    }
  }

  async function handleSignIn() {
    setIsAuthenticating(true);
    setError(null);

    try {
      const authResponse = await authenticate();

      // authResponse contains { accessToken, firebaseUser, error? }
      if (!authResponse.accessToken) {
        throw new Error('No access token received from authentication');
      }

      // Store auth data including idToken for Firebase re-authentication
      await storeAuthData({
        accessToken: authResponse.accessToken,
        firebaseUser: authResponse.firebaseUser,
        idToken: authResponse.idToken
      });

      // Set up Google Classroom API
      const classroomApi = new GoogleClassroomAPI(authResponse.accessToken);
      setApi(classroomApi);
      setAccessToken(authResponse.accessToken);
      setFirebaseUser(authResponse.firebaseUser);
      setIsAuthenticated(true);

      // Log Firebase auth status
      if (authResponse.firebaseUser) {
        console.log('Successfully authenticated with Firebase:', authResponse.firebaseUser.uid);
      } else if (authResponse.error) {
        console.warn('Firebase authentication failed:', authResponse.error);
      }
    } catch (error) {
      setError(error.message === 'SESSION_EXPIRED'
        ? 'Session expired. Please sign in again.'
        : 'Authentication failed: ' + error.message
      );
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleSignOut() {
    try {
      // Call background script to properly revoke tokens
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'signOut' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve();
          } else {
            reject(new Error('Sign out failed'));
          }
        });
      });

      // Clear local state
      setApi(null);
      setAccessToken(null);
      setFirebaseUser(null);
      setIsAuthenticated(false);
      setCourses([]);
      setAssignments([]);
      setSubmissions([]);
      setSelectedCourse(null);
      setSelectedAssignment(null);
      setSelectedSubmission(null);
      setGradingResult(null);
      setMessages([]);

      console.log('Sign out complete - cleared all state');
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear local state
      setApi(null);
      setAccessToken(null);
      setFirebaseUser(null);
      setIsAuthenticated(false);
      setCourses([]);
      setAssignments([]);
      setSubmissions([]);
    }
  }

  async function loadCourses() {
    setLoading(true);
    setError(null);

    try {
      const coursesData = await api.getCourses();
      setCourses(coursesData);
    } catch (error) {
      if (error.message === 'SESSION_EXPIRED') {
        setIsAuthenticated(false);
        setApi(null);
        setError('Session expired. Please sign in again.');
      } else {
        setError('Error loading courses: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCourseSelect(course) {
    setSelectedCourse(course);
    setSelectedAssignment(null);
    setSelectedSubmission(null);
    setGradingResult(null);
    setLoading(true);
    setError(null);

    try {
      const assignmentsData = await api.getAssignments(course.id);
      setAssignments(assignmentsData);
    } catch (error) {
      setError('Error loading assignments: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignmentSelect(assignment) {
    setSelectedAssignment(assignment);
    setSelectedSubmission(null);
    setGradingResult(null);
    setLoading(true);
    setError(null);

    try {
      const submissionsData = await api.getSubmissions(selectedCourse.id, assignment.id);

      // Fetch student names for each submission
      const submissionsWithNames = await Promise.all(
        submissionsData.map(async (submission) => {
          // Try to get student info from course roster first (more reliable)
          let studentInfo = await api.getCourseStudent(selectedCourse.id, submission.userId);

          // Fallback to user profile if course student not found
          if (!studentInfo) {
            studentInfo = await api.getStudentProfile(submission.userId);
          }

          console.log('Student info for', submission.userId, ':', studentInfo);

          const name = studentInfo?.profile?.name?.fullName ||
            studentInfo?.name?.fullName ||
            'Unknown Student';

          const email = studentInfo?.profile?.emailAddress ||
            studentInfo?.emailAddress ||
            null;

          console.log('Extracted name:', name, 'email:', email);

          // Get attachments for this submission
          const attachments = api.getSubmissionAttachments(submission);

          return {
            ...submission,
            studentName: name,
            studentEmail: email,
            attachments: attachments
          };
        })
      );

      setSubmissions(submissionsWithNames);
    } catch (error) {
      setError('Error loading submissions: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmissionSelect(submission) {
    setSelectedSubmission(submission);
    setGradingResult(null);
    setCustomInstructions('');
  }

  async function handleGrade() {
    if (!selectedSubmission || !selectedSubmission.attachments || selectedSubmission.attachments.length === 0) {
      setError('No worksheet found in this submission. Please make sure the student attached a file.');
      return;
    }

    setIsGrading(true);
    setError(null);

    try {
      // Get the first attachment (assuming it's the worksheet)
      const worksheetAttachment = selectedSubmission.attachments[0];

      // For Drive files, prefer using the file ID directly
      let fileUrl = worksheetAttachment.url;
      if (worksheetAttachment.type === 'driveFile' && worksheetAttachment.id) {
        // Convert Drive file ID to API URL
        fileUrl = `https://www.googleapis.com/drive/v3/files/${worksheetAttachment.id}?alt=media`;
        console.log('Using Drive API URL:', fileUrl);
      } else if (!worksheetAttachment.url) {
        throw new Error('Could not find a valid URL for the worksheet attachment');
      }

      console.log('Sending grading request to background worker...');
      console.log('File URL:', fileUrl);
      console.log('Attachment details:', worksheetAttachment);

      // Send message to background worker to handle grading
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'gradeWorksheet',
            data: {
              fileUrl: fileUrl,
              accessToken: accessToken,
              studentName: selectedSubmission.studentName,
              assignmentName: selectedAssignment.title,
              gradingStyle: gradingStyle,
              customInstructions: customInstructions
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (!response.success) {
        throw new Error(response.error || 'Unknown error during grading');
      }

      console.log('Raw grading result:', response.result);

      // Store raw AI response for later saving to database
      setRawAIResponse(response.result);

      // Validate and normalize the grading result
      let gradingResult = response.result;

      // If result is a string, try to parse it
      if (typeof gradingResult === 'string') {
        console.log('Parsing stringified grading result...');
        gradingResult = JSON.parse(gradingResult);
      }

      // Validate required fields exist
      if (!gradingResult || typeof gradingResult !== 'object') {
        throw new Error('Invalid grading result format: expected an object');
      }

      // Ensure numeric fields are actually numbers
      if (typeof gradingResult.overallScore !== 'number') {
        gradingResult.overallScore = parseFloat(gradingResult.overallScore);
        if (isNaN(gradingResult.overallScore)) {
          throw new Error('Invalid overallScore: cannot convert to number');
        }
      }

      if (typeof gradingResult.totalPoints !== 'number') {
        gradingResult.totalPoints = parseFloat(gradingResult.totalPoints);
        if (isNaN(gradingResult.totalPoints) || gradingResult.totalPoints === 0) {
          // If totalPoints is missing/invalid, try to calculate it from questions
          if (Array.isArray(gradingResult.questions) && gradingResult.questions.length > 0) {
            gradingResult.totalPoints = gradingResult.questions.reduce((sum, q) => {
              return sum + (typeof q.pointsPossible === 'number' ? q.pointsPossible : 0);
            }, 0);
            console.log('Calculated totalPoints from questions:', gradingResult.totalPoints);
          } else {
            throw new Error('Invalid totalPoints: cannot convert to number and cannot calculate from questions');
          }
        }
      }

      // Validate questions array
      if (!Array.isArray(gradingResult.questions)) {
        throw new Error('Invalid grading result: questions must be an array');
      }

      // Validate each question's numeric fields
      gradingResult.questions = gradingResult.questions.map((q, idx) => {
        const validatedQuestion = { ...q };
        if (typeof validatedQuestion.pointsAwarded !== 'number') {
          validatedQuestion.pointsAwarded = parseFloat(validatedQuestion.pointsAwarded);
          if (isNaN(validatedQuestion.pointsAwarded)) {
            console.warn(`Question ${idx} has invalid pointsAwarded, setting to 0`);
            validatedQuestion.pointsAwarded = 0;
          }
        }
        if (typeof validatedQuestion.pointsPossible !== 'number') {
          validatedQuestion.pointsPossible = parseFloat(validatedQuestion.pointsPossible);
          if (isNaN(validatedQuestion.pointsPossible)) {
            console.warn(`Question ${idx} has invalid pointsPossible, setting to 0`);
            validatedQuestion.pointsPossible = 0;
          }
        }
        return validatedQuestion;
      });

      // Ensure strugglingTopics is an array
      if (!Array.isArray(gradingResult.strugglingTopics)) {
        gradingResult.strugglingTopics = [];
      }

      console.log('Validated grading result:', gradingResult);
      setGradingResult(gradingResult);
    } catch (err) {
      console.error('Error grading worksheet:', err);
      console.error('Full error:', err.stack);

      // Provide more helpful error messages
      let errorMessage = err.message;
      if (err.message.includes('Invalid totalPoints')) {
        errorMessage = 'Failed to parse grading results. The AI response was malformed. Please try grading again.';
      } else if (err.message.includes('Invalid grading result')) {
        errorMessage = 'The AI returned an invalid response structure. Please try grading again.';
      }

      setError(`Failed to grade worksheet: ${errorMessage}`);
    } finally {
      setIsGrading(false);
    }
  }

  function handleGradingResultsChange(updatedResults) {
    setGradingResult(updatedResults);
  }

  async function handleSaveGrades() {
    if (!firebaseUser) {
      setError('Cannot save grades: Not authenticated with Firebase');
      return;
    }

    if (!gradingResult || !rawAIResponse) {
      setError('No grading results to save');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Step 1: Save raw AI response to aiGradingResults
      const aiResultId = await saveAIGradingResult({
        submissionId: selectedSubmission.id,
        assignmentId: selectedAssignment.id,
        studentId: selectedSubmission.userId,
        classId: selectedCourse.id,
        model: 'gemini-2.5-pro',
        customInstructions: customInstructions,
        rawResponse: rawAIResponse
      });

      console.log('Saved AI result with ID:', aiResultId);

      // Step 2: Save grade with reference to AI result
      const gradeId = await saveGrade({
        submissionId: selectedSubmission.id,
        assignmentId: selectedAssignment.id,
        studentId: selectedSubmission.userId,
        classId: selectedCourse.id,
        teacherId: firebaseUser.uid,
        assignmentName: selectedAssignment.title,
        studentName: selectedSubmission.studentName,
        overallScore: gradingResult.overallScore,
        totalPoints: gradingResult.totalPoints,
        syncedToGoogleClassroom: syncToClassroom,
        aiResultId: aiResultId,
        questions: gradingResult.questions
      });

      console.log('Saved grade with ID:', gradeId);

      // Step 3: Save struggling topics if any
      if (gradingResult.strugglingTopics && gradingResult.strugglingTopics.length > 0) {
        await saveStrugglingTopics(
          selectedSubmission.userId,
          selectedCourse.id,
          selectedAssignment.id,
          {
            topics: gradingResult.strugglingTopics,
            assignmentName: selectedAssignment.title,
            score: gradingResult.overallScore
          }
        );
        console.log('Saved struggling topics');
      }

      // Step 4: Optionally sync to Google Classroom (TODO: implement)
      if (syncToClassroom) {
        console.log('TODO: Sync grade to Google Classroom');
        // This would call Google Classroom API to update the grade
        // await api.updateSubmissionGrade(selectedCourse.id, selectedAssignment.id, selectedSubmission.id, gradingResult.overallScore);
      }

      // Success! Clear the grading result and show success message
      console.log('Successfully saved all grading data');
      setGradingResult(null);
      setRawAIResponse(null);
      setCustomInstructions('');
      setSyncToClassroom(false);

      // You might want to show a success message to the user
      // For now, we'll just log it
      alert('Grades saved successfully!');

    } catch (err) {
      console.error('Error saving grades:', err);
      setError(`Failed to save grades: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleClassSelectForGrades(course) {
    setSelectedClassForGrades(course);
    setGradesHistory([]);
    setIsLoadingGrades(true);
    setError(null);

    if (!firebaseUser) {
      setError('Not authenticated with Firebase');
      setIsLoadingGrades(false);
      return;
    }

    // Clean up previous listener if exists
    if (gradesUnsubscribe) {
      gradesUnsubscribe();
    }

    // Set up real-time listener for grades
    const unsubscribe = listenToGradesByClass(course.id, firebaseUser.uid, (updatedGrades) => {
      setGradesHistory(updatedGrades);
      setIsLoadingGrades(false);
      console.log('Loaded grades for class:', course.name, updatedGrades);
    });

    setGradesUnsubscribe(() => unsubscribe);
  }

  function handleGradeCardClick(grade) {
    console.log('Grade card clicked:', grade);
    // The modal is handled within GradesTab component
  }

  async function handleTestConnection() {
    setIsTesting(true);
    setTestResponse('');
    setError(null);

    try {
      const response = await testGeminiConnection(accessToken);
      setTestResponse(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!inputMessage.trim() || isSendingMessage) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsSendingMessage(true);
    setError(null);

    // Create abort controller for stopping the stream
    const controller = new AbortController();
    setAbortController(controller);

    // Add user message to chat
    const newUserMessage = { role: 'user', content: userMessage };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);

    // Add empty assistant message that will be filled with streaming content
    const assistantMessage = { role: 'assistant', content: '' };
    setMessages([...updatedMessages, assistantMessage]);

    // Save user message to Firebase if in a conversation
    if (selectedConversation) {
      try {
        await addMessageToConversation(firebaseUser.uid, selectedConversation.id, newUserMessage, userMessage);

        // Auto-generate conversation name if this is the first user message
        const isFirstMessage = selectedConversation.title === 'New Conversation' ||
          !selectedConversation.messages ||
          selectedConversation.messages.length === 0;

        if (isFirstMessage) {
          // Generate name in parallel with the main chat response (don't await)
          generateConversationName(userMessage, accessToken)
            .then(async (generatedName) => {
              try {
                await updateConversationTitle(firebaseUser.uid, selectedConversation.id, generatedName);
                console.log('Updated conversation title to:', generatedName);
              } catch (err) {
                console.error('Error updating conversation title:', err);
              }
            })
            .catch((err) => {
              console.error('Error generating conversation name:', err);
            });
        }
      } catch (err) {
        console.error('Error saving user message to Firebase:', err);
      }
    }

    try {
      let fullAssistantContent = '';

      // Filter out timestamps before sending to Claude API (Claude only accepts role and content)
      const messagesForAPI = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Send to chatbot API with streaming
      await sendChatMessage(
        messagesForAPI,
        (chunk) => {
          fullAssistantContent += chunk;

          // Update the last message (assistant) with streaming content
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content += chunk;
            }
            return newMessages;
          });
        },
        controller.signal,
        accessToken
      );

      // Save assistant message to Firebase if in a conversation
      if (selectedConversation && fullAssistantContent) {
        try {
          await addMessageToConversation(firebaseUser.uid, selectedConversation.id, {
            role: 'assistant',
            content: fullAssistantContent
          });

          // Reload conversation to get updated messages
          const updatedConversation = await getConversation(firebaseUser.uid, selectedConversation.id);
          setSelectedConversation(updatedConversation);
        } catch (err) {
          console.error('Error saving assistant message to Firebase:', err);
        }
      }
    } catch (err) {
      if (err.message === 'Stream aborted') {
        console.log('Message generation stopped by user');
      } else {
        console.error('Error sending message:', err);
        setError(`Failed to send message: ${err.message}`);
        // Remove the empty assistant message on error
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsSendingMessage(false);
      setAbortController(null);
    }
  }

  function handleStopMessage() {
    // Abort the streaming request
    if (abortController) {
      abortController.abort();
    }
    setIsSendingMessage(false);
    setAbortController(null);
  }

  async function loadConversations() {
    setIsLoadingConversations(true);
    try {
      const convos = await getConversations(firebaseUser.uid);
      setConversations(convos);
      console.log('Loaded conversations:', convos);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function handleNewConversation() {
    try {
      const conversationId = await createConversation(firebaseUser.uid);
      const newConversation = await getConversation(firebaseUser.uid, conversationId);

      setSelectedConversation(newConversation);
      setMessages([]);
      setInputMessage('');

      console.log('Created new conversation:', conversationId);

      // Reload conversations list
      await loadConversations();
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError(`Failed to create conversation: ${err.message}`);
    }
  }

  async function handleSelectConversation(conversation) {
    // Prevent opening another conversation if one is already open without messages
    if (selectedConversation && selectedConversation.id !== conversation.id && (!selectedConversation.messages || selectedConversation.messages.length === 0)) {
      return; // Don't allow selecting a different conversation
    }

    setSelectedConversation(conversation);
    setMessages(conversation.messages || []);
    setInputMessage('');
  }

  function handleBackToConversationList() {
    setSelectedConversation(null);
    setMessages([]);
    setInputMessage('');
  }

  function handleToggleSelectMode() {
    setIsSelectMode(!isSelectMode);
    setSelectedConversationIds([]);
  }

  function handleToggleConversationSelection(conversationId) {
    setSelectedConversationIds(prev => {
      if (prev.includes(conversationId)) {
        return prev.filter(id => id !== conversationId);
      } else {
        return [...prev, conversationId];
      }
    });
  }

  async function handleDeleteSelectedConversations() {
    if (selectedConversationIds.length === 0) return;

    try {
      setLoading(true);
      for (const conversationId of selectedConversationIds) {
        await deleteConversation(firebaseUser.uid, conversationId);
      }

      // Exit select mode and refresh conversations
      setIsSelectMode(false);
      setSelectedConversationIds([]);
      await loadConversations();
    } catch (err) {
      console.error('Error deleting conversations:', err);
      setError(`Failed to delete conversations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="w-full h-screen bg-white flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="flex items-center justify-center gap-2 mb-4">
            <GraduationCap className="w-12 h-12 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">CheckMate</h1>
          </div>
          <p className="text-gray-600 mb-8">AI-Powered Grading Assistant for Google Classroom</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={isAuthenticating}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuthenticating ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    );
  }

  // Main application
  return (
    <div className="w-full h-screen bg-white flex">
      {/* Sidebar Navigation */}
      <div className="w-14 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-3 gap-1">
        <div className="mb-4">
          <GraduationCap className="w-6 h-6 text-gray-700" />
        </div>

        <button
          onClick={() => setActiveTab('grade')}
          className={`w-full h-12 flex items-center justify-center transition-colors ${activeTab === 'grade'
            ? 'text-blue-600'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
          title="Grade"
        >
          <Check className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTab('grades')}
          className={`w-full h-12 flex items-center justify-center transition-colors ${activeTab === 'grades'
            ? 'text-blue-600'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
          title="Grades"
        >
          <ClipboardList className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`w-full h-12 flex items-center justify-center transition-colors ${activeTab === 'analytics'
            ? 'text-blue-600'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
          title="Analytics"
        >
          <BarChart3 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTab('assistant')}
          className={`w-full h-12 flex items-center justify-center transition-colors ${activeTab === 'assistant'
            ? 'text-blue-600'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
          title="Assistant"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full h-12 flex items-center justify-center transition-colors ${activeTab === 'settings'
            ? 'text-blue-600'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="flex-1"></div>

        <button
          onClick={handleSignOut}
          className="w-full h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
          title="Sign Out"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-x-hidden min-w-0">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* GRADE TAB */}
          {activeTab === 'grade' && (
            <GradeTab
              courses={courses}
              selectedCourse={selectedCourse}
              assignments={assignments}
              selectedAssignment={selectedAssignment}
              submissions={submissions}
              selectedSubmission={selectedSubmission}
              loading={loading}
              customInstructions={customInstructions}
              gradingResult={gradingResult}
              isGrading={isGrading}
              syncToClassroom={syncToClassroom}
              isSaving={isSaving}
              onCourseSelect={handleCourseSelect}
              onAssignmentSelect={handleAssignmentSelect}
              onSubmissionSelect={handleSubmissionSelect}
              onCustomInstructionsChange={setCustomInstructions}
              onGrade={handleGrade}
              onGradingResultsChange={handleGradingResultsChange}
              onClearGradingResult={() => setGradingResult(null)}
              onSyncToClassroomChange={setSyncToClassroom}
              onSaveGrades={handleSaveGrades}
            />
          )}

          {/* GRADES TAB */}
          {activeTab === 'grades' && (
            <GradesTab
              courses={courses}
              selectedClass={selectedClassForGrades}
              grades={gradesHistory}
              loading={isLoadingGrades}
              onClassSelect={handleClassSelectForGrades}
              onGradeClick={handleGradeCardClick}
            />
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <AnalyticsTab
              courses={courses}
              selectedClass={selectedClassForAnalytics}
              onClassSelect={setSelectedClassForAnalytics}
            />
          )}

          {/* ASSISTANT TAB */}
          {activeTab === 'assistant' && (
            <AssistantTab
              conversations={conversations}
              selectedConversation={selectedConversation}
              messages={messages}
              inputMessage={inputMessage}
              isSendingMessage={isSendingMessage}
              isLoadingConversations={isLoadingConversations}
              isSelectMode={isSelectMode}
              selectedConversationIds={selectedConversationIds}
              onInputChange={setInputMessage}
              onSendMessage={handleSendMessage}
              onStopMessage={handleStopMessage}
              onNewConversation={handleNewConversation}
              onSelectConversation={handleSelectConversation}
              onBackToList={handleBackToConversationList}
              onToggleSelectMode={handleToggleSelectMode}
              onToggleConversationSelection={handleToggleConversationSelection}
              onDeleteSelectedConversations={handleDeleteSelectedConversations}
            />
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <SettingsTab
              gradingStyle={gradingStyle}
              testResponse={testResponse}
              isTesting={isTesting}
              onGradingStyleChange={setGradingStyle}
              onTestConnection={handleTestConnection}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
