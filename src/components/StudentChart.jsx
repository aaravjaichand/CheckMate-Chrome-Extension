import { BarChart2 } from 'lucide-react';

/**
 * StudentChart component - Displays score distribution chart
 * Uses pure CSS bars to avoid additional dependencies
 * 
 * @param {Object} props
 * @param {Array} props.students - Array of student objects with averageScore
 * @param {Function} props.onStudentClick - Handler when a student bar is clicked
 */
export default function StudentChart({ students, onStudentClick }) {
  // Calculate score distribution buckets
  const getDistribution = () => {
    const buckets = [
      { label: '90-100', min: 90, max: 100, count: 0, color: 'bg-emerald-500' },
      { label: '80-89', min: 80, max: 89, count: 0, color: 'bg-green-500' },
      { label: '70-79', min: 70, max: 79, count: 0, color: 'bg-yellow-500' },
      { label: '60-69', min: 60, max: 69, count: 0, color: 'bg-orange-500' },
      { label: '< 60', min: 0, max: 59, count: 0, color: 'bg-red-500' },
    ];

    students.forEach(student => {
      const score = student.averageScore;
      for (const bucket of buckets) {
        if (score >= bucket.min && score <= bucket.max) {
          bucket.count++;
          break;
        }
      }
    });

    return buckets;
  };

  const distribution = getDistribution();
  const maxCount = Math.max(...distribution.map(b => b.count), 1);

  if (students.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center space-x-2 text-gray-700 mb-4">
        <BarChart2 size={18} />
        <h3 className="font-semibold">Score Distribution</h3>
        <span className="text-xs text-gray-500">({students.length} students)</span>
      </div>

      <div className="space-y-2">
        {distribution.map((bucket) => (
          <div key={bucket.label} className="flex items-center gap-3">
            <div className="w-14 text-xs font-medium text-gray-600 text-right">
              {bucket.label}
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden relative">
              <div
                className={`h-full ${bucket.color} transition-all duration-500 ease-out rounded-md`}
                style={{ 
                  width: bucket.count > 0 ? `${Math.max((bucket.count / maxCount) * 100, 8)}%` : '0%' 
                }}
              />
              {bucket.count > 0 && (
                <span className="absolute inset-y-0 left-2 flex items-center text-xs font-bold text-white drop-shadow-sm">
                  {bucket.count}
                </span>
              )}
            </div>
            <div className="w-8 text-xs text-gray-500 text-right">
              {bucket.count > 0 ? `${Math.round((bucket.count / students.length) * 100)}%` : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Excellent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Good</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Average</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span>Below Avg</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Needs Help</span>
          </div>
        </div>
      </div>
    </div>
  );
}

