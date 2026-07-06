import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigationState } from '../context/NavigationStateContext';
import { useToast } from '../context/ToastContext';
import Drawer from '../components/Drawer';

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

// Approximate UMD dining hall serving windows, in hours.
const MEAL_HOURS = {
  Breakfast: [7, 11],
  Brunch: [9, 14],
  Lunch: [11, 16],
  Dinner: [16.5, 21],
};

function isServingNow(meal) {
  const range = MEAL_HOURS[meal];
  if (!range) return false;
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  return h >= range[0] && h < range[1];
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

function LegendDrawer({ open, onClose }) {
  const dietary = Object.entries(ALL_BADGES).filter(([k]) => INCLUDE_TAGS.includes(k));
  const allergens = Object.entries(ALL_BADGES).filter(([k]) => !INCLUDE_TAGS.includes(k));

  return (
    <Drawer open={open} onClose={onClose} title="Icon Legend">
      <div className="text-[11px] font-semibold text-umd-gray-dark uppercase tracking-wide mb-2">Allergens</div>
      <div className="space-y-2.5 mb-5">
        {allergens.map(([key]) => (
          <div key={key} className="flex items-center gap-2.5">
            <BadgeCircle tag={key} size="lg" />
            <span className="text-sm text-umd-body">{ALL_BADGES[key].label}</span>
          </div>
        ))}
      </div>

      <div className="text-[11px] font-semibold text-umd-gray-dark uppercase tracking-wide mb-2">Dietary</div>
      <div className="space-y-2.5">
        {dietary.map(([key]) => (
          <div key={key} className="flex items-center gap-2.5">
            <BadgeCircle tag={key} size="lg" />
            <span className="text-sm text-umd-body">{ALL_BADGES[key].label}</span>
          </div>
        ))}
      </div>
    </Drawer>
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

function StationGroup({ station, items, favorites, onToggleFav, expandSignal }) {
  const [open, setOpen] = useState(true);
  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);

  useEffect(() => {
    if (expandSignal.version > 0) setOpen(expandSignal.open);
  }, [expandSignal]);

  return (
    <div className="border border-umd-gray rounded-lg overflow-hidden bg-white dark:bg-[#1c1c1c]">
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
                  active ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700/60' : 'bg-white dark:bg-[#1c1c1c] text-umd-body border-umd-gray hover:border-umd-gray-dark'
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
                  active ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800/60' : 'bg-white dark:bg-[#1c1c1c] text-umd-body border-umd-gray hover:border-umd-gray-dark'
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
  const grouped = useMemo(() => {
    if (!data || favorites.size === 0) return [];
    // name -> hall -> Set of meals
    const byItem = new Map();
    for (const [hall, meals] of Object.entries(data.halls)) {
      for (const [meal, stations] of Object.entries(meals)) {
        for (const items of Object.values(stations)) {
          for (const item of items) {
            if (!favorites.has(item.name)) continue;
            if (!byItem.has(item.name)) byItem.set(item.name, new Map());
            const hallMap = byItem.get(item.name);
            if (!hallMap.has(hall)) hallMap.set(hall, new Set());
            hallMap.get(hall).add(meal);
          }
        }
      }
    }
    return [...byItem.entries()]
      .map(([name, hallMap]) => ({
        name,
        places: [...hallMap.entries()].map(([hall, mealSet]) => ({
          hall,
          meals: MEAL_ORDER.filter((m) => mealSet.has(m)),
        })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, favorites]);

  if (grouped.length === 0) return null;

  return (
    <div className="rounded-xl border border-pink-200 bg-pink-50/60 dark:border-pink-900/50 dark:bg-pink-950/20 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span className="text-sm font-semibold text-red-800 dark:text-red-300">
          {grouped.length === 1 ? 'A favorite is on the menu today!' : `${grouped.length} favorites on the menu today!`}
        </span>
      </div>
      <div className="divide-y divide-pink-200/60 dark:divide-pink-900/30">
        {grouped.map((g) => (
          <div key={g.name} className="py-1.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-xs font-semibold text-umd-black sm:w-44 shrink-0 truncate">{g.name}</span>
            <div className="flex flex-wrap gap-1">
              {g.places.map((p) => (
                <span
                  key={p.hall}
                  className="inline-flex items-center gap-1 text-[11px] rounded-full bg-white/70 dark:bg-white/10 border border-pink-200 dark:border-pink-900/40 px-2 py-0.5 text-umd-body"
                >
                  <span className="font-medium text-umd-black">
                    {p.hall.replace(' Dining Hall', '')}
                  </span>
                  <span className="text-umd-gray-dark">{p.meals.join(' & ')}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="skeleton h-9 w-48" />
        <div className="skeleton h-9 w-64" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-32" />
        <div className="skeleton h-9 w-40" />
        <div className="skeleton h-9 w-24" />
      </div>
      <div className="skeleton h-11 w-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="border border-umd-gray rounded-lg overflow-hidden">
          <div className="skeleton h-10 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-umd-gray-dark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search the menu..."
        className="w-full bg-white dark:bg-[#1c1c1c] text-umd-black border border-umd-gray rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-umd-gray-dark hover:text-umd-red"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SearchResults({ data, query, includeTags, excludeTags, favorites, onToggleFav }) {
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!data || !q) return [];
    const found = [];
    for (const [hall, meals] of Object.entries(data.halls)) {
      for (const [meal, stations] of Object.entries(meals)) {
        for (const [station, items] of Object.entries(stations)) {
          for (const item of items) {
            if (!item.name.toLowerCase().includes(q)) continue;
            if (includeTags.length > 0 && !includeTags.every((t) => item.tags.includes(t))) continue;
            if (excludeTags.length > 0 && excludeTags.some((t) => item.tags.includes(t))) continue;
            found.push({ item, hall, meal, station });
          }
        }
      }
    }
    found.sort((a, b) => a.item.name.localeCompare(b.item.name));
    return found;
  }, [data, q, includeTags, excludeTags]);

  if (matches.length === 0) {
    return (
      <div className="text-center py-10 text-umd-body text-sm">
        No menu items match "{query}" today.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-umd-body">
        <span className="font-semibold text-umd-black">{matches.length}</span> item{matches.length === 1 ? '' : 's'} match "{query}"
      </div>
      <div className="umd-card rounded-xl divide-y divide-umd-gray-light overflow-hidden">
        {matches.map((m, i) => {
          const isFav = favorites.has(m.item.name);
          return (
            <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => onToggleFav(m.item.name)}
                  className="flex-shrink-0 p-0.5 transition-colors"
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={isFav ? '#e21833' : 'none'} stroke={isFav ? '#e21833' : '#d1d5db'} strokeWidth={2}>
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <div className="text-sm text-umd-black truncate">{m.item.name}</div>
                  <div className="text-xs text-umd-gray-dark truncate">{m.hall} &middot; {m.meal} &middot; {m.station}</div>
                </div>
              </div>
              <ItemBadges tags={m.item.tags} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FavoritesDrawer({ open, favorites, onRemove, onClose }) {
  const sorted = useMemo(() => [...favorites].sort(), [favorites]);

  return (
    <Drawer open={open} onClose={onClose} title={`Your Favorites (${sorted.length})`}>
      {sorted.length === 0 ? (
        <p className="text-sm text-umd-body py-2">No favorites yet. Tap the heart next to any menu item to add it.</p>
      ) : (
        <div className="divide-y divide-umd-gray-light">
          {sorted.map((name) => (
            <div key={name} className="flex items-center justify-between py-2.5 gap-2">
              <span className="text-sm text-umd-black min-w-0 truncate">{name}</span>
              <button onClick={() => onRemove(name)} className="text-umd-gray-dark hover:text-red-500 p-1 shrink-0" title="Remove">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </Drawer>
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
  const searchQuery = menu.searchQuery;
  const setSearchQuery = (v) => patchMenu({ searchQuery: v });
  const legendOpen = menu.legendOpen;
  const setLegendOpen = (v) => patchMenu({ legendOpen: typeof v === 'function' ? v(menu.legendOpen) : v });
  const showFavManager = menu.showFavManager;
  const setShowFavManager = (v) => patchMenu({ showFavManager: typeof v === 'function' ? v(menu.showFavManager) : v });

  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState(() => new Set());
  const [expandSignal, setExpandSignal] = useState({ version: 0, open: true });

  const refreshFavorites = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await apiGet('/api/favorites');
      setFavorites(new Set(rows.map((r) => r.name)));
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!user) { setFavorites(new Set()); return; }
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
  }, [user, refreshFavorites]);

  async function toggleFav(name) {
    if (!user) {
      toast('Sign in to save favorites');
      navigate('/login');
      return;
    }
    const had = favorites.has(name);
    try {
      if (had) await apiDelete(`/api/favorites/${encodeURIComponent(name)}`);
      else await apiPost('/api/favorites', { name });
      await refreshFavorites();
    } catch {
      toast(`Couldn't ${had ? 'remove' : 'save'} favorite. Check your connection.`);
    }
  }

  async function removeFav(name) {
    try {
      await apiDelete(`/api/favorites/${encodeURIComponent(name)}`);
      await refreshFavorites();
    } catch {
      toast("Couldn't remove favorite. Check your connection.");
    }
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
  const hallsWithData = data ? Object.keys(data.halls) : [];
  const halls = data
    ? (data.all_halls && data.all_halls.length > 0 ? data.all_halls : Object.keys(data.halls).sort())
    : [];
  const hallHasData = Boolean(activeHall && data?.halls[activeHall]);
  const meals = data && activeHall && data.halls[activeHall]
    ? MEAL_ORDER.filter((m) => Object.keys(data.halls[activeHall]).includes(m)) : [];
  const tooFarAhead = isTooFarAhead(date, today, data?.latest_date);
  return (
    <div className="umd-container px-4 py-6 space-y-5">
      {loading ? (
        <MenuSkeleton />
      ) : !data || hallsWithData.length === 0 ? (
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
                  <>. Menus are available through{' '}
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
              className="bg-white dark:bg-[#1c1c1c] text-umd-black border border-umd-gray rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red"
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
            {halls.map((h) => {
              const closed = !data.halls[h];
              return (
                <button key={h} onClick={() => setActiveHall(h)}
                  className={`px-6 py-4 rounded-xl text-base font-bold umd-card transition-colors ${
                    closed ? 'opacity-60 hover:border-umd-gray-dark' : 'hover:border-umd-red hover:text-umd-red'
                  }`}>
                  {h}
                  {closed && (
                    <span className="block text-[11px] font-medium text-umd-gray-dark mt-0.5">No menu today</span>
                  )}
                </button>
              );
            })}
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
                className="bg-white dark:bg-[#1c1c1c] text-umd-black border border-umd-gray rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red" />
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
              <button
                onClick={() => setLegendOpen(true)}
                className="p-1.5 sm:p-2 rounded-lg border border-umd-gray text-umd-gray-dark hover:border-umd-red hover:text-umd-red transition-colors"
                title="Icon legend"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {halls.map((h) => (
              <button key={h} onClick={() => setActiveHall(h)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeHall === h ? 'bg-umd-red text-white' : 'bg-white dark:bg-[#1c1c1c] text-umd-black border border-umd-gray hover:border-umd-red hover:text-umd-red'
                }`}>{h}</button>
            ))}
          </div>

          {!hallHasData ? (
            <div className="flex flex-col items-center text-center py-16 px-4">
              <div className="text-6xl mb-4">🌴🐢</div>
              <h2 className="text-2xl umd-hero-title text-umd-black mb-2">Terps are on their summer break!</h2>
              <p className="text-umd-body text-sm max-w-md">
                No menu found for <span className="font-semibold text-umd-black">{activeHall}</span> on
                this date. It may be closed, since some dining halls shut down over breaks. Check UMD dining
                hours to be sure, or pick another hall above.
              </p>
            </div>
          ) : (
            <>
              <SearchBar value={searchQuery} onChange={setSearchQuery} />

              {searchQuery.trim() ? (
                <SearchResults
                  data={data}
                  query={searchQuery}
                  includeTags={includeTags}
                  excludeTags={excludeTags}
                  favorites={favorites}
                  onToggleFav={toggleFav}
                />
              ) : (
                <>
                  <FavoritesAlert data={data} favorites={favorites} />

                  {meals.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {meals.map((m) => {
                        const serving = date === today && isServingNow(m);
                        return (
                          <button key={m} onClick={() => setActiveMeal(m)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                              activeMeal === m ? 'bg-umd-gold text-umd-black' : 'bg-umd-gray-light text-umd-body hover:bg-umd-gray'
                            }`}
                            title={serving ? 'Serving now' : undefined}>
                            {serving && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <FilterBar includeTags={includeTags} excludeTags={excludeTags}
                    onToggleInclude={toggleInclude} onToggleExclude={toggleExclude}
                    onClear={() => { patchMenu({ includeTags: [], excludeTags: [] }); }} />

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-umd-body">
                      {(includeTags.length > 0 || excludeTags.length > 0) && (
                        <>Showing <span className="font-semibold text-umd-black">{filteredCount}</span> items matching filters</>
                      )}
                    </div>
                    {Object.keys(filteredStations).length > 1 && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExpandSignal((s) => ({ version: s.version + 1, open: true }))}
                          className="text-xs text-umd-body hover:text-umd-red hover:underline"
                        >
                          Expand all
                        </button>
                        <button
                          onClick={() => setExpandSignal((s) => ({ version: s.version + 1, open: false }))}
                          className="text-xs text-umd-body hover:text-umd-red hover:underline"
                        >
                          Collapse all
                        </button>
                      </div>
                    )}
                  </div>

                  {Object.keys(filteredStations).length > 0 ? (
                    <div className="columns-1 md:columns-2 xl:columns-3 gap-3">
                      {Object.keys(filteredStations).sort().map((station) => (
                        <div key={station} className="break-inside-avoid mb-3">
                          <StationGroup station={station} items={filteredStations[station]} favorites={favorites} onToggleFav={toggleFav} expandSignal={expandSignal} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-umd-body text-sm">No items match the current filters.</div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      <FavoritesDrawer
        open={showFavManager}
        favorites={favorites}
        onRemove={removeFav}
        onClose={() => setShowFavManager(false)}
      />
      <LegendDrawer open={legendOpen} onClose={() => setLegendOpen(false)} />
    </div>
  );
}
