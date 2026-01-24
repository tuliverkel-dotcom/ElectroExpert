
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ManualFile, Message, AnalysisMode, SavedProject, KnowledgeBase } from './types';
import { analyzeManual } from './services/gemini';
import { getAllManualsFromDB, saveManualToDB, deleteManualFromDB } from './services/db';
import { driveService } from './services/googleDrive';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ManualViewer from './components/ManualViewer';
import LoginGate from './components/LoginGate';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_MB } from './constants';

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
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [tempClientId, setTempClientId] = useState(localStorage.getItem('ee_google_client_id') || '');
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Vitajte v ElectroExpert AI. Systém je pripravený na analýzu.',
      timestamp: Date.now(),
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMode, setCurrentMode] = useState<AnalysisMode>(AnalysisMode.SCHEMATIC);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentOrigin = window.location.origin;

  useEffect(() => {
    if (!isLocked) {
      const loadData = async () => {
        const manuals = await getAllManualsFromDB();
        setAllManuals(manuals);
        await driveService.init();
      };
      loadData();
    }
  }, [isLocked]);

  const handleStartCloudSetup = () => {
    setShowSetupWizard(true);
    setSetupStep(1);
  };

  const handleSaveClientId = async () => {
    if (!tempClientId.trim().endsWith('.apps.googleusercontent.com')) {
      alert("Chyba: Toto nevyzerá ako Client ID. Musí končiť na '.apps.googleusercontent.com'");
      return;
    }
    driveService.setClientId(tempClientId.trim());
    setSetupStep(3);
    
    try {
      const success = await driveService.signIn();
      if (success) {
        setIsCloudSynced(true);
        setShowSetupWizard(false);
        setMessages(prev => [...prev, {
          id: 'sync-' + Date.now(),
          role: 'assistant',
          content: `✅ Cloud pripojený! Vaše projekty sa teraz synchronizujú s Google Drive.`,
          timestamp: Date.now()
        }]);
      }
    } catch (e: any) {
      console.error("Setup Error:", e);
      setSetupStep(4); // Zobraziť chybu a troubleshooting
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newManuals: ManualFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`Súbor ${file.name} je príliš veľký.`);
        continue;
      }
      
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
      newManuals.push(manual);
      
      if (isCloudSynced) {
        driveService.uploadFile(manual.name, manual.base64, manual.type, manual.baseId);
      }
    }

    setAllManuals(prev => [...prev, ...newManuals]);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      setMessages((prev) => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: `❌ **Chyba:** ${error.message || "Zlyhanie komunikácie s AI."}`, 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLocked) return <LoginGate onUnlock={() => setIsLocked(false)} />;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-100">
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center z-20 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white uppercase italic leading-none tracking-tighter">
              Electro<span className="text-blue-500">Expert</span>
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${isCloudSynced ? 'text-green-400 border-green-500/30 bg-green-500/5' : 'text-slate-500 border-slate-700'}`}>
                {isCloudSynced ? 'Cloud Online' : 'Workspace Offline'}
              </span>
            </div>
          </div>
          
          <button 
            onClick={handleStartCloudSetup} 
            className={`${isCloudSynced ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-blue-600 text-white shadow-blue-900/40'} hover:scale-105 active:scale-95 px-5 py-2.5 rounded-xl text-[11px] font-black transition-all shadow-lg flex items-center gap-2`}
          >
            <div className={`w-2 h-2 rounded-full ${isCloudSynced ? 'bg-green-400 animate-pulse' : 'bg-white/50'}`}></div>
            {isCloudSynced ? 'CLOUD NASTAVENÝ' : 'NASTAVIŤ GOOGLE CLOUD'}
          </button>
        </div>
        
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700 shadow-inner">
           {Object.values(AnalysisMode).map((mode) => (
             <button
               key={mode}
               onClick={() => setCurrentMode(mode)}
               className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${currentMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
             >
               {mode}
             </button>
           ))}
        </div>
      </header>

      {/* Cloud Setup Wizard Modal */}
      {showSetupWizard && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
              <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs italic">G</span>
                Sprievodca pripojením Cloudu
              </h2>
              <button onClick={() => setShowSetupWizard(false)} className="text-slate-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto max-h-[70vh]">
              {setupStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
                    <h3 className="text-blue-400 font-bold text-sm mb-2 uppercase">KROK 4: Nastavenie v Google Console</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Otvorte <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-blue-400 underline font-bold">Google Cloud Console</a>.
                      Uistite sa, že v sekcii <strong>"Authorized JavaScript origins"</strong> máte pridanú túto presnú adresu:
                    </p>
                    <code className="bg-black p-3 rounded-xl block mt-3 font-mono text-blue-400 border border-blue-900/50 select-all">{currentOrigin}</code>
                    <p className="text-[10px] text-slate-500 mt-2 italic">* Adresa nesmie končiť lomkou.</p>
                  </div>
                  <button onClick={() => setSetupStep(2)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs">MÁM TO NASTAVENÉ, POKRAČOVAŤ</button>
                </div>
              )}

              {setupStep === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl">
                    <h3 className="text-green-400 font-bold text-sm mb-2 uppercase">KROK 5: Vloženie Client ID</h3>
                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                      V Google Console skopírujte pole <strong>"Client ID"</strong> (nie Client Secret).
                      Musí to končiť na <code className="text-white">.apps.googleusercontent.com</code>.
                    </p>
                    <input 
                      type="text" 
                      value={tempClientId}
                      onChange={(e) => setTempClientId(e.target.value)}
                      placeholder="Tu vložte Client ID..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-sm font-mono text-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setSetupStep(1)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-4 rounded-2xl uppercase tracking-widest text-[10px]">SPÄŤ</button>
                    <button onClick={handleSaveClientId} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest text-[10px]">PRIPOJIŤ A TESTOVAŤ</button>
                  </div>
                </div>
              )}

              {setupStep === 3 && (
                <div className="flex flex-col items-center justify-center py-10 space-y-6">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Prebieha overovanie kľúča...</p>
                </div>
              )}

              {setupStep === 4 && (
                <div className="space-y-6 animate-in zoom-in-95 duration-200">
                  <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl">
                    <div className="flex items-center gap-3 text-red-500 mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <h3 className="font-black uppercase tracking-tight">CHYBA 401 (INVALID CLIENT)</h3>
                    </div>
                    <div className="space-y-4 text-[11px] text-red-200/80 leading-relaxed">
                      <p>Táto chyba znamená, že Google váš kľúč nepozná. Skontrolujte:</p>
                      <ul className="list-disc ml-5 space-y-2">
                        <li><strong>Typ klienta:</strong> Musí byť <span className="text-white underline">Web application</span> (nie Desktop/Android).</li>
                        <li><strong>Kód:</strong> Či ste neskopírovali <span className="text-white">Client Secret</span> namiesto <span className="text-white">Client ID</span>.</li>
                        <li><strong>Origin:</strong> Či máte v Origins presne <code className="bg-black px-1 text-red-400">{currentOrigin}</code> a či ste v Google Console klikli na <span className="text-white font-bold">SAVE</span> (Uložiť) úplne dole.</li>
                      </ul>
                    </div>
                  </div>
                  <button onClick={() => setSetupStep(2)} className="w-full bg-slate-100 text-slate-900 hover:bg-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs">SKÚSIŤ TO ZNOVA</button>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-950/50 text-center">
              <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">ElectroExpert Cloud Setup Tool v1.0</p>
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-1 overflow-hidden">
        <Sidebar 
          manuals={allManuals.filter(m => m.baseId === activeBaseId)} 
          onUploadClick={() => fileInputRef.current?.click()} 
          onRemove={(id) => { deleteManualFromDB(id); setAllManuals(prev => prev.filter(m => m.id !== id)); }}
          onSaveProject={() => {}}
          savedProjects={savedProjects}
          onLoadProject={(id) => { const p = savedProjects.find(pr => pr.id === id); if(p) setMessages(p.messages); }}
          onDeleteProject={(id, e) => { e.stopPropagation(); setSavedProjects(prev => prev.filter(p => p.id !== id)); }}
          currentProjectId={currentProjectId}
          knowledgeBases={knowledgeBases}
          activeBaseId={activeBaseId}
          onSelectBase={setActiveBaseId}
          onAddBase={() => { const n = prompt("Názov novej zložky:"); if(n) setKnowledgeBases(prev => [...prev, {id: n.toLowerCase().replace(/\s/g, '_'), name: n, icon: '📂'}]); }}
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
