import { useState, useEffect, useRef } from 'react';
import { GraduationCap, BarChart3, Settings, Check, X, MessageSquare, ClipboardList } from 'lucide-react';
import { GoogleClassroomAPI, authenticate, getStoredAuthData, storeAuthData } from './utils/googleClassroom';
import { testGeminiConnection } from './utils/gemini';
import { sendChatMessage, sendChatMessageWithRAG, generateConversationName } from './utils/chatbot';
import {
  saveGrade,
  saveAIGradingResult,
  saveStrugglingTopics,
  signInWithGoogleToken,
  createConversation,
  getConversations,
  getConversation,
  addMessageToConversation,
  updateConversationTitle,
  listenToConversations,
  listenToGradesByClass,
  deleteConversation,
  deleteGrade,
  recalculateClassAnalytics,
  recalculateStudentAnalytics,
  updateClassAnalytics,
  updateStudentAnalytics,
  saveRagDocument,
  getClassAnalytics,
  upsertClassRagDocument,
  saveLessonPlan,
  saveLessonPlanRagDocument
} from './utils/firebase';
import { generateEmbedding, generateStudentSummary, generateClassSummary, generateLessonPlanSummary } from './utils/embeddings';
import { ToastProvider, useToast } from './components/Toast';
import GradeTab from './components/GradeTab';
import GradesTab from './components/GradesTab';
import AnalyticsTab from './components/AnalyticsTab';
import AssistantTab from './components/AssistantTab';
import SettingsTab from './components/SettingsTab';
import LessonPlanModal from './components/LessonPlanModal';

function AppContent() {
  const toast = useToast();

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
  const [isGradeSelectMode, setIsGradeSelectMode] = useState(false);
  const [selectedGradeIds, setSelectedGradeIds] = useState([]);

  // Analytics tab state
  const [selectedClassForAnalytics, setSelectedClassForAnalytics] = useState(null);

  // Test state
  const [testResponse, setTestResponse] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Chatbot state
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSearchingData, setIsSearchingData] = useState(false);
  const [abortController, setAbortController] = useState(null);

  // Conversation history state
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [gradesUnsubscribe, setGradesUnsubscribe] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);

  // Lesson plan modal state (for Assistant tab)
  const [chatLessonPlan, setChatLessonPlan] = useState(null);
  const [isChatLessonPlanModalOpen, setIsChatLessonPlanModalOpen] = useState(false);
  const [isGeneratingLessonPlanFromChat, setIsGeneratingLessonPlanFromChat] = useState(false);

  // Ref to track conversations currently generating names (prevents duplicates)
  const generatingNamesRef = useRef(new Set());

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

      if (selectedConversation) {
        const updatedSelected = updatedConversations.find(c => c.id === selectedConversation.id);
        if (updatedSelected) {
          if (updatedSelected.title !== selectedConversation.title ||
            (updatedSelected.messages?.length !== selectedConversation.messages?.length)) {
            setSelectedConversation(updatedSelected);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [firebaseUser, selectedConversation]);

  // Clean up grades listener
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
    const intervalId = setInterval(loadCourses, 120000);
    return () => clearInterval(intervalId);
  }, [api]);

  // Periodic refresh for assignments (every 1 minute)
  useEffect(() => {
    if (!api || !selectedCourse) return;

    const intervalId = setInterval(async () => {
      try {
        const assignmentsData = await api.getAssignments(selectedCourse.id);
        setAssignments(assignmentsData);
      } catch {
        // Silent refresh failure
      }
    }, 60000);

    return () => clearInterval(intervalId);
  }, [api, selectedCourse]);

  // Periodic refresh for submissions (every 30 seconds)
  useEffect(() => {
    if (!api || !selectedCourse || !selectedAssignment) return;

    const intervalId = setInterval(async () => {
      try {
        const submissionsData = await api.getSubmissions(selectedCourse.id, selectedAssignment.id);
        const submissionsWithNames = await Promise.all(
          submissionsData.map(async (submission) => {
            let studentInfo = await api.getCourseStudent(selectedCourse.id, submission.userId);
            if (!studentInfo) {
              studentInfo = await api.getStudentProfile(submission.userId);
            }
            const name = studentInfo?.profile?.name?.fullName || studentInfo?.name?.fullName || 'Unknown Student';
            const email = studentInfo?.profile?.emailAddress || studentInfo?.emailAddress || null;
            const attachments = api.getSubmissionAttachments(submission);
            return { ...submission, studentName: name, studentEmail: email, attachments };
          })
        );
        setSubmissions(submissionsWithNames);
      } catch {
        // Silent refresh failure
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [api, selectedCourse, selectedAssignment]);

  async function checkAuth() {
    try {
      const authData = await getStoredAuthData();
      if (authData.accessToken) {
        const classroomApi = new GoogleClassroomAPI(authData.accessToken);
        setApi(classroomApi);
        setAccessToken(authData.accessToken);

        if (authData.idToken) {
          try {
            const user = await signInWithGoogleToken(authData.idToken, authData.accessToken);
            setFirebaseUser(user);
          } catch {
            setFirebaseUser(authData.firebaseUser);
          }
        } else {
          setFirebaseUser(authData.firebaseUser);
        }
        setIsAuthenticated(true);
      }
    } catch {
      // Auth check failed silently
    }
  }

  async function handleSignIn() {
    setIsAuthenticating(true);
    setError(null);

    try {
      const authResponse = await authenticate();

      if (!authResponse.accessToken) {
        throw new Error('No access token received from authentication');
      }

      await storeAuthData({
        accessToken: authResponse.accessToken,
        firebaseUser: authResponse.firebaseUser,
        idToken: authResponse.idToken
      });

      const classroomApi = new GoogleClassroomAPI(authResponse.accessToken);
      setApi(classroomApi);
      setAccessToken(authResponse.accessToken);
      setFirebaseUser(authResponse.firebaseUser);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message === 'SESSION_EXPIRED'
        ? 'Session expired. Please sign in again.'
        : 'Authentication failed: ' + err.message
      );
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleSignOut() {
    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'signOut' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve();
          } else {
            reject(new Error('Sign out failed'));
          }
        });
      });

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
    } catch {
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
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') {
        setIsAuthenticated(false);
        setApi(null);
        setError('Session expired. Please sign in again.');
      } else {
        setError('Error loading courses: ' + err.message);
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
    } catch (err) {
      setError('Error loading assignments: ' + err.message);
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
      const submissionsWithNames = await Promise.all(
        submissionsData.map(async (submission) => {
          let studentInfo = await api.getCourseStudent(selectedCourse.id, submission.userId);
          if (!studentInfo) {
            studentInfo = await api.getStudentProfile(submission.userId);
          }
          const name = studentInfo?.profile?.name?.fullName || studentInfo?.name?.fullName || 'Unknown Student';
          const email = studentInfo?.profile?.emailAddress || studentInfo?.emailAddress || null;
          const attachments = api.getSubmissionAttachments(submission);
          return { ...submission, studentName: name, studentEmail: email, attachments };
        })
      );
      setSubmissions(submissionsWithNames);
    } catch (err) {
      setError('Error loading submissions: ' + err.message);
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
    if (!selectedSubmission?.attachments?.length) {
      setError('No worksheet found in this submission. Please make sure the student attached a file.');
      return;
    }

    setIsGrading(true);
    setError(null);

    try {
      const worksheetAttachment = selectedSubmission.attachments[0];
      let fileUrl = worksheetAttachment.url;

      if (worksheetAttachment.type === 'driveFile' && worksheetAttachment.id) {
        fileUrl = `https://www.googleapis.com/drive/v3/files/${worksheetAttachment.id}?alt=media`;
      } else if (!worksheetAttachment.url) {
        throw new Error('Could not find a valid URL for the worksheet attachment');
      }

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'gradeWorksheet',
            data: {
              fileUrl,
              accessToken,
              studentName: selectedSubmission.studentName,
              assignmentName: selectedAssignment.title,
              gradingStyle,
              customInstructions
            }
          },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          }
        );
      });

      if (!response.success) {
        throw new Error(response.error || 'Unknown error during grading');
      }

      setRawAIResponse(response.result);

      let result = response.result;
      if (typeof result === 'string') {
        result = JSON.parse(result);
      }

      if (!result || typeof result !== 'object') {
        throw new Error('Invalid grading result format: expected an object');
      }

      if (typeof result.overallScore !== 'number') {
        result.overallScore = parseFloat(result.overallScore);
        if (isNaN(result.overallScore)) {
          throw new Error('Invalid overallScore: cannot convert to number');
        }
      }

      if (typeof result.totalPoints !== 'number') {
        result.totalPoints = parseFloat(result.totalPoints);
        if (isNaN(result.totalPoints) || result.totalPoints === 0) {
          if (Array.isArray(result.questions) && result.questions.length > 0) {
            result.totalPoints = result.questions.reduce((sum, q) =>
              sum + (typeof q.pointsPossible === 'number' ? q.pointsPossible : 0), 0);
          } else {
            throw new Error('Invalid totalPoints');
          }
        }
      }

      if (!Array.isArray(result.questions)) {
        throw new Error('Invalid grading result: questions must be an array');
      }

      result.questions = result.questions.map((q) => ({
        ...q,
        pointsAwarded: typeof q.pointsAwarded === 'number' ? q.pointsAwarded : (parseFloat(q.pointsAwarded) || 0),
        pointsPossible: typeof q.pointsPossible === 'number' ? q.pointsPossible : (parseFloat(q.pointsPossible) || 0)
      }));

      if (!Array.isArray(result.strugglingTopics)) {
        result.strugglingTopics = [];
      }

      setGradingResult(result);
    } catch (err) {
      let errorMessage = err.message;
      if (err.message.includes('Invalid totalPoints') || err.message.includes('Invalid grading result')) {
        errorMessage = 'The AI returned an invalid response. Please try grading again.';
      }
      setError(`Failed to grade worksheet: ${errorMessage}`);
    } finally {
      setIsGrading(false);
    }
  }

  function handleGradingResultsChange(updatedResults) {
    setGradingResult(updatedResults);
  }

  /**
   * Index grade data for RAG retrieval (called after saving grades)
   */
  async function indexGradeForRAG(gradeData) {
    const {
      teacherId,
      studentId,
      studentName,
      classId,
      className,
      assignmentName,
      overallScore,
      totalPoints,
      strugglingTopics,
      questions
    } = gradeData;

    // Generate and index student summary
    const studentSummary = generateStudentSummary({
      studentName,
      assignmentName,
      overallScore,
      totalPoints,
      strugglingTopics,
      questions
    });

    const studentEmbedding = await generateEmbedding(studentSummary);
    
    await saveRagDocument(teacherId, {
      type: 'student',
      studentId,
      classId,
      content: studentSummary,
      metadata: {
        studentName,
        className,
        assignmentName,
        avgScore: (overallScore / totalPoints) * 100,
        topics: strugglingTopics || []
      }
    }, studentEmbedding);

    // Update class-level summary document
    const classAnalytics = await getClassAnalytics(classId);
    if (classAnalytics) {
      const classSummary = generateClassSummary(classAnalytics, className);
      const classEmbedding = await generateEmbedding(classSummary);
      
      await upsertClassRagDocument(teacherId, classId, classSummary, classEmbedding, {
        className,
        averageGrade: classAnalytics.averageGrade,
        totalAssignments: classAnalytics.totalAssignments,
        topStrugglingTopics: classAnalytics.commonStrugglingTopics 
          ? Object.keys(classAnalytics.commonStrugglingTopics).slice(0, 5)
          : []
      });
    }
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
      const aiResultId = await saveAIGradingResult({
        submissionId: selectedSubmission.id,
        assignmentId: selectedAssignment.id,
        studentId: selectedSubmission.userId,
        classId: selectedCourse.id,
        model: 'gemini-2.5-pro',
        customInstructions,
        rawResponse: rawAIResponse
      });

      await saveGrade({
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
        aiResultId,
        questions: gradingResult.questions
      });

      if (gradingResult.strugglingTopics?.length) {
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
      }

      await Promise.all([
        updateClassAnalytics(
          selectedCourse.id,
          {
            overallScore: gradingResult.overallScore,
            totalPoints: gradingResult.totalPoints,
            strugglingTopics: gradingResult.strugglingTopics
          },
          selectedSubmission.userId,
          selectedSubmission.studentName
        ),
        updateStudentAnalytics(selectedSubmission.userId, selectedCourse.id, {
          assignmentId: selectedAssignment.id,
          assignmentName: selectedAssignment.title,
          overallScore: gradingResult.overallScore,
          totalPoints: gradingResult.totalPoints,
          strugglingTopics: gradingResult.strugglingTopics
        })
      ]);

      // Index student and class data for RAG (non-blocking)
      indexGradeForRAG({
        teacherId: firebaseUser.uid,
        studentId: selectedSubmission.userId,
        studentName: selectedSubmission.studentName,
        classId: selectedCourse.id,
        className: selectedCourse.name,
        assignmentName: selectedAssignment.title,
        overallScore: gradingResult.overallScore,
        totalPoints: gradingResult.totalPoints,
        strugglingTopics: gradingResult.strugglingTopics,
        questions: gradingResult.questions
      }).catch(err => {
        // RAG indexing failures shouldn't block the user
        console.warn('RAG indexing failed:', err.message);
      });

      setGradingResult(null);
      setRawAIResponse(null);
      setCustomInstructions('');
      setSyncToClassroom(false);

      toast.success('Grades saved successfully!');
    } catch (err) {
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
    // Reset select mode when changing class
    setIsGradeSelectMode(false);
    setSelectedGradeIds([]);

    if (!firebaseUser) {
      setError('Not authenticated with Firebase');
      setIsLoadingGrades(false);
      return;
    }

    if (gradesUnsubscribe) {
      gradesUnsubscribe();
    }

    const unsubscribe = listenToGradesByClass(course.id, firebaseUser.uid, (updatedGrades) => {
      setGradesHistory(updatedGrades);
      setIsLoadingGrades(false);
    });

    setGradesUnsubscribe(() => unsubscribe);
  }

  function handleToggleGradeSelectMode() {
    setIsGradeSelectMode(!isGradeSelectMode);
    setSelectedGradeIds([]);
  }

  function handleToggleGradeSelection(gradeId) {
    setSelectedGradeIds(prev =>
      prev.includes(gradeId)
        ? prev.filter(id => id !== gradeId)
        : [...prev, gradeId]
    );
  }

  async function handleDeleteSelectedGrades() {
    if (selectedGradeIds.length === 0 || !selectedClassForGrades || !firebaseUser) return;

    try {
      setLoading(true);

      // Get the grades to be deleted to find affected students
      const gradesToDelete = gradesHistory.filter(g => selectedGradeIds.includes(g.id));
      const affectedStudentIds = [...new Set(gradesToDelete.map(g => g.studentId))];

      // Soft delete each selected grade
      for (const gradeId of selectedGradeIds) {
        await deleteGrade(gradeId);
      }

      // Recalculate class analytics
      await recalculateClassAnalytics(selectedClassForGrades.id, firebaseUser.uid);

      // Recalculate student analytics for each affected student
      for (const studentId of affectedStudentIds) {
        await recalculateStudentAnalytics(studentId, selectedClassForGrades.id, firebaseUser.uid);
      }

      setIsGradeSelectMode(false);
      setSelectedGradeIds([]);
      toast.success(`Deleted ${selectedGradeIds.length} grade${selectedGradeIds.length !== 1 ? 's' : ''} successfully!`);
    } catch (err) {
      setError(`Failed to delete grades: ${err.message}`);
    } finally {
      setLoading(false);
    }
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

    const controller = new AbortController();
    setAbortController(controller);

    const newUserMessage = { role: 'user', content: userMessage };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);

    const assistantMessage = { role: 'assistant', content: '', toolCalls: [] };
    setMessages([...updatedMessages, assistantMessage]);

    // Capture IDs to avoid stale closure issues
    const conversationId = selectedConversation?.id;
    const userId = firebaseUser?.uid;

    // Track if this is the first message (for name generation after AI responds)
    const shouldGenerateName = conversationId && userId && 
      selectedConversation.title === 'New Conversation' &&
      !generatingNamesRef.current.has(conversationId);

    if (conversationId && userId) {
      try {
        await addMessageToConversation(userId, conversationId, newUserMessage);
      } catch {
        // Message save failed silently
      }
    }

    try {
      let fullAssistantContent = '';
      let toolCallsFromResponse = [];
      const messagesForAPI = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Use RAG-enhanced chat with teacher's data and tool support
      const { response, toolCalls } = await sendChatMessageWithRAG(
        messagesForAPI,
        userId, // teacherId for RAG retrieval
        courses, // available courses for lesson plan context
        (chunk) => {
          fullAssistantContent += chunk;
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content += chunk;
            }
            return newMessages;
          });
        },
        () => setIsSearchingData(true), // onRetrievalStart
        () => setIsSearchingData(false), // onRetrievalComplete
        controller.signal
      );
      fullAssistantContent = response;
      toolCallsFromResponse = toolCalls || [];

      // Handle tool calls - auto-execute generate_lesson_plan
      if (toolCallsFromResponse.length > 0) {
        const generateCall = toolCallsFromResponse.find(t => t.type === 'generate_lesson_plan');
        if (generateCall && generateCall.classId && generateCall.className) {
          // Reset any previous generated plan
          setChatLessonPlan(null);
          // Show generating state in the message
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.toolCalls = [generateCall];
            }
            return newMessages;
          });
          // Trigger generation (non-blocking)
          handleGenerateLessonPlanFromChat(generateCall.classId, generateCall.className, generateCall.focusTopics);
        }
      }

      if (conversationId && userId && fullAssistantContent) {
        try {
          await addMessageToConversation(userId, conversationId, {
            role: 'assistant',
            content: fullAssistantContent
          });

          const updatedConversation = await getConversation(userId, conversationId);
          if (updatedConversation) {
            setSelectedConversation(updatedConversation);
          }

          // Generate conversation name after we have AI response for better context
          if (shouldGenerateName) {
            generatingNamesRef.current.add(conversationId);
            
            generateConversationName(userMessage, fullAssistantContent)
              .then(async (generatedName) => {
                if (generatedName && generatedName !== 'New Conversation') {
                  setSelectedConversation(prev => 
                    prev?.id === conversationId ? { ...prev, title: generatedName } : prev
                  );
                  setConversations(prev => 
                    prev.map(c => c.id === conversationId ? { ...c, title: generatedName } : c)
                  );
                  await updateConversationTitle(userId, conversationId, generatedName);
                }
              })
              .catch(() => {})
              .finally(() => {
                generatingNamesRef.current.delete(conversationId);
              });
          }
        } catch {
          // Assistant message save failed silently
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError' && !err.message?.includes('aborted')) {
        setError(`Failed to send message: ${err.message}`);
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsSendingMessage(false);
      setAbortController(null);
    }
  }

  function handleStopMessage() {
    if (abortController) {
      abortController.abort();
    }
    setIsSendingMessage(false);
    setAbortController(null);
  }

  async function handleNewConversation() {
    try {
      const conversationId = await createConversation(firebaseUser.uid);
      const newConversation = await getConversation(firebaseUser.uid, conversationId);

      setSelectedConversation(newConversation);
      setMessages([]);
      setInputMessage('');
      setChatLessonPlan(null); // Reset lesson plan state for new conversation
    } catch (err) {
      setError(`Failed to create conversation: ${err.message}`);
    }
  }

  async function handleSelectConversation(conversation) {
    if (selectedConversation && selectedConversation.id !== conversation.id &&
      (!selectedConversation.messages?.length)) {
      return;
    }

    setSelectedConversation(conversation);
    setMessages(conversation.messages || []);
    setInputMessage('');
    setChatLessonPlan(null); // Reset lesson plan state when switching conversations
  }

  function handleBackToConversationList() {
    setSelectedConversation(null);
    setMessages([]);
    setInputMessage('');
    setChatLessonPlan(null); // Reset lesson plan state
  }

  function handleToggleSelectMode() {
    setIsSelectMode(!isSelectMode);
    setSelectedConversationIds([]);
  }

  function handleToggleConversationSelection(conversationId) {
    setSelectedConversationIds(prev =>
      prev.includes(conversationId)
        ? prev.filter(id => id !== conversationId)
        : [...prev, conversationId]
    );
  }

  async function handleDeleteSelectedConversations() {
    if (selectedConversationIds.length === 0) return;

    try {
      setLoading(true);
      for (const conversationId of selectedConversationIds) {
        await deleteConversation(firebaseUser.uid, conversationId);
      }
      setIsSelectMode(false);
      setSelectedConversationIds([]);
    } catch (err) {
      setError(`Failed to delete conversations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickAction(prompt) {
    setInputMessage(prompt);
  }

  /**
   * Handle generating a lesson plan from the chatbot
   */
  async function handleGenerateLessonPlanFromChat(classId, className, focusTopics = []) {
    if (!firebaseUser) {
      toast.error('Not authenticated');
      return;
    }

    setIsGeneratingLessonPlanFromChat(true);

    try {
      // Get class analytics for the lesson plan generation
      const analytics = await getClassAnalytics(classId);
      
      // Prepare analytics data for lesson plan generation
      let strugglingTopics = focusTopics;
      let topicCounts = {};
      
      if (analytics?.commonStrugglingTopics) {
        const topicsEntries = Object.entries(analytics.commonStrugglingTopics)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);
        
        if (strugglingTopics.length === 0) {
          strugglingTopics = topicsEntries.map(([topic]) => topic);
        }
        topicCounts = Object.fromEntries(topicsEntries);
      }

      const analyticsData = {
        className,
        classAverage: Math.round(analytics?.averageGrade || 0),
        totalStudents: analytics?.studentPerformances ? Object.keys(analytics.studentPerformances).length : 0,
        studentsNeedingSupport: analytics?.studentPerformances 
          ? Object.values(analytics.studentPerformances).filter(s => s.averageScore < 80).length 
          : 0,
        strugglingTopics,
        topicCounts
      };

      // Generate lesson plan via background.js
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'generateLessonPlan', data: analyticsData },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (res?.success) {
              resolve(res.result);
            } else {
              reject(new Error(res?.error || 'Failed to generate lesson plan'));
            }
          }
        );
      });

      // Save to Firebase
      const lessonPlanId = await saveLessonPlan({
        classId,
        className,
        teacherId: firebaseUser.uid,
        analyticsSnapshot: {
          classAverage: analyticsData.classAverage,
          totalStudents: analyticsData.totalStudents,
          studentsNeedingSupport: analyticsData.studentsNeedingSupport,
          strugglingTopics: analyticsData.strugglingTopics
        },
        plan: response
      });

      // Index for RAG (non-blocking)
      indexLessonPlanForRAG(lessonPlanId, response, { id: classId, name: className }, strugglingTopics)
        .catch(err => console.warn('RAG indexing failed:', err.message));

      // Store the lesson plan for modal viewing
      setChatLessonPlan(response);

      toast.success('Lesson plan generated successfully!');
    } catch (err) {
      console.error('Failed to generate lesson plan:', err);
      toast.error(err.message || 'Failed to generate lesson plan');
    } finally {
      setIsGeneratingLessonPlanFromChat(false);
    }
  }

  /**
   * Index a lesson plan for RAG retrieval
   */
  async function indexLessonPlanForRAG(lessonPlanId, plan, classInfo, strugglingTopics) {
    if (!firebaseUser) return;
    
    const summary = generateLessonPlanSummary(plan, classInfo.name);
    const embedding = await generateEmbedding(summary);
    
    await saveLessonPlanRagDocument(
      firebaseUser.uid,
      lessonPlanId,
      summary,
      embedding,
      {
        classId: classInfo.id,
        className: classInfo.name,
        planTitle: plan.title,
        duration: plan.duration,
        strugglingTopics: strugglingTopics || []
      }
    );
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
          className={`w-full h-12 flex items-center justify-center transition-colors ${
            activeTab === 'grade' ? 'text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Grade"
        >
          <Check className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTab('grades')}
          className={`w-full h-12 flex items-center justify-center transition-colors ${
            activeTab === 'grades' ? 'text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Grades"
        >
          <ClipboardList className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`w-full h-12 flex items-center justify-center transition-colors ${
            activeTab === 'analytics' ? 'text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Analytics"
        >
          <BarChart3 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTab('assistant')}
          className={`w-full h-12 flex items-center justify-center transition-colors ${
            activeTab === 'assistant' ? 'text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Assistant"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full h-12 flex items-center justify-center transition-colors ${
            activeTab === 'settings' ? 'text-blue-600' : 'text-gray-600 hover:bg-gray-100'
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

          {activeTab === 'grades' && (
            <GradesTab
              courses={courses}
              selectedClass={selectedClassForGrades}
              grades={gradesHistory}
              loading={isLoadingGrades}
              onClassSelect={handleClassSelectForGrades}
              isSelectMode={isGradeSelectMode}
              selectedGradeIds={selectedGradeIds}
              onToggleSelectMode={handleToggleGradeSelectMode}
              onToggleGradeSelection={handleToggleGradeSelection}
              onDeleteSelectedGrades={handleDeleteSelectedGrades}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab
              courses={courses}
              selectedClass={selectedClassForAnalytics}
              onClassSelect={setSelectedClassForAnalytics}
            />
          )}

          {activeTab === 'assistant' && (
            <>
              <AssistantTab
                conversations={conversations}
                selectedConversation={selectedConversation}
                messages={messages}
                inputMessage={inputMessage}
                isSendingMessage={isSendingMessage}
                isSearchingData={isSearchingData}
                isLoadingConversations={isLoadingConversations}
                isSelectMode={isSelectMode}
                selectedConversationIds={selectedConversationIds}
                isGeneratingLessonPlan={isGeneratingLessonPlanFromChat}
                hasGeneratedPlan={!!chatLessonPlan}
                onInputChange={setInputMessage}
                onSendMessage={handleSendMessage}
                onStopMessage={handleStopMessage}
                onNewConversation={handleNewConversation}
                onSelectConversation={handleSelectConversation}
                onBackToList={handleBackToConversationList}
                onToggleSelectMode={handleToggleSelectMode}
                onToggleConversationSelection={handleToggleConversationSelection}
                onDeleteSelectedConversations={handleDeleteSelectedConversations}
                onQuickAction={handleQuickAction}
                onOpenLessonPlanModal={() => setIsChatLessonPlanModalOpen(true)}
              />
              <LessonPlanModal
                lessonPlan={chatLessonPlan}
                isOpen={isChatLessonPlanModalOpen}
                onClose={() => setIsChatLessonPlanModalOpen(false)}
              />
            </>
          )}

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
}

const App = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
