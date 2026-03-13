import { useState, useRef, useEffect, useCallback } from 'react';
import { apiPost, apiGet, apiDelete } from '../api';
import ChatMessage from '../components/ChatMessage';
import { useNavigationState } from '../context/NavigationStateContext';

const HALLS = ['South Campus', 'Yahentamitsi Dining Hall', '251 North'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
const GOAL_OPTIONS = ['High Protein', 'Low Carb', 'Low Fat', 'Low Calorie', 'Vegan', 'Vegetarian', 'Halal'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RecipePage() {
  const { recipe, patchRecipe } = useNavigationState();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(() => recipe.activeSession);
  const [messages, setMessages] = useState(() => [...(recipe.messages || [])]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => recipe.sidebarOpen);
  const [showForm, setShowForm] = useState(() => recipe.showForm ?? true);
  const [followUp, setFollowUp] = useState(() => recipe.followUp ?? '');
  const bottomRef = useRef(null);

  const [cuisine, setCuisine] = useState(() => recipe.cuisine ?? '');
  const [goals, setGoals] = useState(() => recipe.goals ?? []);
  const [hall, setHall] = useState(() => recipe.hall ?? HALLS[0]);
  const [meal, setMeal] = useState(() => recipe.meal ?? MEALS[1]);
  const [dt, setDt] = useState(() => recipe.dt ?? todayStr());

  useEffect(() => {
    patchRecipe({
      activeSession,
      messages,
      sidebarOpen,
      showForm,
      followUp,
      cuisine,
      goals,
      hall,
      meal,
      dt,
    });
  }, [
    activeSession,
    messages,
    sidebarOpen,
    showForm,
    followUp,
    cuisine,
    goals,
    hall,
    meal,
    dt,
    patchRecipe,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await apiGet('/api/recipe/sessions');
      setSessions(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  async function loadSession(id) {
    setActiveSession(id);
    setShowForm(false);
    try {
      const data = await apiGet(`/api/recipe/sessions/${id}/messages`);
      const visible = (data.messages || []).filter((m) => m.role !== 'system');
      setMessages(visible);
    } catch {
      setMessages([]);
    }
  }

  function handleNewRecipe() {
    setActiveSession(null);
    setMessages([]);
    setShowForm(true);
    setCuisine('');
    setGoals([]);
    patchRecipe({
      activeSession: null,
      messages: [],
      showForm: true,
      cuisine: '',
      goals: [],
    });
  }

  async function handleDeleteSession(id) {
    await apiDelete(`/api/recipe/sessions/${id}`);
    if (activeSession === id) handleNewRecipe();
    fetchSessions();
  }

  function toggleGoal(goal) {
    setGoals((prev) => prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (loading) return;

    const userSummary = `Craving: ${cuisine || 'anything'} | Goals: ${goals.join(', ') || 'none'} | ${hall}, ${meal}`;
    setMessages([{ role: 'user', content: userSummary }]);
    setShowForm(false);
    setLoading(true);

    try {
      const data = await apiPost('/api/recipe', {
        hall, meal, dt,
        cuisine: cuisine || 'anything',
        goals: goals.length > 0 ? goals : null,
      });
      setActiveSession(data.session_id);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      fetchSessions();
    } catch (err) {
      const msg = err.message?.includes('No menu data')
        ? `No menu data found for **${hall}** (**${meal}**) on **${dt}**. Try a different date, meal, or dining hall.`
        : `Error: ${err.message}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
      setShowForm(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp(e) {
    e.preventDefault();
    const text = followUp.trim();
    if (!text || loading || !activeSession) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setFollowUp('');
    setLoading(true);

    try {
      const data = await apiPost('/api/recipe', {
        session_id: activeSession,
        message: text,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-5.5rem)] relative">
      {/* backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${sidebarOpen ? 'md:w-64' : 'md:w-0'}
        fixed md:relative z-30 md:z-auto
        h-[calc(100vh-5.5rem)] w-72 md:w-64
        transition-all duration-200
        bg-white dark:bg-[#1c1c1c] border-r border-umd-gray
        flex flex-col overflow-hidden flex-shrink-0
      `}>
        <div className="p-3 border-b border-umd-gray">
          <button onClick={handleNewRecipe}
            className="w-full bg-umd-red hover:bg-umd-red-dark text-white text-sm font-semibold py-2 rounded-lg transition-colors">
            + New Recipe
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map((s) => (
            <div key={s.id}
              className={`group flex items-center gap-1 px-3 py-2.5 cursor-pointer text-sm border-b border-umd-gray-light transition-colors ${
                activeSession === s.id ? 'bg-red-50 dark:bg-red-950/40 text-umd-red' : 'text-umd-black hover:bg-umd-gray-light'
              }`}>
              <button onClick={() => loadSession(s.id)} className="flex-1 text-left truncate">{s.title}</button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5 transition-opacity">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="p-4 text-center">
              <div className="text-2xl mb-1">🐢</div>
              <div className="text-xs text-umd-body">No recipe history yet. Your past sessions will show up here.</div>
            </div>
          )}
        </div>
      </div>

      {/* main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-2 border-b border-umd-gray bg-white dark:bg-[#1c1c1c] flex items-center gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-umd-gray-light rounded-lg transition-colors text-umd-gray-dark">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm text-umd-body">
            {activeSession ? sessions.find((s) => s.id === activeSession)?.title || 'Recipe' : 'New Recipe'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {showForm && messages.length === 0 && (
            <div className="max-w-lg mx-auto">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🍳</div>
                <h2 className="text-xl font-bold text-umd-black mb-1">Recipe Creator</h2>
                <p className="text-sm text-umd-body">
                  Tell me what you're craving and I'll create recipes from today's dining hall ingredients.
                </p>
              </div>

              <form onSubmit={handleCreate} className="umd-card rounded-xl p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-umd-black mb-1">What are you craving?</label>
                  <input type="text" value={cuisine} onChange={(e) => setCuisine(e.target.value)}
                    placeholder="Asian, Mediterranean, comfort food, anything..."
                    className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-umd-black mb-1.5">Dietary goals</label>
                  <div className="flex flex-wrap gap-1.5">
                    {GOAL_OPTIONS.map((g) => (
                      <button key={g} type="button" onClick={() => toggleGoal(g)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                          goals.includes(g)
                            ? 'bg-umd-red text-white border-umd-red'
                            : 'bg-white dark:bg-[#1c1c1c] text-umd-body border-umd-gray hover:border-umd-red hover:text-umd-red'
                        }`}>{g}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-umd-black mb-1">Dining Hall</label>
                    <select value={hall} onChange={(e) => setHall(e.target.value)}
                      className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red">
                      {HALLS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-umd-black mb-1">Meal</label>
                    <select value={meal} onChange={(e) => setMeal(e.target.value)}
                      className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red">
                      {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-umd-black mb-1">Date</label>
                  <input type="date" value={dt} onChange={(e) => setDt(e.target.value)}
                    className="bg-white dark:bg-[#1c1c1c] text-umd-black w-full border border-umd-gray rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red" />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-umd-red hover:bg-umd-red-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {loading ? 'Creating recipes...' : 'Create Recipes'}
                </button>
              </form>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} content={m.content} />
          ))}

          {loading && (
            <div className="flex justify-start mb-3">
              <div className="w-8 h-8 rounded-full bg-umd-gold flex items-center justify-center text-base mr-2 mt-1 shrink-0">
                🐢
              </div>
              <div className="umd-card rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-umd-body rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-umd-body rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-umd-body rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {!showForm && (
          <form onSubmit={handleFollowUp} className="border-t border-umd-gray bg-white dark:bg-[#1c1c1c] px-3 py-3 flex gap-2">
            <input type="text" value={followUp} onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Ask for modifications, different cuisine, dessert ideas..."
              className="bg-white dark:bg-[#1c1c1c] text-umd-black flex-1 min-w-0 border border-umd-gray rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-umd-red focus:border-transparent"
              disabled={loading} />
            <button type="submit" disabled={loading || !followUp.trim()}
              className="bg-umd-red hover:bg-umd-red-dark text-white font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 shrink-0">
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
