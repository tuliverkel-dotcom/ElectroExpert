
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ManualFile, Message, AnalysisMode, SavedProject, KnowledgeBase } from './types';
import { analyzeManual } from './services/gemini';
import { getAllManualsFromDB, saveManualToDB, deleteManualFromDB } from './services/db';
import { driveService } from './services/googleDrive';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ManualViewer from './components/ManualViewer';
import LoginGate from './components/LoginGate';

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
      content: 'Vitajte v ElectroExpert AI. Vaše dáta sú chránené a synchronizované.',
      timestamp: Date.now(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLocked) {
      const loadData = async () => {
        const storedBases = localStorage.getItem('electro_expert_bases');
        if (storedBases) setKnowledgeBases(JSON.parse(storedBases));
        
        const storedProjects = localStorage.getItem('electro_expert_projects');
        if (storedProjects) setSavedProjects(JSON.parse(storedProjects));

        const manuals = await getAllManualsFromDB();
        setAllManuals(manuals);
        
        await driveService.init();
      };
      loadData();
    }
  }, [isLocked]);

  const handleGoogleDriveSync = async () => {
    try {
      const success = await driveService.signIn();
      if (success) {
        setIsCloudSynced(true);
        // Po prihlásení načítame zoznam projektov z cloudu
        const cloudProjects = await driveService.listCloudProjects();
        if (cloudProjects.length > 0) {
          setMessages(prev => [...prev, {
            id: 'sync-' + Date.now(),
            role: 'assistant',
            content: `📂 V cloude som našiel ${cloudProjects.length} existujúcich projektov. Sú pripravené na prácu v Sidebare.`,
            timestamp: Date.now()
          }]);
        }
      }
    } catch (e) {
      alert("Chyba synchronizácie.");
    }
  };

  const handleSignOut = async () => {
    await driveService.signOut();
    setIsCloudSynced(false);
    setIsLocked(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Full = e.target?.result as string;
        const newManual: ManualFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          base64: base64Full.split(',')[1],
          baseId: activeBaseId,
        };
        await saveManualToDB(newManual);
        setAllManuals((prev) => [...prev, newManual]);
        if (isCloudSynced) {
          await driveService.uploadFile(file.name, base64Full, file.type, activeBaseId);
        }
      };
      reader.readAsDataURL(file);
    });
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
      setMessages((prev) => [...prev, { id: 'err', role: 'assistant', content: "Chyba AI.", timestamp: Date.now() }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLocked) return <LoginGate onUnlock={() => setIsLocked(false)} />;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-100 font-sans">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white uppercase italic leading-none">Electro<span className="text-blue-500">Expert</span></h1>
            <span className={`text-[8px] mt-1 font-bold uppercase ${isCloudSynced ? 'text-green-400' : 'text-slate-500'}`}>
              {isCloudSynced ? '● Cloud Synced' : '○ Local Only'}
            </span>
          </div>
          {!isCloudSynced ? (
            <button onClick={handleGoogleDriveSync} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-lg shadow-blue-600/20">
              PRIPOJIŤ CLOUD
            </button>
          ) : (
            <button onClick={handleSignOut} className="bg-slate-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all">
              UZAMKNÚŤ
            </button>
          )}
        </div>
        
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
           {Object.values(AnalysisMode).map((mode) => (
             <button
               key={mode}
               onClick={() => setCurrentMode(mode)}
               className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${currentMode === mode ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
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
          onDeleteProject={(id) => setSavedProjects(prev => prev.filter(p => p.id !== id))}
          currentProjectId={currentProjectId}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={() => { const n = prompt("Názov:"); if(n) setKnowledgeBases(prev => [...prev, {id: n.toLowerCase(), name: n, icon: '📂'}]); }}
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
