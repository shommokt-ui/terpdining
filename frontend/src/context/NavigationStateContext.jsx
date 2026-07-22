import { createContext, useContext, useCallback, useState, useMemo } from 'react';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const defaultMenu = {
  date: null,
  activeHall: null,
  activeMeal: null,
  includeTags: [],
  excludeTags: [],
  showFavManager: false,
  searchQuery: '',
  favoritesCount: 0,
};

const defaultTracker = {
  date: null,
  showGoalEditor: false,
  dismissed: false,
};

const defaultRecipe = {
  activeSession: null,
  messages: [],
  showForm: true,
  followUp: '',
  cuisine: '',
  goals: [],
  hall: 'South Campus',
  meal: 'Lunch',
  dt: todayStr(),
  sidebarOpen: false,
};

const NavigationStateContext = createContext(null);

export function NavigationStateProvider({ children }) {
  const [menu, setMenu] = useState(defaultMenu);
  const [tracker, setTracker] = useState(defaultTracker);
  const [recipe, setRecipe] = useState(defaultRecipe);

  const patchMenu = useCallback((p) => setMenu((m) => ({ ...m, ...p })), []);
  const patchTracker = useCallback((p) => setTracker((t) => ({ ...t, ...p })), []);
  const patchRecipe = useCallback((p) => setRecipe((r) => ({ ...r, ...p })), []);

  const value = useMemo(
    () => ({
      menu,
      patchMenu,
      tracker,
      patchTracker,
      recipe,
      patchRecipe,
    }),
    [menu, tracker, recipe, patchMenu, patchTracker, patchRecipe]
  );

  return (
    <NavigationStateContext.Provider value={value}>
      {children}
    </NavigationStateContext.Provider>
  );
}

export function useNavigationState() {
  const v = useContext(NavigationStateContext);
  if (!v) {
    throw new Error('useNavigationState must be used within NavigationStateProvider');
  }
  return v;
}
