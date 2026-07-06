import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import DailySummary from '../components/DailySummary';
import MealSection from '../components/MealSection';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigationState } from '../context/NavigationStateContext';

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const GOALS_LS_KEY = 'tracker_goals';

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadGoalsLocal() {
  try {
    const raw = localStorage.getItem(GOALS_LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveGoalsLocal(g) {
  if (g) localStorage.setItem(GOALS_LS_KEY, JSON.stringify(g));
  else localStorage.removeItem(GOALS_LS_KEY);
}

function goalsFromApi(d) {
  return {
    calories: d?.calories || 0,
    protein: d?.protein_g || 0,
    fat: d?.total_fat_g || 0,
    carbs: d?.total_carbs_g || 0,
  };
}

function goalsToApi(g) {
  return {
    calories: g?.calories || 0,
    protein_g: g?.protein || 0,
    total_fat_g: g?.fat || 0,
    total_carbs_g: g?.carbs || 0,
  };
}

function goalsEmpty(g) {
  if (!g) return true;
  return Object.values(g).every((v) => !v);
}

export default function TrackerPage() {
  const today = localDateStr();
  const { user } = useAuth();
  const toast = useToast();
  const { tracker, patchTracker } = useNavigationState();
  const date = tracker.date ?? today;
  const setDate = (next) => patchTracker({ date: next });
  const showGoalEditor = tracker.showGoalEditor ?? false;
  const setShowGoalEditor = (v) =>
    patchTracker({
      showGoalEditor: typeof v === 'function' ? v(tracker.showGoalEditor ?? false) : v,
    });
  const dismissed = tracker.dismissed ?? false;
  const setDismissed = (v) =>
    patchTracker({
      dismissed: typeof v === 'function' ? v(tracker.dismissed ?? false) : v,
    });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState(loadGoalsLocal);
  const [celebrate, setCelebrate] = useState(false);
  const prevGoalsHit = useRef(false);
  const isToday = date === today;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiGet('/api/tracker/goals');
        if (cancelled) return;
        const fromServer = goalsFromApi(resp);
        if (goalsEmpty(fromServer)) {
          const local = loadGoalsLocal();
          if (!goalsEmpty(local)) {
            apiPut('/api/tracker/goals', goalsToApi(local)).catch(() => {});
            setGoals(local);
          } else {
            setGoals(null);
            saveGoalsLocal(null);
          }
        } else {
          setGoals(fromServer);
          saveGoalsLocal(fromServer);
        }
      } catch {
        /* keep localStorage cache as-is */
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  function persistGoals(next) {
    if (!user) {
      toast('Sign in to save your goals');
      return;
    }
    const hasAny = next && Object.values(next).some((v) => v > 0);
    setGoals(hasAny ? next : null);
    saveGoalsLocal(hasAny ? next : null);
    apiPut('/api/tracker/goals', goalsToApi(hasAny ? next : null)).catch(() => {});
  }

  const hasLoaded = useRef(false);

  const fetchLogs = useCallback(async (retries = 2) => {
    if (!hasLoaded.current) setLoading(true);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const data = await apiGet(`/api/tracker/logs?date=${date}`);
        setLogs(data.logs || []);
        setLoading(false);
        hasLoaded.current = true;
        return;
      } catch {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
    setLogs([]);
    setLoading(false);
    hasLoaded.current = true;
  }, [date]);

  useEffect(() => {
    if (!user) { setLogs([]); setLoading(false); hasLoaded.current = true; return; }
    hasLoaded.current = false;
    fetchLogs();
    patchTracker({ dismissed: false });
    setCelebrate(false);
    prevGoalsHit.current = false;
  }, [fetchLogs, patchTracker, user]);

  async function handleLog(item) {
    if (!user) {
      toast('Sign in to start tracking your meals');
      return;
    }
    if (!item.food_item_id) return;
    await apiPost('/api/tracker/logs', {
      food_item_id: item.food_item_id,
      servings: item.servings,
      portion_label: item.portion_label || null,
      meal_type: item.meal_type,
      logged_date: date,
    });
    fetchLogs(0);
  }

  async function handleDelete(logId) {
    await apiDelete(`/api/tracker/logs/${logId}`);
    fetchLogs(0);
  }

  function goBack() {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setDate(localDateStr(d));
  }

  function goForward() {
    if (isToday) return;
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const next = localDateStr(d);
    setDate(next > today ? today : next);
  }

  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein_g: acc.protein_g + (l.protein_g || 0),
      total_fat_g: acc.total_fat_g + (l.total_fat_g || 0),
      total_carbs_g: acc.total_carbs_g + (l.total_carbs_g || 0),
    }),
    { calories: 0, protein_g: 0, total_fat_g: 0, total_carbs_g: 0 }
  );

  const hasGoals = goals && Object.values(goals).some((v) => v > 0);
  const activeGoals = hasGoals ? Object.entries(goals).filter(([, v]) => v > 0) : [];
  const goalChecks = {
    calories: Math.round(totals.calories) >= (goals?.calories || Infinity),
    protein: Math.round(totals.protein_g) >= (goals?.protein || Infinity),
    fat: Math.round(totals.total_fat_g) >= (goals?.fat || Infinity),
    carbs: Math.round(totals.total_carbs_g) >= (goals?.carbs || Infinity),
  };
  const goalsHit = activeGoals.length > 0 && activeGoals.every(([key]) => goalChecks[key]);

  useEffect(() => {
    if (!goalsHit || loading) {
      prevGoalsHit.current = goalsHit;
      return;
    }
    const celebratedKey = `celebrated_${date}`;
    const alreadyCelebrated = localStorage.getItem(celebratedKey);
    if (!prevGoalsHit.current && !alreadyCelebrated) {
      setCelebrate(true);
      localStorage.setItem(celebratedKey, '1');
      const timer = setTimeout(() => setCelebrate(false), 3000);
      return () => clearTimeout(timer);
    }
    prevGoalsHit.current = goalsHit;
  }, [goalsHit, loading, date]);

  const showCongrats = goalsHit && !dismissed;

  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="umd-container max-w-3xl px-4 py-6 space-y-5 relative">

      {/* celebration overlay */}
      {celebrate && <Confetti />}

      {!user && (
        <div className="rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm font-semibold bg-umd-gold/20 dark:bg-umd-gold/10 border border-umd-gold/50 text-umd-black">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Sign in to log meals and save your daily goals.
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-4xl umd-hero-title text-umd-black">Macro Tracker</h1>
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="p-2 hover:bg-umd-gray-light rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              const v = e.target.value;
              setDate(v > today ? today : v);
            }}
            className="bg-white dark:bg-[#1c1c1c] text-umd-black border border-umd-gray rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red"
          />
          <button
            onClick={goForward}
            disabled={isToday}
            className={`p-2 rounded-lg transition-colors ${isToday ? 'opacity-30 cursor-not-allowed' : 'hover:bg-umd-gray-light'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {!isToday && (
            <button onClick={() => setDate(today)} className="text-xs text-umd-red font-semibold hover:underline ml-1 whitespace-nowrap">
              Return to current day
            </button>
          )}

          <button
            onClick={() => setShowGoalEditor((o) => !o)}
            className={`ml-1 p-2 rounded-lg border transition-colors ${showGoalEditor ? 'bg-umd-red text-white border-umd-red' : 'border-umd-gray text-umd-gray-dark hover:border-umd-red hover:text-umd-red'}`}
            title="Set goals"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
      </div>

      {!hasGoals && !showGoalEditor && (
        <div className="umd-card rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-umd-body">Want to set daily nutrition goals?</div>
          <button
            onClick={() => setShowGoalEditor(true)}
            className="bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            Set goals
          </button>
        </div>
      )}

      {showGoalEditor && (
        <GoalEditor
          goals={goals || { calories: 0, protein: 0, fat: 0, carbs: 0 }}
          onSave={(g) => {
            const cleaned = { calories: g.calories || 0, protein: g.protein || 0, fat: g.fat || 0, carbs: g.carbs || 0 };
            persistGoals(cleaned);
            setShowGoalEditor(false);
          }}
          onClear={() => { persistGoals(null); setShowGoalEditor(false); }}
          onClose={() => setShowGoalEditor(false)}
        />
      )}

      {showCongrats && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-xl px-4 py-3 flex items-center justify-between animate-[slideIn_0.4s_ease-out]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <div className="text-sm font-bold text-green-800 dark:text-green-300">You hit your goals today! Nice job.</div>
              <div className="text-xs text-green-700 dark:text-green-400">Keep up the grind.</div>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-green-600 dark:text-green-400 hover:text-green-800 dark:text-green-300 p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-5">
          <div className="skeleton h-64 w-full rounded-2xl" />
          <div className="skeleton h-24 w-full rounded-2xl" />
          <div className="skeleton h-24 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <DailySummary totals={totals} goals={goals} />
          {logs.length === 0 && (
            <div className="text-center py-4">
              <div className="text-3xl mb-1">🐢</div>
              <p className="text-sm text-umd-body">
                Nothing logged {isToday ? 'today' : 'this day'} yet. Search a food under any meal below to
                start tracking.
              </p>
            </div>
          )}
          {MEALS.map((meal) => (
            <MealSection
              key={meal}
              title={meal}
              logs={logs.filter((l) => l.meal_type === meal)}
              onLog={handleLog}
              onDelete={handleDelete}
            />
          ))}
        </>
      )}

      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-center text-umd-gray-dark hover:text-umd-black hover:shadow-md transition-all z-40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

const GOAL_TYPES = [
  { key: 'calories', label: 'Calories', placeholder: '2000', unit: 'cal', color: '#16a34a' },
  { key: 'protein', label: 'Protein', placeholder: '120', unit: 'g', color: '#3b82f6' },
  { key: 'fat', label: 'Fat', placeholder: '65', unit: 'g', color: '#f97316' },
  { key: 'carbs', label: 'Carbs', placeholder: '250', unit: 'g', color: '#eab308' },
];

function GoalEditor({ goals, onSave, onClear, onClose }) {
  const [values, setValues] = useState({
    calories: goals.calories || '',
    protein: goals.protein || '',
    fat: goals.fat || '',
    carbs: goals.carbs || '',
  });
  const [enabled, setEnabled] = useState({
    calories: (goals.calories || 0) > 0,
    protein: (goals.protein || 0) > 0,
    fat: (goals.fat || 0) > 0,
    carbs: (goals.carbs || 0) > 0,
  });

  function toggle(key) {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    const result = {};
    GOAL_TYPES.forEach(({ key }) => {
      result[key] = enabled[key] ? (parseInt(values[key]) || 0) : 0;
    });
    onSave(result);
  }

  return (
    <div className="umd-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-umd-black">Daily goals</span>
        <button onClick={onClose} className="text-umd-gray-dark hover:text-umd-black">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        {GOAL_TYPES.map(({ key, label, placeholder, unit, color }) => (
          <div key={key} className="flex items-center gap-3">
            <button
              onClick={() => toggle(key)}
              className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
              style={{
                borderColor: enabled[key] ? color : '#d1d5db',
                backgroundColor: enabled[key] ? color : 'transparent',
              }}
            >
              {enabled[key] && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className="text-xs font-semibold text-umd-body w-14">{label}</span>
            <input
              type="number"
              disabled={!enabled[key]}
              value={enabled[key] ? values[key] : ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
              className="bg-white dark:bg-[#1c1c1c] text-umd-black flex-1 border border-umd-gray rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red disabled:opacity-30 disabled:bg-gray-50"
            />
            <span className="text-[10px] text-umd-gray-dark w-6">{unit}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          className="bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          Save
        </button>
        <button onClick={onClear} className="text-umd-gray-dark hover:text-umd-red text-sm font-semibold px-3 py-1.5">
          Clear all
        </button>
      </div>
    </div>
  );
}

function Confetti() {
  const particles = Array.from({ length: 40 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const duration = 1.5 + Math.random() * 1.5;
    const size = 6 + Math.random() * 6;
    const colors = ['#e21833', '#ffd200', '#3b82f6', '#22c55e', '#f97316', '#a855f7'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const drift = (Math.random() - 0.5) * 80;
    const rotation = Math.random() * 720;

    return (
      <div
        key={i}
        className="absolute rounded-sm"
        style={{
          left: `${left}%`,
          top: '-10px',
          width: size,
          height: size * 0.6,
          backgroundColor: color,
          opacity: 0,
          animation: `confettiFall ${duration}s ${delay}s ease-out forwards`,
          '--drift': `${drift}px`,
          '--rotation': `${rotation}deg`,
        }}
      />
    );
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <style>{`
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) translateX(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) translateX(var(--drift)) rotate(var(--rotation)); }
        }
        @keyframes slideIn {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {particles}
    </div>
  );
}
