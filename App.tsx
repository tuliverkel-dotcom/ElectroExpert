
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
  const [runtimeApiKey, setRuntimeApiKey] = useState<string | null>(null);
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
    content: 'Systém ElectroExpert Advanced (PRO Core) aktivovaný. Pripravený na hlbokú technickú analýzu schém a logiky s využitím Chain-of-Thought uvažovania.',
    timestamp: Date.now(),
  };

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEnvKeyPresent = !!(process.env.API_KEY && process.env.API_KEY !== 'undefined');
  const isKeyActive = isEnvKeyPresent || !!runtimeApiKey;

  useEffect(() => {
    if (!isLocked) {
      const loadInitialData = async () => {
        try {
          const manuals = await getAllManualsFromDB();
          setAllManuals(manuals);
          const projects = await getAllProjectsFromDB();
          setSavedProjects(projects);
          await driveService.init();
        } catch (e) {
          console.error("Init fail", e);
        }
      };
      loadInitialData();
    }
  }, [isLocked]);

  useEffect(() => {
    if (driveStatus === 'on') {
      const syncKeyFromDrive = async () => {
        const fileId = await driveService.findFile('.ai_settings.json');
        if (fileId) {
          try {
            const content = await driveService.getFileContent(fileId);
            const settings = JSON.parse(content);
            if (settings.apiKey) {
              setRuntimeApiKey(settings.apiKey);
            }
          } catch (e) {
            console.error("Cloud config parse fail", e);
          }
        } else if (!isEnvKeyPresent) {
          const key = prompt("Vložte váš Gemini API kľúč (PRO model vyžaduje kľúč s povoleným billingom):");
          if (key) {
            setRuntimeApiKey(key);
            await driveService.saveConfig('.ai_settings.json', JSON.stringify({ apiKey: key }));
          }
        }
      };
      syncKeyFromDrive();
    }
  }, [driveStatus]);

  const handleDriveConnect = async () => {
    setDriveStatus('loading');
    try {
      let clientId = localStorage.getItem('ee_google_client_id');
      if (!clientId) {
        clientId = prompt("Vložte Google Client ID:");
        if (clientId) driveService.setClientId(clientId);
      }
      if (clientId) {
        const success = await driveService.signIn();
        setDriveStatus(success ? 'on' : 'off');
      } else {
        setDriveStatus('off');
      }
    } catch (e) {
      setDriveStatus('off');
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsAnalyzing(true);

    try {
      const visibleManuals = allManuals.filter(m => m.baseId === activeBaseId);
      const { text: responseText, sources } = await analyzeManual(text, visibleManuals, currentMode, updatedMessages, runtimeApiKey);
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: responseText, 
        timestamp: Date.now(),
        sources 
      }]);
    } catch (error: any) {
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
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        const manual: ManualFile = { id: tempId, name: file.name, type: file.type, base64, baseId: activeBaseId };
        await saveManualToDB(manual);
        setAllManuals(prev => [...prev, manual]);
        if (driveStatus === 'on') {
          await driveService.uploadFile(manual.name, manual.base64, manual.type, manual.baseId);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSyncingFiles(prev => { const n = new Set(prev); n.delete(tempId); return n; });
      }
    }
  };

  if (isLocked) return <LoginGate onUnlock={() => setIsLocked(false)} />;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30 overflow-hidden">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-2xl relative z-40">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic tracking-tighter leading-none flex items-center gap-2">
              Electro<span className="text-blue-500">Expert</span>
              <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full not-italic tracking-normal">ADVANCED</span>
            </h1>
            <span className="text-[9px] font-bold text-slate-500 tracking-[0.2em] mt-1 uppercase">Build {APP_VERSION} | PRO Core</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleDriveConnect}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                driveStatus === 'on' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-700 text-slate-400 border-slate-600'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${driveStatus === 'on' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
              {driveStatus === 'on' ? 'CLOUD AKTÍVNY' : 'OFFLINE MOD'}
            </button>

            <div className={`text-[9px] font-bold px-2 py-1 rounded border flex items-center gap-2 ${isKeyActive ? 'text-blue-400 border-blue-500/20 bg-blue-500/5' : 'text-red-400 border-red-500/20 bg-red-500/5'}`}>
              <div className={`w-1 h-1 rounded-full ${isKeyActive ? 'bg-blue-500' : 'bg-red-500'}`}></div>
              AI ENGINE: {runtimeApiKey ? 'PRO (CLOUD KEY)' : (isEnvKeyPresent ? 'PRO (ENV)' : 'NEAKTÍVNA')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
             {['SCHEMATIC', 'LOGIC', 'SETTINGS'].map((mode) => (
               <button 
                 key={mode} 
                 onClick={() => setCurrentMode(mode as AnalysisMode)} 
                 className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${currentMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
               >
                 {mode}
               </button>
             ))}
           </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          manuals={allManuals.filter(m => m.baseId === activeBaseId)} 
          onUploadClick={() => fileInputRef.current?.click()} 
          onRemove={(id) => { deleteManualFromDB(id); setAllManuals(prev => prev.filter(m => m.id !== id)); }}
          onSaveProject={() => {}} 
          onNewProject={() => setMessages([welcomeMessage])}
          savedProjects={savedProjects} 
          onLoadProject={(id) => {
            const p = savedProjects.find(x => x.id === id);
            if (p) { setMessages(p.messages); setCurrentProjectId(p.id); setActiveBaseId(p.baseId); }
          }}
          onDeleteProject={async (id, e) => { e.stopPropagation(); if(confirm("Zmazať riešenie?")){ await deleteProjectFromDB(id); setSavedProjects(prev => prev.filter(p => p.id !== id)); }}}
          currentProjectId={currentProjectId}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={() => { const n = prompt("Názov priečinka:"); if(n) setKnowledgeBases([...knowledgeBases, {id: n.toLowerCase().replace(/\s/g, ''), name: n, icon: '📁'}]) }}
          syncingFiles={syncingFiles}
        />
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
          <ChatInterface messages={messages} onSendMessage={handleSendMessage} isAnalyzing={isAnalyzing} activeManualsCount={allManuals.filter(m => m.baseId === activeBaseId).length} />
          <ManualViewer manuals={allManuals.filter(m => m.baseId === activeBaseId)} />
        </div>
      </main>
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
    </div>
  );
};

export default App;
