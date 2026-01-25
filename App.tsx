
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
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Removed readonly to ensure compatibility with other declarations and fix the "identical modifiers" error
    aistudio: AIStudio;
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
    content: 'Systém je pripravený. Ak uvidíte chybu API, použite tlačidlo nastavenia kľúča vpravo hore.',
    timestamp: Date.now(),
  };

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kontrola kľúča pri štarte a po každom odomknutí
  const refreshKeyStatus = async () => {
    if (window.aistudio) {
      const active = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(active);
    }
  };

  useEffect(() => {
    refreshKeyStatus();
  }, [isLocked]);

  useEffect(() => {
    if (!isLocked) {
      getAllManualsFromDB().then(setAllManuals);
      getAllProjectsFromDB().then(setSavedProjects);
    }
  }, [isLocked]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      // Malý delay pre vstreknutie kľúča do process.env
      setTimeout(() => refreshKeyStatus(), 500);
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
      // Prompt user to select a key again if API reports it missing or invalid
      if (error.message?.includes("Requested entity was not found") || error.message?.includes("API_KEY")) {
        setHasApiKey(false);
      }
      setMessages(prev => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: `❌ **CHYBA:** ${error.message}`, 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsAnalyzing(false);
    }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    // Explicitly casting to File[] to avoid 'unknown' type errors during loop iteration
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
  };

  if (isLocked) return <LoginGate onUnlock={() => setIsLocked(false)} hasApiKey={hasApiKey} onSelectKey={handleSelectKey} />;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-2xl relative z-10">
        <div className="flex flex-col">
          <h1 className="text-xl font-black italic tracking-tighter leading-none">Electro<span className="text-blue-500">Expert</span></h1>
          <span className="text-[9px] font-bold text-slate-500 tracking-[0.2em] mt-1">BUILD <span className="text-blue-400 bg-blue-400/10 px-1 rounded">{APP_VERSION}</span></span>
        </div>

        <div className="flex items-center gap-4">
           <button 
             onClick={handleSelectKey}
             className={`text-[10px] font-black px-4 py-2 rounded-lg transition-all border ${hasApiKey ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-red-600 text-white border-red-400 animate-pulse shadow-lg shadow-red-900/40'}`}
           >
             {hasApiKey ? 'API KĽÚČ AKTÍVNY' : 'NASTAVIŤ API KĽÚČ'}
           </button>
           <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
             {['SCHEMATIC', 'LOGIC', 'SETTINGS'].map((mode) => (
               <button key={mode} onClick={() => setCurrentMode(mode as AnalysisMode)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${currentMode === mode ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
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
          onDeleteProject={async (id, e) => { e.stopPropagation(); await deleteProjectFromDB(id); setSavedProjects(prev => prev.filter(p => p.id !== id)); }}
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
