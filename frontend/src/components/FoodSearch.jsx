import { useState, useRef, useEffect, useMemo } from 'react';
import { apiGet } from '../api';

const PORTION_TYPES = [
  {
    id: 'spoonful', label: 'Spoonful', multiplier: 0.33,
    match: /soup|chili|stew|sauce|salsa|hummus|guacamole|dip|spread|butter|jam|jelly|oatmeal|yogurt|pudding|mousse|rice|grain|quinoa|couscous|grits|mashed|cottage|applesauce|gravy|curry(?!.*chicken)|dressing|pesto|tahini|tzatziki|aioli|sour cream|cream cheese|baba|chutney/i,
  },
  {
    id: 'scoop', label: 'Scoop', multiplier: 0.5,
    match: /ice cream|soft serve|gelato|sorbet|frozen yogurt|rice|mashed|potato salad|tuna salad|chicken salad|egg salad|coleslaw|mac.*cheese|cottage|granola/i,
  },
  {
    id: 'slice', label: 'Slice', multiplier: 0.5,
    match: /pizza|bread|toast|cake|pie|quiche|meatloaf|meat loaf|ham\b|turkey breast|roast beef|watermelon|cantaloupe|honeydew|melon|french toast|focaccia|cornbread|banana bread|pound cake|cheesecake|flatbread|ciabatta|frittata|lasagna|loaf/i,
  },
  {
    id: 'piece', label: 'Piece', multiplier: 1.0,
    match: /chicken|drumstick|thigh|wing|breast|nugget|tender|strip|leg\b|cookie|brownie|muffin|bagel|roll\b|bun\b|biscuit|croissant|donut|doughnut|scone|pretzel|waffle|pancake|egg\b|omelet|omelette|sushi|dumpling|egg roll|spring roll|falafel|samosa|empanada|taco|burrito|wrap|sandwich|slider|burger|hot dog|corn dog|fruit\b|apple\b|banana\b|orange\b|pear\b|peach|plum|nectarine|danish|eclair|cannoli|cupcake|tart\b|crab cake|fish fillet|salmon|tilapia|cod\b|shrimp|rib\b|chop\b|steak/i,
  },
  {
    id: 'cup', label: 'Cup', multiplier: 1.0,
    match: /soup|chili|stew|salad|vegetable|broccoli|carrot|corn\b|peas\b|green bean|rice|cereal|yogurt|fruit|berr|grape|cherry|cherries|melon|juice|milk|coffee|tea\b|lemonade|water\b|smoothie|shake|cider|cocoa|hot chocolate|granola|oatmeal|chowder|bisque|gumbo|coleslaw|bean|lentil|edamame|kimchi|couscous|quinoa|grits|cottage|applesauce/i,
  },
  {
    id: 'bowl', label: 'Bowl', multiplier: 1.5,
    match: /soup|chili|stew|cereal|salad|pasta|spaghetti|penne|linguine|fettuccin|rigatoni|rotini|mac.*cheese|noodle|ramen|udon|lo mein|chow mein|pad thai|rice|oatmeal|stir.?fry|curry|gumbo|chowder|bisque|pho|fried rice|jambalaya|risotto|grain bowl|poke|acai|bibimbap|burrito bowl/i,
  },
  {
    id: 'plate', label: 'Plate', multiplier: 2.0,
    match: /pasta|spaghetti|penne|linguine|fettuccin|rigatoni|stir.?fry|curry|fried rice|chicken.*rice|beef.*rice|salmon|tilapia|fish|entree|special|casserole|lasagna|pot pie|shepherd|jambalaya|risotto|paella|bibimbap|teriyaki|general tso|orange chicken|kung pao|sesame chicken|bourbon chicken/i,
  },
];

function getBestPortion(foodName) {
  if (!foodName) return null;
  const matches = PORTION_TYPES.filter((pt) => pt.match.test(foodName));
  return matches.length > 0 ? matches[0] : null;
}

function getAllPortions(foodName) {
  if (!foodName) return [];
  return PORTION_TYPES.filter((pt) => pt.match.test(foodName));
}

const QTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function FoodSearch({ mealType, onLog }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [portion, setPortion] = useState(null);
  const [qty, setQty] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  const availablePortions = useMemo(
    () => selected ? getAllPortions(selected.name) : [],
    [selected]
  );

  useEffect(() => {
    if (selected) {
      const best = getBestPortion(selected.name);
      setPortion(best);
    } else {
      setPortion(null);
    }
    setQty(1);
  }, [selected]);

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
    setPortion(null);
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
        setResults(data.results || []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectItem(item) {
    setSelected(item);
    setQuery(item.name);
    setShowResults(false);
    setQty(1);
  }

  const effectiveServings = portion ? portion.multiplier * qty : qty;
  const unitLabel = portion ? portion.label.toLowerCase() : 'piece';
  const portionLabel = `${qty} ${unitLabel}${qty !== 1 ? 's' : ''}`;

  function handleLog() {
    if (!selected) return;
    onLog({
      food_item_id: selected.food_item_id,
      food_name: selected.name,
      servings: effectiveServings,
      portion_label: portionLabel,
      meal_type: mealType,
      calories: selected.calories,
      protein_g: selected.protein_g,
      total_fat_g: selected.total_fat_g,
      total_carbs_g: selected.total_carbs_g,
    });
    setQuery('');
    setSelected(null);
    setPortion(null);
    setQty(1);
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
            {results.map((item, i) => (
              <button
                key={i}
                onClick={() => selectItem(item)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-umd-gray-light transition-colors border-b border-umd-gray-light last:border-b-0"
              >
                <div className="font-medium text-umd-black">{item.name}</div>
                <div className="text-xs text-umd-body mt-0.5">
                  {item.calories || 0} cal · {item.protein_g || 0}g P · {item.total_fat_g || 0}g F · {item.total_carbs_g || 0}g C
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="mt-3 space-y-3">
          {/* measurement type — only if multiple options */}
          {availablePortions.length > 1 && (
            <div>
              <div className="text-xs font-semibold text-umd-black mb-2">Measure by</div>
              <div className="flex flex-wrap gap-1.5">
                {availablePortions.map((pt) => (
                  <button
                    key={pt.id}
                    onClick={() => { setPortion(pt); setQty(1); }}
                    className={`px-3 py-2 rounded-lg border text-xs transition-colors ${
                      portion?.id === pt.id
                        ? 'border-umd-red bg-red-50 dark:bg-red-950/40 text-umd-red font-semibold'
                        : 'border-umd-gray bg-white dark:bg-[#1c1c1c] text-umd-body hover:border-umd-red hover:text-umd-red'
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* qty */}
          <div>
            <div className="text-xs font-semibold text-umd-black mb-2">
              How many {unitLabel}s?
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QTY_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setQty(n)}
                  className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-colors ${
                    qty === n
                      ? 'border-umd-red bg-umd-red text-white'
                      : 'border-umd-gray bg-white dark:bg-[#1c1c1c] text-umd-body hover:border-umd-red hover:text-umd-red'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* preview + log */}
          <div className="bg-umd-gray-light rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-umd-black">{portionLabel}</span>
              <span className="text-sm font-bold text-umd-black">
                {Math.round((selected.calories || 0) * effectiveServings)} cal
              </span>
            </div>
            <div className="flex gap-4 text-xs text-umd-body">
              <span>{Math.round((selected.protein_g || 0) * effectiveServings * 10) / 10}g protein</span>
              <span>{Math.round((selected.total_fat_g || 0) * effectiveServings * 10) / 10}g fat</span>
              <span>{Math.round((selected.total_carbs_g || 0) * effectiveServings * 10) / 10}g carbs</span>
            </div>
            <button
              onClick={handleLog}
              className="w-full bg-umd-red hover:bg-umd-red-dark text-white font-semibold py-2 rounded-lg text-sm transition-colors mt-1"
            >
              + Log {portionLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
