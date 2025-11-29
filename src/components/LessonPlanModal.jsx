import { X, Clock, Target, Package, Activity, Users, CheckCircle, Lightbulb, Copy, Check } from 'lucide-react';
import { useState } from 'react';

/**
 * LessonPlanModal component - Displays AI-generated lesson plan
 * 
 * @param {Object} props
 * @param {Object} props.lessonPlan - The lesson plan data from AI
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Handler to close the modal
 */
export default function LessonPlanModal({ lessonPlan, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !lessonPlan) return null;

  const handleCopyToClipboard = async () => {
    const planText = formatLessonPlanAsText(lessonPlan);
    try {
      await navigator.clipboard.writeText(planText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatLessonPlanAsText = (plan) => {
    let text = `# ${plan.title}\n\n`;
    text += `Duration: ${plan.duration}\n\n`;
    text += `## Overview\n${plan.overview}\n\n`;
    text += `## Learning Objectives\n`;
    plan.objectives?.forEach((obj, i) => {
      text += `${i + 1}. ${obj}\n`;
    });
    text += `\n## Materials Needed\n`;
    plan.materials?.forEach((mat) => {
      text += `- ${mat}\n`;
    });
    text += `\n## Activities\n`;
    plan.activities?.forEach((act, i) => {
      text += `### ${i + 1}. ${act.name} (${act.duration})\n${act.description}\n\n`;
    });
    text += `## Differentiation\n`;
    text += `**For Struggling Students:** ${plan.differentiation?.struggling}\n\n`;
    text += `**For Advanced Students:** ${plan.differentiation?.advanced}\n\n`;
    text += `## Assessment\n${plan.assessment}\n`;
    if (plan.teacherNotes) {
      text += `\n## Teacher Notes\n${plan.teacherNotes}\n`;
    }
    return text;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-purple-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{lessonPlan.title}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
              <Clock size={14} />
              <span>{lessonPlan.duration}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-green-600" />
                  <span className="text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Overview */}
          <div>
            <p className="text-gray-700 leading-relaxed">{lessonPlan.overview}</p>
          </div>

          {/* Learning Objectives */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Learning Objectives</h3>
            </div>
            <ul className="space-y-2">
              {lessonPlan.objectives?.map((objective, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Materials */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">Materials Needed</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {lessonPlan.materials?.map((material, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700"
                >
                  {material}
                </span>
              ))}
            </div>
          </div>

          {/* Activities */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={18} className="text-purple-600" />
              <h3 className="font-semibold text-gray-900">Activities</h3>
            </div>
            <div className="space-y-3">
              {lessonPlan.activities?.map((activity, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {idx + 1}. {activity.name}
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                      {activity.duration}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{activity.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Differentiation */}
          <div className="bg-orange-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-orange-600" />
              <h3 className="font-semibold text-gray-900">Differentiation Strategies</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/70 rounded-lg p-3">
                <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2">
                  For Struggling Students
                </div>
                <p className="text-sm text-gray-700">{lessonPlan.differentiation?.struggling}</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3">
                <div className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">
                  For Advanced Students
                </div>
                <p className="text-sm text-gray-700">{lessonPlan.differentiation?.advanced}</p>
              </div>
            </div>
          </div>

          {/* Assessment */}
          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={18} className="text-emerald-600" />
              <h3 className="font-semibold text-gray-900">Formative Assessment</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{lessonPlan.assessment}</p>
          </div>

          {/* Teacher Notes */}
          {lessonPlan.teacherNotes && (
            <div className="bg-yellow-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={18} className="text-yellow-600" />
                <h3 className="font-semibold text-gray-900">Teacher Notes</h3>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{lessonPlan.teacherNotes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

