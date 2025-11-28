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
