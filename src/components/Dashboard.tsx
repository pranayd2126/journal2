import { ReactNode, useMemo, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie, ScatterChart, Scatter, ZAxis, RadialBarChart, RadialBar, Legend
} from 'recharts';
import { Trade, UserSettings } from '../types';
import { format, parseISO } from 'date-fns';
import { Flame, Target, TrendingUp, ShieldAlert, Percent, Activity, Wallet, Edit2, X, Check } from 'lucide-react';
import { useRiskManager } from '../hooks/useRiskManager';
import { dbService } from '../services/dbService';
import CalendarHeatmap from './CalendarHeatmap';

interface DashboardProps {
  trades: Trade[];
  settings: UserSettings;
  onSettingsUpdate: (settings: UserSettings) => void;
}

export default function Dashboard({ trades, settings, onSettingsUpdate }: DashboardProps) {
  const risk = useRiskManager(trades, settings);
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const [tempCapital, setTempCapital] = useState((settings.totalCapital ?? 100000).toString());

  const stats = useMemo(() => {
    const totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);
    const winRate = trades.length > 0 ? (trades.filter(t => t.pnl > 0).length / trades.length) * 100 : 0;
    const avgWin = trades.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0) / (trades.filter(t => t.pnl > 0).length || 1);
    const avgLoss = trades.filter(t => t.pnl < 0).reduce((acc, t) => acc + Math.abs(t.pnl), 0) / (trades.filter(t => t.pnl < 0).length || 1);
    const profitFactor = (avgWin * (winRate / 100)) / (avgLoss * (1 - winRate / 100)) || 0;
    
    // Performance items for charts
    const pnlHistory = trades.slice().reverse().reduce((acc: any[], trade) => {
      const prevTotal = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      let dateStr = 'Unknown';
      try {
        if (trade.entryTime) {
          const date = parseISO(trade.entryTime);
          if (!isNaN(date.getTime())) {
            dateStr = format(date, 'MMM dd');
          }
        }
      } catch (e) {
        console.error('Invalid date for trade:', trade);
      }
      
      acc.push({
        date: dateStr,
        pnl: trade.pnl,
        cumulative: prevTotal + trade.pnl
      });
      return acc;
    }, []);

    // Mistakes frequency
    const mistakeCounts: Record<string, number> = {};
    trades.forEach(t => {
      if (t.mistakes && Array.isArray(t.mistakes)) {
        t.mistakes.forEach(m => mistakeCounts[m] = (mistakeCounts[m] || 0) + 1);
      }
    });
    const mistakesData = Object.entries(mistakeCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Emotion vs PNL
    const emotionData: Record<string, { pnl: number, count: number }> = {};
    trades.forEach(t => {
      const state = t.psychology?.before || 'CALM';
      if (!emotionData[state]) emotionData[state] = { pnl: 0, count: 0 };
      emotionData[state].pnl += t.pnl;
      emotionData[state].count += 1;
    });
    const emotionHeatmap = Object.entries(emotionData).map(([name, val]) => ({
      name,
      avgPnl: Math.round(val.pnl / val.count),
      count: val.count,
      fill: (val.pnl / val.count) >= 0 ? '#10b981' : '#ef4444'
    }));

    // Setup Type Performance
    const setupPerf: Record<string, { pnl: number, count: number }> = {};
    trades.forEach(t => {
      const type = t.setupType || 'UNTAGGED';
      if (!setupPerf[type]) setupPerf[type] = { pnl: 0, count: 0 };
      setupPerf[type].pnl += t.pnl;
      setupPerf[type].count += 1;
    });
    const setupData = Object.entries(setupPerf).map(([name, val]) => ({
      name,
      pnl: val.pnl,
      avg: Math.round(val.pnl / val.count)
    })).sort((a, b) => b.pnl - a.pnl);

    const winData = [
      { name: 'Wins', value: trades.filter(t => t.pnl > 0).length, fill: '#10b981' },
      { name: 'Losses', value: trades.filter(t => t.pnl <= 0).length, fill: '#ef4444' }
    ];

    return {
      totalPnl,
      winRate,
      profitFactor,
      pnlHistory,
      mistakesData,
      emotionHeatmap,
      setupData,
      winData,
      totalTrades: trades.length
    };
  }, [trades]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-2xl">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-sm font-mono font-bold" style={{ color: p.color || p.fill }}>
              {p.name}: {p.value >= 0 ? '₹' : '-₹'}{Math.abs(p.value).toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const currentCapital = (settings.totalCapital ?? 100000) + stats.totalPnl;

  const handleUpdateCapital = async () => {
    const newCapitalValue = parseFloat(tempCapital);
    if (isNaN(newCapitalValue)) return;

    const updatedSettings = {
      ...settings,
      totalCapital: newCapitalValue,
      updatedAt: new Date()
    };
    
    try {
      await dbService.setDocument(`users/${settings.userId}/settings`, 'current', updatedSettings);
      onSettingsUpdate(updatedSettings);
      setIsEditingCapital(false);
    } catch (err) {
      console.error('Failed to update capital:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Risk Alert if breached */}
      {risk.isLocked && (
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-6 animate-pulse-red">
          <div className="p-3 bg-red-500 rounded-xl text-white">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-red-500 uppercase tracking-tight">Trading Suspended: {risk.lockReason}</h3>
            <p className="text-red-400/80 text-sm">Discipline enforced. Your session is locked to prevent emotional trading.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Net P&L" 
          value={`₹${stats.totalPnl.toLocaleString()}`} 
          icon={TrendingUp} 
          trend={stats.totalPnl >= 0 ? 'up' : 'down'}
        />
        <StatCard 
          label="Win Rate" 
          value={`${stats.winRate.toFixed(1)}%`} 
          icon={Target} 
          trend={stats.winRate >= 50 ? 'up' : 'down'}
        />
        <StatCard 
          label="Total Trades" 
          value={stats.totalTrades.toString()} 
          icon={Activity} 
        />
        <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl relative group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-zinc-900 rounded-lg">
              <Wallet className="w-5 h-5 text-blue-500" />
            </div>
            {!isEditingCapital ? (
              <button 
                onClick={() => {
                  setTempCapital((settings.totalCapital ?? 100000).toString());
                  setIsEditingCapital(true);
                }}
                className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-md transition-all opacity-0 group-hover:opacity-100"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleUpdateCapital}
                  className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setIsEditingCapital(false)}
                  className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <p className="text-zinc-500 text-sm font-medium">Account Capital</p>
          {isEditingCapital ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-zinc-500 font-mono">₹</span>
              <input 
                type="number"
                value={tempCapital}
                onChange={(e) => setTempCapital(e.target.value)}
                className="bg-transparent border-b border-zinc-700 text-white font-mono font-bold text-xl w-full focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
          ) : (
            <h3 className="text-2xl font-bold text-white mt-1 font-mono">₹{currentCapital.toLocaleString()}</h3>
          )}
          <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1 tracking-wider">
            Base: ₹{(settings.totalCapital ?? 100000).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Calendar Heatmap Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CalendarHeatmap trades={trades} initialOffset={0} />
        <CalendarHeatmap trades={trades} initialOffset={1} />
        <CalendarHeatmap trades={trades} initialOffset={2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Equity Curve */}
        <ChartWrapper title="Cumulative Growth (Equity Curve)" className="lg:col-span-2">
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.pnlHistory}>
                <defs>
                  <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="date" stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="stepAfter" 
                  dataKey="cumulative" 
                  name="Account Value"
                  stroke="#3b82f6" 
                  fillOpacity={1} 
                  fill="url(#colorPnl)" 
                  strokeWidth={2} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartWrapper>

        {/* Win Rate Pie */}
        <ChartWrapper title="Win/Loss Distribution">
          <div className="h-[350px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.winData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.winData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #27272a', borderRadius: '12px' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
              <span className="text-3xl font-bold text-white font-mono">{stats.winRate.toFixed(0)}%</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Win Rate</span>
            </div>
          </div>
        </ChartWrapper>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Setup Performance */}
        <ChartWrapper title="Setup Performance (Total P&L)">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.setupData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={10} width={100} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pnl" name="Total P&L" radius={[0, 4, 4, 0]}>
                  {stats.setupData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartWrapper>

        {/* Mistakes Distribution */}
        <ChartWrapper title="Execution Friction (Mistakes)">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.mistakesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                />
                <Bar dataKey="value" name="Occurrences" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartWrapper>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Emotion Impact */}
        <ChartWrapper title="Psychological Edge (Emotion vs Avg P&L)" className="lg:col-span-2">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.emotionHeatmap}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgPnl" name="Average P&L" radius={[4, 4, 0, 0]}>
                  {stats.emotionHeatmap.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartWrapper>

        {/* Profit Factor / Risk Gauge */}
        <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mb-4">
            <Flame className="w-10 h-10 text-blue-500" />
          </div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Profit Factor</h4>
          <p className="text-4xl font-mono font-bold text-white mb-2">{stats.profitFactor.toFixed(2)}</p>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden mt-4">
            <div 
              className={`h-full transition-all duration-1000 ${stats.profitFactor > 2 ? 'bg-emerald-500' : stats.profitFactor > 1 ? 'bg-blue-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, stats.profitFactor * 25)}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-600 font-bold uppercase mt-4">
            {stats.profitFactor > 1.5 ? 'EXCELLENT EDGE' : stats.profitFactor >= 1 ? 'PROFITABLE' : 'UNPROFITABLE'}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend }: { label: string, value: string, icon: any, trend?: 'up' | 'down' }) {
  return (
    <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-zinc-900 rounded-lg">
          <Icon className="w-5 h-5 text-zinc-400" />
        </div>
        {trend && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
            {trend === 'up' ? '▲' : '▼'}
          </span>
        )}
      </div>
      <p className="text-zinc-500 text-sm font-medium">{label}</p>
      <h3 className="text-2xl font-bold text-white mt-1 font-mono">{value}</h3>
    </div>
  );
}

function ChartWrapper({ title, children, className = "" }: { title: string, children: ReactNode, className?: string }) {
  return (
    <div className={`p-6 bg-zinc-950 border border-zinc-900 rounded-2xl shadow-sm ${className}`}>
      <h3 className="text-sm font-bold text-zinc-400 mb-6 uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}
