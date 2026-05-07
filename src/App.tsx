import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import TradeJournal from './components/Trades/TradeJournal';
import JournalDashboard from './components/JournalDashboard';
import RiskRules from './components/RiskRules';
import DailyHabits from './components/DailyHabits';
import { 
  BarChart3, 
  BookOpen, 
  ShieldAlert, 
  Plus,
  Loader2, 
  AlertTriangle,
  LayoutDashboard,
  PieChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbService } from './services/dbService';
import { Trade, UserSettings } from './types';
import { useRiskManager } from './hooks/useRiskManager';

const DEFAULT_SETTINGS: UserSettings = {
  userId: '',
  dailyLossLimit: 7000,
  singleTradeLossLimit: 5000,
  monthlyLossLimit: 15000,
  totalCapital: 100000,
  riskBaseCurrency: 'INR',
  updatedAt: null
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'vault' | 'risk' | 'analytics'>('dashboard');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const risk = useRiskManager(trades, settings);

  useEffect(() => {
    const savedUser = dbService.getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
      fetchUserData(savedUser.id);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const [tradesData, settingsData] = await Promise.all([
        dbService.getCollection<Trade>(`users/${userId}/trades`),
        dbService.getDocument<UserSettings>(`users/${userId}/settings`, 'current')
      ]);
      setTrades(tradesData);
      if (settingsData) setSettings(settingsData);
    } catch (err) {
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (user: any) => {
    setUser(user);
    setLoading(true);
    fetchUserData(user.id);
  };

  const handleLogout = () => {
    dbService.setCurrentUser(null);
    setUser(null);
    setTrades([]);
    setActiveTab('dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <Auth user={null} onLogin={handleLogin} onLogout={handleLogout} />
      </div>
    );
  }

  const currentUser = user;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'vault', label: 'Journal Cards', icon: LayoutDashboard },
    { id: 'risk', label: 'Risk Rules', icon: ShieldAlert },
  ] as const;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-blue-500/30">
      {/* Sidebar Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 md:top-0 md:bottom-0 md:w-20 bg-zinc-950 border-t md:border-t-0 md:border-r border-zinc-900 z-50 flex md:flex-col items-center justify-around md:justify-center py-4 gap-8">
        <div className="hidden md:block mb-12">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="text-white w-6 h-6" />
          </div>
        </div>
        
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-3 rounded-xl transition-all relative group ${
                isActive ? 'bg-blue-600/10 text-blue-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none hidden md:block">
                {tab.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 md:bottom-auto md:right-auto md:top-0 md:bottom-0 md:w-0.5"
                />
              )}
            </button>
          );
        })}

        <div className="md:mt-auto">
          <Auth user={user} onLogin={handleLogin} onLogout={handleLogout} />
        </div>
      </nav>

      {/* Main Content */}
      <main className="md:pl-20 pb-24 md:pb-0 min-h-screen">
        <header className="px-6 py-6 border-b border-zinc-900 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-xl z-40">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-zinc-500 font-mono text-center md:text-left">ACCOUNT_SECURE_ID: {currentUser.id.slice(0, 8)}</p>
          </div>
          
          <div className="flex items-center gap-4">
            {risk.isLocked && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/20 animate-pulse-red">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{risk.lockReason}</span>
              </div>
            )}
            
            <button 
              onClick={() => setActiveTab('journal')}
              disabled={risk.isLocked}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-md ${
                risk.isLocked 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 text-white hover:bg-blue-50 hover:-translate-y-0.5 active:translate-y-0 shadow-blue-500/20'
              }`}
            >
              {risk.isLocked ? <ShieldAlert className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              New Trade
            </button>
          </div>
        </header>

        <section className="p-6 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                  <div className="lg:col-span-3">
                    <Dashboard trades={trades} settings={settings} onSettingsUpdate={(s) => setSettings(s)} />
                  </div>
                  <div className="lg:col-span-1">
                    <DailyHabits />
                  </div>
                </div>
              )}
              {activeTab === 'analytics' && <AnalyticsDashboard trades={trades} />}
              {activeTab === 'journal' && (
                <TradeJournal 
                  trades={trades} 
                  onTradeAdded={(t) => setTrades(prev => [t, ...prev])} 
                  onTradeUpdated={(t) => setTrades(prev => prev.map(p => p.id === t.id ? t : p))}
                  onTradeDeleted={(id) => setTrades(prev => prev.filter(p => p.id !== id))}
                  settings={settings} 
                />
              )}
              {activeTab === 'vault' && <JournalDashboard trades={trades} />}
              {activeTab === 'risk' && <RiskRules trades={trades} settings={settings} onSettingsUpdate={(s) => setSettings(s)} />}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
