import { evaluateRisk } from '../lib/riskRules';
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

  const breaches = useMemo(()=>evaluateRisk(trades,settings),[trades,settings]);
  const [error,setError] = useState('');
  const handleSave = async () => {
    const user = dbService.getCurrentUser();
    if (!user) return;
    const updated = {
      ...localSettings,
      userId: user.id
    };
    try { await dbService.setDocument(`users/${user.id}/settings`, 'current', updated);
    onSettingsUpdate(updated);
    setIsEditing(false); setError('');
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save settings"); }
  };

  const isLocked = breaches.dailyLossLimitReached || breaches.monthlyLimitReached || breaches.singleTradeLimitReached || breaches.isTradeCountBreached || breaches.isConsecutiveBreached || breaches.isRiskBreached;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {error && <p role="alert" className="text-red-400">{error}</p>}
      <p className="text-sm text-zinc-400">Trading day: Asia/Kolkata. Revenge-tagged entries today: {breaches.revengeCount}. Warnings never prevent recording real trades.</p>
      <ul className="text-amber-400 text-sm">
        {breaches.isTradeCountBreached && <li>Maximum daily entry count reached.</li>}
        {breaches.isConsecutiveBreached && <li>Consecutive losing trade limit reached.</li>}
        {breaches.isRiskBreached && <li>Recorded initial monetary risk limit reached.</li>}
        {breaches.isStreakBreached && <li>Three or more consecutive losing trading days. Review your plan.</li>}
      </ul>
      {/* Alert Banner */}
      <div className={`p-6 rounded-3xl border flex items-center gap-6 ${
        isLocked ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
      }`}>
        <div className={`p-4 rounded-2xl ${isLocked ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {isLocked ? <Lock className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
        </div>
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tight">
            {isLocked ? 'Risk Warning' : 'Risk Monitor'}
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
            label="Daily Net Loss"
            value={Math.max(0,-breaches.dailyNet)}
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
            Journal warnings only. This app does not block broker orders or prevent recording trades.
          </div>
        </div>

        {/* Risk Settings */}
        <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-3xl space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest px-2">Risk Warning Limits</h3>
            <button
              aria-label={isEditing ? "Save risk settings" : "Edit risk settings"}
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
            <SettingsInput label="Maximum entries per day (0 = off)" value={localSettings.maxTradesPerDay ?? 0} onChange={v=>setLocalSettings({...localSettings,maxTradesPerDay:Number(v)})} disabled={!isEditing} />
            <SettingsInput label="Consecutive loss limit (0 = off)" value={localSettings.maxConsecutiveLosses ?? 0} onChange={v=>setLocalSettings({...localSettings,maxConsecutiveLosses:Number(v)})} disabled={!isEditing} />
            <SettingsInput label="Maximum initial risk per trade (₹, 0 = off)" value={localSettings.maxRiskPerTrade ?? 0} onChange={v=>setLocalSettings({...localSettings,maxRiskPerTrade:Number(v)})} disabled={!isEditing} />
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
      <input aria-label={label}
        type="number"
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
      />
    </div>
  );
}
