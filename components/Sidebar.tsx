
import React from 'react';
import { ManualFile, SavedProject, KnowledgeBase } from '../types';

interface SidebarProps {
  manuals: ManualFile[];
  onUploadClick: () => void;
  onRemove: (id: string) => void;
  onSaveProject: () => void;
  savedProjects: SavedProject[];
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  currentProjectId: string | null;
  knowledgeBases: KnowledgeBase[];
  activeBaseId: string;
  onSelectBase: (id: string) => void;
  onAddBase: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  manuals, 
  onUploadClick, 
  onRemove, 
  onSaveProject, 
  savedProjects, 
  onLoadProject, 
  onDeleteProject,
  currentProjectId,
  knowledgeBases,
  activeBaseId,
  onSelectBase,
  onAddBase
}) => {
  const activeBaseName = knowledgeBases.find(b => b.id === activeBaseId)?.name;
  
  // Rozdelenie manuálov pre prehľadnejšie zobrazenie
  const generalManuals = manuals.filter(m => m.baseId === 'general');
  const specificManuals = manuals.filter(m => m.baseId !== 'general');

  return (
    <aside className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col hidden lg:flex">
      {/* Zložky Výrobcov */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Moje Zložky</h3>
          <button onClick={onAddBase} className="p-1 hover:bg-slate-700 rounded text-blue-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="space-y-1">
          {knowledgeBases.map((base) => (
            <button
              key={base.id}
              onClick={() => onSelectBase(base.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeBaseId === base.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                : 'bg-slate-900/30 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <span className="text-base">{base.icon || '📂'}</span>
              <span className="truncate">{base.name}</span>
              {base.id === 'general' && <span className="ml-auto text-[8px] opacity-60">GLOBAL</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-1">
        <div className="h-px bg-slate-700/50"></div>
      </div>

      <div className="p-4 space-y-2">
        <button 
          onClick={onUploadClick}
          className="w-full bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
        >
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          NAHRAŤ DO {activeBaseName?.toUpperCase()}
        </button>
        <button 
          onClick={onSaveProject}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          ULOŽIŤ AKTUÁLNE RIEŠENIE
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-4">
        {/* Špecifické manuály */}
        {activeBaseId !== 'general' && (
          <div>
            <h4 className="text-[9px] font-black text-blue-500 uppercase tracking-tighter mb-2">Súbory v {activeBaseName}</h4>
            <div className="space-y-1">
              {specificManuals.length === 0 ? (
                <div className="text-[10px] text-slate-600 italic">Priečinok je prázdny.</div>
              ) : (
                specificManuals.map((m) => (
                  <div key={m.id} className="group flex items-center justify-between bg-slate-900/50 p-2 rounded border border-slate-700/50">
                    <span className="text-[10px] text-slate-300 truncate w-[80%]">{m.name}</span>
                    <button onClick={() => onRemove(m.id)} className="opacity-0 group-hover:opacity-100 text-red-500">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Globálne manuály */}
        <div>
          <h4 className="text-[9px] font-black text-green-500 uppercase tracking-tighter mb-2">Globálne Dokumenty (Všeobecné)</h4>
          <div className="space-y-1">
            {generalManuals.length === 0 ? (
              <div className="text-[10px] text-slate-600 italic">Prázdne.</div>
            ) : (
              generalManuals.map((m) => (
                <div key={m.id} className="group flex items-center justify-between bg-slate-900/50 p-2 rounded border border-green-900/20">
                  <span className="text-[10px] text-slate-400 truncate w-[80%]">{m.name}</span>
                  <button onClick={() => onRemove(m.id)} className="opacity-0 group-hover:opacity-100 text-red-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Projekty */}
        <div>
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-2">História riešení ({activeBaseName})</h4>
          <div className="space-y-1">
            {savedProjects.length === 0 ? (
              <p className="text-[10px] text-slate-700 italic">Žiadne uložené dáta.</p>
            ) : (
              savedProjects.map((project) => (
                <div 
                  key={project.id} 
                  onClick={() => onLoadProject(project.id)}
                  className={`group cursor-pointer flex items-center justify-between p-2 rounded border transition-all ${
                    currentProjectId === project.id ? 'bg-blue-600 border-blue-400' : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-[10px] font-bold truncate ${currentProjectId === project.id ? 'text-white' : 'text-slate-300'}`}>{project.name}</span>
                    <span className={`text-[8px] ${currentProjectId === project.id ? 'text-blue-200' : 'text-slate-600'}`}>{new Date(project.timestamp).toLocaleDateString()}</span>
                  </div>
                  <button onClick={(e) => onDeleteProject(project.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
