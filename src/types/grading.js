/**
 * Type definitions for grading functionality
 * These match the schemas defined in planning/ai_prompts_and_schemas.md
 */

/**
 * @typedef {Object} GradedQuestion
 * @property {number} questionNumber - The question number
 * @property {string} questionText - The text of the question
 * @property {string} studentAnswer - The student's answer
 * @property {string} correctAnswer - The correct answer
 * @property {boolean} isCorrect - Whether the answer is correct
 * @property {number} pointsAwarded - Points awarded for this question
 * @property {number} pointsPossible - Maximum points possible for this question
 * @property {string} feedback - Feedback for the student
 * @property {string} topic - The topic/concept being tested
 */

/**
 * @typedef {Object} GradingResult
 * @property {number} overallScore - The overall score
 * @property {number} totalPoints - Total points possible
 * @property {string[]} strugglingTopics - List of topics the student struggled with
 * @property {GradedQuestion[]} questions - Array of graded questions
 */

/**
 * @typedef {Object} QuestionInput
 * @property {number} questionNumber - The question number
 * @property {string} questionText - The text of the question
 * @property {string} studentAnswer - The student's answer
 * @property {number} pointsPossible - Maximum points possible
 */

/**
 * @typedef {Object} GradingInput
 * @property {string} worksheetUrl - URL to the worksheet PDF or image
 * @property {string} studentName - Name of the student
 * @property {string} assignmentName - Name of the assignment
 * @property {QuestionInput[]} questions - Array of questions to grade
 */

/**
 * Tool definition for Vertex AI (Gemini) structured output
 */
export const GRADING_TOOL = {
  name: "grade_worksheet",
  description: "Grade a student worksheet and return structured grading results with feedback for each question.",
  input_schema: {
    type: "object",
    properties: {
      overallScore: {
        type: "number",
        description: "The overall score (sum of points awarded)"
      },
      totalPoints: {
        type: "number",
        description: "Total points possible (sum of all pointsPossible)"
      },
      strugglingTopics: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of topics the student struggled with (from questions that were incorrect or partially correct)"
      },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionNumber: {
              type: "number",
              description: "The question number"
            },
            questionText: {
              type: "string",
              description: "The text of the question"
            },
            studentAnswer: {
              type: "string",
              description: "The student's answer"
            },
            correctAnswer: {
              type: "string",
              description: "The correct answer"
            },
            isCorrect: {
              type: "boolean",
              description: "Whether the answer is fully correct (true), incorrect (false), or partially correct (false with some points awarded)"
            },
            pointsAwarded: {
              type: "number",
              description: "Points awarded for this question (can be partial)"
            },
            pointsPossible: {
              type: "number",
              description: "Maximum points possible for this question"
            },
            feedback: {
              type: "string",
              description: "Specific, actionable feedback for the student. Be encouraging and constructive."
            },
            topic: {
              type: "string",
              description: "The topic/concept being tested (e.g., 'linear equations', 'fractions', 'word problems')"
            }
          },
          required: ["questionNumber", "questionText", "studentAnswer", "correctAnswer", "isCorrect", "pointsAwarded", "pointsPossible", "feedback", "topic"]
        },
        description: "Array of graded questions with feedback"
      }
    },
    required: ["overallScore", "totalPoints", "strugglingTopics", "questions"]
  }
};
