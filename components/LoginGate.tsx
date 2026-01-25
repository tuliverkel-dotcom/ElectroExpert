
import React, { useState, useEffect } from 'react';

interface LoginGateProps {
  onUnlock: () => void;
}

const LoginGate: React.FC<LoginGateProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const savedHash = localStorage.getItem('ee_workspace_hash');
    if (!savedHash) {
      setIsNewUser(true);
    }
  }, []);

  const handleAction = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);

    if (isNewUser) {
      if (password.length < 4) {
        alert("Heslo musí mať aspoň 4 znaky.");
        return;
      }
      if (password !== confirmPassword) {
        alert("Heslá sa nezhodujú.");
        return;
      }
      localStorage.setItem('ee_workspace_hash', btoa(password)); 
      setIsNewUser(false);
      onUnlock();
    } else {
      const savedHash = localStorage.getItem('ee_workspace_hash');
      if (btoa(password) === savedHash) {
        onUnlock();
      } else {
        setError(true);
        setPassword('');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 overflow-y-auto p-4 backdrop-blur-md">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e293b_0%,#020617_100%)]"></div>
      </div>

      <div className="relative w-full max-w-md p-10 bg-slate-900/90 border border-slate-800 rounded-[2.5rem] shadow-2xl shadow-blue-900/40">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-inner">
            <svg className={`w-10 h-10 ${error ? 'text-red-500 animate-pulse' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
            Electro<span className="text-blue-500">Expert</span>
          </h1>
          <p className="text-[11px] text-slate-500 uppercase font-black tracking-[0.3em] mt-2">
            Zabezpečený terminál
          </p>
        </div>

        <form onSubmit={handleAction} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">
              {isNewUser ? 'Vytvorte si heslo' : 'Vstupné heslo'}
            </label>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-slate-950 border ${error ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'} rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 transition-all text-center tracking-[0.6em] font-mono text-xl shadow-inner`}
            />
          </div>

          {isNewUser && (
            <div className="space-y-2 animate-in slide-in-from-top-4 duration-500">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Potvrďte heslo</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center tracking-[0.6em] font-mono text-xl shadow-inner"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 py-2 rounded-xl text-center">
               <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">Prístup zamietnutý</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-95 uppercase text-xs tracking-[0.2em] border border-blue-400/50"
          >
            {isNewUser ? 'Aktivovať pracovisko' : 'Odomknúť systém'}
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest italic opacity-50">Authorized Personnel Only</p>
        </div>
      </div>
    </div>
  );
};

export default LoginGate;
