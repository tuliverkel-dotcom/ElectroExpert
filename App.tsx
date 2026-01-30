
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
import SettingsModal from './components/SettingsModal';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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
    content: 'Systém ElectroExpert Advanced (PRO Core) aktivovaný.\n\nPre zdieľanie riešenia technikovi použite nové tlačidlá (WhatsApp/Email) pod touto správou. Pre vytvorenie manuálu prepnite režim na DOKUMENTÁCIA.',
    timestamp: Date.now(),
  };

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEnvKeyPresent = !!(process.env.API_KEY && process.env.API_KEY !== 'undefined');
  const isKeyActive = isEnvKeyPresent || !!runtimeApiKey;

  // <--- TU JE ZMENA: Pridaný režim DOKUMENTÁCIA
  const modes = [
    { id: AnalysisMode.SCHEMATIC, label: 'SCHÉMY' },
    { id: AnalysisMode.LOGIC, label: 'LOGIKA' },
    { id: AnalysisMode.DOCUMENTATION, label: 'DOKUMENTÁCIA' },
    { id: AnalysisMode.SETTINGS, label: 'KONFIGURÁCIA' }
  ];

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
        } else if (!isEnvKeyPresent && !runtimeApiKey) {
          setIsSettingsOpen(true);
        }
      };
      syncKeyFromDrive();
    }
  }, [driveStatus]);

  const handleDriveConnect = async () => {
    let clientId = localStorage.getItem('ee_google_client_id');
    if (!clientId) {
      setIsSettingsOpen(true);
      return;
    }

    setDriveStatus('loading');
    try {
      const success = await driveService.signIn();
      setDriveStatus(success ? 'on' : 'off');
      if (!success) {
        alert("Prihlásenie zlyhalo. Skontrolujte, či váš prehliadač (najmä v mobile) neblokuje vyskakovacie okná.");
      }
    } catch (e) {
      setDriveStatus('off');
    }
  };

  const handleSaveProject = async () => {
    const existingProject = currentProjectId ? savedProjects.find(p => p.id === currentProjectId) : null;
    const defaultName = existingProject ? existingProject.name : `Riešenie ${new Date().toLocaleTimeString()}`;
    
    const projectName = prompt("Zadajte názov pre uloženie aktuálneho riešenia:", defaultName);
    if (!projectName) return;

    const newProject: SavedProject = {
      id: currentProjectId || Date.now().toString(),
      name: projectName,
      baseId: activeBaseId,
      manuals: allManuals.filter(m => m.baseId === activeBaseId),
      messages: messages,
      mode: currentMode,
      timestamp: Date.now()
    };

    try {
      await saveProjectToDB(newProject);
      setCurrentProjectId(newProject.id);
      const allProjects = await getAllProjectsFromDB();
      setSavedProjects(allProjects);
      alert("✅ Riešenie bolo úspešne uložené.");
    } catch (err) {
      console.error(err);
      alert("❌ Chyba pri ukladaní projektu.");
    }
  };

  const handleNewProject = () => {
    if (messages.length > 1 && !confirm("Naozaj chcete začať novú tému? Aktuálna história bude vymazaná (ak nie je uložená).")) {
      return;
    }
    setMessages([welcomeMessage]);
    setCurrentProjectId(null);
  };

  const handleDeleteBase = (id: string) => {
    if (id === 'general') return;
    if (confirm(`Naozaj chcete zmazať priečinok "${id}" a všetky manuály v ňom?`)) {
      const manualsToDelete = allManuals.filter(m => m.baseId === id);
      manualsToDelete.forEach(m => deleteManualFromDB(m.id));
      setAllManuals(prev => prev.filter(m => m.baseId !== id));
      
      const updatedBases = knowledgeBases.filter(b => b.id !== id);
      setKnowledgeBases(updatedBases);
      localStorage.setItem('ee_knowledge_bases', JSON.stringify(updatedBases));
      
      if (activeBaseId === id) setActiveBaseId('general');
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
              {driveStatus === 'on' ? 'CLOUD AKTÍVNY' : (driveStatus === 'loading' ? 'PRIPÁJANIE...' : 'OFFLINE MOD')}
            </button>

            <div className={`text-[9px] font-bold px-2 py-1 rounded border flex items-center gap-2 ${isKeyActive ? 'text-blue-400 border-blue-500/20 bg-blue-500/5' : 'text-red-400 border-red-500/20 bg-red-500/5'}`}>
              <div className={`w-1 h-1 rounded-full ${isKeyActive ? 'bg-blue-500' : 'bg-red-500'}`}></div>
              AI ENGINE: {runtimeApiKey ? 'PRO (CLOUD KEY)' : (isEnvKeyPresent ? 'PRO (ENV)' : 'NEAKTÍVNA')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {/* <--- TU JE ZMENA: Vylepšený zoznam režimov vrátane Dokumentácie */}
           <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-700 mr-2">
             <span className="text-[8px] font-black text-slate-500 uppercase px-2">Režim AI:</span>
             {modes.map((m) => (
               <button 
                 key={m.id} 
                 onClick={() => setCurrentMode(m.id)} 
                 className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${currentMode === m.id ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-slate-300'}`}
               >
                 {m.label}
               </button>
             ))}
           </div>
           
           <div className="w-px h-8 bg-slate-700"></div>

           <button 
             onClick={() => setIsSettingsOpen(true)}
             title="Nastavenia účtu a pripojenia"
             className="p-2.5 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-xl border border-slate-700 shadow-xl hover:shadow-blue-900/20 hover:border-slate-500"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          manuals={allManuals.filter(m => m.baseId === activeBaseId)} 
          onUploadClick={() => fileInputRef.current?.click()} 
          onRemove={(id) => { deleteManualFromDB(id); setAllManuals(prev => prev.filter(m => m.id !== id)); }}
          onSaveProject={handleSaveProject} 
          onNewProject={handleNewProject}
          savedProjects={savedProjects} 
          onLoadProject={(id) => {
            const p = savedProjects.find(x => x.id === id);
            if (p) { 
              setMessages(p.messages); 
              setCurrentProjectId(p.id); 
              setActiveBaseId(p.baseId); 
              if (p.mode) setCurrentMode(p.mode);
            }
          }}
          onDeleteProject={async (id, e) => { 
            e.stopPropagation(); 
            if(confirm("Zmazať toto uložené riešenie?")){ 
              await deleteProjectFromDB(id); 
              setSavedProjects(prev => prev.filter(p => p.id !== id));
              if (currentProjectId === id) setCurrentProjectId(null);
            } 
          }}
          currentProjectId={currentProjectId}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={() => { const n = prompt("Názov priečinka:"); if(n) { const id = n.toLowerCase().replace(/\s/g, ''); const newBases = [...knowledgeBases, {id, name: n, icon: '📁'}]; setKnowledgeBases(newBases); localStorage.setItem('ee_knowledge_bases', JSON.stringify(newBases)); }}}
          onDeleteBase={handleDeleteBase}
          syncingFiles={syncingFiles}
        />
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
          <ChatInterface messages={messages} onSendMessage={handleSendMessage} isAnalyzing={isAnalyzing} activeManualsCount={allManuals.filter(m => m.baseId === activeBaseId).length} />
          <ManualViewer manuals={allManuals.filter(m => m.baseId === activeBaseId)} />
        </div>
      </main>
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        clientId={localStorage.getItem('ee_google_client_id') || ''} 
        onSaveClientId={(id) => { driveService.setClientId(id); }} 
        apiKey={runtimeApiKey}
        onSaveApiKey={(key) => { 
          setRuntimeApiKey(key);
          if (driveStatus === 'on') {
            driveService.saveConfig('.ai_settings.json', JSON.stringify({ apiKey: key }));
          }
        }}
      />
    </div>
  );
};

export default App;
