import { useState } from 'react';
import { ClipboardList, RefreshCw, Check, ChevronLeft, X } from 'lucide-react';
import LatexRenderer from './LatexRenderer';

/**
 * GradesTab component - Displays history of saved grades
 * @param {Object} props
 * @param {Array} props.courses - List of courses
 * @param {Object} props.selectedClass - Currently selected class
 * @param {Array} props.grades - List of grades
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onClassSelect - Handler for class selection
 * @param {boolean} props.isSelectMode - Whether in select mode
 * @param {Array} props.selectedGradeIds - Array of selected grade IDs
 * @param {Function} props.onToggleSelectMode - Handler for toggling select mode
 * @param {Function} props.onToggleGradeSelection - Handler for toggling grade selection
 * @param {Function} props.onDeleteSelectedGrades - Handler for deleting selected grades
 */
export default function GradesTab({
  courses,
  selectedClass,
  grades,
  loading,
  onClassSelect,
  isSelectMode,
  selectedGradeIds,
  onToggleSelectMode,
  onToggleGradeSelection,
  onDeleteSelectedGrades
}) {
  const [selectedGrade, setSelectedGrade] = useState(null);

  const handleGradeCardClick = (grade) => {
    setSelectedGrade(grade);
  };

  const handleCloseSidePanel = () => {
    setSelectedGrade(null);
  };

  const calculatePercentage = (score, total) => {
    if (!total || total === 0) return 0;
    const percentage = (score / total) * 100;
    return isNaN(percentage) ? 0 : Math.round(percentage);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Class Selection - Fixed at top (hidden when viewing grade) */}
      {!selectedGrade && (
        <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">Select Class</label>
            {selectedClass && grades.length > 0 && (
              <div className="flex items-center gap-2">
                {isSelectMode ? (
                  <>
                    <button
                      onClick={onDeleteSelectedGrades}
                      disabled={selectedGradeIds.length === 0}
                      className="px-3 py-1 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete selected"
                    >
                      Delete
                    </button>
                    <button
                      onClick={onToggleSelectMode}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onToggleSelectMode}
                    className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Select grades"
                  >
                    Select
                  </button>
                )}
              </div>
            )}
          </div>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedClass?.id || ''}
            onChange={(e) => {
              const course = courses.find(c => c.id === e.target.value);
              if (course) onClassSelect(course);
            }}
          >
            <option value="">Choose a class...</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Grades List (hidden when grade selected) */}
        {!selectedGrade && (
          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            )}

            {!selectedClass && !loading && (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Select a class to view graded submissions</p>
              </div>
            )}

            {selectedClass && !loading && grades.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No graded submissions found for this class</p>
                <p className="text-sm mt-2 text-gray-400">Grades you save will appear here</p>
              </div>
            )}

            {selectedClass && !loading && grades.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600 font-medium">
                  {grades.length} graded submission{grades.length !== 1 ? 's' : ''}
                </div>

                <div className="space-y-2">
                  {grades.map((grade) => (
                    <div key={grade.id} className="flex items-center gap-2">
                      {isSelectMode && (
                        <input
                          type="checkbox"
                          checked={selectedGradeIds.includes(grade.id)}
                          onChange={() => onToggleGradeSelection(grade.id)}
                          className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
                        />
                      )}
                      <div
                        onClick={() => {
                          if (isSelectMode) {
                            onToggleGradeSelection(grade.id);
                          } else {
                            handleGradeCardClick(grade);
                          }
                        }}
                        className="flex-1 border rounded-lg p-3 cursor-pointer transition-all border-gray-200 bg-white hover:shadow-md hover:border-blue-300"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">{grade.assignmentName}</h3>
                            <p className="text-xs text-gray-600 mt-0.5 truncate">{grade.studentName}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-base font-bold text-gray-900">
                              {calculatePercentage(grade.overallScore, grade.totalPoints)}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {grade.overallScore}/{grade.totalPoints}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                          <div className="text-xs text-gray-500">{formatDate(grade.gradedAt)}</div>
                          {grade.syncedToGoogleClassroom && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Synced</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grade Details Panel */}
        {selectedGrade && (
          <div className="flex-1 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
            <div className="bg-blue-600 text-white p-3 flex justify-between items-start flex-shrink-0">
              <div className="flex items-start gap-2 flex-1">
                <button
                  onClick={handleCloseSidePanel}
                  className="p-1 hover:bg-blue-700 rounded transition-colors flex-shrink-0 mt-0.5"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-base font-bold">{selectedGrade.assignmentName}</h2>
                  <p className="text-blue-100 text-xs mt-1">Student: {selectedGrade.studentName}</p>
                  <p className="text-blue-100 text-xs">{formatDate(selectedGrade.gradedAt)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded p-3">
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">Overall Score</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {selectedGrade.overallScore} / {selectedGrade.totalPoints}
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    {calculatePercentage(selectedGrade.overallScore, selectedGrade.totalPoints)}%
                  </div>
                </div>
              </div>

              {selectedGrade.questions?.some(q => !q.isCorrect) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                  <div className="text-xs font-medium text-gray-700 mb-1">Struggling Topics:</div>
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(
                      selectedGrade.questions
                        .filter(q => !q.isCorrect)
                        .map(q => q.topic)
                        .filter(Boolean)
                    )].map((topic, index) => (
                      <span key={index} className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedGrade.questions?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-700">
                    Questions ({selectedGrade.questions.length})
                  </div>

                  {selectedGrade.questions.map((question, index) => (
                    <div
                      key={index}
                      className={`border rounded p-2 text-xs ${
                        question.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-semibold text-gray-900">Q{question.questionNumber}</span>
                        {question.isCorrect ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : (
                          <span className="w-3 h-3 text-red-600">✕</span>
                        )}
                        {question.topic && (
                          <span className="text-xs px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-700">
                            {question.topic}
                          </span>
                        )}
                        <span className="ml-auto font-semibold text-gray-900">
                          {question.pointsAwarded}/{question.pointsPossible}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <p><span className="font-medium">Q:</span> {question.questionText}</p>
                        
                        <div>
                          <div className="font-medium text-gray-700 mb-0.5">Student Answer:</div>
                          <div className="bg-white/60 border border-gray-200 rounded p-1.5">
                            <LatexRenderer>{question.studentAnswer}</LatexRenderer>
                          </div>
                        </div>
                        
                        {!question.isCorrect && question.correctAnswer && (
                          <div>
                            <div className="font-medium text-gray-700 mb-0.5">Correct Answer:</div>
                            <div className="bg-white/60 border border-gray-200 rounded p-1.5">
                              <LatexRenderer>{question.correctAnswer}</LatexRenderer>
                            </div>
                          </div>
                        )}
                        
                        {question.feedback && (
                          <p className="text-gray-600 italic">💭 {question.feedback}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
