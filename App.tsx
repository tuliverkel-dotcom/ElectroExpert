
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

declare global {
  // Fix: Simplification of Window augmentation to avoid modifier conflicts (Error on line 26)
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
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
    content: 'ElectroExpert je pripravený. Nahrajte manuály alebo vyberte uložené riešenie.',
    timestamp: Date.now(),
  };

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kontrola API kľúča
  const checkKey = async () => {
    if (window.aistudio) {
      const ok = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(ok);
    }
  };

  useEffect(() => {
    checkKey();
    if (!isLocked) {
      getAllManualsFromDB().then(setAllManuals);
      getAllProjectsFromDB().then(setSavedProjects);
      driveService.init().then(() => {
        if (localStorage.getItem('ee_google_client_id')) {
          setDriveStatus('off');
        }
      });
    }
  }, [isLocked]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Podľa inštrukcií: Assume success immediately to avoid race condition
      setHasApiKey(true);
    }
  };

  const handleDriveConnect = async () => {
    setDriveStatus('loading');
    try {
      let clientId = localStorage.getItem('ee_google_client_id');
      if (!clientId) {
        clientId = prompt("Vložte Google Client ID (ak ho ešte nemáte v pamäti):");
        if (clientId) driveService.setClientId(clientId);
      }
      const success = await driveService.signIn();
      setDriveStatus(success ? 'on' : 'off');
    } catch (e) {
      console.error(e);
      setDriveStatus('off');
      alert("Pripojenie k Drive zlyhalo.");
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
      // Ak API nahlási chýbajúcu entitu, resetujeme stav kľúča
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
      }
      setMessages(prev => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: `❌ **CHYBA:** ${error.message}${!hasApiKey ? '\n\nKliknite na "NASTAVIŤ API KĽÚČ" v hornom menu.' : ''}`, 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    // Fix: Explicitly casting Array.from(files) to File[] to resolve 'unknown' type issues with reader and property access (Error on lines 150, 153)
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

      // Ak je Drive aktívny, synchronizujeme
      if (driveStatus === 'on') {
        try {
          await driveService.uploadFile(manual.name, manual.base64, manual.type, manual.baseId);
        } catch (err) {
          console.error("Cloud sync failed", err);
        }
      }

      setSyncingFiles(prev => { const n = new Set(prev); n.delete(tempId); return n; });
    }
  };

  const handleSaveProject = async () => {
    if (messages.length <= 1) return;
    const name = prompt("Názov riešenia:", currentProjectId ? savedProjects.find(p => p.id === currentProjectId)?.name : "");
    if (!name) return;
    const project: SavedProject = {
      id: currentProjectId || Date.now().toString(),
      name, baseId: activeBaseId, manuals: allManuals.filter(m => m.baseId === activeBaseId),
      messages, mode: currentMode, timestamp: Date.now()
    };
    await saveProjectToDB(project);
    setSavedProjects(await getAllProjectsFromDB());
    setCurrentProjectId(project.id);
    alert("Uložené lokálne.");
  };

  const handleLoadProject = (id: string) => {
    const project = savedProjects.find(p => p.id === id);
    if (project) {
      setActiveBaseId(project.baseId);
      setMessages(project.messages);
      setCurrentMode(project.mode);
      setCurrentProjectId(project.id);
    }
  };

  if (isLocked) return <LoginGate onUnlock={() => setIsLocked(false)} hasApiKey={hasApiKey} onSelectKey={handleSelectKey} />;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-2xl relative z-10">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic tracking-tighter leading-none">Electro<span className="text-blue-500">Expert</span></h1>
            <span className="text-[9px] font-bold text-slate-500 tracking-[0.2em] mt-1 uppercase">Build {APP_VERSION}</span>
          </div>
          <button 
            onClick={handleDriveConnect}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
              driveStatus === 'on' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-700 text-slate-400 border border-slate-600'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${driveStatus === 'on' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
            {driveStatus === 'on' ? 'GOOGLE DRIVE AKTÍVNY' : 'PRIPOJIŤ DISK'}
          </button>
        </div>

        <div className="flex items-center gap-4">
           {!hasApiKey && (
             <button 
               onClick={handleSelectKey}
               className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-black px-4 py-2 rounded-lg animate-pulse shadow-lg shadow-red-900/40 border border-red-400"
             >
               NASTAVIŤ API KĽÚČ
             </button>
           )}
           <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
             {['SCHEMATIC', 'LOGIC', 'SETTINGS'].map((mode) => (
               <button key={mode} onClick={() => setCurrentMode(mode as AnalysisMode)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${currentMode === mode ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}>
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
          onSaveProject={handleSaveProject}
          onNewProject={() => { setMessages([welcomeMessage]); setCurrentProjectId(null); }}
          savedProjects={savedProjects}
          onLoadProject={handleLoadProject}
          onDeleteProject={async (id, e) => { e.stopPropagation(); if(confirm("Zmazať riešenie?")){ await deleteProjectFromDB(id); setSavedProjects(prev => prev.filter(p => p.id !== id)); }}}
          currentProjectId={currentProjectId}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={() => { const n = prompt("Názov:"); if(n) setKnowledgeBases([...knowledgeBases, {id: n.toLowerCase(), name: n, icon: '📁'}]) }}
          syncingFiles={syncingFiles}
        />
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <ChatInterface messages={messages} onSendMessage={handleSendMessage} isAnalyzing={isAnalyzing} activeManualsCount={allManuals.filter(m => m.baseId === activeBaseId).length} />
          <ManualViewer manuals={allManuals.filter(m => m.baseId === activeBaseId)} />
        </div>
      </main>
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
    </div>
  );
};

export default App;
