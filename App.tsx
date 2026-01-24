
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ManualFile, Message, AnalysisMode, SavedProject } from './types';
import { analyzeManual } from './services/gemini';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ManualViewer from './components/ManualViewer';

const App: React.FC = () => {
  const [manuals, setManuals] = useState<ManualFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Dobrý deň! Nahrajte technické manuály k vašim elektro zariadeniam. Pomôžem vám so schémami zapojenia, logikou riadenia aj parametrizáciou.',
      timestamp: Date.now(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load projects from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('electro_expert_projects');
    if (stored) {
      try {
        setSavedProjects(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved projects", e);
      }
    }
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('electro_expert_projects', JSON.stringify(savedProjects));
  }, [savedProjects]);

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
        };
        setManuals((prev) => [...prev, newManual]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() && manuals.length === 0) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAnalyzing(true);

    try {
      const response = await analyzeManual(text, manuals, currentMode);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || "Ospravedlňujem sa, ale nepodarilo sa mi spracovať požiadavku.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: 'error',
          role: 'assistant',
          content: 'Vyskytla sa chyba pri komunikácii s AI. Skúste to prosím neskôr.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveCurrentProject = () => {
    const name = prompt("Zadajte názov riešenia:", currentProjectId 
      ? savedProjects.find(p => p.id === currentProjectId)?.name 
      : `Riešenie ${new Date().toLocaleDateString()}`
    );
    
    if (!name) return;

    const newProject: SavedProject = {
      id: currentProjectId || Math.random().toString(36).substr(2, 9),
      name,
      manuals,
      messages,
      mode: currentMode,
      timestamp: Date.now()
    };

    setSavedProjects(prev => {
      const filtered = prev.filter(p => p.id !== newProject.id);
      return [newProject, ...filtered];
    });
    setCurrentProjectId(newProject.id);
  };

  const loadProject = (id: string) => {
    const project = savedProjects.find(p => p.id === id);
    if (project) {
      setManuals(project.manuals);
      setMessages(project.messages);
      setCurrentMode(project.mode);
      setCurrentProjectId(project.id);
    }
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedProjects(prev => prev.filter(p => p.id !== id));
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      // Reset to default
      setManuals([]);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Dobrý deň! Projekt bol vymazaný. Môžete začať nové riešenie.',
        timestamp: Date.now(),
      }]);
    }
  };

  const startNewProject = () => {
    if (confirm("Chcete začať nové riešenie? Neuložené zmeny v aktuálnom sa stratia.")) {
      setManuals([]);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Dobrý deň! Nahrajte technické manuály k vašim elektro zariadeniam.',
        timestamp: Date.now(),
      }]);
      setCurrentProjectId(null);
    }
  };

  const removeManual = (id: string) => {
    setManuals((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg cursor-pointer" onClick={startNewProject} title="Nový projekt">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">ElectroExpert <span className="text-blue-400">AI</span></h1>
            {currentProjectId && (
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Aktívny projekt: {savedProjects.find(p => p.id === currentProjectId)?.name}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
           {Object.values(AnalysisMode).map((mode) => (
             <button
               key={mode}
               onClick={() => setCurrentMode(mode)}
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                 currentMode === mode 
                 ? 'bg-blue-600 text-white' 
                 : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
               }`}
             >
               {mode === AnalysisMode.SCHEMATIC ? 'Schémy' : mode === AnalysisMode.LOGIC ? 'Logika' : 'Nastavenia'}
             </button>
           ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        <Sidebar 
          manuals={manuals} 
          onUploadClick={() => fileInputRef.current?.click()} 
          onRemove={removeManual}
          onSaveProject={saveCurrentProject}
          savedProjects={savedProjects}
          onLoadProject={loadProject}
          onDeleteProject={deleteProject}
          currentProjectId={currentProjectId}
        />
        
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <ChatInterface 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isAnalyzing={isAnalyzing}
            activeManualsCount={manuals.length}
          />
          <ManualViewer manuals={manuals} />
        </div>
      </main>

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        accept="image/*,application/pdf" 
        onChange={handleFileUpload}
      />
    </div>
  );
};

export default App;
