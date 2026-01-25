
import React, { useState, useEffect } from 'react';

interface LoginGateProps {
  onUnlock: () => void;
  hasApiKey?: boolean;
  onSelectKey?: () => void;
}

const LoginGate: React.FC<LoginGateProps> = ({ onUnlock, hasApiKey, onSelectKey }) => {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 overflow-y-auto p-4">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e293b_0%,#020617_100%)]"></div>
      </div>

      <div className="relative w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-blue-900/20 my-auto">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-4 border border-blue-500/30">
            <svg className={`w-8 h-8 ${error ? 'text-red-500 animate-shake' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">
            Electro<span className="text-blue-500">Expert</span>
          </h1>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] mt-1">
            Zabezpečené pracovisko
          </p>
        </div>

        {/* API KEY SECTION - PRIORITNÁ PRE FUNKČNOSŤ */}
        {!hasApiKey && onSelectKey && (
          <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-2xl">
            <p className="text-[10px] text-blue-300 font-bold uppercase mb-2 text-center tracking-tight">
              ⚠ Najskôr prepojte AI systém cez Google Cloud
            </p>
            <button 
              onClick={onSelectKey}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl shadow-lg transition-all animate-bounce uppercase text-[10px] tracking-widest border border-blue-400"
            >
              Nastaviť API kľúč
            </button>
            <p className="text-[9px] text-slate-500 italic mt-2 text-center">
              (Vyžaduje kľúč z plateného projektu s povoleným billingom)
            </p>
          </div>
        )}

        <form onSubmit={handleAction} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
              {isNewUser ? 'Vytvorte si heslo do aplikácie' : 'Vstupné heslo'}
            </label>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-slate-950 border ${error ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'} rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all text-center tracking-[0.5em] font-mono`}
            />
          </div>

          {isNewUser && (
            <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Potvrďte heslo</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center tracking-[0.5em] font-mono"
              />
            </div>
          )}

          {error && (
            <p className="text-[10px] text-red-500 font-bold text-center uppercase tracking-wider animate-pulse">
              Nesprávne heslo.
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest"
          >
            {isNewUser ? 'Vytvoriť a vstúpiť' : 'Odomknúť a vstúpiť'}
          </button>
        </form>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default LoginGate;
