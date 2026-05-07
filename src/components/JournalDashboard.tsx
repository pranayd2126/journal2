import { useState, useMemo } from 'react';
import { Trade } from '../types';
import { format } from 'date-fns';
import { 
  Search, Filter, SlidersHorizontal, TrendingUp, TrendingDown, 
  Calendar, Tag, MoreHorizontal, Image as ImageIcon,
  ArrowUpRight, ArrowDownRight, Clock, X, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface JournalDashboardProps {
  trades: Trade[];
}

type SortOption = 'newest' | 'oldest' | 'highest_profit' | 'highest_loss';

export default function JournalDashboard({ trades }: JournalDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPnl, setFilterPnl] = useState<'all' | 'profit' | 'loss'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    trades.forEach(t => {
      t.tags?.forEach(tag => tags.add(tag));
      t.mistakes?.forEach(m => tags.add(m));
    });
    return Array.from(tags);
  }, [trades]);

  const filteredTrades = useMemo(() => {
    let result = [...trades];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.symbol.toLowerCase().includes(lower) || 
        t.tradeReason?.toLowerCase().includes(lower) ||
        t.tags?.some(tag => tag.toLowerCase().includes(lower))
      );
    }

    if (filterPnl === 'profit') {
      result = result.filter(t => t.pnl > 0);
    } else if (filterPnl === 'loss') {
      result = result.filter(t => t.pnl < 0);
    }

    if (selectedTag !== 'all') {
      result = result.filter(t => 
        t.tags?.includes(selectedTag) || 
        t.mistakes?.includes(selectedTag)
      );
    }

    result.sort((a, b) => {
      const timeA = new Date(a.entryTime).getTime();
      const timeB = new Date(b.entryTime).getTime();
      
      switch (sortBy) {
        case 'newest': return timeB - timeA;
        case 'oldest': return timeA - timeB;
        case 'highest_profit': return b.pnl - a.pnl;
        case 'highest_loss': return a.pnl - b.pnl;
        default: return 0;
      }
    });

    return result;
  }, [trades, searchTerm, filterPnl, sortBy, selectedTag]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-950 border border-zinc-900 p-4 rounded-2xl">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text"
            placeholder="Search symbols, tags, or reasons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={filterPnl}
            onChange={(e) => setFilterPnl(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs font-bold text-zinc-400 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All Outcomes</option>
            <option value="profit">Profits Only</option>
            <option value="loss">Losses Only</option>
          </select>

          <select 
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs font-bold text-zinc-400 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
          >
            <option value="all">Every Tag</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs font-bold text-zinc-400 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest_profit">Top Profit</option>
            <option value="highest_loss">Top Loss</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredTrades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} onClick={() => setSelectedTrade(trade)} />
          ))}
        </AnimatePresence>
      </div>

      {filteredTrades.length === 0 && (
        <div className="py-32 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-zinc-700" />
          </div>
          <h3 className="text-white font-bold text-lg">No matches found</h3>
          <p className="text-zinc-500 text-sm mt-1">Try adjusting your filters or search term</p>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedTrade && (
          <TradeDetailModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function TradeDetailModal({ trade, onClose }: { trade: Trade, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-black/90 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-zinc-950 border border-zinc-900 w-full max-w-6xl max-h-[90vh] rounded-[40px] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
            {/* Visual Side */}
            <div className="bg-zinc-900 relative min-h-[300px] lg:min-h-0">
              {trade.imageUrl ? (
                <img 
                  src={trade.imageUrl} 
                  alt="Trade Screenshot" 
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 gap-3">
                  <ImageIcon className="w-12 h-12 opacity-10" />
                  <p className="text-xs font-bold uppercase tracking-widest opacity-20 text-center px-4">Detailed visual analysis unavailable for this entry</p>
                </div>
              )}
              
              <button 
                onClick={onClose}
                className="absolute top-6 left-6 p-3 bg-black/50 hover:bg-black text-white rounded-2xl backdrop-blur-md transition-all lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Data Side */}
            <div className="p-8 lg:p-12 space-y-10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-4xl font-bold text-white uppercase tracking-tighter">{trade.symbol}</h2>
                    <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                      trade.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.side}
                    </span>
                  </div>
                  <p className="text-zinc-500 font-mono text-sm">
                    Executed on {format(new Date(trade.entryTime), 'MMMM dd, yyyy • HH:mm')}
                  </p>
                </div>
                <button 
                  onClick={onClose}
                  className="hidden lg:flex p-3 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <DetailStat label="P&L Outcome" value={`₹${trade.pnl.toLocaleString()}`} color={trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'} />
                <DetailStat label="Quantity" value={trade.quantity.toString()} />
                <DetailStat label="Risk Used" value={`${trade.riskPercentage}%`} />
                <DetailStat label="Setup" value={trade.setupType || 'Generic'} />
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Trade Thesis & Logic</h4>
                <p className="text-lg text-zinc-300 leading-relaxed font-medium italic">
                   &ldquo;{trade.tradeReason || 'No reasoning logged for this trade.'}&rdquo;
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Execution Quality</h4>
                  <div className="space-y-3">
                    <StatusItem label="Followed Trade Plan" active={trade.executionQuality?.followedPlan !== false} />
                    <StatusItem label="Respected Stop Loss" active={trade.executionQuality?.followedSL !== false} />
                    <StatusItem label="Risk-Reward Discipline" active={trade.executionQuality?.respectedRR !== false} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Psychological Radar</h4>
                  <div className="flex flex-wrap gap-2">
                    <TagBadge label={`Pre: ${trade.psychology?.before || 'CALM'}`} />
                    <TagBadge label={`During: ${trade.psychology?.during || 'CALM'}`} />
                    <TagBadge label={`Post: ${trade.psychology?.after || 'CALM'}`} />
                  </div>
                </div>
              </div>

              {trade.mistakes && trade.mistakes.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-red-500/50 uppercase tracking-[0.2em]">Mistakes Identified</h4>
                  <div className="flex flex-wrap gap-2">
                    {trade.mistakes.map(m => (
                      <span key={m} className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl uppercase tracking-widest">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TradeCard({ trade, onClick }: { trade: Trade, onClick: () => void, key?: string | number }) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onClick}
      className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden group hover:border-zinc-700 transition-all shadow-xl hover:shadow-2xl flex flex-col h-full cursor-pointer"
    >
      {/* Card Header / Image */}
      <div className="aspect-video bg-zinc-900 relative overflow-hidden shrink-0">
        {trade.imageUrl ? (
          <img 
            src={trade.imageUrl} 
            alt={trade.symbol} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 gap-2">
            <ImageIcon className="w-8 h-8 opacity-20" />
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-30">No Screenshot Attached</span>
          </div>
        )}
        
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${
            trade.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
          }`}>
            {trade.side}
          </div>
          {trade.setupType && (
            <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border bg-blue-500/20 text-blue-400 border-blue-500/30">
              {trade.setupType}
            </div>
          )}
        </div>

        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-mono font-bold backdrop-blur-md border shadow-lg ${
          trade.pnl >= 0 ? 'bg-emerald-500/40 text-white border-emerald-500/50' : 'bg-red-500/40 text-white border-red-500/50'
        }`}>
          {trade.pnl >= 0 ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString()}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{trade.symbol}</h4>
            <div className="flex items-center gap-1.5 text-zinc-500 mt-1">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-mono font-bold">
                {(() => {
                  try {
                    return format(new Date(trade.entryTime), 'MMM dd, yyyy • HH:mm');
                  } catch (e) {
                    return 'Date Unknown';
                  }
                })()}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-end text-[10px] font-bold uppercase tracking-widest gap-1">
            <span className={trade.executionQuality?.followedPlan !== false ? 'text-emerald-500' : 'text-amber-500'}>
              {trade.executionQuality?.followedPlan !== false ? 'STRICT' : 'BREACH'}
            </span>
            <span className="text-zinc-600">RR {((trade.targetPrice! - trade.entryPrice!) / (trade.entryPrice! - trade.stopLoss!)).toFixed(1)}x</span>
          </div>
        </div>

        {trade.tradeReason && (
          <p className="text-zinc-400 text-sm leading-relaxed mb-4 line-clamp-2 italic">
             &ldquo;{trade.tradeReason}&rdquo;
          </p>
        )}

        <div className="mt-auto pt-4 border-t border-zinc-900/50 flex flex-wrap gap-2">
          {trade.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{tag}</span>
          ))}
          {trade.mistakes?.slice(0, 2).map(m => (
            <span key={m} className="px-2 py-1 bg-red-500/5 border border-red-500/10 rounded-lg text-[9px] font-bold text-red-500 uppercase tracking-widest">{m}</span>
          ))}
          {(trade.tags?.length || 0) + (trade.mistakes?.length || 0) > 4 && (
            <span className="text-[9px] font-bold text-zinc-600 mt-1.5">+{((trade.tags?.length || 0) + (trade.mistakes?.length || 0)) - 4} MORE</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DetailStat({ label, value, color = 'text-white' }: { label: string, value: string, color?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

function StatusItem({ label, active }: { label: string, active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${active ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
        {active ? <Check className="w-3.5 h-3.5 font-bold" /> : <X className="w-3.5 h-3.5 font-bold" />}
      </div>
      <span className={`text-sm font-bold ${active ? 'text-zinc-300' : 'text-zinc-500 line-through'}`}>{label}</span>
    </div>
  );
}

function TagBadge({ label }: { label: string }) {
  return (
    <span className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
      {label}
    </span>
  );
}
