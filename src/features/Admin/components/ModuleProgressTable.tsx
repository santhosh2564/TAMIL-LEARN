import { StudentModuleProgress } from '../../../admin/types';

interface ModuleProgressTableProps {
  modules: StudentModuleProgress[];
}

export function ModuleProgressTable({ modules }: ModuleProgressTableProps) {
  if (!modules || modules.length === 0) return null;

  return (
    <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg sm:text-xl font-display font-bold text-text">
          Progress by Curriculum Module
        </h3>
        <span className="text-xs text-text-muted font-medium">Tamil & English Modules</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-surface-highlight bg-white">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-surface border-b border-surface-highlight text-text-muted font-bold text-xs uppercase tracking-wider">
              <th className="py-3 px-4">Module</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4 text-center">Done (Correct)</th>
              <th className="py-3 px-4 text-center">Not Done</th>
              <th className="py-3 px-4 text-center">Total Activities</th>
              <th className="py-3 px-4 text-center">Accuracy %</th>
              <th className="py-3 px-4 text-center">Completion %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-highlight">
            {modules.map((m) => (
              <tr key={`${m.subject}-${m.moduleId}`} className="hover:bg-primary-50/30 transition-colors">
                <td className="py-3.5 px-4 font-bold text-text">
                  {m.moduleTitle}
                </td>
                <td className="py-3.5 px-4">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    m.subject === 'tamil' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-sky-50 text-sky-800 border border-sky-200'
                  }`}>
                    {m.subject === 'tamil' ? 'தமிழ்' : 'English'}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-emerald-700">
                  {m.completed}
                </td>
                <td className="py-3.5 px-4 text-center text-text-muted">
                  {m.notDone}
                </td>
                <td className="py-3.5 px-4 text-center text-text-muted font-medium">
                  {m.totalAvailable}
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-primary-700">
                  {m.accuracy}%
                </td>
                <td className="py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-20 bg-surface-highlight rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${m.completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-text min-w-[32px]">
                      {m.completionPercentage}%
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

