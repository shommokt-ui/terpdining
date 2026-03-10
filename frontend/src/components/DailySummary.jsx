import { useState } from 'react';

export default function DailySummary({ totals, goals }) {
  const protein = Math.round(totals.protein_g || 0);
  const fat = Math.round(totals.total_fat_g || 0);
  const carbs = Math.round(totals.total_carbs_g || 0);
  const calories = Math.round(totals.calories || 0);
  const total = protein + fat + carbs;

  const slices = [
    { label: 'Protein', value: protein, color: '#3b82f6', light: '#eff6ff', goalKey: 'protein' },
    { label: 'Fat', value: fat, color: '#f97316', light: '#fff7ed', goalKey: 'fat' },
    { label: 'Carbs', value: carbs, color: '#22c55e', light: '#f0fdf4', goalKey: 'carbs' },
  ];

  const [hovered, setHovered] = useState(null);

  const size = 240;
  const center = size / 2;
  const radius = 90;
  const strokeW = 28;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const sliceData = slices.map((s) => {
    const pct = total > 0 ? s.value / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const currentOffset = offset;
    offset += dash;
    return { ...s, pct, dash, gap, offset: currentOffset };
  });

  const hasGoals = goals && Object.values(goals).some((v) => v > 0);

  return (
    <div className="umd-card rounded-2xl p-6">
      {/* two-column on md+, stacked on mobile */}
      <div className="flex flex-col md:flex-row items-center md:items-center gap-6 md:gap-10">

        {/* donut — hero element */}
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {total > 0 ? (
              sliceData.map((s) => {
                if (s.pct === 0) return null;
                const isHovered = hovered === s.label;
                const isOther = hovered !== null && hovered !== s.label;
                return (
                  <circle
                    key={s.label}
                    cx={center} cy={center} r={radius}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={isHovered ? strokeW + 8 : strokeW}
                    strokeDasharray={`${s.dash} ${s.gap}`}
                    strokeDashoffset={-s.offset}
                    strokeLinecap="butt"
                    transform={`rotate(-90 ${center} ${center})`}
                    opacity={isOther ? 0.25 : 1}
                    className="cursor-pointer"
                    style={{ transition: 'stroke-width 0.25s ease, opacity 0.25s ease' }}
                    onMouseEnter={() => setHovered(s.label)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })
            ) : (
              <circle cx={center} cy={center} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeW} />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hovered && total > 0 ? (
              (() => {
                const s = sliceData.find((s) => s.label === hovered);
                return (
                  <>
                    <span className="text-3xl font-extrabold leading-none" style={{ color: s.color }}>{s.value}<span className="text-lg">g</span></span>
                    <span className="text-xs font-semibold mt-1" style={{ color: s.color }}>{s.label}</span>
                    <span className="text-[10px] text-umd-gray-dark mt-0.5">{Math.round(s.pct * 100)}%</span>
                  </>
                );
              })()
            ) : (
              <>
                <span className="text-4xl font-extrabold text-umd-black leading-none">{calories}</span>
                <span className="text-sm text-umd-gray-dark font-medium mt-1">calories</span>
              </>
            )}
          </div>
        </div>

        {/* right side — macros + goals */}
        <div className="flex-1 w-full space-y-5">
          {/* macro breakdown */}
          <div className="space-y-3">
            {sliceData.map((s) => {
              const pct = total > 0 ? Math.round(s.pct * 100) : 0;
              const isHovered = hovered === s.label;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-3 cursor-pointer group"
                  onMouseEnter={() => setHovered(s.label)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-200"
                    style={{ backgroundColor: s.color, transform: isHovered ? 'scale(1.4)' : 'scale(1)' }}
                  />
                  <span className="text-sm font-medium text-umd-body w-14">{s.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${s.color}15` }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: s.color,
                        opacity: isHovered ? 1 : 0.8,
                        transition: 'width 0.5s ease, opacity 0.2s ease',
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold tabular-nums w-12 text-right" style={{ color: s.color }}>
                    {s.value}g
                  </span>
                </div>
              );
            })}
          </div>

          {/* goal progress */}
          {hasGoals && (
            <div className="border-t border-gray-100 pt-4 space-y-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-umd-gray-dark">Goals</span>
              {goals.calories > 0 && (
                <GoalRow label="Calories" current={calories} target={goals.calories} color="#16a34a" />
              )}
              {goals.protein > 0 && (
                <GoalRow label="Protein" current={protein} target={goals.protein} color="#3b82f6" />
              )}
              {goals.fat > 0 && (
                <GoalRow label="Fat" current={fat} target={goals.fat} color="#f97316" />
              )}
              {goals.carbs > 0 && (
                <GoalRow label="Carbs" current={carbs} target={goals.carbs} color="#eab308" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalRow({ label, current, target, color }) {
  const ratio = current / target;
  const pct = Math.min(Math.round(ratio * 100), 100);
  const over = ratio > 1.15;
  const hit = ratio >= 1 && !over;
  const barColor = over ? '#dc2626' : hit ? '#16a34a' : color;
  const textColor = over ? '#dc2626' : hit ? '#16a34a' : '#6b7280';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-umd-gray-dark w-14">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-24 text-right" style={{ color: textColor }}>
        {current} / {target}{over ? ' over' : hit ? ' ✓' : ''}
      </span>
    </div>
  );
}
