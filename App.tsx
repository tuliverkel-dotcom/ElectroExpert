
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
  const [showCloudHelper, setShowCloudHelper] = useState(false);
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
    
    // Ak ID chýba, pýtame sa (Krok 5)
    if (!cid || cid === '' || cid.includes('YOUR_CLIENT_ID')) {
      const msg = `KROK 5: AKTIVÁCIA CLOUDU\n\n1. Skopírujte "Client ID" z Google Console.\n2. Musí končiť na: .apps.googleusercontent.com\n3. Ak ste v kroku 4 nezadali túto adresu do Origins, prihlásenie zlyhá:\n${currentOrigin}\n\nVložte Client ID:`;
      
      const input = prompt(msg, "");
      if (input && input.trim().endsWith('.apps.googleusercontent.com')) {
        cid = input.trim();
        driveService.setClientId(cid);
        // Malá pauza na prebratie nového ID
        await new Promise(r => setTimeout(r, 300));
      } else if (input !== null) {
        alert("Chyba: Vložený text nevyzerá ako Client ID. Musí končiť na .apps.googleusercontent.com");
        return;
      } else {
        return;
      }
    }

    try {
      const success = await driveService.signIn();
      if (success) {
        setIsCloudSynced(true);
        setShowCloudHelper(false);
        setMessages(prev => [...prev, {
          id: 'sync-' + Date.now(),
          role: 'assistant',
          content: `✅ Cloud pripojený! Vaše dokumenty sú teraz v bezpečí na Google Drive.`,
          timestamp: Date.now()
        }]);
      }
    } catch (e: any) {
      console.error("Sync error:", e);
      // Riešenie chyby 401
      const is401 = e.message?.includes('401') || e.error === 'invalid_client' || e.error === 'idpiframe_initialization_failed';
      
      if (is401) {
        setShowCloudHelper(true);
        if (confirm("Chyba 401 (Invalid Client).\n\nTo znamená, že Google váš kód nepozná. Chcete vymazať uložené ID a skúsiť ho zadať znova? (Uistite sa, že kopírujete Client ID a nie Client Secret!)")) {
          localStorage.removeItem('ee_google_client_id');
          window.location.reload();
        }
      } else {
        alert(`Chyba: ${e.message || "Skontrolujte nastavenia v Google Console."}`);
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
                {isCloudSynced ? 'Cloud Online' : 'Workspace Offline'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleGoogleDriveSync} 
              className={`${isCloudSynced ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-blue-600 text-white shadow-blue-900/40'} hover:scale-105 active:scale-95 px-5 py-2.5 rounded-xl text-[11px] font-black transition-all shadow-lg flex items-center gap-2`}
            >
              <div className={`w-2 h-2 rounded-full ${isCloudSynced ? 'bg-green-400 animate-pulse' : 'bg-white/50'}`}></div>
              {isCloudSynced ? 'SYNCHRONIZÁCIA BEŽÍ' : 'PRIPOJIŤ GOOGLE CLOUD'}
            </button>
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

      {showCloudHelper && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-lg bg-red-950 border border-red-500/50 p-6 rounded-2xl z-50 shadow-2xl animate-in zoom-in-95 duration-200">
          <h2 className="text-red-400 font-black text-sm uppercase mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            CHYBA 401: AKO JU OPRAVIŤ?
          </h2>
          <div className="space-y-4 text-xs text-red-200 leading-relaxed">
            <p><strong className="text-white uppercase">1. Kontrola v Google Console:</strong> Uistite sa, že ste vytvorili <code className="bg-black/50 px-1 rounded text-white">OAuth 2.0 Client ID</code> typu <strong className="text-white">Web Application</strong>.</p>
            <p><strong className="text-white uppercase">2. Povolený Origin:</strong> V sekcii "Authorized JavaScript origins" musíte mať presne toto (bez lomky na konci): <br/>
            <code className="bg-black p-2 mt-2 block rounded font-mono text-blue-400 border border-blue-500/30 select-all">{currentOrigin}</code></p>
            <p><strong className="text-white uppercase">3. Kopírujete správny kód?</strong> Musíte skopírovať <strong className="text-white">Client ID</strong> (končí na .apps.googleusercontent.com). <span className="underline italic">Nesmie</span> to byť "Client Secret".</p>
          </div>
          <button onClick={() => setShowCloudHelper(false)} className="mt-6 w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors">ZAVRIEŤ A SKÚSIŤ ZNOVA</button>
        </div>
      )}

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
