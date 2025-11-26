import { Check, RefreshCw, Save } from 'lucide-react';
import GradingResults from './GradingResults';

/**
 * GradeTab component - Handles the grading workflow
 * @param {Object} props
 * @param {Array} props.courses - List of available courses
 * @param {Object} props.selectedCourse - Currently selected course
 * @param {Array} props.assignments - List of assignments for selected course
 * @param {Object} props.selectedAssignment - Currently selected assignment
 * @param {Array} props.submissions - List of submissions for selected assignment
 * @param {Object} props.selectedSubmission - Currently selected submission
 * @param {boolean} props.loading - Loading state
 * @param {string} props.customInstructions - Custom grading instructions
 * @param {Object} props.gradingResult - Results from AI grading
 * @param {boolean} props.isGrading - Whether grading is in progress
 * @param {boolean} props.syncToClassroom - Whether to sync to Google Classroom
 * @param {boolean} props.isSaving - Whether save operation is in progress
 * @param {Function} props.onCourseSelect - Handler for course selection
 * @param {Function} props.onAssignmentSelect - Handler for assignment selection
 * @param {Function} props.onSubmissionSelect - Handler for submission selection
 * @param {Function} props.onCustomInstructionsChange - Handler for custom instructions change
 * @param {Function} props.onGrade - Handler for grading action
 * @param {Function} props.onGradingResultsChange - Handler for grading results edit
 * @param {Function} props.onClearGradingResult - Handler to clear grading results
 * @param {Function} props.onSyncToClassroomChange - Handler for sync checkbox change
 * @param {Function} props.onSaveGrades - Handler for saving grades
 */
export default function GradeTab({
  courses,
  selectedCourse,
  assignments,
  selectedAssignment,
  submissions,
  selectedSubmission,
  loading,
  customInstructions,
  gradingResult,
  isGrading,
  syncToClassroom,
  isSaving,
  onCourseSelect,
  onAssignmentSelect,
  onSubmissionSelect,
  onCustomInstructionsChange,
  onGrade,
  onGradingResultsChange,
  onClearGradingResult,
  onSyncToClassroomChange,
  onSaveGrades
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Course Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Course
        </label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={selectedCourse?.id || ''}
          onChange={(e) => {
            const course = courses.find(c => c.id === e.target.value);
            if (course) onCourseSelect(course);
          }}
        >
          <option value="">Choose a course...</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
      </div>

      {/* Assignment Selection */}
      {selectedCourse && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Assignment
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedAssignment?.id || ''}
            onChange={(e) => {
              const assignment = assignments.find(a => a.id === e.target.value);
              if (assignment) onAssignmentSelect(assignment);
            }}
          >
            <option value="">Choose an assignment...</option>
            {assignments.map(assignment => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Submission Selection */}
      {selectedAssignment && submissions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Submission
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedSubmission?.id || ''}
            onChange={(e) => {
              const submission = submissions.find(s => s.id === e.target.value);
              if (submission) onSubmissionSelect(submission);
            }}
          >
            <option value="">Choose a submission...</option>
            {submissions.map(submission => (
              <option key={submission.id} value={submission.id}>
                {submission.studentName}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedSubmission && (
        <>
          {/* Submission Context */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Student:</span>
              <span className="font-medium text-gray-900">{selectedSubmission.studentName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium text-gray-900">
                {selectedSubmission.studentEmail || 'Not available'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Course:</span>
              <span className="font-medium text-gray-900">{selectedCourse.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Assignment:</span>
              <span className="font-medium text-gray-900">{selectedAssignment.title}</span>
            </div>
            {selectedSubmission.state !== 'TURNED_IN' && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium text-gray-900">
                  {selectedSubmission.state === 'NEW' ? 'Not submitted' :
                   selectedSubmission.state === 'CREATED' ? 'In progress' :
                   selectedSubmission.state === 'RECLAIMED_BY_STUDENT' ? 'Unsubmitted' :
                   selectedSubmission.state === 'RETURNED' ? 'Returned' :
                   selectedSubmission.state}
                </span>
              </div>
            )}
          </div>

          {/* Custom Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Instructions (Optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="3"
              placeholder="e.g., Focus on showing work, be extra encouraging..."
              value={customInstructions}
              onChange={(e) => onCustomInstructionsChange(e.target.value)}
            />
          </div>

          {/* Display attachments info */}
          {selectedSubmission.attachments && selectedSubmission.attachments.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Worksheet Attachments ({selectedSubmission.attachments.length})
              </div>
              {selectedSubmission.attachments.map((att, idx) => (
                <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{att.type}</span>
                  <span className="truncate">{att.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Grade Button */}
          {!gradingResult && (
            <button
              onClick={onGrade}
              disabled={isGrading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGrading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Grading...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Grade Assignment
                </>
              )}
            </button>
          )}

          {/* Grading Results */}
          {gradingResult && (
            <div className="space-y-4">
              <GradingResults
                gradingResult={gradingResult}
                onResultsChange={onGradingResultsChange}
              />

              {/* Save Button */}
              <div className="space-y-3">
                <button
                  onClick={onSaveGrades}
                  disabled={isSaving}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Grades
                    </>
                  )}
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={syncToClassroom}
                    onChange={(e) => onSyncToClassroomChange(e.target.checked)}
                  />
                  <span>Update score in Google Classroom</span>
                </label>
                <button
                  onClick={onClearGradingResult}
                  className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Grade Another Submission
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedAssignment && submissions.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No submissions found for this assignment.
        </div>
      )}
    </div>
  );
}
