import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie, ScatterChart, Scatter, ZAxis, 
  Legend, ComposedChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Trade, EmotionalState } from '../types';
import { format, parseISO, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';
import { 
  TrendingUp, TrendingDown, Target, Zap, AlertTriangle, 
  Smile, Activity, Layers, Calendar, Filter,
  ArrowUpRight, ArrowDownRight, Info
} from 'lucide-react';
import { motion } from 'motion/react';

interface AnalyticsDashboardProps {
  trades: Trade[];
}

type TimeRange = 'all' | '7d' | '30d' | '90d' | 'ytd';

export default function AnalyticsDashboard({ trades }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [filterStrategy, setFilterStrategy] = useState<string>('all');
  const [filterEmotion, setFilterEmotion] = useState<string>('all');
  const [filterMarket, setFilterMarket] = useState<string>('all');

  // --- Filter Logic ---
  const filteredTrades = useMemo(() => {
    let filtered = [...trades];
    const now = new Date();

    if (timeRange !== 'all') {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const startDate = subDays(now, days);
      filtered = filtered.filter(t => isWithinInterval(new Date(t.entryTime), { start: startDate, end: now }));
    }

    if (filterStrategy !== 'all') filtered = filtered.filter(t => t.setupType === filterStrategy);
    if (filterEmotion !== 'all') filtered = filtered.filter(t => t.psychology?.before === filterEmotion);
    if (filterMarket !== 'all') filtered = filtered.filter(t => t.marketCondition === filterMarket);

    return filtered.sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime());
  }, [trades, timeRange, filterStrategy, filterEmotion, filterMarket]);

  // --- Metrics Engine ---
  const metrics = useMemo(() => {
    if (filteredTrades.length === 0) return null;

    const wins = filteredTrades.filter(t => t.pnl > 0);
    const losses = filteredTrades.filter(t => t.pnl <= 0);
    const winRate = (wins.length / filteredTrades.length) * 100;
    const avgWin = wins.reduce((acc, t) => acc + t.pnl, 0) / (wins.length || 1);
    const avgLoss = losses.reduce((acc, t) => acc + Math.abs(t.pnl), 0) / (losses.length || 1);
    
    // Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
    const expectancy = (winRate / 100 * avgWin) - ((100 - winRate) / 100 * avgLoss);
    
    // Equity Curve & Drawdown
    let peak = 0;
    let currentEquity = 0;
    let maxDrawdown = 0;
    const equityCurve = filteredTrades.map(t => {
      currentEquity += t.pnl;
      if (currentEquity > peak) peak = currentEquity;
      const dd = peak === 0 ? 0 : ((peak - currentEquity) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
      return {
        date: format(new Date(t.entryTime), 'MM/dd'),
        equity: currentEquity,
        pnl: t.pnl
      };
    });

    // Loss Reasons (Mistakes) Distribution
    const mistakeMap: Record<string, number> = {};
    losses.forEach(t => {
      if (t.mistakes?.length) {
        t.mistakes.forEach(m => mistakeMap[m] = (mistakeMap[m] || 0) + 1);
      } else {
        mistakeMap['Uncategorized'] = (mistakeMap['Uncategorized'] || 0) + 1;
      }
    });
    const lossReasons = Object.entries(mistakeMap).map(([name, value]) => ({ name, value }));

    // Strategy Performance
    const stratMap: Record<string, { pnl: number, count: number, wins: number }> = {};
    filteredTrades.forEach(t => {
      const s = t.setupType || 'Standard';
      if (!stratMap[s]) stratMap[s] = { pnl: 0, count: 0, wins: 0 };
      stratMap[s].pnl += t.pnl;
      stratMap[s].count++;
      if (t.pnl > 0) stratMap[s].wins++;
    });
    const strategyPerf = Object.entries(stratMap).map(([name, d]) => ({
      name,
      pnl: d.pnl,
      wr: (d.wins / d.count) * 100
    })).sort((a, b) => b.pnl - a.pnl);

    // Emotion vs PNL
    const emoMap: Record<string, { pnl: number, count: number }> = {};
    filteredTrades.forEach(t => {
      const e = t.psychology?.before || 'CALM';
      if (!emoMap[e]) emoMap[e] = { pnl: 0, count: 0 };
      emoMap[e].pnl += t.pnl;
      emoMap[e].count++;
    });
    const emotionPerf = Object.entries(emoMap).map(([name, d]) => ({
      name,
      avgPnl: d.pnl / d.count,
      fill: (d.pnl / d.count) > 0 ? '#10b981' : '#ef4444'
    }));

    // Market Condition Win Rate
    const marketMap: Record<string, { wins: number, total: number }> = {};
    filteredTrades.forEach(t => {
      const m = t.marketCondition || 'SIDEWAYS';
      if (!marketMap[m]) marketMap[m] = { wins: 0, total: 0 };
      marketMap[m].total++;
      if (t.pnl > 0) marketMap[m].wins++;
    });
    const marketWinRate = Object.entries(marketMap).map(([name, d]) => ({
      name,
      winRate: (d.wins / d.total) * 100,
      lossRate: 100 - (d.wins / d.total) * 100
    }));

    // R-Multiple Tracking
    const rMultiples = filteredTrades.map((t, i) => {
      const risk = t.entryPrice - (t.stopLoss || t.entryPrice * 0.99);
      const reward = t.exitPrice - t.entryPrice;
      const r = risk !== 0 ? reward / Math.abs(risk) : 0;
      return { 
        name: `Trade ${i+1}`, 
        r,
        fill: r >= 0 ? '#10b981' : '#ef4444'
      };
    });

    // Time of Day
    const timeMap: Record<string, { pnl: number, count: number }> = {
      'Morning': { pnl: 0, count: 0 },
      'Mid-Day': { pnl: 0, count: 0 },
      'Closing': { pnl: 0, count: 0 }
    };
    filteredTrades.forEach(t => {
      const hour = new Date(t.entryTime).getHours();
      let slot = 'Morning';
      if (hour >= 12 && hour < 15) slot = 'Mid-Day';
      if (hour >= 15) slot = 'Closing';
      timeMap[slot].pnl += t.pnl;
      timeMap[slot].count++;
    });
    const timePerf = Object.entries(timeMap).map(([name, d]) => ({
      name,
      pnl: d.pnl,
      avg: d.count > 0 ? d.pnl / d.count : 0
    }));

    return {
      winRate,
      expectancy,
      profitFactor: (wins.reduce((a, b) => a + b.pnl, 0) / Math.abs(losses.reduce((a, b) => a + b.pnl, 0) || 1)) || 0,
      maxDrawdown,
      equityCurve,
      lossReasons,
      strategyPerf,
      emotionPerf,
      marketWinRate,
      rMultiples,
      timePerf,
      avgWin,
      avgLoss,
      totalPnl: currentEquity
    };
  }, [filteredTrades]);

  if (!metrics) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-center">
        <Activity className="w-12 h-12 text-zinc-800 mb-4" />
        <h3 className="text-white font-bold text-lg">Insufficient Data</h3>
        <p className="text-zinc-500 text-sm mt-1">Log at least one trade to see advanced analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Global Filter Bar */}
      <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-3xl flex flex-wrap items-center gap-4 sticky top-6 z-40 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-2 px-3 border-r border-zinc-800 mr-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Filters</span>
        </div>
        
        <select 
          value={timeRange} 
          onChange={e => setTimeRange(e.target.value as any)}
          className="bg-zinc-900 border border-zinc-800 text-[11px] font-bold uppercase text-zinc-400 px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500/50"
        >
          <option value="all">All Time</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="ytd">Year to Date</option>
        </select>

        <select 
          value={filterStrategy} 
          onChange={e => setFilterStrategy(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-[11px] font-bold uppercase text-zinc-400 px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500/50"
        >
          <option value="all">All Strategies</option>
          {Array.from(new Set(trades.map(t => t.setupType))).filter(Boolean).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select 
          value={filterEmotion} 
          onChange={e => setFilterEmotion(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-[11px] font-bold uppercase text-zinc-400 px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500/50"
        >
          <option value="all">All Emotions</option>
          {['CALM', 'FOMO', 'FEAR', 'REVENGE', 'CONFIDENT'].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          label="Profit Expectancy" 
          value={`₹${metrics.expectancy.toFixed(2)}`} 
          subValue="Expected return per trade"
          icon={Activity}
          color="text-blue-500"
        />
        <KPICard 
          label="Max Drawdown" 
          value={`${metrics.maxDrawdown.toFixed(1)}%`} 
          subValue="Peak-to-trough drop"
          icon={TrendingDown}
          color="text-red-500"
        />
        <KPICard 
          label="Profit Factor" 
          value={metrics.profitFactor.toFixed(2)} 
          subValue={`${metrics.winRate.toFixed(1)}% Win Rate`}
          icon={Target}
          color="text-emerald-500"
        />
        <KPICard 
          label="Avg Risk/Reward" 
          value={`${(metrics.avgWin / metrics.avgLoss).toFixed(1)}x`} 
          subValue="Gross Win vs Gross Loss"
          icon={TrendingUp}
          color="text-amber-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Trends */}
        <div className="lg:col-span-2 space-y-6">
          <ChartCard title="Performance Trend (Equity Curve)">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.equityCurve}>
                  <defs>
                    <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                  <XAxis dataKey="date" stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="equity" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorEquity)" 
                    strokeWidth={2} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="R-Multiple Distribution (Risk Reward Tracking)">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.rMultiples}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                  <XAxis dataKey="name" hide />
                  <YAxis stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} label={{ value: 'R', angle: -90, position: 'insideLeft', fill: '#3f3f46' }} />
                  <Tooltip content={<CustomChartTooltip prefix="" suffix="R" />} />
                  <Bar dataKey="r" radius={[4, 4, 0, 0]}>
                    {metrics.rMultiples.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Behavioral Analysis */}
        <div className="space-y-6">
          <ChartCard title="Loss Reason Distribution (Why am I losing?)">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.lossReasons}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {[
                      '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#06b6d4', '#8b5cf6'
                    ].map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #27272a', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {metrics.lossReasons.sort((a, b) => b.value - a.value).slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">{r.name}</span>
                    <span className="text-xs font-mono text-zinc-400">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Emotional Impact (Avg P&L vs State)">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.emotionPerf} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#52525b" fontSize={10} width={80} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Bar dataKey="avgPnl" radius={[0, 4, 4, 0]}>
                    {metrics.emotionPerf.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ChartCard title="Strategy Win Rates (%)">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.strategyPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={9} />
                <YAxis stroke="#52525b" fontSize={9} unit="%" />
                <Tooltip content={<CustomChartTooltip suffix="%" prefix="" />} />
                <Bar dataKey="wr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Market Win/Loss Distribution">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.marketWinRate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={9} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="winRate" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="lossRate" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Time of Day Performance">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.timePerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={9} />
                <YAxis stroke="#52525b" fontSize={9} />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {metrics.timePerf.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <ChartCard title="Risk vs Reward Scatter (Trade Discipline)">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                  <XAxis type="number" dataKey="risk" name="Risk" unit="₹" stroke="#52525b" fontSize={10} />
                  <YAxis type="number" dataKey="reward" name="Reward" unit="₹" stroke="#52525b" fontSize={10} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter 
                    name="Trades" 
                    data={filteredTrades.map(t => ({ 
                      risk: Math.abs(t.entryPrice - (t.stopLoss || t.entryPrice * 0.99)) * t.quantity, 
                      reward: t.pnl,
                      name: t.symbol
                    }))} 
                    fill="#3b82f6" 
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
         </ChartCard>

         <ChartCard title="Daily Outcome Heatmap (Net P&L)">
            <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={metrics.equityCurve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                      <XAxis dataKey="date" stroke="#52525b" fontSize={9} />
                      <YAxis stroke="#52525b" fontSize={9} />
                      <Tooltip content={<CustomChartTooltip prefix="P&L: ₹" />} />
                      <Bar dataKey="pnl">
                        {metrics.equityCurve.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                   </ComposedChart>
                </ResponsiveContainer>
            </div>
         </ChartCard>
      </div>
    </div>
  );
}

function KPICard({ label, value, subValue, icon: Icon, color }: { label: string, value: string, subValue: string, icon: any, color: string }) {
  return (
    <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-[32px] relative overflow-hidden group shadow-xl">
      <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] -mr-16 -mt-16 opacity-10 ${color.replace('text-', 'bg-')}`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-zinc-900 rounded-2xl group-hover:scale-110 transition-transform">
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{label}</p>
        <h3 className="text-4xl font-black text-white mt-2 tracking-tighter">{value}</h3>
        <p className="text-[10px] text-zinc-600 font-bold uppercase mt-2">{subValue}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-8 bg-zinc-950 border border-zinc-900 rounded-[32px] shadow-sm flex flex-col"
    >
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{title}</h3>
        <Info className="w-4 h-4 text-zinc-800" />
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </motion.div>
  );
}

function CustomChartTooltip({ active, payload, label, prefix = "₹", suffix = "" }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/90 backdrop-blur-xl border border-zinc-800 p-4 rounded-2xl shadow-2xl">
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="text-xs text-zinc-400 capitalize">{p.name}</span>
            <span className="text-sm font-mono font-bold" style={{ color: p.color || p.fill }}>
              {prefix}{Math.abs(p.value).toLocaleString()}{suffix}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
