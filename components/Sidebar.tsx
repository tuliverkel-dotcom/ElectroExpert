
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
  onDeleteBase?: (id: string) => void;
  syncingFiles?: Set<string>;
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
  onAddBase,
  onDeleteBase,
  syncingFiles = new Set()
}) => {
  return (
    <aside className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col hidden lg:flex shadow-2xl z-10">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-blue-500"></div>
            Priečinky / Projekty
          </h3>
          <button onClick={onAddBase} title="Pridať priečinok" className="p-1 hover:bg-slate-700 rounded text-blue-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {knowledgeBases.map((base) => (
            <div key={base.id} className="group flex items-center gap-1">
              <button
                onClick={() => onSelectBase(base.id)}
                className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeBaseId === base.id 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-slate-900/30 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-transparent hover:border-slate-600'
                }`}
              >
                <span className="text-base">{base.icon || '📁'}</span>
                <span className="truncate">{base.name}</span>
              </button>
              {base.id !== 'general' && onDeleteBase && (
                <button 
                  onClick={() => onDeleteBase(base.id)}
                  className="p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2 bg-slate-800/50">
        <button 
          onClick={onUploadClick}
          className="w-full bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
        >
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          NAHRAŤ DO "{knowledgeBases.find(b => b.id === activeBaseId)?.name.toUpperCase()}"
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 space-y-6 py-4">
        <div>
          <h4 className="text-[9px] font-black text-blue-500 uppercase tracking-tighter mb-3 flex items-center justify-between">
            Súbory v tomto priečinku
            <span className="bg-blue-500/10 text-blue-400 px-1.5 rounded">{manuals.length}</span>
          </h4>
          <div className="space-y-1.5">
            {manuals.length === 0 ? (
              <div className="text-[10px] text-slate-600 italic p-6 text-center border border-dashed border-slate-700 rounded-xl">
                Tento priečinok je prázdny.
              </div>
            ) : (
              manuals.map((m) => (
                <div key={m.id} className="group flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {syncingFiles.has(m.id) ? (
                      <svg className="w-3 h-3 text-blue-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    )}
                    <span className="text-[10px] text-slate-300 truncate font-medium">{m.name}</span>
                  </div>
                  <button onClick={() => onRemove(m.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
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
