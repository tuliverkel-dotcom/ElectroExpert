
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ManualFile, Message, AnalysisMode, SavedProject, KnowledgeBase } from './types';
import { analyzeManual } from './services/gemini';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ManualViewer from './components/ManualViewer';

const DEFAULT_BASES: KnowledgeBase[] = [
  { id: 'general', name: 'Všeobecné', icon: '🌍' },
  { id: 'intec', name: 'INTEC', icon: '🏢' },
  { id: 'vega', name: 'VEGA', icon: '📡' },
];

const App: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(DEFAULT_BASES);
  const [activeBaseId, setActiveBaseId] = useState<string>('general');
  const [allManuals, setAllManuals] = useState<ManualFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Vitajte v ElectroExpert AI. Ak potrebujete zmeniť zapojenie, navrhnem vám nový draft schémy, ktorý môžete použiť ako predlohu pre prekreslenie v EPLAN.',
      timestamp: Date.now(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedProjects = localStorage.getItem('electro_expert_projects');
    const storedBases = localStorage.getItem('electro_expert_bases');
    const storedManuals = localStorage.getItem('electro_expert_manuals');
    if (storedProjects) setSavedProjects(JSON.parse(storedProjects));
    if (storedBases) setKnowledgeBases(JSON.parse(storedBases));
    if (storedManuals) setAllManuals(JSON.parse(storedManuals));
  }, []);

  useEffect(() => {
    localStorage.setItem('electro_expert_projects', JSON.stringify(savedProjects));
    localStorage.setItem('electro_expert_bases', JSON.stringify(knowledgeBases));
    localStorage.setItem('electro_expert_manuals', JSON.stringify(allManuals));
  }, [savedProjects, knowledgeBases, allManuals]);

  const activeBase = knowledgeBases.find(b => b.id === activeBaseId);
  const visibleManuals = allManuals.filter(m => m.baseId === 'general' || m.baseId === activeBaseId);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const newManual: ManualFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          base64: base64.split(',')[1],
          baseId: activeBaseId,
        };
        setAllManuals((prev) => [...prev, newManual]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() && visibleManuals.length === 0) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsAnalyzing(true);

    try {
      const response = await analyzeManual(text, visibleManuals, currentMode, updatedMessages, activeBase);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || "Chyba spracovania.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { id: 'err', role: 'assistant', content: 'Chyba pripojenia k AI.', timestamp: Date.now() }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveCurrentProject = () => {
    const defaultName = `Riešenie ${activeBase?.name} - ${new Date().toLocaleDateString()}`;
    const name = prompt(`Uložiť riešenie pod názvom:`, defaultName);
    if (!name) return;

    const newProject: SavedProject = {
      id: currentProjectId || Math.random().toString(36).substr(2, 9),
      name,
      baseId: activeBaseId,
      manuals: visibleManuals,
      messages,
      mode: currentMode,
      timestamp: Date.now()
    };

    setSavedProjects(prev => [newProject, ...prev.filter(p => p.id !== newProject.id)]);
    setCurrentProjectId(newProject.id);
  };

  const loadProject = (id: string) => {
    const project = savedProjects.find(p => p.id === id);
    if (project) {
      setMessages(project.messages);
      setCurrentMode(project.mode);
      setCurrentProjectId(project.id);
      setActiveBaseId(project.baseId);
    }
  };

  const addKnowledgeBase = () => {
    const name = prompt("Zadajte názov nového výrobcu:");
    if (name) {
      const newBase: KnowledgeBase = { id: name.toLowerCase().replace(/\s/g, '-'), name, icon: '📂' };
      setKnowledgeBases(prev => [...prev, newBase]);
      setActiveBaseId(newBase.id);
      setCurrentProjectId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-100 font-sans">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shrink-0 z-20 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter text-white">
              ELECTRO<span className="text-blue-500">EXPERT</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Zložka:</span>
              <span className={`text-[9px] font-black uppercase ${activeBaseId === 'general' ? 'text-green-400' : 'text-blue-400'}`}>
                {activeBase?.name}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
           {Object.values(AnalysisMode).map((mode) => (
             <button
               key={mode}
               onClick={() => setCurrentMode(mode)}
               className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                 currentMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
               }`}
             >
               {mode}
             </button>
           ))}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <Sidebar 
          manuals={visibleManuals} 
          onUploadClick={() => fileInputRef.current?.click()} 
          onRemove={(id) => setAllManuals(prev => prev.filter(m => m.id !== id))}
          onSaveProject={saveCurrentProject}
          savedProjects={savedProjects.filter(p => p.baseId === activeBaseId)}
          onLoadProject={loadProject}
          onDeleteProject={(id, e) => {
             e.stopPropagation();
             setSavedProjects(prev => prev.filter(p => p.id !== id));
          }}
          currentProjectId={currentProjectId}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={addKnowledgeBase}
        />
        
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <ChatInterface 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isAnalyzing={isAnalyzing}
            activeManualsCount={visibleManuals.length}
          />
          <ManualViewer manuals={visibleManuals} />
        </div>
      </main>

      <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
    </div>
  );
};

export default App;
