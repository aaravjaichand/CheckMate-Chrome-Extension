import { useState } from 'react';
import { Check, X, Edit2, Save } from 'lucide-react';

/**
 * Component to display and edit grading results
 * @param {Object} props
 * @param {Object} props.gradingResult - The grading result from AI (matches GradingResult type)
 * @param {Function} props.onResultsChange - Callback when results are edited
 */
export default function GradingResults({ gradingResult, onResultsChange }) {
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editedResults, setEditedResults] = useState(gradingResult);

  // Validate and sanitize the grading result on mount/change
  if (!editedResults || typeof editedResults !== 'object') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error: Invalid grading results format</p>
        <p className="text-sm mt-1">The grading data could not be parsed. Please try grading again.</p>
      </div>
    );
  }

  // Ensure required fields exist and are valid
  const safeResults = {
    overallScore: typeof editedResults.overallScore === 'number' ? editedResults.overallScore : 0,
    totalPoints: typeof editedResults.totalPoints === 'number' ? editedResults.totalPoints : 0,
    questions: Array.isArray(editedResults.questions) ? editedResults.questions : [],
    strugglingTopics: Array.isArray(editedResults.strugglingTopics) ? editedResults.strugglingTopics : []
  };

  // Calculate percentage safely
  const calculatePercentage = () => {
    if (safeResults.totalPoints === 0 || safeResults.totalPoints === undefined || isNaN(safeResults.totalPoints)) {
      return 0;
    }
    const percentage = (safeResults.overallScore / safeResults.totalPoints) * 100;
    return isNaN(percentage) ? 0 : Math.round(percentage);
  };

  // Handle editing a specific field of a question
  const handleQuestionEdit = (questionIndex, field, value) => {
    const updatedQuestions = [...editedResults.questions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      [field]: value
    };

    // Recalculate overall score if points change
    let newOverallScore = editedResults.overallScore;
    if (field === 'pointsAwarded') {
      newOverallScore = updatedQuestions.reduce((sum, q) => sum + (typeof q.pointsAwarded === 'number' ? q.pointsAwarded : 0), 0);
    }

    const newResults = {
      ...editedResults,
      questions: updatedQuestions,
      overallScore: newOverallScore
    };

    setEditedResults(newResults);
    onResultsChange(newResults);
  };

  // Handle editing overall score directly
  const handleOverallScoreEdit = (value) => {
    const numValue = parseFloat(value) || 0;
    const newResults = {
      ...editedResults,
      overallScore: numValue
    };
    setEditedResults(newResults);
    onResultsChange(newResults);
  };

  const toggleEditQuestion = (index) => {
    setEditingQuestionId(editingQuestionId === index ? null : index);
  };

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Overall Score</div>
          <input
            type="number"
            value={safeResults.overallScore}
            onChange={(e) => handleOverallScoreEdit(e.target.value)}
            className="text-4xl font-bold text-gray-900 text-center w-24 border-b-2 border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none"
            step="0.5"
          />
          <span className="text-4xl font-bold text-gray-900"> / {safeResults.totalPoints}</span>
          <div className="text-lg text-gray-700 mt-2">
            {calculatePercentage()}%
          </div>
        </div>
      </div>

      {/* Struggling Topics */}
      {safeResults.strugglingTopics && safeResults.strugglingTopics.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-sm font-medium text-gray-700 mb-2">Struggling Topics:</div>
          <div className="flex flex-wrap gap-2">
            {safeResults.strugglingTopics.map((topic, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-700">
          Questions ({safeResults.questions.length})
        </div>

        {safeResults.questions.map((question, index) => (
          <div
            key={index}
            className={`border rounded-lg p-4 ${
              question.isCorrect
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {/* Question Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">Q{question.questionNumber}</span>
                {question.isCorrect ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <X className="w-4 h-4 text-red-600" />
                )}
                <span className="text-xs px-2 py-0.5 bg-white rounded border border-gray-200">
                  {question.topic}
                </span>
              </div>
              <button
                onClick={() => toggleEditQuestion(index)}
                className="p-1 hover:bg-white rounded transition-colors"
                title={editingQuestionId === index ? 'Done editing' : 'Edit question'}
              >
                {editingQuestionId === index ? (
                  <Save className="w-4 h-4 text-blue-600" />
                ) : (
                  <Edit2 className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>

            {/* Question Text */}
            <div className="text-sm text-gray-700 mb-2">
              <span className="font-medium">Question: </span>
              {question.questionText}
            </div>

            {/* Student Answer */}
            <div className="text-sm text-gray-700 mb-2">
              <span className="font-medium">Student Answer: </span>
              {question.studentAnswer}
            </div>

            {/* Correct Answer */}
            <div className="text-sm text-gray-700 mb-3">
              <span className="font-medium">Correct Answer: </span>
              {question.correctAnswer}
            </div>

            {/* Points */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-700">Points:</span>
              {editingQuestionId === index ? (
                <input
                  type="number"
                  value={question.pointsAwarded}
                  onChange={(e) =>
                    handleQuestionEdit(index, 'pointsAwarded', parseFloat(e.target.value) || 0)
                  }
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  step="0.5"
                  min="0"
                  max={question.pointsPossible}
                />
              ) : (
                <span className="font-semibold text-gray-900">{question.pointsAwarded}</span>
              )}
              <span className="text-sm text-gray-600">/ {question.pointsPossible}</span>

              {editingQuestionId === index && (
                <label className="flex items-center gap-1 ml-4">
                  <input
                    type="checkbox"
                    checked={question.isCorrect}
                    onChange={(e) => handleQuestionEdit(index, 'isCorrect', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-600">Mark as correct</span>
                </label>
              )}
            </div>

            {/* Feedback */}
            <div className="text-sm">
              <span className="font-medium text-gray-700">Feedback: </span>
              {editingQuestionId === index ? (
                <textarea
                  value={question.feedback}
                  onChange={(e) => handleQuestionEdit(index, 'feedback', e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows="3"
                />
              ) : (
                <div className="mt-1 text-gray-700 italic">{question.feedback}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
