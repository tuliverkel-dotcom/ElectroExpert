
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
  const [driveStatus, setDriveStatus] = useState<'off' | 'on' | 'loading'>('off');
  const [syncingFiles, setSyncingFiles] = useState<Set<string>>(new Set());
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(() => {
    const saved = localStorage.getItem('ee_knowledge_bases');
    return saved ? JSON.parse(saved) : [
      { id: 'general', name: 'Základné', icon: '⚡' },
      { id: 'intec', name: 'Intec', icon: '🏭' },
      { id: 'vega', name: 'Vega', icon: '🛰️' }
    ];
  });
  
  const [activeBaseId, setActiveBaseId] = useState<string>('general');
  const [allManuals, setAllManuals] = useState<ManualFile[]>([]);
  
  const welcomeMessage: Message = {
    id: 'welcome',
    role: 'assistant',
    content: 'ElectroExpert pripravený. Analýza prebieha cez model Gemini 3 Pro. Súbory sú synchronizované lokálne aj do Cloudu.',
    timestamp: Date.now(),
  };

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('ee_knowledge_bases', JSON.stringify(knowledgeBases));
  }, [knowledgeBases]);

  useEffect(() => {
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

  const handleNewProject = () => {
    if (messages.length > 1 && !currentProjectId) {
      if (!confirm("Aktuálna konverzácia nie je uložená. Chcete začať nový problém a stratiť zmeny?")) {
        return;
      }
    }
    setMessages([{ ...welcomeMessage, timestamp: Date.now() }]);
    setCurrentProjectId(null);
  };

  const handleAddBase = () => {
    const name = prompt("Názov nového priečinka:");
    if (name) {
      const newBase: KnowledgeBase = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        icon: '📁'
      };
      setKnowledgeBases([...knowledgeBases, newBase]);
      setActiveBaseId(newBase.id);
    }
  };

  const handleDeleteBase = (id: string) => {
    if (id === 'general') return;
    if (confirm(`Zmazať priečinok "${knowledgeBases.find(b => b.id === id)?.name}"?`)) {
      setKnowledgeBases(knowledgeBases.filter(b => b.id !== id));
      setActiveBaseId('general');
    }
  };

  const handleDriveConnect = async () => {
    setDriveStatus('loading');
    try {
      let clientId = localStorage.getItem('ee_google_client_id');
      if (!clientId) {
        clientId = prompt("Vložte Google Client ID (z Google Console):");
        if (clientId) driveService.setClientId(clientId);
      }
      const success = await driveService.signIn();
      setDriveStatus(success ? 'on' : 'off');
    } catch (e) {
      setDriveStatus('off');
      alert("Pripojenie k Google Drive zlyhalo.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const filesToUpload = Array.from(files) as File[];
    for (const file of filesToUpload) {
      const tempId = Math.random().toString(36).substr(2, 9);
      setSyncingFiles(prev => new Set(prev).add(tempId));

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const manual: ManualFile = {
        id: tempId,
        name: file.name,
        type: file.type,
        base64,
        baseId: activeBaseId,
      };

      await saveManualToDB(manual);
      setAllManuals(prev => [...prev, manual]);

      if (driveStatus === 'on') {
        await driveService.uploadFile(manual.name, manual.base64, manual.type, manual.baseId);
      }
      
      setSyncingFiles(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
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
      setMessages((prev) => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: responseText, 
        timestamp: Date.now(),
        sources: sources 
      }]);
    } catch (error: any) {
      setMessages((prev) => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: `❌ **Chyba:** ${error.message}`, 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveProject = async () => {
    if (messages.length <= 1) {
      alert("Niet čo ukladať. Napíšte správu pre vytvorenie histórie.");
      return;
    }
    const name = prompt("Názov riešenia / projektu:", currentProjectId ? savedProjects.find(p => p.id === currentProjectId)?.name : "");
    if (!name) return;

    const project: SavedProject = {
      id: currentProjectId || Date.now().toString(),
      name,
      baseId: activeBaseId,
      manuals: allManuals.filter(m => m.baseId === activeBaseId),
      messages: messages,
      mode: currentMode,
      timestamp: Date.now()
    };

    await saveProjectToDB(project);
    const updatedProjects = await getAllProjectsFromDB();
    setSavedProjects(updatedProjects);
    setCurrentProjectId(project.id);
    alert("Riešenie bolo úspešne uložené.");
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

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Naozaj chcete zmazať toto uložené riešenie?")) {
      await deleteProjectFromDB(id);
      setSavedProjects(prev => prev.filter(p => p.id !== id));
      if (currentProjectId === id) setCurrentProjectId(null);
    }
  };

  if (isLocked) return <LoginGate onUnlock={() => setIsLocked(false)} />;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-2xl relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic tracking-tighter leading-none">
              Electro<span className="text-blue-500">Expert</span>
            </h1>
            <span className="text-[9px] font-bold text-slate-500 tracking-[0.2em] mt-1 flex items-center gap-1.5 uppercase">
              Build <span className="text-blue-400 bg-blue-400/10 px-1 rounded">{APP_VERSION}</span>
            </span>
          </div>
          <button 
            onClick={handleDriveConnect}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
              driveStatus === 'on' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-700 text-slate-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${driveStatus === 'on' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
            {driveStatus === 'on' ? 'CLOUD AKTÍVNY' : 'PRIPOJIŤ CLOUD'}
          </button>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
             {['SCHEMATIC', 'LOGIC', 'SETTINGS'].map((mode) => (
               <button
                 key={mode}
                 onClick={() => setCurrentMode(mode as AnalysisMode)}
                 className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${currentMode === mode ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
               >
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
          onNewProject={handleNewProject}
          savedProjects={savedProjects}
          onLoadProject={handleLoadProject}
          onDeleteProject={handleDeleteProject}
          currentProjectId={currentProjectId}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={handleAddBase}
          onDeleteBase={handleDeleteBase}
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
