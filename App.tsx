
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ManualFile, Message, AnalysisMode, SavedProject, KnowledgeBase } from './types';
import { analyzeManual } from './services/gemini';
import { getAllManualsFromDB, saveManualToDB, deleteManualFromDB } from './services/db';
import { driveService } from './services/googleDrive';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ManualViewer from './components/ManualViewer';
import LoginGate from './components/LoginGate';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_MB } from './constants';

const DEFAULT_BASES: KnowledgeBase[] = [
  { id: 'general', name: 'Všeobecné', icon: '🌍' },
  { id: 'intec', name: 'INTEC', icon: '🏢' },
  { id: 'vega', name: 'VEGA', icon: '📡' },
];

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(DEFAULT_BASES);
  const [activeBaseId, setActiveBaseId] = useState<string>('general');
  const [allManuals, setAllManuals] = useState<ManualFile[]>([]);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Vitajte v ElectroExpert AI. Systém je pripravený na analýzu.',
      timestamp: Date.now(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentOrigin = window.location.origin;

  useEffect(() => {
    if (!isLocked) {
      const loadData = async () => {
        const manuals = await getAllManualsFromDB();
        setAllManuals(manuals);
        await driveService.init();
      };
      loadData();
    }
  }, [isLocked]);

  const handleGoogleDriveSync = async () => {
    let cid = localStorage.getItem('ee_google_client_id');
    
    // Ak ID chýba alebo je to placeholder, opýtame sa naň (Toto je Krok 5)
    if (!cid || cid === '' || cid.includes('YOUR_CLIENT_ID')) {
      const msg = `KROK 5: AKTIVÁCIA CLOUDU\n\n1. Choďte do Google Cloud Console (Credentials).\n2. Skopírujte "Client ID" (končí na .apps.googleusercontent.com).\n3. Uistite sa, že v Google Console máte v "Authorized JavaScript origins" pridanú túto presnú adresu:\n   ${currentOrigin}\n\nVložte Client ID sem:`;
      
      const input = prompt(msg, "");
      if (input && input.trim().endsWith('.apps.googleusercontent.com')) {
        cid = input.trim();
        driveService.setClientId(cid);
      } else if (input !== null) {
        alert("Neplatný formát Client ID. Musí končiť na '.apps.googleusercontent.com'");
        return;
      } else {
        return;
      }
    }

    try {
      const success = await driveService.signIn();
      if (success) {
        setIsCloudSynced(true);
        setMessages(prev => [...prev, {
          id: 'sync-' + Date.now(),
          role: 'assistant',
          content: `✅ Cloud pripojený! Vaše dokumenty sa teraz budú synchronizovať s Google Drive.`,
          timestamp: Date.now()
        }]);
      }
    } catch (e: any) {
      console.error("Sync error:", e);
      if (e.error === 'idpiframe_initialization_failed' || (e.message && e.message.includes('401'))) {
        if (confirm("Chyba 401: Google zamietol prístup. Pravdepodobne zlé Client ID alebo chýbajúci Origin v nastaveniach Google Console. Chcete vymazať uložené ID a skúsiť znova?")) {
          localStorage.removeItem('ee_google_client_id');
        }
      } else {
        alert(`Chyba pripojenia: ${e.message || "Skontrolujte konzolu prehliadača (F12)."}`);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newManuals: ManualFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`Súbor ${file.name} je príliš veľký.`);
        continue;
      }
      
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const manual: ManualFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        base64,
        baseId: activeBaseId,
      };

      await saveManualToDB(manual);
      newManuals.push(manual);
      
      if (isCloudSynced) {
        driveService.uploadFile(manual.name, manual.base64, manual.type, manual.baseId);
      }
    }

    setAllManuals(prev => [...prev, ...newManuals]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() && allManuals.length === 0) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsAnalyzing(true);

    try {
      const visibleManuals = allManuals.filter(m => m.baseId === 'general' || m.baseId === activeBaseId);
      const activeBase = knowledgeBases.find(b => b.id === activeBaseId);
      const { text: responseText, sources } = await analyzeManual(text, visibleManuals, currentMode, updatedMessages, activeBase);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: responseText, sources, timestamp: Date.now() }]);
    } catch (error: any) {
      setMessages((prev) => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: `❌ **Chyba:** ${error.message || "Zlyhanie komunikácie s AI."}`, 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLocked) return <LoginGate onUnlock={() => setIsLocked(false)} />;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-100">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center z-20 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white uppercase italic leading-none tracking-tighter">
              Electro<span className="text-blue-500">Expert</span>
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${isCloudSynced ? 'text-green-400 border-green-500/30 bg-green-500/5' : 'text-slate-500 border-slate-700'}`}>
                {isCloudSynced ? 'Cloud Online' : 'Local Only'}
              </span>
              <span className="text-[7px] text-slate-600 font-mono hidden sm:block">Origin: {currentOrigin}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleGoogleDriveSync} 
              className={`${isCloudSynced ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-blue-600 text-white shadow-blue-900/40'} hover:scale-105 active:scale-95 px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-lg flex items-center gap-2`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isCloudSynced ? 'bg-green-400 animate-pulse' : 'bg-white/50'}`}></div>
              {isCloudSynced ? 'SYNCHRONIZÁCIA AKTÍVNA' : 'PRIPOJIŤ GOOGLE CLOUD'}
            </button>
            
            {localStorage.getItem('ee_google_client_id') && (
              <button 
                onClick={() => { if(confirm("Naozaj chcete resetovať Client ID?")) { localStorage.removeItem('ee_google_client_id'); window.location.reload(); } }}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                title="Resetovať nastavenia Cloudu"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            )}
          </div>
        </div>
        
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700 shadow-inner">
           {Object.values(AnalysisMode).map((mode) => (
             <button
               key={mode}
               onClick={() => setCurrentMode(mode)}
               className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${currentMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
             >
               {mode}
             </button>
           ))}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <Sidebar 
          manuals={allManuals.filter(m => m.baseId === activeBaseId)} 
          onUploadClick={() => fileInputRef.current?.click()} 
          onRemove={(id) => { deleteManualFromDB(id); setAllManuals(prev => prev.filter(m => m.id !== id)); }}
          onSaveProject={() => {}}
          savedProjects={savedProjects}
          onLoadProject={(id) => { const p = savedProjects.find(pr => pr.id === id); if(p) setMessages(p.messages); }}
          onDeleteProject={(id, e) => { e.stopPropagation(); setSavedProjects(prev => prev.filter(p => p.id !== id)); }}
          currentProjectId={currentProjectId}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={() => { const n = prompt("Názov novej zložky:"); if(n) setKnowledgeBases(prev => [...prev, {id: n.toLowerCase().replace(/\s/g, '_'), name: n, icon: '📂'}]); }}
        />
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <ChatInterface messages={messages} onSendMessage={handleSendMessage} isAnalyzing={isAnalyzing} activeManualsCount={allManuals.length} />
          <ManualViewer manuals={allManuals.filter(m => m.baseId === activeBaseId)} />
        </div>
      </main>
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
    </div>
  );
};

export default App;
