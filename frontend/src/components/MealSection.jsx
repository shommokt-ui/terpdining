import { useState } from 'react';
import FoodSearch from './FoodSearch';
import ExternalLink from './ExternalLink';

export default function MealSection({ title, logs, onLog, onDelete }) {
  const [expanded, setExpanded] = useState(true);

  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein_g: acc.protein_g + (l.protein_g || 0),
      total_fat_g: acc.total_fat_g + (l.total_fat_g || 0),
      total_carbs_g: acc.total_carbs_g + (l.total_carbs_g || 0),
    }),
    { calories: 0, protein_g: 0, total_fat_g: 0, total_carbs_g: 0 }
  );

  return (
    <div className="umd-card rounded-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-umd-gray-light transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-umd-black">{title}</h3>
          <span className="text-xs text-umd-body bg-umd-gray-light px-2 py-0.5 rounded-full">
            {logs.length} item{logs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-umd-body">
          <span><span className="font-semibold text-umd-black">{Math.round(totals.calories)}</span> cal</span>
          <span>{Math.round(totals.protein_g)}g P</span>
          <span>{Math.round(totals.total_fat_g)}g F</span>
          <span>{Math.round(totals.total_carbs_g)}g C</span>
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-umd-gray px-5 py-4 space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between py-2 border-b border-umd-gray-light last:border-b-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-umd-black">{log.food_name}</span>
                  {log.label_url && (
                    <ExternalLink
                      href={log.label_url}
                      title="View full nutrition label"
                      className="text-umd-body hover:text-umd-red transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5m0 0v5m0-5L10 14M9 5H5v14h14v-4" />
                      </svg>
                    </ExternalLink>
                  )}
                </div>
                <div className="text-xs text-umd-body mt-0.5">
                  {log.portion_label || `${log.servings} serving${log.servings !== 1 ? 's' : ''}`} · {Math.round(log.calories || 0)} cal · {Math.round(log.protein_g || 0)}g P · {Math.round(log.total_fat_g || 0)}g F · {Math.round(log.total_carbs_g || 0)}g C
                </div>
              </div>
              <button
                onClick={() => onDelete(log.id)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          <FoodSearch mealType={title} onLog={onLog} />
        </div>
      )}
    </div>
  );
}
