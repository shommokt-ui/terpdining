import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { useNavigationState } from '../context/NavigationStateContext';

const MEAL_ORDER = ['Breakfast', 'Brunch', 'Lunch', 'Dinner'];

const INCLUDE_TAGS = ['vegan', 'vegetarian', 'HalalFriendly'];
const EXCLUDE_TAGS = [
  'Contains dairy', 'Contains egg', 'Contains gluten', 'Contains nuts',
  'Contains sesame', 'Contains soy', 'Contains fish', 'Contains Shellfish',
];

const ALL_BADGES = {
  'Contains dairy':     { letter: 'D',  hex: '#3978b1', label: 'Dairy' },
  'Contains egg':       { letter: 'E',  hex: '#e6ba3a', label: 'Eggs' },
  'Contains fish':      { letter: 'F',  hex: '#e33980', label: 'Fish' },
  'Contains gluten':    { letter: 'G',  hex: '#e56644', label: 'Gluten' },
  'Contains nuts':      { letter: 'N',  hex: '#df363c', label: 'Nuts' },
  'Contains sesame':    { letter: 'SS', hex: '#ea9f42', label: 'Sesame' },
  'Contains Shellfish': { letter: 'SF', hex: '#4db8ad', label: 'Shellfish' },
  'Contains soy':       { letter: 'S',  hex: '#9fcb63', label: 'Soy' },
  'HalalFriendly':      { letter: 'HF', hex: '#47b3de', label: 'Halal Friendly' },
  'vegan':              { letter: 'VG', hex: '#986aab', label: 'Vegan' },
  'vegetarian':         { letter: 'V',  hex: '#458361', label: 'Vegetarian' },
};

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isTooFarAhead(date, today, latestMenuDate) {
  if (!latestMenuDate || date <= latestMenuDate) return false;
  if (latestMenuDate >= today) return true;
  const latest = new Date(`${latestMenuDate}T12:00:00`);
  const todayD = new Date(`${today}T12:00:00`);
  const daysBehind = (todayD - latest) / 86400000;
  return date >= today && daysBehind <= 14;
}

function BadgeCircle({ tag, size = 'sm' }) {
  const b = ALL_BADGES[tag];
  if (!b) return null;
  const cls = size === 'lg'
    ? 'w-6 h-6 text-[10px]'
    : 'w-5 h-5 text-[9px]';
  return (
    <span title={b.label}
      className={`${cls} rounded-full text-white font-bold flex items-center justify-center shrink-0`}
      style={{ backgroundColor: b.hex }}>
      {b.letter}
    </span>
  );
}

function ItemBadges({ tags }) {
  const matching = tags.filter((t) => ALL_BADGES[t]);
  if (matching.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap justify-end">
      {matching.map((t) => <BadgeCircle key={t} tag={t} />)}
    </div>
  );
}

function LegendPanel({ open, onClose }) {
  if (!open) return null;

  const dietary = Object.entries(ALL_BADGES).filter(([k]) => INCLUDE_TAGS.includes(k));
  const allergens = Object.entries(ALL_BADGES).filter(([k]) => !INCLUDE_TAGS.includes(k));

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 z-50 w-64 umd-card rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-umd-black">Icon Legend</span>
          <button onClick={onClose} className="text-umd-gray-dark hover:text-umd-black p-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-[11px] font-semibold text-umd-gray-dark uppercase tracking-wide mb-2">Allergens</div>
        <div className="space-y-2 mb-4">
          {allergens.map(([key]) => (
            <div key={key} className="flex items-center gap-2.5">
              <BadgeCircle tag={key} size="lg" />
              <span className="text-sm text-umd-body">{ALL_BADGES[key].label}</span>
            </div>
          ))}
        </div>

        <div className="text-[11px] font-semibold text-umd-gray-dark uppercase tracking-wide mb-2">Dietary</div>
        <div className="space-y-2">
          {dietary.map(([key]) => (
            <div key={key} className="flex items-center gap-2.5">
              <BadgeCircle tag={key} size="lg" />
              <span className="text-sm text-umd-body">{ALL_BADGES[key].label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ItemRow({ item, isFav, onToggleFav }) {
  return (
    <div className="px-4 py-1.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(item.name); }}
          className="flex-shrink-0 p-0.5 transition-colors"
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={isFav ? '#e21833' : 'none'} stroke={isFav ? '#e21833' : '#d1d5db'} strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <span className="text-sm text-umd-black truncate">{item.name}</span>
      </div>
      <ItemBadges tags={item.tags} />
    </div>
  );
}

function StationGroup({ station, items, favorites, onToggleFav }) {
  const [open, setOpen] = useState(true);
  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);

  return (
    <div className="border border-umd-gray rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-umd-gray-light hover:bg-umd-gray transition-colors">
        <span className="font-semibold text-sm text-umd-black">{station}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-umd-body">{items.length} items</span>
          <svg className={`w-3.5 h-3.5 text-umd-gray-dark transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-umd-gray-light">
          {sorted.map((item, i) => (
            <ItemRow key={i} item={item} isFav={favorites.has(item.name)} onToggleFav={onToggleFav} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBar({ includeTags, excludeTags, onToggleInclude, onToggleExclude, onClear }) {
  const hasActive = includeTags.length > 0 || excludeTags.length > 0;

  return (
    <div className="umd-card rounded-xl px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-umd-gray-dark uppercase tracking-wide">Filters</span>
        {hasActive && <button onClick={onClear} className="text-xs text-umd-red hover:underline">Clear all</button>}
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] text-umd-body font-medium">Show only:</div>
        <div className="flex flex-wrap gap-1.5">
          {INCLUDE_TAGS.map((tag) => {
            const active = includeTags.includes(tag);
            const badge = ALL_BADGES[tag];
            return (
              <button key={tag} onClick={() => onToggleInclude(tag)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors flex items-center gap-1.5 ${
                  active ? 'bg-green-50 text-green-700 border-green-300' : 'bg-white text-umd-body border-umd-gray hover:border-umd-gray-dark'
                }`}>
                {badge && <span className="w-3.5 h-3.5 rounded-full text-white text-[7px] font-bold inline-flex items-center justify-center" style={{ backgroundColor: badge.hex }}>{badge.letter}</span>}
                {badge.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-[11px] text-umd-body font-medium">Exclude allergens:</div>
        <div className="flex flex-wrap gap-1.5">
          {EXCLUDE_TAGS.map((tag) => {
            const active = excludeTags.includes(tag);
            const badge = ALL_BADGES[tag];
            return (
              <button key={tag} onClick={() => onToggleExclude(tag)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors flex items-center gap-1.5 ${
                  active ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-umd-body border-umd-gray hover:border-umd-gray-dark'
                }`}>
                {badge && <span className="w-3.5 h-3.5 rounded-full text-white text-[7px] font-bold inline-flex items-center justify-center" style={{ backgroundColor: badge.hex }}>{badge.letter}</span>}
                {badge.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FavoritesAlert({ data, favorites }) {
  const matches = useMemo(() => {
    if (!data || favorites.size === 0) return [];
    const found = [];
    for (const [hall, meals] of Object.entries(data.halls)) {
      for (const [meal, stations] of Object.entries(meals)) {
        for (const [station, items] of Object.entries(stations)) {
          for (const item of items) {
            if (favorites.has(item.name)) {
              found.push({ name: item.name, hall, meal, station });
            }
          }
        }
      }
    }
    const unique = [];
    const seen = new Set();
    for (const f of found) {
      const key = `${f.name}__${f.hall}__${f.meal}`;
      if (!seen.has(key)) { seen.add(key); unique.push(f); }
    }
    return unique;
  }, [data, favorites]);

  if (matches.length === 0) return null;

  return (
    <div className="rounded-xl border border-pink-200 bg-pink-50/60 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span className="text-sm font-semibold text-red-800">
          {matches.length === 1 ? 'A favorite is on the menu today!' : `${matches.length} favorites on the menu today!`}
        </span>
      </div>
      <div className="space-y-1">
        {matches.map((m, i) => (
          <div key={i} className="flex items-baseline gap-1.5 text-xs">
            <span className="font-semibold text-umd-black">{m.name}</span>
            <span className="text-umd-gray-dark">— {m.hall}, {m.meal}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FavoritesManager({ favorites, onRemove, onClose }) {
  const sorted = useMemo(() => [...favorites].sort(), [favorites]);

  return (
    <div className="umd-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-umd-black">Your Favorites ({sorted.length})</span>
        <button onClick={onClose} className="text-umd-gray-dark hover:text-umd-black p-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-umd-body py-2">No favorites yet. Tap the heart next to any menu item to add it.</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {sorted.map((name) => (
            <div key={name} className="flex items-center justify-between py-1">
              <span className="text-sm text-umd-black">{name}</span>
              <button onClick={() => onRemove(name)} className="text-umd-gray-dark hover:text-red-500 p-0.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  const today = localDateStr();
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return localDateStr(d);
  })();
  const { menu, patchMenu } = useNavigationState();
  const date = menu.date ?? today;
  const setDate = (v) => patchMenu({ date: v });
  const activeHall = menu.activeHall;
  const setActiveHall = (h) => patchMenu({ activeHall: h });
  const activeMeal = menu.activeMeal;
  const setActiveMeal = (m) => patchMenu({ activeMeal: m });
  const includeTags = menu.includeTags;
  const excludeTags = menu.excludeTags;
  const legendOpen = menu.legendOpen;
  const setLegendOpen = (v) => patchMenu({ legendOpen: typeof v === 'function' ? v(menu.legendOpen) : v });
  const showFavManager = menu.showFavManager;
  const setShowFavManager = (v) => patchMenu({ showFavManager: typeof v === 'function' ? v(menu.showFavManager) : v });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState(() => new Set());

  const refreshFavorites = useCallback(async () => {
    try {
      const rows = await apiGet('/api/favorites');
      setFavorites(new Set(rows.map((r) => r.name)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const rows = await apiGet('/api/favorites');
        let next = new Set(rows.map((r) => r.name));
        try {
          const raw = localStorage.getItem('menu_favorites');
          if (raw) {
            const old = JSON.parse(raw);
            for (const n of old) {
              if (typeof n === 'string' && n && !next.has(n)) {
                await apiPost('/api/favorites', { name: n }).catch(() => {});
                next.add(n);
              }
            }
            localStorage.removeItem('menu_favorites');
          }
        } catch { /* ignore migration */ }
        setFavorites(next);
      } catch { /* ignore */ }
    })();
    const onEvt = () => { refreshFavorites(); };
    window.addEventListener('favorites-updated', onEvt);
    return () => window.removeEventListener('favorites-updated', onEvt);
  }, [refreshFavorites]);

  async function toggleFav(name) {
    const had = favorites.has(name);
    try {
      if (had) await apiDelete(`/api/favorites/${encodeURIComponent(name)}`);
      else await apiPost('/api/favorites', { name });
      await refreshFavorites();
    } catch { /* ignore */ }
  }

  async function removeFav(name) {
    try {
      await apiDelete(`/api/favorites/${encodeURIComponent(name)}`);
      await refreshFavorites();
    } catch { /* ignore */ }
  }

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet(`/api/menu/browse?dt=${date}`);
      setData(resp);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  useEffect(() => {
    if (data && activeHall && data.halls[activeHall]) {
      const meals = Object.keys(data.halls[activeHall]);
      const ordered = MEAL_ORDER.filter((m) => meals.includes(m));
      if (!activeMeal || !ordered.includes(activeMeal)) patchMenu({ activeMeal: ordered[0] || null });
    }
  }, [activeHall, data, activeMeal, patchMenu]);

  function toggleInclude(tag) {
    patchMenu({
      includeTags: includeTags.includes(tag) ? includeTags.filter((t) => t !== tag) : [...includeTags, tag],
    });
  }
  function toggleExclude(tag) {
    patchMenu({
      excludeTags: excludeTags.includes(tag) ? excludeTags.filter((t) => t !== tag) : [...excludeTags, tag],
    });
  }

  const filteredStations = useMemo(() => {
    if (!data || !activeHall || !activeMeal) return {};
    const raw = data.halls[activeHall]?.[activeMeal] || {};
    if (includeTags.length === 0 && excludeTags.length === 0) return raw;
    const result = {};
    for (const [station, items] of Object.entries(raw)) {
      const filtered = items.filter((item) => {
        if (includeTags.length > 0 && !includeTags.every((t) => item.tags.includes(t))) return false;
        if (excludeTags.length > 0 && excludeTags.some((t) => item.tags.includes(t))) return false;
        return true;
      });
      if (filtered.length > 0) result[station] = filtered;
    }
    return result;
  }, [data, activeHall, activeMeal, includeTags, excludeTags]);

  const filteredCount = Object.values(filteredStations).reduce((s, items) => s + items.length, 0);
  const halls = data ? Object.keys(data.halls).sort() : [];
  const meals = data && activeHall && data.halls[activeHall]
    ? MEAL_ORDER.filter((m) => Object.keys(data.halls[activeHall]).includes(m)) : [];
  const tooFarAhead = isTooFarAhead(date, today, data?.latest_date);
  return (
    <div className="umd-container px-4 py-6 space-y-5">
      {loading ? (
        <div className="text-center py-16 text-umd-body">Loading menu...</div>
      ) : !data || halls.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-4">
          <div className="text-6xl mb-4">{tooFarAhead ? '📅🐢' : '🌴🐢'}</div>
          <h2 className="text-2xl umd-hero-title text-umd-black mb-2">
            {tooFarAhead ? "You're too far ahead!" : 'Terps are enjoying their summer!'}
          </h2>
          <p className="text-umd-body text-sm max-w-md mb-6">
            {tooFarAhead ? (
              <>
                UMD hasn&apos;t posted menus for{' '}
                <span className="font-semibold text-umd-black">{date}</span> yet. Try an earlier date
                {data?.latest_date ? (
                  <> — menus are available through{' '}
                    <span className="font-semibold text-umd-black">{data.latest_date}</span>.</>
                ) : '.'}
              </>
            ) : date === today ? (
              <>
                No menus posted for today <span className="font-semibold text-umd-black"></span>. See you during the semester!
              </>
            ) : (
              <>
                No menus posted for this day <span className="font-semibold text-umd-black"></span>. See you during the semester!
              </>
            )}
          </p>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                const d = new Date(date + 'T12:00:00');
                d.setDate(d.getDate() - 1);
                setDate(localDateStr(d));
              }}
              className="p-2 rounded-lg hover:bg-umd-gray-light transition-colors"
              title="Previous day"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              type="date"
              value={date}
              max={maxDate}
              onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
              className="border border-umd-gray rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red"
            />
            <button
              onClick={() => {
                const d = new Date(date + 'T12:00:00');
                d.setDate(d.getDate() + 1);
                setDate(localDateStr(d));
              }}
              className="p-2 rounded-lg hover:bg-umd-gray-light transition-colors"
              title="Next day"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {date !== today && (
            <button
              onClick={() => setDate(today)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-umd-red text-white hover:bg-umd-red-dark transition-colors"
            >
              Back to today
            </button>
          )}
        </div>
      ) : !activeHall ? (
        <div className="flex flex-col items-center py-16">
          <div className="text-5xl mb-4">🐢</div>
          <h1 className="text-4xl umd-hero-title text-umd-black mb-2">Today's Menu</h1>
          <p className="text-umd-body text-sm mb-8">Pick a dining hall to see what's cooking</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {halls.map((h) => (
              <button key={h} onClick={() => setActiveHall(h)}
                className="px-6 py-4 rounded-xl text-base font-bold umd-card hover:border-umd-red hover:text-umd-red transition-colors">
                {h}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-2xl sm:text-4xl umd-hero-title text-umd-black">Today's Menu</h1>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  const d = new Date(date + 'T12:00:00');
                  d.setDate(d.getDate() - 1);
                  setDate(localDateStr(d));
                }}
                className="p-1.5 sm:p-2 rounded-lg transition-colors hover:bg-umd-gray-light">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <input type="date" value={date} max={maxDate}
                onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
                className="border border-umd-gray rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red" />
              <button onClick={() => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + 1); setDate(localDateStr(d)); }}
                className="p-1.5 sm:p-2 hover:bg-umd-gray-light rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              {date !== today && (
                <button onClick={() => setDate(today)} className="text-xs text-umd-red font-semibold hover:underline ml-1">Today</button>
              )}

              {/* favorites */}
              <button
                onClick={() => setShowFavManager((o) => !o)}
                className={`p-1.5 sm:p-2 rounded-lg border transition-colors ${showFavManager ? 'bg-red-500 text-white border-red-500' : 'border-umd-gray text-umd-gray-dark hover:border-red-400 hover:text-red-500'}`}
                title="My favorites"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={favorites.size > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>

              {/* legend */}
              <div className="relative">
                <button
                  onClick={() => setLegendOpen(!legendOpen)}
                  className={`p-1.5 sm:p-2 rounded-lg border transition-colors ${legendOpen ? 'bg-umd-red text-white border-umd-red' : 'border-umd-gray text-umd-gray-dark hover:border-umd-red hover:text-umd-red'}`}
                  title="Icon legend"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <LegendPanel open={legendOpen} onClose={() => setLegendOpen(false)} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {halls.map((h) => (
              <button key={h} onClick={() => setActiveHall(h)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeHall === h ? 'bg-umd-red text-white' : 'bg-white text-umd-black border border-umd-gray hover:border-umd-red hover:text-umd-red'
                }`}>{h}</button>
            ))}
          </div>

          <FavoritesAlert data={data} favorites={favorites} />

          {showFavManager && (
            <FavoritesManager favorites={favorites} onRemove={removeFav} onClose={() => setShowFavManager(false)} />
          )}

          {meals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meals.map((m) => (
                <button key={m} onClick={() => setActiveMeal(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeMeal === m ? 'bg-umd-gold text-umd-black' : 'bg-umd-gray-light text-umd-body hover:bg-umd-gray'
                  }`}>{m}</button>
              ))}
            </div>
          )}

          <FilterBar includeTags={includeTags} excludeTags={excludeTags}
            onToggleInclude={toggleInclude} onToggleExclude={toggleExclude}
            onClear={() => { patchMenu({ includeTags: [], excludeTags: [] }); }} />

          {(includeTags.length > 0 || excludeTags.length > 0) && (
            <div className="text-xs text-umd-body">
              Showing <span className="font-semibold text-umd-black">{filteredCount}</span> items matching filters
            </div>
          )}

          {Object.keys(filteredStations).length > 0 ? (
            <div className="space-y-2">
              {Object.keys(filteredStations).sort().map((station) => (
                <StationGroup key={station} station={station} items={filteredStations[station]} favorites={favorites} onToggleFav={toggleFav} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-umd-body text-sm">No items match the current filters.</div>
          )}
        </>
      )}
    </div>
  );
}
