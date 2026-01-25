
import React, { useState, useRef, useEffect } from 'react';
import { ManualFile, Message, AnalysisMode, SavedProject, KnowledgeBase } from './types';
import { analyzeManual } from './services/gemini';
import { 
  getAllManualsFromDB, 
  saveManualToDB, 
  deleteManualFromDB, 
  saveProjectToDB, 
  getAllProjectsFromDB, 
  deleteProjectFromDB 
} from './services/db';
import { driveService } from './services/googleDrive';
import { APP_VERSION } from './constants';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ManualViewer from './components/ManualViewer';
import LoginGate from './components/LoginGate';

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [driveStatus, setDriveStatus] = useState<'off' | 'on' | 'loading'>('off');
  const [syncingFiles, setSyncingFiles] = useState<Set<string>>(new Set());
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [allManuals, setAllManuals] = useState<ManualFile[]>([]);
  const [activeBaseId, setActiveBaseId] = useState<string>('general');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(() => {
    const saved = localStorage.getItem('ee_knowledge_bases');
    return saved ? JSON.parse(saved) : [
      { id: 'general', name: 'Základné', icon: '⚡' },
      { id: 'intec', name: 'Intec', icon: '🏭' },
      { id: 'vega', name: 'Vega', icon: '🛰️' }
    ];
  });

  const welcomeMessage: Message = {
    id: 'welcome',
    role: 'assistant',
    content: 'ElectroExpert je pripravený. Uistite sa, že svieti zelený indikátor "API KĽÚČ OK".',
    timestamp: Date.now(),
  };

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkKeyStatus = async () => {
    const win = window as any;
    if (win.aistudio?.hasSelectedApiKey) {
      try {
        const ok = await win.aistudio.hasSelectedApiKey();
        setHasApiKey(ok);
      } catch (e) {
        setHasApiKey(false);
      }
    }
  };

  useEffect(() => {
    checkKeyStatus();
    const interval = setInterval(checkKeyStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isLocked) {
      getAllManualsFromDB().then(setAllManuals);
      getAllProjectsFromDB().then(setSavedProjects);
    }
  }, [isLocked]);

  const handleSelectKey = async () => {
    const win = window as any;
    if (win.aistudio?.openSelectKey) {
      await win.aistudio.openSelectKey();
      setHasApiKey(true); // Predpokladáme úspech podľa pravidiel race condition
    } else {
      alert("Dialóg pre kľúč nie je dostupný v tomto prehliadači.");
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsAnalyzing(true);

    try {
      const visibleManuals = allManuals.filter(m => m.baseId === activeBaseId);
      const { text: responseText, sources } = await analyzeManual(text, visibleManuals, currentMode, updatedMessages);
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: responseText, 
        timestamp: Date.now(),
        sources 
      }]);
    } catch (error: any) {
      if (error.message?.includes("API kľúč") || error.message?.includes("kľúča")) {
        setHasApiKey(false);
      }
      setMessages(prev => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: `❌ ${error.message}`, 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files) as File[]) {
      const tempId = Math.random().toString(36).substr(2, 9);
      setSyncingFiles(prev => new Set(prev).add(tempId));
      
      const base64 = await new Promise<string>(r => {
        const reader = new FileReader();
        reader.onload = () => r((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const manual: ManualFile = { id: tempId, name: file.name, type: file.type, base64, baseId: activeBaseId };
      await saveManualToDB(manual);
      setAllManuals(prev => [...prev, manual]);
      setSyncingFiles(prev => { const n = new Set(prev); n.delete(tempId); return n; });
    }
  };

  if (isLocked) return (
    <LoginGate 
      onUnlock={() => setIsLocked(false)} 
      hasApiKey={hasApiKey} 
      onSelectKey={handleSelectKey} 
    />
  );

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-2xl relative z-20">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic tracking-tighter leading-none">Electro<span className="text-blue-500">Expert</span></h1>
            <span className="text-[9px] font-bold text-slate-500 tracking-[0.2em] mt-1 uppercase">Build {APP_VERSION}</span>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
            hasApiKey ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-red-500'}`}></div>
            {hasApiKey ? 'API KĽÚČ OK' : 'CHÝBA API KĽÚČ'}
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={handleSelectKey}
             className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border flex items-center gap-2 ${
               hasApiKey ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-blue-600 border-blue-400 text-white animate-bounce'
             }`}
           >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
             {hasApiKey ? 'ZMENIŤ KĽÚČ' : 'NASTAVIŤ API KĽÚČ'}
           </button>

           <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
             {['SCHEMATIC', 'LOGIC', 'SETTINGS'].map((mode) => (
               <button key={mode} onClick={() => setCurrentMode(mode as AnalysisMode)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${currentMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                 {mode}
               </button>
             ))}
           </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <Sidebar 
          manuals={allManuals.filter(m => m.baseId === activeBaseId)} 
          onUploadClick={() => fileInputRef.current?.click()} 
          onRemove={(id) => { deleteManualFromDB(id); setAllManuals(prev => prev.filter(m => m.id !== id)); }}
          onSaveProject={() => {}} 
          onNewProject={() => setMessages([welcomeMessage])}
          savedProjects={[]} 
          onLoadProject={() => {}}
          onDeleteProject={() => {}}
          currentProjectId={null}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={() => {}}
          syncingFiles={syncingFiles}
        />
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <ChatInterface messages={messages} onSendMessage={handleSendMessage} isAnalyzing={isAnalyzing} activeManualsCount={allManuals.filter(m => m.baseId === activeBaseId).length} />
          <ManualViewer manuals={allManuals.filter(m => m.baseId === activeBaseId)} />
        </div>
      </main>
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
    </div>
  );
};

export default App;
