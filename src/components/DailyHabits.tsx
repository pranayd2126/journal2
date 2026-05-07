import { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { DailyChecklist } from '../types';
import { format } from 'date-fns';
import { Check, ShieldCheck, Zap, Newspaper, CalendarCheck } from 'lucide-react';

export default function DailyHabits() {
  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const user = dbService.getCurrentUser();
    if (user) {
      const fetchChecklist = async () => {
        const data = await dbService.getCollection<DailyChecklist>(`users/${user.id}/checklists`);
        const todayData = data.find(c => c.date === today);
        if (todayData) setChecklist(todayData);
        setLoading(false);
      };
      fetchChecklist();
    }
  }, []);

  const toggleHabit = async (key: keyof Omit<DailyChecklist, 'id' | 'userId' | 'date' | 'disciplineScore' | 'createdAt'>) => {
    const user = dbService.getCurrentUser();
    if (!user) return;

    const updated = checklist ? { ...checklist, [key]: !checklist[key] } : {
      userId: user.id,
      date: today,
      followedRisk: false,
      noFOMO: false,
      waitedForConfirmation: false,
      avoidedNews: false,
      plannedTrade: false,
      [key]: true,
      disciplineScore: 0,
      createdAt: null
    };

    // Calculate score
    const habits = [updated.followedRisk, updated.noFOMO, updated.waitedForConfirmation, updated.avoidedNews, updated.plannedTrade];
    updated.disciplineScore = (habits.filter(Boolean).length / habits.length) * 100;

    if (checklist?.id) {
      await dbService.updateDocument(`users/${user.id}/checklists`, checklist.id, updated);
      setChecklist(updated);
    } else {
      const id = await dbService.addDocument(`users/${user.id}/checklists`, updated);
      setChecklist({ ...updated, id });
    }
  };

  if (loading) return null;

  const HABITS = [
    { key: 'followedRisk', label: 'Followed Risk Plan', icon: ShieldCheck },
    { key: 'noFOMO', label: 'Zero FOMO Trading', icon: Zap },
    { key: 'waitedForConfirmation', label: 'Waited for Setup', icon: Check },
    { key: 'avoidedNews', label: 'Avoided News Impact', icon: Newspaper },
    { key: 'plannedTrade', label: 'Only Planned Trades', icon: CalendarCheck },
  ] as const;

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Daily Discipline Tracker</h3>
        <div className="px-3 py-1 bg-blue-600/10 text-blue-500 rounded-full text-xs font-bold border border-blue-500/20">
          Score: {checklist?.disciplineScore.toFixed(0) || 0}%
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {HABITS.map(habit => {
          const Icon = habit.icon;
          const isChecked = checklist?.[habit.key] || false;
          return (
            <button
              key={habit.key}
              onClick={() => toggleHabit(habit.key)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                isChecked ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-transparent border-zinc-900 text-zinc-500 hover:border-zinc-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isChecked ? 'text-blue-500' : 'text-zinc-600'}`} />
                <span className="text-sm font-medium">{habit.label}</span>
              </div>
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                isChecked ? 'bg-blue-600 border-blue-600' : 'bg-zinc-950 border-zinc-800'
              }`}>
                {isChecked && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
