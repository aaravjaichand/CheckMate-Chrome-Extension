/**
 * Embedding utilities using Gemini text-embedding-004
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Generate an embedding vector for the given text using Gemini
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} 768-dimensional embedding vector
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text is required for embedding generation');
  }

  // Truncate very long texts (embedding model has token limits)
  const truncatedText = text.slice(0, 10000);

  const url = `${EMBEDDING_API_URL}/${EMBEDDING_MODEL}:embedContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text: truncatedText }]
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const embedding = result.embedding?.values;

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Invalid embedding response: missing values array');
  }

  return embedding;
}

/**
 * Compute cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} Similarity score between -1 and 1
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    throw new Error('Vectors must be non-null and have equal length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Search for similar documents based on embedding similarity
 * @param {number[]} queryEmbedding - The query embedding vector
 * @param {Array<{embedding: number[], content: string, metadata: Object}>} documents - Documents to search
 * @param {number} topK - Number of top results to return (default: 10)
 * @returns {Array<{content: string, metadata: Object, score: number}>} Top K similar documents with scores
 */
export function searchSimilar(queryEmbedding, documents, topK = 10) {
  if (!queryEmbedding || !Array.isArray(documents)) {
    return [];
  }

  // Calculate similarity scores for all documents
  const scoredDocs = documents
    .filter(doc => doc.embedding && Array.isArray(doc.embedding))
    .map(doc => ({
      content: doc.content,
      metadata: doc.metadata,
      type: doc.type,
      studentId: doc.studentId,
      classId: doc.classId,
      lessonPlanId: doc.lessonPlanId, // Include lessonPlanId for lesson plan documents
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    }));

  // Sort by score descending and return top K
  return scoredDocs
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Generate a text summary for a student's grade that can be embedded
 * @param {Object} gradeData - Grade data object
 * @returns {string} Text summary for embedding
 */
export function generateStudentSummary(gradeData) {
  const percentage = ((gradeData.overallScore / gradeData.totalPoints) * 100).toFixed(1);
  
  let summary = `Student ${gradeData.studentName} in assignment "${gradeData.assignmentName}" scored ${gradeData.overallScore}/${gradeData.totalPoints} (${percentage}%).`;
  
  if (gradeData.strongTopics?.length) {
    summary += ` Strong topics: ${gradeData.strongTopics.join(', ')}.`;
  }

  if (gradeData.strugglingTopics?.length) {
    summary += ` Struggling topics: ${gradeData.strugglingTopics.join(', ')}.`;
  }
  
  if (gradeData.questions?.length) {
    const incorrectQuestions = gradeData.questions.filter(q => q.pointsAwarded < q.pointsPossible);
    if (incorrectQuestions.length > 0) {
      const questionSummaries = incorrectQuestions.slice(0, 3).map(q => {
        const topic = q.topic || 'general';
        return `${topic} (${q.pointsAwarded}/${q.pointsPossible})`;
      });
      summary += ` Questions missed: ${questionSummaries.join('; ')}.`;
    }
  }
  
  return summary;
}

/**
 * Generate a class-level summary text for embedding
 * @param {Object} classData - Class analytics data
 * @param {string} className - Name of the class
 * @returns {string} Text summary for embedding
 */
export function generateClassSummary(classData, className) {
  let summary = `Class "${className}" has an average grade of ${classData.averageGrade?.toFixed(1) || 0}% across ${classData.totalAssignments || 0} graded assignments.`;
  
  // Add strong topics
  if (classData.commonStrongTopics && Object.keys(classData.commonStrongTopics).length > 0) {
    const topStrongTopics = Object.entries(classData.commonStrongTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => `${topic} (${count} students)`);
    summary += ` Common strong topics: ${topStrongTopics.join(', ')}.`;
  }

  // Add struggling topics
  if (classData.commonStrugglingTopics && Object.keys(classData.commonStrugglingTopics).length > 0) {
    const topTopics = Object.entries(classData.commonStrugglingTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => `${topic} (${count} students)`);
    summary += ` Common struggling topics: ${topTopics.join(', ')}.`;
  }
  
  // Add student performance summary
  if (classData.studentPerformances && Object.keys(classData.studentPerformances).length > 0) {
    const students = Object.values(classData.studentPerformances);
    const needsSupport = students.filter(s => s.averageScore < 70);
    if (needsSupport.length > 0) {
      const names = needsSupport.slice(0, 5).map(s => `${s.name} (${s.averageScore.toFixed(1)}%)`);
      summary += ` Students needing support: ${names.join(', ')}.`;
    }
  }
  
  return summary;
}

/**
 * Generate a lesson plan summary text for embedding
 * @param {Object} lessonPlan - Lesson plan object with title, overview, objectives, etc.
 * @param {string} className - Name of the class this lesson plan is for
 * @returns {string} Text summary for embedding
 */
export function generateLessonPlanSummary(lessonPlan, className) {
  let summary = `Lesson plan "${lessonPlan.title}" for class "${className}".`;
  
  // Add duration
  if (lessonPlan.duration) {
    summary += ` Duration: ${lessonPlan.duration}.`;
  }
  
  // Add overview
  if (lessonPlan.overview) {
    summary += ` Overview: ${lessonPlan.overview}`;
  }
  
  // Add learning objectives
  if (lessonPlan.objectives?.length > 0) {
    summary += ` Learning objectives: ${lessonPlan.objectives.join('; ')}.`;
  }
  
  // Add activity names to help with searching
  if (lessonPlan.activities?.length > 0) {
    const activityNames = lessonPlan.activities.map(a => a.name).join(', ');
    summary += ` Activities include: ${activityNames}.`;
  }
  
  // Add differentiation strategies (helpful for finding plans for struggling students)
  if (lessonPlan.differentiation) {
    if (lessonPlan.differentiation.struggling) {
      summary += ` For struggling students: ${lessonPlan.differentiation.struggling}`;
    }
    if (lessonPlan.differentiation.advanced) {
      summary += ` For advanced students: ${lessonPlan.differentiation.advanced}`;
    }
  }
  
  // Add assessment info
  if (lessonPlan.assessment) {
    summary += ` Assessment: ${lessonPlan.assessment}`;
  }
  
  return summary;
}
