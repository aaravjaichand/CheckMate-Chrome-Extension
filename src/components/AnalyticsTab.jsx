/**
 * AnalyticsTab component - Displays analytics and insights for classes
 * @param {Object} props
 * @param {Array} props.courses - List of available courses
 * @param {Object} props.selectedClass - Currently selected class for analytics
 * @param {Function} props.onClassSelect - Handler for class selection
 */
export default function AnalyticsTab({
  courses,
  selectedClass,
  onClassSelect
}) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Class
        </label>
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
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
      </div>

      {selectedClass && (
        <div className="text-center py-8 text-gray-500">
          Analytics features coming soon. This will include:
          <ul className="mt-4 text-left max-w-md mx-auto space-y-2 text-sm">
            <li>• Class average grades</li>
            <li>• Top performers</li>
            <li>• Students needing support</li>
            <li>• AI-generated insights and recommendations</li>
          </ul>
        </div>
      )}
    </div>
  );
}
