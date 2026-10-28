import { StudentCategoryMastery } from '../../../admin/types';

interface CategoryMasteryTableProps {
  categories: StudentCategoryMastery[];
}

export function CategoryMasteryTable({ categories }: CategoryMasteryTableProps) {
  return (
    <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg sm:text-xl font-display font-bold text-text">
          Progress by Learning Category
        </h3>
        <span className="text-xs text-text-muted font-medium">6 Educational Families</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-highlight bg-white">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-surface border-b border-surface-highlight text-text-muted font-bold text-xs uppercase tracking-wider">
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-center">Completed</th>
              <th className="py-3 px-4 text-center">Total Available</th>
              <th className="py-3 px-4 text-center">First-Attempt Correct</th>
              <th className="py-3 px-4 text-center">Total Retries</th>
              <th className="py-3 px-4 text-center">Completion %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-highlight">
            {categories.map((cat) => (
              <tr key={cat.category} className="hover:bg-primary-50/30 transition-colors">
                <td className="py-3.5 px-4 font-bold text-text">
                  <div>{cat.categoryTitle}</div>
                  <div className="text-[11px] text-text-muted font-mono">{cat.category}</div>
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-text">
                  {cat.completed}
                </td>
                <td className="py-3.5 px-4 text-center text-text-muted">
                  {cat.totalAvailable}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {cat.firstAttemptCorrect}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${
                      cat.totalRetries > 0
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-surface text-text-muted border-surface-highlight'
                    }`}
                  >
                    {cat.totalRetries}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-20 bg-surface-highlight rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${cat.completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-text min-w-[32px]">
                      {cat.completionPercentage}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
