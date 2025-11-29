import { useState, useEffect } from 'react';
import { getClassAnalytics, getStudentAnalytics, getTeacherSettings, saveLessonPlan, getLessonPlansByClass, auth } from '../utils/firebase';
import { BarChart3, TrendingUp, Users, AlertCircle, BookOpen, ChevronRight, ArrowLeft, Sparkles, RefreshCw, FileText, Clock } from 'lucide-react';
import StudentChart from './StudentChart';
import LessonPlanModal from './LessonPlanModal';

/**
 * AnalyticsTab component - Displays analytics and insights for classes
 */
export default function AnalyticsTab({ courses, selectedClass, onClassSelect }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentAnalytics, setStudentAnalytics] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [threshold, setThreshold] = useState(80);
  
  // Lesson plan state
  const [lessonPlan, setLessonPlan] = useState(null);
  const [isLessonPlanModalOpen, setIsLessonPlanModalOpen] = useState(false);
  const [isGeneratingLessonPlan, setIsGeneratingLessonPlan] = useState(false);
  const [lessonPlanError, setLessonPlanError] = useState(null);
  const [savedLessonPlans, setSavedLessonPlans] = useState([]);

  useEffect(() => {
    loadSettings();
  }, []);

  // Load lesson plans when class changes
  useEffect(() => {
    async function loadLessonPlans() {
      if (selectedClass && auth.currentUser) {
        try {
          const plans = await getLessonPlansByClass(selectedClass.id, auth.currentUser.uid);
          setSavedLessonPlans(plans);
        } catch (error) {
          // Silently fail - Firestore rules may not be configured yet
          console.warn('Could not load lesson plans:', error.message);
          setSavedLessonPlans([]);
        }
      } else {
        setSavedLessonPlans([]);
      }
    }
    loadLessonPlans();
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass) {
      loadAnalytics();
      setSelectedStudentId(null);
      setStudentAnalytics(null);
    } else {
      setAnalytics(null);
    }
  }, [selectedClass]);

  async function loadSettings() {
    if (auth.currentUser) {
      const settings = await getTeacherSettings(auth.currentUser.uid);
      if (settings?.gradeThresholds?.needsSupport) {
        setThreshold(settings.gradeThresholds.needsSupport);
      }
    }
  }

  useEffect(() => {
    if (selectedStudentId && selectedClass) {
      loadStudentAnalytics();
    }
  }, [selectedStudentId, selectedClass]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const data = await getClassAnalytics(selectedClass.id);
      setAnalytics(data);
    } catch {
      // Analytics load failed silently
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentAnalytics() {
    setLoadingStudent(true);
    try {
      const data = await getStudentAnalytics(selectedStudentId, selectedClass.id);
      setStudentAnalytics(data);
    } catch {
      // Student analytics load failed silently
    } finally {
      setLoadingStudent(false);
    }
  }

  async function handleGenerateLessonPlan() {
    if (!analytics || !selectedClass || !auth.currentUser) return;
    
    setIsGeneratingLessonPlan(true);
    setLessonPlanError(null);
    
    try {
      // Prepare struggling topics data
      const strugglingTopicsEntries = analytics.commonStrugglingTopics 
        ? Object.entries(analytics.commonStrugglingTopics).sort(([, a], [, b]) => b - a).slice(0, 5)
        : [];
      
      const strugglingTopics = strugglingTopicsEntries.map(([topic]) => topic);
      const topicCounts = Object.fromEntries(strugglingTopicsEntries);
      
      // Count students needing support
      const studentsNeedingSupport = sortedStudents.filter(s => s.averageScore < threshold).length;
      
      const analyticsData = {
        className: selectedClass.name,
        classAverage: Math.round(analytics.averageGrade || 0),
        totalStudents: sortedStudents.length,
        studentsNeedingSupport,
        strugglingTopics,
        topicCounts
      };
      
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
      
      // Show the lesson plan immediately
      setLessonPlan(response);
      setIsLessonPlanModalOpen(true);
      
      // Try to save to Firebase (but don't block on it)
      try {
        await saveLessonPlan({
          classId: selectedClass.id,
          className: selectedClass.name,
          teacherId: auth.currentUser.uid,
          analyticsSnapshot: {
            classAverage: analyticsData.classAverage,
            totalStudents: analyticsData.totalStudents,
            studentsNeedingSupport: analyticsData.studentsNeedingSupport,
            strugglingTopics: analyticsData.strugglingTopics
          },
          plan: response
        });
        
        // Reload lesson plans after successful save
        const plans = await getLessonPlansByClass(selectedClass.id, auth.currentUser.uid);
        setSavedLessonPlans(plans);
      } catch (saveError) {
        console.warn('Could not save lesson plan to Firebase:', saveError.message);
        // Don't show error to user - the plan was still generated successfully
      }
    } catch (error) {
      console.error('Failed to generate lesson plan:', error);
      setLessonPlanError(error.message || 'Failed to generate lesson plan. Please try again.');
    } finally {
      setIsGeneratingLessonPlan(false);
    }
  }

  function handleViewSavedLessonPlan(savedPlan) {
    setLessonPlan(savedPlan.plan);
    setIsLessonPlanModalOpen(true);
  }

  const getSortedStudents = () => {
    if (!analytics?.studentPerformances) return [];
    return Object.entries(analytics.studentPerformances)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.averageScore - a.averageScore);
  };

  const sortedStudents = getSortedStudents();
  const topStudents = sortedStudents.filter(s => s.averageScore >= threshold).slice(0, 5);
  const needsSupportStudents = sortedStudents
    .filter(s => s.averageScore < threshold)
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 5);

  if (selectedStudentId) {
    return (
      <div className="p-4 space-y-6">
        <button
          onClick={() => setSelectedStudentId(null)}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Class Analytics
        </button>

        {loadingStudent ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : studentAnalytics ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {analytics?.studentPerformances?.[selectedStudentId]?.name || 'Student'}
              </h2>
              <p className="text-gray-500">Student Performance Report</p>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium mb-1">Average Score</div>
                  <div className="text-3xl font-bold text-blue-900">
                    {Math.round(studentAnalytics.averageScore)}%
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-600 font-medium mb-1">Assignments</div>
                  <div className="text-3xl font-bold text-green-900">
                    {studentAnalytics.totalAssignments}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Assignment History</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {studentAnalytics.assignmentHistory?.slice().reverse().map((assignment, idx) => (
                  <div key={idx} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900">{assignment.assignmentName}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(assignment.gradedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-sm font-medium ${
                        assignment.score >= 90 ? 'bg-green-100 text-green-800' :
                        assignment.score >= 80 ? 'bg-blue-100 text-blue-800' :
                        assignment.score >= 70 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {assignment.score}/{assignment.totalPoints}
                      </div>
                    </div>
                    {assignment.strugglingTopics?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {assignment.strugglingTopics.map((topic, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded-full border border-orange-100">
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <AlertCircle className="text-orange-500" size={20} />
                <h3 className="font-semibold text-gray-900">Areas for Improvement</h3>
              </div>
              {studentAnalytics.strugglingTopics && Object.keys(studentAnalytics.strugglingTopics).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(studentAnalytics.strugglingTopics)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([topic, data]) => (
                      <div key={topic} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 capitalize">{topic}</span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                          Flagged in {data.count} {data.count === 1 ? 'assignment' : 'assignments'}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No specific struggling topics identified yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No Student Data</h3>
            <p className="text-sm text-gray-500 mt-1">Could not load analytics for this student.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Class</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={selectedClass?.id || ''}
          onChange={(e) => {
            const course = courses.find(c => c.id === e.target.value);
            onClassSelect(course);
          }}
        >
          <option value="">Choose a class...</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>{course.name}</option>
          ))}
        </select>
      </div>

      {selectedClass ? (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center space-x-2 text-gray-500 mb-1">
                  <TrendingUp size={16} />
                  <span className="text-xs font-medium uppercase tracking-wider">Class Average</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {analytics.averageGrade ? `${Math.round(analytics.averageGrade)}%` : 'N/A'}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center space-x-2 text-gray-500 mb-1">
                  <BookOpen size={16} />
                  <span className="text-xs font-medium uppercase tracking-wider">Assignments Graded</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{analytics.totalAssignments || 0}</div>
              </div>
            </div>

            {/* Score Distribution Chart */}
            {sortedStudents.length > 0 && (
              <StudentChart 
                students={sortedStudents} 
                onStudentClick={(studentId) => setSelectedStudentId(studentId)} 
              />
            )}

            {sortedStudents.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center text-green-700">
                    <TrendingUp size={18} className="mr-2" /> Top Performers
                  </h3>
                  <div className="space-y-2">
                    {topStudents.map((student) => (
                      <div
                        key={student.id}
                        onClick={() => setSelectedStudentId(student.id)}
                        className="flex justify-between items-center p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-700">{student.name}</span>
                        <span className="text-sm font-bold text-green-600">{Math.round(student.averageScore)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center text-orange-700">
                    <AlertCircle size={18} className="mr-2" /> Needs Support ({'<'} {threshold}%)
                  </h3>
                  <div className="space-y-2">
                    {needsSupportStudents.length > 0 ? (
                      needsSupportStudents.map((student) => (
                        <div
                          key={student.id}
                          onClick={() => setSelectedStudentId(student.id)}
                          className="flex justify-between items-center p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-700">{student.name}</span>
                          <span className="text-sm font-bold text-orange-600">{Math.round(student.averageScore)}%</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No students below threshold.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <AlertCircle className="text-orange-500" size={20} />
                <h3 className="font-semibold text-gray-900">Common Struggling Topics</h3>
              </div>

              {analytics.commonStrugglingTopics && Object.keys(analytics.commonStrugglingTopics).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(analytics.commonStrugglingTopics)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([topic, count]) => (
                      <div key={topic} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 capitalize">{topic}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 rounded-full"
                              style={{ width: `${Math.min((count / (analytics.totalAssignments || 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 font-medium">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No data available yet.</p>
              )}

              {/* Generate Lesson Plan Button */}
              <button
                onClick={handleGenerateLessonPlan}
                disabled={isGeneratingLessonPlan || !analytics.commonStrugglingTopics || Object.keys(analytics.commonStrugglingTopics).length === 0}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGeneratingLessonPlan ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Generating Lesson Plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate Lesson Plan</span>
                  </>
                )}
              </button>

              {/* Error Display */}
              {lessonPlanError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{lessonPlanError}</p>
                </div>
              )}
            </div>

            {/* Saved Lesson Plans Section */}
            {savedLessonPlans.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-purple-50">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-purple-600" />
                    <h3 className="font-semibold text-gray-900">Saved Lesson Plans</h3>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {savedLessonPlans.length}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {savedLessonPlans.map((savedPlan) => (
                    <div
                      key={savedPlan.id}
                      onClick={() => handleViewSavedLessonPlan(savedPlan)}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {savedPlan.plan?.title || 'Untitled Lesson Plan'}
                          </h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock size={12} />
                              {savedPlan.plan?.duration || 'N/A'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(savedPlan.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {savedPlan.analyticsSnapshot?.strugglingTopics?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {savedPlan.analyticsSnapshot.strugglingTopics.slice(0, 3).map((topic, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full"
                                >
                                  {topic}
                                </span>
                              ))}
                              {savedPlan.analyticsSnapshot.strugglingTopics.length > 3 && (
                                <span className="text-xs text-gray-400">
                                  +{savedPlan.analyticsSnapshot.strugglingTopics.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">All Students</h3>
              </div>
              <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                {sortedStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        <div className="text-xs text-gray-500">{student.totalAssignments} assignments</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className={`text-sm font-bold mr-3 ${
                        student.averageScore >= 90 ? 'text-green-600' :
                        student.averageScore >= 70 ? 'text-blue-600' : 'text-orange-600'
                      }`}>
                        {Math.round(student.averageScore)}%
                      </span>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </div>
                ))}
                {sortedStudents.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">No student data available yet.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No Analytics Data</h3>
            <p className="text-sm text-gray-500 mt-1">Start grading assignments for this class to see analytics.</p>
          </div>
        )
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p>Select a class to view analytics</p>
        </div>
      )}

      {/* Lesson Plan Modal */}
      <LessonPlanModal
        lessonPlan={lessonPlan}
        isOpen={isLessonPlanModalOpen}
        onClose={() => setIsLessonPlanModalOpen(false)}
      />
    </div>
  );
}
