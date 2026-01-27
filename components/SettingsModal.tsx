
import React, { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  onSaveClientId: (id: string) => void;
  apiKey: string | null;
  onSaveApiKey: (key: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  clientId, 
  onSaveClientId, 
  apiKey, 
  onSaveApiKey 
}) => {
  const [tempId, setTempId] = useState(clientId);
  const [tempKey, setTempKey] = useState(apiKey || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Technické nastavenia
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Google Client ID</label>
            <input 
              type="text" 
              value={tempId}
              onChange={(e) => setTempId(e.target.value)}
              placeholder="123456-abcde.apps.googleusercontent.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-blue-400 font-mono focus:ring-2 focus:ring-blue-600 outline-none"
            />
            <p className="text-[9px] text-slate-500 italic ml-1">Toto ID nájdete v Google Cloud Console. Musí končiť na ".apps.googleusercontent.com"</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gemini API Key (Manuálne)</label>
            <input 
              type="password" 
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="Vložte AI kľúč..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-green-400 font-mono focus:ring-2 focus:ring-green-600 outline-none"
            />
            <p className="text-[9px] text-slate-500 italic ml-1">Ak nepoužívate synchronizáciu cez Drive, vložte kľúč tu.</p>
          </div>

          <button 
            onClick={() => {
              onSaveClientId(tempId);
              onSaveApiKey(tempKey);
              onClose();
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95"
          >
            Uložiť a synchronizovať
          </button>
        </div>
        
        <div className="p-4 bg-slate-800/30 text-center">
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
            Synchronizácia prebieha cez zašifrovaný súbor na vašom Google Drive.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
