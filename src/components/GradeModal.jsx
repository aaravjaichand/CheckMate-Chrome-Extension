import { X, Check } from 'lucide-react';
import LatexRenderer from './LatexRenderer';

/**
 * Modal component to display full grade details
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Object} props.grade - Grade object with all details
 */
export default function GradeModal({ isOpen, onClose, grade }) {
  if (!isOpen || !grade) return null;

  // Calculate percentage safely
  const calculatePercentage = () => {
    if (!grade.totalPoints || grade.totalPoints === 0) {
      return 0;
    }
    const percentage = (grade.overallScore / grade.totalPoints) * 100;
    return isNaN(percentage) ? 0 : Math.round(percentage);
  };

  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Safely get questions array
  const questions = Array.isArray(grade.questions) ? grade.questions : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">{grade.assignmentName}</h2>
            <p className="text-blue-100 text-sm mt-1">Student: {grade.studentName}</p>
            <p className="text-blue-100 text-xs mt-0.5">Graded: {formatDate(grade.gradedAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Overall Score */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Overall Score</div>
              <div className="text-4xl font-bold text-gray-900">
                {grade.overallScore} / {grade.totalPoints}
              </div>
              <div className="text-lg text-gray-700 mt-2">
                {calculatePercentage()}%
              </div>
            </div>
          </div>

          {/* Struggling Topics - only show if they exist */}
          {grade.questions && grade.questions.some(q => !q.isCorrect) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Struggling Topics:</div>
              <div className="flex flex-wrap gap-2">
                {[...new Set(
                  grade.questions
                    .filter(q => !q.isCorrect)
                    .map(q => q.topic)
                    .filter(Boolean)
                )].map((topic, index) => (
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
              Questions ({questions.length})
            </div>

            {questions.map((question, index) => (
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
                    {question.topic && (
                      <span className="text-xs px-2 py-0.5 bg-white rounded border border-gray-200">
                        {question.topic}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {question.pointsAwarded} / {question.pointsPossible} pts
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Question: </span>
                  {question.questionText}
                </div>

                {/* Student Answer */}
                <div className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Student Answer: </span>
                  <LatexRenderer className="inline-block">{question.studentAnswer}</LatexRenderer>
                </div>

                {/* Correct Answer */}
                {!question.isCorrect && question.correctAnswer && (
                  <div className="text-sm text-gray-700 mb-3">
                    <span className="font-medium">Correct Answer: </span>
                    <LatexRenderer className="inline-block">{question.correctAnswer}</LatexRenderer>
                  </div>
                )}

                {/* Feedback */}
                {question.feedback && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Feedback: </span>
                    <div className="mt-1 text-gray-700 italic">{question.feedback}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sync Status */}
          {grade.syncedToGoogleClassroom && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              This grade has been synced to Google Classroom
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
