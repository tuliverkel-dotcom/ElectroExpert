
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
  const [aiStatus, setAiStatus] = useState<'ready' | 'pending' | 'error'>('pending');
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
      content: 'Systém ElectroExpert AI nabudený. Ak máte v prostredí nastavený API kľúč, môžeme začať.',
      timestamp: Date.now(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      // 1. Skontrolujeme, či je kľúč priamo v environmente (najčastejší prípad)
      if (process.env.API_KEY && process.env.API_KEY.length > 5) {
        setAiStatus('ready');
        return;
      }

      // 2. Skontrolujeme AI Studio dialóg
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        try {
          const hasKey = await aistudio.hasSelectedApiKey();
          if (hasKey) setAiStatus('ready');
        } catch (e) {
          console.warn("AI Studio key check failed", e);
        }
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

  const handleActivateAi = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      try {
        await aistudio.openSelectKey();
        setAiStatus('ready');
      } catch (e) {
        alert("Nepodarilo sa otvoriť výber kľúča. Uistite sa, že nie ste v anonymnom okne.");
        setAiStatus('error');
      }
    } else {
      alert("Prostredie nepodporuje automatický výber kľúča. Kľúč musí byť vložený cez environment premennú API_KEY.");
      setAiStatus('error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newManuals: ManualFile[] = [];
    for (const file of Array.from(files)) {
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
    }
    setAllManuals(prev => [...prev, ...newManuals]);
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsAnalyzing(true);

    try {
      const visibleManuals = allManuals.filter(m => m.baseId === 'general' || m.baseId === activeBaseId);
      const activeBase = knowledgeBases.find(b => b.id === activeBaseId);
      const { text: responseText, sources } = await analyzeManual(text, visibleManuals, currentMode, updatedMessages, activeBase);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: responseText, sources, timestamp: Date.now() }]);
      setAiStatus('ready');
    } catch (error: any) {
      setAiStatus('error');
      let errorMsg = "Došlo k chybe pri spracovaní.";
      
      if (error.message === "API_KEY_REQUIRED") {
        errorMsg = "❌ **Chýba API kľúč.** AI nemôže odpovedať bez platného kľúča v premennej process.env.API_KEY.";
      } else {
        errorMsg = `❌ **Chyba AI:** ${error.message}`;
      }

      setMessages((prev) => [...prev, { id: 'err-' + Date.now(), role: 'assistant', content: errorMsg, timestamp: Date.now() }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLocked) return <LoginGate onUnlock={() => setIsLocked(false)} />;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-100 font-sans">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center z-20 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white uppercase italic leading-none tracking-tighter">
              Electro<span className="text-blue-500">Expert</span>
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${aiStatus === 'ready' ? 'bg-green-500' : aiStatus === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                AI ENGINE: {aiStatus.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {aiStatus !== 'ready' && (
              <button 
                onClick={handleActivateAi}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 shadow-lg"
              >
                AKTIVOVAŤ AI MANUÁLNE
              </button>
            )}
            <button 
              onClick={() => setShowSetupWizard(true)} 
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2"
            >
              DRIVE SETUP
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
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Google Drive Sync</h2>
            <input 
              type="text" 
              value={tempClientId} 
              onChange={(e) => setTempClientId(e.target.value)} 
              placeholder="Google Client ID..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowSetupWizard(false)} className="flex-1 bg-slate-800 py-2 rounded-lg text-xs font-bold">Zrušiť</button>
              <button onClick={() => {
                driveService.setClientId(tempClientId);
                setShowSetupWizard(false);
                setIsCloudSynced(true);
              }} className="flex-1 bg-blue-600 py-2 rounded-lg text-xs font-bold text-white">Uložiť</button>
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
          onLoadProject={() => {}}
          onDeleteProject={() => {}}
          currentProjectId={currentProjectId}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={() => {}}
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
