
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

// Use type casting for window.aistudio to avoid global declaration conflicts with existing environment types
const getAiStudio = () => (window as any).aistudio;

const DEFAULT_BASES: KnowledgeBase[] = [
  { id: 'general', name: 'Všeobecné', icon: '🌍' },
  { id: 'intec', name: 'INTEC', icon: '🏢' },
  { id: 'vega', name: 'VEGA', icon: '📡' },
];

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [hasAiKey, setHasAiKey] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(DEFAULT_BASES);
  const [activeBaseId, setActiveBaseId] = useState<string>('general');
  const [allManuals, setAllManuals] = useState<ManualFile[]>([]);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [tempClientId, setTempClientId] = useState(localStorage.getItem('ee_google_client_id') || '');
  
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
    const checkApiKey = async () => {
      const aistudio = getAiStudio();
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        setHasAiKey(hasKey);
      } else {
        // Ak nie sme v AI Studio prostredí, predpokladáme, že kľúč je v process.env
        setHasAiKey(!!process.env.API_KEY);
      }
    };

    if (!isLocked) {
      const loadData = async () => {
        const manuals = await getAllManualsFromDB();
        setAllManuals(manuals);
        await driveService.init();
      };
      loadData();
      checkApiKey();
    }
  }, [isLocked]);

  const handleSelectAiKey = async () => {
    const aistudio = getAiStudio();
    if (aistudio) {
      await aistudio.openSelectKey();
      // Assume the key selection was successful after triggering openSelectKey and proceed
      setHasAiKey(true);
    }
  };

  const handleStartCloudSetup = () => {
    setShowSetupWizard(true);
    setSetupStep(1);
  };

  const handleSaveClientId = async () => {
    if (!tempClientId.trim().endsWith('.apps.googleusercontent.com')) {
      alert("Chyba: Toto nevyzerá ako Client ID. Musí končiť na '.apps.googleusercontent.com'");
      return;
    }
    driveService.setClientId(tempClientId.trim());
    setSetupStep(3);
    
    try {
      const success = await driveService.signIn();
      if (success) {
        setIsCloudSynced(true);
        setShowSetupWizard(false);
      }
    } catch (e: any) {
      console.error("Setup Error:", e);
      setSetupStep(4);
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
    if (!hasAiKey) {
      setMessages(prev => [...prev, {
        id: 'err-key-' + Date.now(),
        role: 'assistant',
        content: '⚠️ **AI nie je aktivovaná.** Pre pokračovanie kliknite na tlačidlo "AKTIVOVAŤ AI" v hornom paneli a vyberte platný kľúč.',
        timestamp: Date.now()
      }]);
      return;
    }

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
      // If the request fails with an error message containing "Requested entity was not found.", reset the key selection state 
      // and prompt the user to select a key again via openSelectKey()
      if (error.message === "API_KEY_REQUIRED") {
        setHasAiKey(false);
        setMessages((prev) => [...prev, { 
          id: 'err-' + Date.now(), 
          role: 'assistant', 
          content: `❌ **Chyba kľúča:** Vybraný API kľúč nie je platný alebo expiroval. Prosím, aktivujte AI znova.`, 
          timestamp: Date.now() 
        }]);
      } else {
        setMessages((prev) => [...prev, { 
          id: 'err-' + Date.now(), 
          role: 'assistant', 
          content: `❌ **Chyba:** ${error.message || "Zlyhanie komunikácie s AI."}`, 
          timestamp: Date.now() 
        }]);
      }
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
          
          <div className="flex items-center gap-2">
            {!hasAiKey && (
              <button 
                onClick={handleSelectAiKey}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl text-[11px] font-black transition-all shadow-lg flex items-center gap-2 animate-pulse"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.65 4.8c-.34-.3-.76-.43-1.16-.43V3.14c0-.43-.32-.81-.75-.86-.49-.06-.94.31-.94.8v1.29c-.4.01-.82.13-1.16.43-.52.47-.63 1.18-.32 1.76l.32.58c.21.39.61.62 1.02.62h.23c.31 0 .58-.2.67-.5.1-.34.4-.57.75-.57.34 0 .65.23.75.57.09.3.36.5.67.5h.23c.41 0 .81-.23 1.02-.62l.32-.58c.31-.58.2-1.29-.32-1.76z"/></svg>
                AKTIVOVAŤ AI
              </button>
            )}
            <button 
              onClick={handleStartCloudSetup} 
              className={`${isCloudSynced ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-blue-600 text-white'} hover:scale-105 active:scale-95 px-5 py-2.5 rounded-xl text-[11px] font-black transition-all shadow-lg flex items-center gap-2`}
            >
              {isCloudSynced ? 'GOOGLE DRIVE OK' : 'PRIPOJIŤ DRIVE'}
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

      {showSetupWizard && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Nastavenie Google Drive</h2>
              <button onClick={() => setShowSetupWizard(false)} className="text-slate-500 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8 space-y-6">
              {setupStep === 1 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">V Google Console povoľte túto adresu v <strong>Authorized JavaScript origins</strong>:</p>
                  <code className="bg-black p-3 rounded-xl block font-mono text-blue-400 select-all">{currentOrigin}</code>
                  <button onClick={() => setSetupStep(2)} className="w-full bg-blue-600 py-4 rounded-xl font-black uppercase text-xs">Pokračovať</button>
                </div>
              )}
              {setupStep === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">Vložte svoje <strong>Client ID</strong>:</p>
                  <input type="text" value={tempClientId} onChange={(e) => setTempClientId(e.target.value)} placeholder="...apps.googleusercontent.com" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-sm font-mono" />
                  <button onClick={handleSaveClientId} className="w-full bg-blue-600 py-4 rounded-xl font-black uppercase text-xs">Uložiť a Prihlásiť</button>
                </div>
              )}
              {setupStep === 3 && <div className="py-10 text-center animate-pulse">Pripájanie k Drive...</div>}
              {setupStep === 4 && <div className="bg-red-500/10 p-4 rounded-xl text-red-500 text-xs">Chyba 401: Skontrolujte typ klienta (Web Application) a povolený Origin.</div>}
            </div>
          </div>
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
