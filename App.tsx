
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ManualFile, Message, AnalysisMode, SavedProject, KnowledgeBase } from './types';
import { analyzeManual } from './services/gemini';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ManualViewer from './components/ManualViewer';
import { MAX_FILE_SIZE_MB } from './constants';

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
      content: 'Vitajte v ElectroExpert AI. Ak aplikácia mrzla, bolo to kvôli limitom prehliadača pri ukladaní veľkých PDF. Teraz sú dáta v bezpečí v pamäti. Ak potrebujete zmeniť zapojenie, navrhnem vám nový draft schémy.',
      timestamp: Date.now(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Načítame len metadáta, nie ťažké base64 reťazce
  useEffect(() => {
    const storedBases = localStorage.getItem('electro_expert_bases');
    if (storedBases) setKnowledgeBases(JSON.parse(storedBases));
  }, []);

  useEffect(() => {
    localStorage.setItem('electro_expert_bases', JSON.stringify(knowledgeBases));
  }, [knowledgeBases]);

  const activeBase = knowledgeBases.find(b => b.id === activeBaseId);
  // Filtrujeme manuály podľa aktuálnej zložky
  const visibleManuals = allManuals.filter(m => m.baseId === 'general' || m.baseId === activeBaseId);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`Súbor ${file.name} je príliš veľký. Maximálna veľkosť je ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        const newManual: ManualFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          base64: base64Data.split(',')[1],
          baseId: activeBaseId,
        };
        setAllManuals((prev) => [...prev, newManual]);
      };
      reader.readAsDataURL(file);
    });
    // Reset inputu aby sa dal nahrať ten istý súbor znova
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        content: response || "AI nevrátilo žiadnu odpoveď.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      let errorMsg = 'Chyba prepojenia k AI.';
      if (error.message?.includes('413')) errorMsg = 'Súbory sú príliš veľké pre AI analýzu. Skúste nahrať len dôležité strany.';
      if (error.message?.includes('429')) errorMsg = 'Príliš veľa požiadaviek. Chvíľu počkajte.';
      
      setMessages((prev) => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: `⚠️ ${errorMsg} (${error.message || 'Unknown error'})`, 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveCurrentProject = () => {
    const defaultName = `Riešenie ${activeBase?.name} - ${new Date().toLocaleDateString()}`;
    const name = prompt(`Uložiť riešenie pod názvom (uloží sa len história správ):`, defaultName);
    if (!name) return;

    const newProject: SavedProject = {
      id: currentProjectId || Math.random().toString(36).substr(2, 9),
      name,
      baseId: activeBaseId,
      manuals: [], // Súbory neukladáme do history kvôli výkonu
      messages,
      mode: currentMode,
      timestamp: Date.now()
    };

    setSavedProjects(prev => [newProject, ...prev.filter(p => p.id !== newProject.id)]);
    setCurrentProjectId(newProject.id);
    alert("Projekt bol uložený (história správ).");
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
            <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">
              Electro<span className="text-blue-500">Expert</span>
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
