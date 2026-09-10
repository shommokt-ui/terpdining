import { useState, useRef, useEffect, useMemo } from 'react';
import { apiGet } from '../api';

const OZ_UNIT = /^(fl\s?oz|oz|ounce|ounces)$/;
const COUNT_UNIT = /^(each|ea|slice|slices|piece|pieces|pc|pcs)$/;

// Parse the dining-hall label serving (e.g. "4 oz", "1 EACH", "3 slices") into
// a quantity + normalized unit. UMD labels carry no gram weight, so the only
// honest scaling is a linear multiple of this serving — plus a direct oz entry
// when the label itself is in ounces.
function parseServing(raw) {
  const text = (raw || '').trim();
  if (!text) return { qty: 1, unit: 'serving', kind: 'generic', raw: '' };

  const m = text.match(/^([\d./\s]+?)\s*([a-z].*)$/i);
  const qtyStr = m ? m[1].trim() : '';
  const qty = parseFraction(qtyStr) || 1;
  const unitRaw = (m ? m[2] : text).trim().toLowerCase();

  if (OZ_UNIT.test(unitRaw)) return { qty, unit: 'oz', kind: 'oz', raw: text };
  if (COUNT_UNIT.test(unitRaw)) {
    let unit = unitRaw;
    if (/^(each|ea)$/.test(unitRaw)) unit = 'each';
    else if (/^slices?$/.test(unitRaw)) unit = 'slice';
    else if (/^pieces?$/.test(unitRaw)) unit = 'piece';
    else if (/^pcs?$/.test(unitRaw)) unit = 'piece';
    return { qty, unit, kind: 'count', raw: text };
  }
  return { qty, unit: unitRaw || 'serving', kind: 'generic', raw: text };
}

// "4 1/2" -> 4.5, "1/2" -> 0.5, "3" -> 3
function parseFraction(s) {
  if (!s) return 0;
  const parts = s.trim().split(/\s+/);
  let total = 0;
  for (const p of parts) {
    if (p.includes('/')) {
      const [n, d] = p.split('/').map(Number);
      if (d) total += n / d;
    } else {
      total += parseFloat(p) || 0;
    }
  }
  return total;
}

function trimNum(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// Collapse same-named food items into one result with per-hall variants.
function groupByName(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { name: r.name, variants: [] });
    map.get(key).variants.push(r);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    // Most recently served variant first — that's the one a hall gets by default.
    g.variants.sort((a, b) => (b.last_served || '').localeCompare(a.last_served || ''));
    g.halls = [...new Set(g.variants.flatMap((v) => v.halls || []))].sort();
    g.varies =
      new Set(g.variants.map((v) => `${v.serving_size}|${v.calories}|${v.protein_g}`)).size > 1;
  }
  return groups;
}

const SERVING_CHIPS = [0.5, 1, 1.5, 2, 3];
const OZ_CHIPS = [2, 3, 4, 6, 8, 12];

export default function FoodSearch({ mealType, onLog }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // a group: { name, variants, halls, varies }
  const [hall, setHall] = useState(null);
  const [mode, setMode] = useState('serving'); // 'serving' (× label serving) | 'oz'
  const [amount, setAmount] = useState('1');
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // The specific food item for the chosen hall (or the only one).
  const variant = useMemo(() => {
    if (!selected) return null;
    const vs = selected.variants;
    if (vs.length === 1) return vs[0];
    return vs.find((v) => (v.halls || []).includes(hall)) || vs[0];
  }, [selected, hall]);

  const serving = useMemo(() => parseServing(variant?.serving_size), [variant]);

  useEffect(() => {
    if (variant) {
      const startOz = serving.kind === 'oz';
      setMode(startOz ? 'oz' : 'serving');
      setAmount(startOz ? trimNum(serving.qty) : '1');
    } else {
      setMode('serving');
      setAmount('1');
    }
  }, [variant, serving.kind, serving.qty]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleQueryChange(val) {
    setQuery(val);
    setSelected(null);
    setHall(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiGet(`/api/nutrition/search?q=${encodeURIComponent(val)}`);
        setResults(groupByName(data.results || []).slice(0, 20));
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectGroup(group) {
    setSelected(group);
    setHall(group.variants.length > 1 ? group.halls[0] ?? null : null);
    setQuery(group.name);
    setShowResults(false);
  }

  const amtNum = Math.max(0, parseFloat(amount) || 0);
  const effectiveServings =
    mode === 'oz' && serving.qty > 0 ? amtNum / serving.qty : amtNum;

  function switchMode(next) {
    if (next === mode) return;
    // Keep the physical quantity constant when toggling servings <-> oz.
    if (next === 'oz') setAmount(trimNum(effectiveServings * serving.qty));
    else setAmount(trimNum(effectiveServings));
    setMode(next);
  }

  let portionLabel;
  if (mode === 'oz') {
    portionLabel = `${trimNum(amtNum)} oz`;
  } else if (serving.kind === 'count' && serving.qty === 1) {
    portionLabel = `${trimNum(amtNum)} ${serving.unit}${amtNum === 1 ? '' : 's'}`;
  } else if (amtNum === 1) {
    portionLabel = serving.raw || '1 serving';
  } else {
    portionLabel = serving.raw
      ? `${trimNum(amtNum)} × ${serving.raw}`
      : `${trimNum(amtNum)} servings`;
  }

  const chips = mode === 'oz' ? OZ_CHIPS : SERVING_CHIPS;
  const multiHall = selected && selected.variants.length > 1 && selected.halls.length > 0;

  function handleLog() {
    if (!variant || amtNum <= 0) return;
    onLog({
      food_item_id: variant.food_item_id,
      food_name: selected.name,
      servings: effectiveServings,
      portion_label: portionLabel,
      meal_type: mealType,
      calories: variant.calories,
      protein_g: variant.protein_g,
      total_fat_g: variant.total_fat_g,
      total_carbs_g: variant.total_carbs_g,
    });
    setQuery('');
    setSelected(null);
    setHall(null);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search dining hall food..."
          className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-umd-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {showResults && results.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#1c1c1c] border border-umd-gray rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {results.map((group, i) => {
              const v = group.variants[0];
              return (
                <button
                  key={i}
                  onClick={() => selectGroup(group)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-umd-gray-light transition-colors border-b border-umd-gray-light last:border-b-0"
                >
                  <div className="font-medium text-umd-black">
                    {group.name}
                    {group.variants.length > 1 && (
                      <span className="ml-2 text-[10px] font-semibold text-umd-red align-middle">
                        varies by hall
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-umd-body mt-0.5">
                    {v.calories || 0} cal · {v.protein_g || 0}g P · {v.total_fat_g || 0}g F · {v.total_carbs_g || 0}g C
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && variant && (
        <div className="mt-3 space-y-3">
          {/* dining hall — only when same-named items differ across halls */}
          {multiHall && (
            <div>
              <div className="text-xs font-semibold text-umd-black mb-2">Dining hall</div>
              <div className="flex flex-wrap gap-1.5">
                {selected.halls.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHall(h)}
                    className={`px-3 py-2 rounded-lg border text-xs transition-colors ${
                      hall === h
                        ? 'border-umd-red bg-red-50 dark:bg-red-950/40 text-umd-red font-semibold'
                        : 'border-umd-gray bg-white dark:bg-[#1c1c1c] text-umd-body hover:border-umd-red hover:text-umd-red'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
              {selected.varies && (
                <div className="text-[11px] text-umd-body/70 mt-1.5">
                  Serving size and macros differ by hall.
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-umd-body">
              Label serving:{' '}
              <span className="font-semibold text-umd-black">
                {serving.raw || 'not published'}
              </span>
            </div>
            {variant.label_url && (
              <a
                href={variant.label_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-umd-red font-semibold hover:underline whitespace-nowrap"
              >
                Full nutrition label
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5m0 0v5m0-5L10 14M9 5H5v14h14v-4" />
                </svg>
              </a>
            )}
          </div>

          {/* unit toggle — only meaningful when the label is oz-based */}
          {serving.kind === 'oz' && (
            <div className="flex gap-1.5">
              {['serving', 'oz'].map((u) => (
                <button
                  key={u}
                  onClick={() => switchMode(u)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                    mode === u
                      ? 'border-umd-red bg-red-50 dark:bg-red-950/40 text-umd-red font-semibold'
                      : 'border-umd-gray bg-white dark:bg-[#1c1c1c] text-umd-body hover:border-umd-red hover:text-umd-red'
                  }`}
                >
                  {u === 'serving' ? `× serving (${serving.raw})` : 'Ounces'}
                </button>
              ))}
            </div>
          )}

          {/* amount */}
          <div>
            <div className="text-xs font-semibold text-umd-black mb-2">
              {mode === 'oz' ? 'How many ounces?' : 'How much?'}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((n) => (
                <button
                  key={n}
                  onClick={() => setAmount(String(n))}
                  className={`h-9 min-w-9 px-2 rounded-lg border text-sm font-semibold transition-colors ${
                    amtNum === n
                      ? 'border-umd-red bg-umd-red text-white'
                      : 'border-umd-gray bg-white dark:bg-[#1c1c1c] text-umd-body hover:border-umd-red hover:text-umd-red'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min="0"
                step="0.25"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label={mode === 'oz' ? 'Ounces' : 'Number of servings'}
                className="h-9 w-20 bg-white dark:bg-[#1c1c1c] text-umd-black border border-umd-gray rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red"
              />
              <span className="text-xs text-umd-body">
                {mode === 'oz' ? 'oz' : serving.kind === 'count' && serving.qty === 1 ? serving.unit : '× serving'}
              </span>
            </div>
            {serving.raw && mode !== 'oz' && (
              <div className="text-[11px] text-umd-body/70 mt-2">
                1 = one dining hall label serving ({serving.raw}). Enter any amount — macros scale linearly.
              </div>
            )}
          </div>

          {/* preview + log */}
          <div className="bg-umd-gray-light rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-umd-black">{portionLabel}</span>
              <span className="text-sm font-bold text-umd-black">
                {Math.round((variant.calories || 0) * effectiveServings)} cal
              </span>
            </div>
            <div className="flex gap-4 text-xs text-umd-body">
              <span>{Math.round((variant.protein_g || 0) * effectiveServings * 10) / 10}g protein</span>
              <span>{Math.round((variant.total_fat_g || 0) * effectiveServings * 10) / 10}g fat</span>
              <span>{Math.round((variant.total_carbs_g || 0) * effectiveServings * 10) / 10}g carbs</span>
            </div>
            <button
              onClick={handleLog}
              disabled={amtNum <= 0}
              className="w-full bg-umd-red hover:bg-umd-red-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg text-sm transition-colors mt-1"
            >
              + Log {portionLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
