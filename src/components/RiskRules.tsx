import { useState, useEffect, useMemo } from 'react';
import { Trade, UserSettings } from '../types';
import { dbService } from '../services/dbService';
import { ShieldAlert, ShieldCheck, Lock, Unlock, AlertTriangle, Info, Save } from 'lucide-react';
import { format, startOfDay, startOfMonth, isWithinInterval, subDays } from 'date-fns';

interface RiskRulesProps {
  trades: Trade[];
  settings: UserSettings;
  onSettingsUpdate: (settings: UserSettings) => void;
}

export default function RiskRules({ trades, settings, onSettingsUpdate }: RiskRulesProps) {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const breaches = useMemo(() => {
    const today = startOfDay(new Date());
    const currMonth = startOfMonth(new Date());
    
    const todayTrades = trades.filter(t => new Date(t.entryTime) >= today);
    const monthlyTrades = trades.filter(t => new Date(t.entryTime) >= currMonth);
    
    const dailyLoss = todayTrades.reduce((acc, t) => acc + (t.pnl < 0 ? Math.abs(t.pnl) : 0), 0);
    const dailyNet = todayTrades.reduce((acc, t) => acc + t.pnl, 0);
    const monthlyNet = monthlyTrades.reduce((acc, t) => acc + t.pnl, 0);
    
    const maxSingleLoss = Math.max(0, ...todayTrades.map(t => (t.pnl < 0 ? Math.abs(t.pnl) : 0)));
    
    return {
      dailyLossLimitReached: dailyNet <= -localSettings.dailyLossLimit,
      singleTradeLimitReached: maxSingleLoss >= localSettings.singleTradeLossLimit,
      monthlyLimitReached: monthlyNet <= -localSettings.monthlyLossLimit,
      dailyNet,
      dailyLoss,
      monthlyNet,
      maxSingleLoss
    };
  }, [trades, localSettings]);

  const handleSave = async () => {
    const user = dbService.getCurrentUser();
    if (!user) return;
    const updated = {
      ...localSettings,
      userId: user.id
    };
    await dbService.setDocument(`users/${user.id}/settings`, 'current', updated);
    onSettingsUpdate(updated);
    setIsEditing(false);
  };

  const isLocked = breaches.dailyLossLimitReached || breaches.monthlyLimitReached || breaches.singleTradeLimitReached;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Alert Banner */}
      <div className={`p-6 rounded-3xl border flex items-center gap-6 ${
        isLocked ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
      }`}>
        <div className={`p-4 rounded-2xl ${isLocked ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {isLocked ? <Lock className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
        </div>
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tight">
            {isLocked ? 'Trading Suspended' : 'System Ready'}
          </h2>
          <p className={`text-sm ${isLocked ? 'text-red-400' : 'text-emerald-400'}`}>
            {isLocked ? 'You have breached your risk limits. Discipline is key—stop for today.' : 'All risk parameters within limits. Trade with discipline.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Risk Monitor */}
        <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-3xl space-y-8">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest px-2">Real-time Risk Monitor</h3>
          
          <MonitorRow 
            label="Daily Loss" 
            value={breaches.dailyLoss} 
            limit={settings.dailyLossLimit} 
            breached={breaches.dailyLossLimitReached}
          />
          <MonitorRow 
            label="Max Single Trade Loss" 
            value={breaches.maxSingleLoss} 
            limit={settings.singleTradeLossLimit} 
            breached={breaches.singleTradeLimitReached}
          />
          <MonitorRow 
            label="Monthly Net P&L" 
            value={breaches.monthlyNet} 
            limit={-settings.monthlyLossLimit} 
            breached={breaches.monthlyLimitReached}
            inverse
          />

          <div className="pt-6 border-t border-zinc-900 flex items-center gap-2 text-zinc-500 text-xs italic">
            <Info className="w-4 h-4" />
            Breaching limits will trigger coaching alerts and lock analysis modes.
          </div>
        </div>

        {/* Risk Settings */}
        <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-3xl space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest px-2">Hard Risk Rules</h3>
            <button 
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              {isEditing ? <Save className="w-5 h-5 text-emerald-500" /> : <Unlock className="w-5 h-5" />}
            </button>
          </div>

          <div className="space-y-6">
            <SettingsInput 
              label="Starting Account Capital (₹)" 
              value={localSettings.totalCapital} 
              disabled={!isEditing} 
              onChange={v => setLocalSettings({...localSettings, totalCapital: parseInt(v) || 0})} 
            />
            <SettingsInput 
              label="Daily Loss Limit (₹)" 
              value={localSettings.dailyLossLimit} 
              disabled={!isEditing} 
              onChange={v => setLocalSettings({...localSettings, dailyLossLimit: parseInt(v) || 0})} 
            />
            <SettingsInput 
              label="Single Trade Loss Limit (₹)" 
              value={localSettings.singleTradeLossLimit} 
              disabled={!isEditing} 
              onChange={v => setLocalSettings({...localSettings, singleTradeLossLimit: parseInt(v) || 0})} 
            />
            <SettingsInput 
              label="Monthly Max Drawdown (₹)" 
              value={localSettings.monthlyLossLimit} 
              disabled={!isEditing} 
              onChange={v => setLocalSettings({...localSettings, monthlyLossLimit: parseInt(v) || 0})} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MonitorRow({ label, value, limit, breached, inverse = false }: any) {
  const percentage = Math.min(100, Math.abs((value / limit) * 100));
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
        <span className="text-zinc-500">{label}</span>
        <span className={breached ? 'text-red-500' : 'text-zinc-300'}>
          ₹{Math.abs(value).toLocaleString()} / ₹{Math.abs(limit).toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${breached ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SettingsInput({ label, value, disabled, onChange }: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{label}</label>
      <input 
        type="number"
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
      />
    </div>
  );
}
