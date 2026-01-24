
import React, { useState, useRef, useEffect } from 'react';
import { ManualFile, Message, AnalysisMode, SavedProject, KnowledgeBase } from './types';
import { analyzeManual } from './services/gemini';
import { getAllManualsFromDB, saveManualToDB, deleteManualFromDB } from './services/db';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ManualViewer from './components/ManualViewer';
import LoginGate from './components/LoginGate';
import { MAX_FILE_SIZE_MB } from './constants';

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [apiKey, setApiKey] = useState(localStorage.getItem('ee_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);
  
  const [activeBaseId, setActiveBaseId] = useState<string>('general');
  const [allManuals, setAllManuals] = useState<ManualFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Vitajte. Nahrajte manuály elektro zariadení a opýtajte sa ma na čokoľvek.',
      timestamp: Date.now(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLocked) {
      getAllManualsFromDB().then(setAllManuals);
    }
  }, [isLocked]);

  const saveKey = (key: string) => {
    const trimmed = key.trim();
    localStorage.setItem('ee_api_key', trimmed);
    setApiKey(trimmed);
    setShowKeyInput(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const manual: ManualFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        base64,
        baseId: activeBaseId,
      };

      await saveManualToDB(manual);
      setAllManuals(prev => [...prev, manual]);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsAnalyzing(true);

    try {
      const visibleManuals = allManuals.filter(m => m.baseId === activeBaseId);
      const { text: responseText } = await analyzeManual(text, visibleManuals, currentMode, updatedMessages, apiKey);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: responseText, timestamp: Date.now() }]);
    } catch (error: any) {
      setMessages((prev) => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: `❌ **Chyba:** ${error.message === 'NEPLATNY_KLUC' ? 'Váš API kľúč nie je správny.' : error.message}`, 
        timestamp: Date.now() 
      }]);
      if (error.message === 'NEPLATNY_KLUC') setShowKeyInput(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLocked) return <LoginGate onUnlock={() => setIsLocked(false)} />;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans">
      {/* API Key Bar */}
      {showKeyInput && (
        <div className="bg-blue-600 p-2 flex flex-col md:flex-row items-center justify-center gap-4 z-[60] shadow-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider">⚠️ AI vyžaduje kľúč pre fungovanie:</span>
          <div className="flex gap-2 w-full md:w-auto">
            <input 
              type="password" 
              placeholder="Vložte Gemini API kľúč..." 
              className="bg-white text-slate-900 px-3 py-1 rounded text-xs flex-1 md:w-64"
              onKeyDown={(e) => e.key === 'Enter' && saveKey((e.target as HTMLInputElement).value)}
              onBlur={(e) => saveKey(e.target.value)}
            />
            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[10px] underline hover:text-white mt-1">Získať kľúč zadarmo</a>
          </div>
        </div>
      )}

      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-lg">
        <h1 className="text-xl font-black italic">Electro<span className="text-blue-500">Expert</span></h1>
        <div className="flex gap-2">
           <button onClick={() => setShowKeyInput(!showKeyInput)} className="text-[9px] font-bold border border-slate-600 px-2 py-1 rounded hover:bg-slate-700 transition-colors">
             {apiKey ? 'ZMENIŤ KĽÚČ' : 'NASTAVIŤ KĽÚČ'}
           </button>
           <div className="flex bg-slate-950 p-1 rounded-lg">
             {['SCHEMATIC', 'LOGIC', 'SETTINGS'].map((mode) => (
               <button
                 key={mode}
                 onClick={() => setCurrentMode(mode as AnalysisMode)}
                 className={`px-3 py-1 rounded text-[9px] font-black transition-all ${currentMode === mode ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
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
          onSaveProject={() => {}}
          savedProjects={[]}
          onLoadProject={() => {}}
          onDeleteProject={() => {}}
          currentProjectId={null}
          knowledgeBases={[{id: 'general', name: 'Manuály', icon: '📂'}]}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={() => {}}
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
