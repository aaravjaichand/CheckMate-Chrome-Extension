/**
 * Firebase configuration and Firestore operations
 */

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
  runTransaction,
  updateDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Sign in to Firebase using Google OAuth tokens
 * @param {string} idToken - The OAuth ID token
 * @param {string} accessToken - The OAuth access token (optional)
 * @returns {Promise<Object>} Firebase user data
 */
export async function signInWithGoogleToken(idToken, accessToken = null) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const userCredential = await signInWithCredential(auth, credential);

  return {
    uid: userCredential.user.uid,
    email: userCredential.user.email,
    displayName: userCredential.user.displayName,
    photoURL: userCredential.user.photoURL
  };
}

/**
 * Sign out from Firebase
 */
export async function signOutFromFirebase() {
  await auth.signOut();
}

/**
 * Save AI grading result to database
 * @param {Object} aiResultData - AI grading result data
 * @returns {Promise<string>} The generated aiResultId
 */
export async function saveAIGradingResult(aiResultData) {
  const aiResultsRef = collection(db, 'aiGradingResults');
  const docRef = await addDoc(aiResultsRef, {
    ...aiResultData,
    generatedAt: Date.now()
  });
  return docRef.id;
}

/**
 * Save grade to database
 * @param {Object} gradeData - Grade data
 * @returns {Promise<string>} The generated gradeId
 */
export async function saveGrade(gradeData) {
  const gradesRef = collection(db, 'grades');
  const docRef = await addDoc(gradesRef, {
    ...gradeData,
    gradedAt: Date.now()
  });
  return docRef.id;
}

/**
 * Save struggling topics for a student
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {string} assignmentId - Assignment ID
 * @param {Object} topicsData - Topics data
 */
export async function saveStrugglingTopics(studentId, classId, assignmentId, topicsData) {
  const topicsRef = doc(db, 'strugglingTopics', studentId, 'classes', classId, 'assignments', assignmentId);
  await setDoc(topicsRef, {
    ...topicsData,
    gradedAt: Date.now()
  });
}

/**
 * Create a new conversation
 * @param {string} teacherId - Teacher ID
 * @returns {Promise<string>} The generated conversationId
 */
export async function createConversation(teacherId) {
  const conversationsRef = collection(db, 'conversations', teacherId, 'userConversations');
  const docRef = await addDoc(conversationsRef, {
    title: 'New Conversation',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  return docRef.id;
}

/**
 * Get all conversations for a teacher
 * @param {string} teacherId - Teacher ID
 * @returns {Promise<Array>} Array of conversation objects
 */
export async function getConversations(teacherId) {
  const conversationsRef = collection(db, 'conversations', teacherId, 'userConversations');
  const q = query(conversationsRef, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return [];

  const conversations = [];
  snapshot.forEach((doc) => {
    conversations.push({ id: doc.id, ...doc.data() });
  });
  return conversations;
}

/**
 * Get a specific conversation
 * @param {string} teacherId - Teacher ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Conversation object or null
 */
export async function getConversation(teacherId, conversationId) {
  const conversationRef = doc(db, 'conversations', teacherId, 'userConversations', conversationId);
  const snapshot = await getDoc(conversationRef);

  if (!snapshot.exists()) return null;

  return { id: conversationId, ...snapshot.data() };
}

/**
 * Add a message to a conversation
 * @param {string} teacherId - Teacher ID
 * @param {string} conversationId - Conversation ID
 * @param {Object} message - Message object { role, content }
 * @param {string} title - Optional conversation title
 */
export async function addMessageToConversation(teacherId, conversationId, message, title = null) {
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

  const updateData = {
    messages: updatedMessages,
    updatedAt: Date.now()
  };

  if (title && conversation.title === 'New Conversation') {
    updateData.title = title;
  }

  await setDoc(conversationRef, { ...conversation, ...updateData });
}

/**
 * Update conversation title
 * @param {string} teacherId - Teacher ID
 * @param {string} conversationId - Conversation ID
 * @param {string} title - New title
 */
export async function updateConversationTitle(teacherId, conversationId, title) {
  const conversationRef = doc(db, 'conversations', teacherId, 'userConversations', conversationId);
  const snapshot = await getDoc(conversationRef);

  if (!snapshot.exists()) {
    throw new Error('Conversation not found');
  }

  await updateDoc(conversationRef, {
    title,
    updatedAt: Date.now()
  });
}

/**
 * Delete a conversation (soft delete)
 * @param {string} teacherId - Teacher ID
 * @param {string} conversationId - Conversation ID
 */
export async function deleteConversation(teacherId, conversationId) {
  const conversationRef = doc(db, 'conversations', teacherId, 'userConversations', conversationId);
  await setDoc(conversationRef, { deleted: true, deletedAt: Date.now() });
}

/**
 * Listen to conversations in real-time
 * @param {string} teacherId - Teacher ID
 * @param {Function} callback - Callback with updated conversations
 * @returns {Function} Unsubscribe function
 */
export function listenToConversations(teacherId, callback) {
  const conversationsRef = collection(db, 'conversations', teacherId, 'userConversations');
  const q = query(conversationsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback([]);
      return;
    }

    const conversations = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.deleted) {
        conversations.push({ id: doc.id, ...data });
      }
    });
    callback(conversations);
  }, (error) => {
    // Firestore listener error - typically network related, will auto-retry
    console.warn('Firestore conversations listener error (will auto-retry):', error?.code || 'unknown');
  });
}

/**
 * Listen to grades for a class in real-time
 * @param {string} classId - Class ID
 * @param {string} teacherId - Teacher ID
 * @param {Function} callback - Callback with updated grades
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

  return onSnapshot(gradesQuery, (snapshot) => {
    if (snapshot.empty) {
      callback([]);
      return;
    }

    const grades = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Filter out deleted grades
      if (!data.deleted) {
        grades.push({ id: doc.id, ...data });
      }
    });
    callback(grades);
  }, (error) => {
    // Firestore listener error - typically network related, will auto-retry
    console.warn('Firestore grades listener error (will auto-retry):', error?.code || 'unknown');
  });
}

/**
 * Update class analytics with new grade data
 * @param {string} classId - Class ID
 * @param {Object} gradeData - Grade data
 * @param {string} studentId - Student ID
 * @param {string} studentName - Student Name
 */
export async function updateClassAnalytics(classId, gradeData, studentId = null, studentName = null) {
  const classRef = doc(db, 'classAnalytics', classId);

  await runTransaction(db, async (transaction) => {
    const classDoc = await transaction.get(classRef);
    const currentPercentage = (gradeData.overallScore / gradeData.totalPoints) * 100;

    let newData;

    if (!classDoc.exists()) {
      newData = {
        averageGrade: currentPercentage,
        totalAssignments: 1,
        lastUpdated: Date.now(),
        commonStrugglingTopics: {},
        studentPerformances: {}
      };

      if (gradeData.strugglingTopics?.length) {
        gradeData.strugglingTopics.forEach(topic => {
          // Normalize topic key to lowercase to prevent duplicates
          const normalizedTopic = topic.toLowerCase().trim();
          newData.commonStrugglingTopics[normalizedTopic] = 1;
        });
      }

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
      const newAvg = ((oldAvg * oldTotal) + currentPercentage) / newTotal;

      newData = {
        ...data,
        averageGrade: newAvg,
        totalAssignments: newTotal,
        lastUpdated: Date.now()
      };

      if (gradeData.strugglingTopics?.length) {
        const topics = data.commonStrugglingTopics || {};
        gradeData.strugglingTopics.forEach(topic => {
          // Normalize topic key to lowercase to prevent duplicates
          const normalizedTopic = topic.toLowerCase().trim();
          topics[normalizedTopic] = (topics[normalizedTopic] || 0) + 1;
        });
        newData.commonStrugglingTopics = topics;
      }

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
}

/**
 * Update student analytics with new grade data
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {Object} gradeData - Grade data
 */
export async function updateStudentAnalytics(studentId, classId, gradeData) {
  const studentRef = doc(db, 'studentAnalytics', studentId, 'classes', classId);

  await runTransaction(db, async (transaction) => {
    const studentDoc = await transaction.get(studentRef);
    const currentPercentage = (gradeData.overallScore / gradeData.totalPoints) * 100;

    const assignmentEntry = {
      assignmentId: gradeData.assignmentId,
      assignmentName: gradeData.assignmentName,
      score: gradeData.overallScore,
      totalPoints: gradeData.totalPoints,
      gradedAt: Date.now(),
      strugglingTopics: gradeData.strugglingTopics || []
    };

    let newData;

    if (!studentDoc.exists()) {
      newData = {
        averageScore: currentPercentage,
        totalAssignments: 1,
        lastUpdated: Date.now(),
        strugglingTopics: {},
        assignmentHistory: [assignmentEntry]
      };

      if (gradeData.strugglingTopics?.length) {
        gradeData.strugglingTopics.forEach(topic => {
          // Normalize topic key to lowercase to prevent duplicates
          const normalizedTopic = topic.toLowerCase().trim();
          newData.strugglingTopics[normalizedTopic] = {
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

      if (gradeData.strugglingTopics?.length) {
        const topics = data.strugglingTopics || {};
        gradeData.strugglingTopics.forEach(topic => {
          // Normalize topic key to lowercase to prevent duplicates
          const normalizedTopic = topic.toLowerCase().trim();
          if (!topics[normalizedTopic]) {
            topics[normalizedTopic] = { count: 0, assignments: [] };
          }
          topics[normalizedTopic].count += 1;
          if (!topics[normalizedTopic].assignments.includes(gradeData.assignmentId)) {
            topics[normalizedTopic].assignments.push(gradeData.assignmentId);
          }
        });
        newData.strugglingTopics = topics;
      }
    }

    transaction.set(studentRef, newData);
  });
}

/**
 * Get class analytics
 * @param {string} classId - Class ID
 * @returns {Promise<Object|null>} Class analytics data or null
 */
export async function getClassAnalytics(classId) {
  const classRef = doc(db, 'classAnalytics', classId);
  const snapshot = await getDoc(classRef);
  return snapshot.exists() ? snapshot.data() : null;
}

/**
 * Get student analytics for a specific class
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @returns {Promise<Object|null>} Student analytics data or null
 */
export async function getStudentAnalytics(studentId, classId) {
  const studentRef = doc(db, 'studentAnalytics', studentId, 'classes', classId);
  const snapshot = await getDoc(studentRef);
  return snapshot.exists() ? snapshot.data() : null;
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
    return snapshot.exists() ? snapshot.data() : { gradeThresholds: { needsSupport: 80 } };
  } catch {
    return { gradeThresholds: { needsSupport: 80 } };
  }
}

/**
 * Save teacher settings
 * @param {string} teacherId - Teacher ID
 * @param {Object} settings - Settings object
 */
export async function saveTeacherSettings(teacherId, settings) {
  const settingsRef = doc(db, 'teacherSettings', teacherId);
  await setDoc(settingsRef, settings, { merge: true });
}

/**
 * Delete a grade (soft delete)
 * @param {string} gradeId - Grade ID
 */
export async function deleteGrade(gradeId) {
  const gradeRef = doc(db, 'grades', gradeId);
  await updateDoc(gradeRef, { deleted: true, deletedAt: Date.now() });
}

/**
 * Get all non-deleted grades for a class
 * @param {string} classId - Class ID
 * @param {string} teacherId - Teacher ID
 * @returns {Promise<Array>} Array of grade objects
 */
async function getActiveGradesForClass(classId, teacherId) {
  const gradesRef = collection(db, 'grades');
  const gradesQuery = query(
    gradesRef,
    where('classId', '==', classId),
    where('teacherId', '==', teacherId)
  );
  const snapshot = await getDocs(gradesQuery);

  const grades = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.deleted) {
      grades.push({ id: doc.id, ...data });
    }
  });
  return grades;
}

/**
 * Recalculate class analytics from all non-deleted grades
 * @param {string} classId - Class ID
 * @param {string} teacherId - Teacher ID
 */
export async function recalculateClassAnalytics(classId, teacherId) {
  const grades = await getActiveGradesForClass(classId, teacherId);
  const classRef = doc(db, 'classAnalytics', classId);

  if (grades.length === 0) {
    // No grades left, reset analytics
    await setDoc(classRef, {
      averageGrade: 0,
      totalAssignments: 0,
      lastUpdated: Date.now(),
      commonStrugglingTopics: {},
      studentPerformances: {}
    });
    return;
  }

  // Calculate new analytics from scratch
  let totalPercentage = 0;
  const commonStrugglingTopics = {};
  const studentPerformances = {};

  for (const grade of grades) {
    const percentage = (grade.overallScore / grade.totalPoints) * 100;
    totalPercentage += percentage;

    // Aggregate struggling topics
    if (grade.strugglingTopics?.length) {
      grade.strugglingTopics.forEach(topic => {
        const normalizedTopic = topic.toLowerCase().trim();
        commonStrugglingTopics[normalizedTopic] = (commonStrugglingTopics[normalizedTopic] || 0) + 1;
      });
    }

    // Aggregate student performances
    if (grade.studentId && grade.studentName) {
      if (!studentPerformances[grade.studentId]) {
        studentPerformances[grade.studentId] = {
          name: grade.studentName,
          totalScore: 0,
          totalAssignments: 0
        };
      }
      studentPerformances[grade.studentId].totalScore += percentage;
      studentPerformances[grade.studentId].totalAssignments += 1;
    }
  }

  // Calculate averages for student performances
  for (const studentId in studentPerformances) {
    const perf = studentPerformances[studentId];
    studentPerformances[studentId] = {
      name: perf.name,
      averageScore: perf.totalScore / perf.totalAssignments,
      totalAssignments: perf.totalAssignments
    };
  }

  await setDoc(classRef, {
    averageGrade: totalPercentage / grades.length,
    totalAssignments: grades.length,
    lastUpdated: Date.now(),
    commonStrugglingTopics,
    studentPerformances
  });
}

/**
 * Recalculate student analytics from all non-deleted grades
 * @param {string} studentId - Student ID
 * @param {string} classId - Class ID
 * @param {string} teacherId - Teacher ID
 */
export async function recalculateStudentAnalytics(studentId, classId, teacherId) {
  const allGrades = await getActiveGradesForClass(classId, teacherId);
  const studentGrades = allGrades.filter(g => g.studentId === studentId);
  const studentRef = doc(db, 'studentAnalytics', studentId, 'classes', classId);

  if (studentGrades.length === 0) {
    // No grades left for this student, reset analytics
    await setDoc(studentRef, {
      averageScore: 0,
      totalAssignments: 0,
      lastUpdated: Date.now(),
      strugglingTopics: {},
      assignmentHistory: []
    });
    return;
  }

  // Calculate new analytics from scratch
  let totalPercentage = 0;
  const strugglingTopics = {};
  const assignmentHistory = [];

  for (const grade of studentGrades) {
    const percentage = (grade.overallScore / grade.totalPoints) * 100;
    totalPercentage += percentage;

    // Build assignment history entry
    assignmentHistory.push({
      assignmentId: grade.assignmentId,
      assignmentName: grade.assignmentName,
      score: grade.overallScore,
      totalPoints: grade.totalPoints,
      gradedAt: grade.gradedAt,
      strugglingTopics: grade.strugglingTopics || []
    });

    // Aggregate struggling topics
    if (grade.strugglingTopics?.length) {
      grade.strugglingTopics.forEach(topic => {
        const normalizedTopic = topic.toLowerCase().trim();
        if (!strugglingTopics[normalizedTopic]) {
          strugglingTopics[normalizedTopic] = { count: 0, assignments: [] };
        }
        strugglingTopics[normalizedTopic].count += 1;
        if (!strugglingTopics[normalizedTopic].assignments.includes(grade.assignmentId)) {
          strugglingTopics[normalizedTopic].assignments.push(grade.assignmentId);
        }
      });
    }
  }

  // Sort assignment history by gradedAt
  assignmentHistory.sort((a, b) => a.gradedAt - b.gradedAt);

  await setDoc(studentRef, {
    averageScore: totalPercentage / studentGrades.length,
    totalAssignments: studentGrades.length,
    lastUpdated: Date.now(),
    strugglingTopics,
    assignmentHistory
  });
}

export { auth, db };
