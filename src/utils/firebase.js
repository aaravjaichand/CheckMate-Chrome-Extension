// Firebase configuration and initialization

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Sign in to Firebase using Google OAuth tokens from Chrome Identity API
 * @param {string} idToken - The OAuth ID token from OAuth flow
 * @param {string} accessToken - The OAuth access token from OAuth flow (optional)
 * @returns {Promise<Object>} Firebase user credentials
 */
export async function signInWithGoogleToken(idToken, accessToken = null) {
  try {
    console.log('Signing in to Firebase with ID token...');

    // Create a Google credential with ID token (first param) and access token (second param)
    // For Firebase, the ID token is the primary credential
    const credential = GoogleAuthProvider.credential(idToken, accessToken);

    // Sign in to Firebase with the credential
    const userCredential = await signInWithCredential(auth, credential);

    console.log('Successfully signed in to Firebase:', userCredential.user.uid);

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: userCredential.user.displayName,
      photoURL: userCredential.user.photoURL
    };
  } catch (error) {
    console.error('Error signing in to Firebase:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw error;
  }
}

/**
 * Sign out from Firebase
 */
export async function signOutFromFirebase() {
  try {
    await auth.signOut();
    console.log('Successfully signed out from Firebase');
  } catch (error) {
    console.error('Error signing out from Firebase:', error);
    throw error;
  }
}

/**
 * Get current Firebase user
 * @returns {Object|null} Current user or null if not signed in
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Listen to auth state changes
 * @param {Function} callback - Callback function to handle auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  return auth.onAuthStateChanged(callback);
}

/**
 * Save AI grading result to database
 * @param {Object} aiResultData - AI grading result data
 * @returns {Promise<string>} The generated aiResultId
 */
export async function saveAIGradingResult(aiResultData) {
  try {
    const aiResultsRef = collection(db, 'aiGradingResults');
    const docRef = await addDoc(aiResultsRef, {
      ...aiResultData,
      generatedAt: Date.now()
    });

    console.log('Successfully saved AI grading result:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving AI grading result:', error);
    throw error;
  }
}

/**
 * Save grade to database
 * @param {Object} gradeData - Grade data
 * @returns {Promise<string>} The generated gradeId
 */
export async function saveGrade(gradeData) {
  try {
    const gradesRef = collection(db, 'grades');
    const docRef = await addDoc(gradesRef, {
      ...gradeData,
      gradedAt: Date.now()
    });

    console.log('Successfully saved grade:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving grade:', error);
    throw error;
  }
}

/**
 * Save struggling topics for a student
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {string} assignmentId - Assignment ID
 * @param {Object} topicsData - Topics data with topics array, assignmentName, score
 * @returns {Promise<void>}
 */
export async function saveStrugglingTopics(studentId, classId, assignmentId, topicsData) {
  try {
    const topicsRef = doc(db, 'strugglingTopics', studentId, 'classes', classId, 'assignments', assignmentId);
    await setDoc(topicsRef, {
      ...topicsData,
      gradedAt: Date.now()
    });

    console.log('Successfully saved struggling topics for student:', studentId);
  } catch (error) {
    console.error('Error saving struggling topics:', error);
    throw error;
  }
}

/**
 * Get all grades for a specific class (filtered by current teacher)
 * @param {string} classId - Class ID
 * @param {string} teacherId - Teacher ID (current user)
 * @returns {Promise<Array>} Array of grade objects with their IDs
 */
export async function getGradesByClass(classId, teacherId) {
  try {
    // Check if user is authenticated
    const currentUser = auth.currentUser;
    console.log('Current Firebase Auth user:', currentUser);
    console.log('User UID:', currentUser?.uid);
    console.log('User email:', currentUser?.email);

    if (!currentUser) {
      throw new Error('Not authenticated with Firebase - please sign in again');
    }

    const gradesRef = collection(db, 'grades');
    console.log('Querying grades for classId:', classId);
    const gradesQuery = query(
      gradesRef,
      where('classId', '==', classId),
      where('teacherId', '==', teacherId),
      orderBy('gradedAt', 'desc')
    );
    const snapshot = await getDocs(gradesQuery);

    if (snapshot.empty) {
      console.log('No grades found for this class');
      return [];
    }

    const grades = [];
    snapshot.forEach((doc) => {
      grades.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`Found ${grades.length} grades for this teacher`);
    return grades;
  } catch (error) {
    console.error('Error fetching grades by class:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw error;
  }
}

/**
 * Get a specific grade by ID
 * @param {string} gradeId - Grade ID
 * @returns {Promise<Object|null>} Grade object or null if not found
 */
export async function getGradeById(gradeId) {
  try {
    const gradeRef = doc(db, 'grades', gradeId);
    const snapshot = await getDoc(gradeRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: gradeId,
      ...snapshot.data()
    };
  } catch (error) {
    console.error('Error fetching grade by ID:', error);
    throw error;
  }
}

/**
 * Create a new conversation
 * @param {string} teacherId - Teacher ID
 * @returns {Promise<string>} The generated conversationId
 */
export async function createConversation(teacherId) {
  try {
    const conversationsRef = collection(db, 'conversations', teacherId, 'userConversations');
    const docRef = await addDoc(conversationsRef, {
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    console.log('Created new conversation:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}

/**
 * Get all conversations for a teacher
 * @param {string} teacherId - Teacher ID
 * @returns {Promise<Array>} Array of conversation objects
 */
export async function getConversations(teacherId) {
  try {
    const conversationsRef = collection(db, 'conversations', teacherId, 'userConversations');
    const q = query(conversationsRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    const conversations = [];
    snapshot.forEach((doc) => {
      conversations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return conversations;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
}

/**
 * Get a specific conversation
 * @param {string} teacherId - Teacher ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Conversation object or null
 */
export async function getConversation(teacherId, conversationId) {
  try {
    const conversationRef = doc(db, 'conversations', teacherId, 'userConversations', conversationId);
    const snapshot = await getDoc(conversationRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: conversationId,
      ...snapshot.data()
    };
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw error;
  }
}

/**
 * Add a message to a conversation
 * @param {string} teacherId - Teacher ID
 * @param {string} conversationId - Conversation ID
 * @param {Object} message - Message object { role, content }
 * @param {string} title - Optional conversation title (for first message)
 * @returns {Promise<void>}
 */
export async function addMessageToConversation(teacherId, conversationId, message, title = null) {
  try {
    const conversationRef = doc(db, 'conversations', teacherId, 'userConversations', conversationId);
    const snapshot = await getDoc(conversationRef);

    if (!snapshot.exists()) {
      throw new Error('Conversation not found');
    }

    const conversation = snapshot.data();
    const updatedMessages = [...(conversation.messages || []), {
      role: message.role,
      content: message.content,
      timestamp: Date.now()
    }];

    // Update title with first message if provided
    const updateData = {
      messages: updatedMessages,
      updatedAt: Date.now()
    };

    if (title && conversation.title === 'New Conversation') {
      updateData.title = title;
    }

    await setDoc(conversationRef, {
      ...conversation,
      ...updateData
    });

    console.log('Added message to conversation:', conversationId);
  } catch (error) {
    console.error('Error adding message to conversation:', error);
    throw error;
  }
}

/**
 * Update conversation title
 * @param {string} teacherId - Teacher ID
 * @param {string} conversationId - Conversation ID
 * @param {string} title - New title
 * @returns {Promise<void>}
 */
export async function updateConversationTitle(teacherId, conversationId, title) {
  try {
    const conversationRef = doc(db, 'conversations', teacherId, 'userConversations', conversationId);
    const snapshot = await getDoc(conversationRef);

    if (!snapshot.exists()) {
      throw new Error('Conversation not found');
    }

    const conversation = snapshot.data();
    await setDoc(conversationRef, {
      ...conversation,
      title: title,
      updatedAt: Date.now()
    });

    console.log('Updated conversation title:', conversationId);
  } catch (error) {
    console.error('Error updating conversation title:', error);
    throw error;
  }
}

/**
 * Delete a conversation
 * @param {string} teacherId - Teacher ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
export async function deleteConversation(teacherId, conversationId) {
  try {
    const conversationRef = doc(db, 'conversations', teacherId, 'userConversations', conversationId);
    await setDoc(conversationRef, { deleted: true, deletedAt: Date.now() });

    console.log('Deleted conversation:', conversationId);
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
}

/**
 * Listen to conversations in real-time
 * @param {string} teacherId - Teacher ID
 * @param {Function} callback - Callback function called with updated conversations
 * @returns {Function} Unsubscribe function
 */
export function listenToConversations(teacherId, callback) {
  const conversationsRef = collection(db, 'conversations', teacherId, 'userConversations');
  const q = query(conversationsRef, orderBy('updatedAt', 'desc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback([]);
      return;
    }

    const conversations = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Filter out deleted conversations
      if (!data.deleted) {
        conversations.push({
          id: doc.id,
          ...data
        });
      }
    });

    callback(conversations);
  }, (error) => {
    console.error('Error listening to conversations:', error);
  });

  return unsubscribe;
}

/**
 * Listen to grades for a class in real-time
 * @param {string} classId - Class ID
 * @param {string} teacherId - Teacher ID (for filtering)
 * @param {Function} callback - Callback function called with updated grades
 * @returns {Function} Unsubscribe function
 */
export function listenToGradesByClass(classId, teacherId, callback) {
  const gradesRef = collection(db, 'grades');
  const gradesQuery = query(
    gradesRef,
    where('classId', '==', classId),
    where('teacherId', '==', teacherId),
    orderBy('gradedAt', 'desc')
  );

  const unsubscribe = onSnapshot(gradesQuery, (snapshot) => {
    if (snapshot.empty) {
      callback([]);
      return;
    }

    const grades = [];
    snapshot.forEach((doc) => {
      grades.push({
        id: doc.id,
        ...doc.data()
      });
    });

    callback(grades);
  }, (error) => {
    console.error('Error listening to grades:', error);
  });

  return unsubscribe;
}

/**
 * Update class analytics with new grade data
 * @param {string} classId - Class ID
 * @param {Object} gradeData - Grade data
 * @param {string} studentId - Student ID (optional but recommended)
 * @param {string} studentName - Student Name (optional but recommended)
 * @returns {Promise<void>}
 */
export async function updateClassAnalytics(classId, gradeData, studentId = null, studentName = null) {
  try {
    const classRef = doc(db, 'classAnalytics', classId);

    await runTransaction(db, async (transaction) => {
      const classDoc = await transaction.get(classRef);

      let newData;
      // Calculate percentage for the current grade
      const currentPercentage = (gradeData.overallScore / gradeData.totalPoints) * 100;

      if (!classDoc.exists()) {
        newData = {
          averageGrade: currentPercentage,
          totalAssignments: 1,
          lastUpdated: Date.now(),
          commonStrugglingTopics: {},
          studentPerformances: {}
        };

        // Initialize struggling topics
        if (gradeData.strugglingTopics && Array.isArray(gradeData.strugglingTopics)) {
          gradeData.strugglingTopics.forEach(topic => {
            newData.commonStrugglingTopics[topic] = 1;
          });
        }

        // Initialize student performance if student info provided
        if (studentId && studentName) {
          newData.studentPerformances[studentId] = {
            name: studentName,
            averageScore: currentPercentage,
            totalAssignments: 1
          };
        }
      } else {
        const data = classDoc.data();
        const oldTotal = data.totalAssignments || 0;
        const oldAvg = data.averageGrade || 0;
        const newTotal = oldTotal + 1;
        // Update average using the percentage
        const newAvg = ((oldAvg * oldTotal) + currentPercentage) / newTotal;

        newData = {
          ...data,
          averageGrade: newAvg,
          totalAssignments: newTotal,
          lastUpdated: Date.now()
        };

        // Update struggling topics
        if (gradeData.strugglingTopics && Array.isArray(gradeData.strugglingTopics)) {
          const topics = data.commonStrugglingTopics || {};
          gradeData.strugglingTopics.forEach(topic => {
            topics[topic] = (topics[topic] || 0) + 1;
          });
          newData.commonStrugglingTopics = topics;
        }

        // Update student performance if student info provided
        if (studentId && studentName) {
          const performances = data.studentPerformances || {};
          const studentPerf = performances[studentId] || {
            name: studentName,
            averageScore: 0,
            totalAssignments: 0
          };

          const sOldTotal = studentPerf.totalAssignments || 0;
          const sOldAvg = studentPerf.averageScore || 0;
          const sNewTotal = sOldTotal + 1;
          const sNewAvg = ((sOldAvg * sOldTotal) + currentPercentage) / sNewTotal;

          performances[studentId] = {
            name: studentName,
            averageScore: sNewAvg,
            totalAssignments: sNewTotal
          };

          newData.studentPerformances = performances;
        }
      }

      transaction.set(classRef, newData);
    });
    console.log('Successfully updated class analytics');
  } catch (error) {
    console.error('Error updating class analytics:', error);
    // Don't throw to avoid blocking the main save flow
  }
}

/**
 * Update student analytics with new grade data
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {Object} gradeData - Grade data
 * @returns {Promise<void>}
 */
export async function updateStudentAnalytics(studentId, classId, gradeData) {
  try {
    const studentRef = doc(db, 'studentAnalytics', studentId, 'classes', classId);

    await runTransaction(db, async (transaction) => {
      const studentDoc = await transaction.get(studentRef);

      let newData;
      const assignmentEntry = {
        assignmentId: gradeData.assignmentId,
        assignmentName: gradeData.assignmentName,
        score: gradeData.overallScore,
        totalPoints: gradeData.totalPoints,
        gradedAt: Date.now(),
        strugglingTopics: gradeData.strugglingTopics || []
      };

      // Calculate percentage for the current grade
      const currentPercentage = (gradeData.overallScore / gradeData.totalPoints) * 100;

      if (!studentDoc.exists()) {
        newData = {
          averageScore: currentPercentage,
          totalAssignments: 1,
          lastUpdated: Date.now(),
          strugglingTopics: {},
          assignmentHistory: [assignmentEntry]
        };

        if (gradeData.strugglingTopics && Array.isArray(gradeData.strugglingTopics)) {
          gradeData.strugglingTopics.forEach(topic => {
            newData.strugglingTopics[topic] = {
              count: 1,
              assignments: [gradeData.assignmentId]
            };
          });
        }
      } else {
        const data = studentDoc.data();
        const oldTotal = data.totalAssignments || 0;
        const oldAvg = data.averageScore || 0;
        const newTotal = oldTotal + 1;
        const newAvg = ((oldAvg * oldTotal) + currentPercentage) / newTotal;

        newData = {
          ...data,
          averageScore: newAvg,
          totalAssignments: newTotal,
          lastUpdated: Date.now(),
          assignmentHistory: [...(data.assignmentHistory || []), assignmentEntry]
        };

        if (gradeData.strugglingTopics && Array.isArray(gradeData.strugglingTopics)) {
          const topics = data.strugglingTopics || {};
          gradeData.strugglingTopics.forEach(topic => {
            if (!topics[topic]) {
              topics[topic] = { count: 0, assignments: [] };
            }
            topics[topic].count += 1;
            if (!topics[topic].assignments.includes(gradeData.assignmentId)) {
              topics[topic].assignments.push(gradeData.assignmentId);
            }
          });
          newData.strugglingTopics = topics;
        }
      }

      transaction.set(studentRef, newData);
    });
    console.log('Successfully updated student analytics');
  } catch (error) {
    console.error('Error updating student analytics:', error);
  }
}



/**
 * Get class analytics
 * @param {string} classId - Class ID
 * @returns {Promise<Object|null>} Class analytics data or null
 */
export async function getClassAnalytics(classId) {
  try {
    const classRef = doc(db, 'classAnalytics', classId);
    const snapshot = await getDoc(classRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  } catch (error) {
    console.error('Error fetching class analytics:', error);
    throw error;
  }
}

/**
 * Get student analytics for a specific class
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @returns {Promise<Object|null>} Student analytics data or null
 */
export async function getStudentAnalytics(studentId, classId) {
  try {
    const studentRef = doc(db, 'studentAnalytics', studentId, 'classes', classId);
    const snapshot = await getDoc(studentRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  } catch (error) {
    console.error('Error fetching student analytics:', error);
    throw error;
  }
}

/**
 * Get teacher settings
 * @param {string} teacherId - Teacher ID
 * @returns {Promise<Object>} Teacher settings object
 */
export async function getTeacherSettings(teacherId) {
  try {
    const settingsRef = doc(db, 'teacherSettings', teacherId);
    const snapshot = await getDoc(settingsRef);

    if (!snapshot.exists()) {
      // Return default settings
      return {
        gradeThresholds: {
          needsSupport: 80 // B-
        }
      };
    }

    return snapshot.data();
  } catch (error) {
    console.error('Error fetching teacher settings:', error);
    // Return defaults on error
    return {
      gradeThresholds: {
        needsSupport: 80
      }
    };
  }
}

/**
 * Save teacher settings
 * @param {string} teacherId - Teacher ID
 * @param {Object} settings - Settings object
 * @returns {Promise<void>}
 */
export async function saveTeacherSettings(teacherId, settings) {
  try {
    const settingsRef = doc(db, 'teacherSettings', teacherId);
    await setDoc(settingsRef, settings, { merge: true });
    console.log('Successfully saved teacher settings');
  } catch (error) {
    console.error('Error saving teacher settings:', error);
    throw error;
  }
}

export { auth, db };
