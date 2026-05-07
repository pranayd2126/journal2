import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbService } from '../services/dbService';

interface AuthProps {
  user: any;
  onLogin: (user: any) => void;
  onLogout: () => void;
}

export default function Auth({ user, onLogin, onLogout }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.toLowerCase(),
          password: formData.password,
          name: formData.name
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server returned non-JSON response (${response.status})`);
      }

      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      dbService.setCurrentUser(data);
      onLogin(data);
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="flex flex-col md:flex-row items-center gap-4 px-4 py-2 bg-zinc-950 border border-zinc-900 rounded-2xl md:rounded-full">
        <div className="text-center md:text-right">
          <p className="text-sm font-bold text-white uppercase tracking-tighter">{user.name || 'Trader'}</p>
          <p className="text-[10px] text-zinc-500 font-mono">{user.email}</p>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-full transition-all group"
          title="Logout"
        >
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full max-w-md mx-auto relative z-10">
      <div className="w-full bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-600/20">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tighter uppercase mb-2">ZEN_TRADER</h1>
          <p className="text-zinc-500 text-sm font-medium tracking-wide">Enter the high-frequency journal</p>
        </div>

        <AnimatePresence mode='wait'>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">Identity</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:border-blue-600 outline-none transition-all"
                  placeholder="Your Full Name"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">Access Channel</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:border-blue-600 outline-none transition-all"
                placeholder="name@terminal.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Encryption Key</label>
              {isLogin && (
                <button type="button" className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest">Forgot?</button>
              )}
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-700 focus:border-blue-600 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/10 transition-all flex items-center justify-center gap-2 group transform active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isLogin ? 'Initiate Session' : 'Create Profile'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 text-center">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setFormData({ email: '', password: '', name: '' });
            }}
            className="text-[11px] font-bold text-zinc-500 hover:text-white uppercase tracking-[0.2em] transition-colors"
          >
            {isLogin ? "Need a new account? Register" : "Already registered? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
