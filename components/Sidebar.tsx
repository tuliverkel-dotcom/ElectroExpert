
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

  return (
    <aside className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col hidden lg:flex shadow-2xl z-10">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-blue-500"></div>
            Workspace
          </h3>
          <button onClick={onAddBase} className="p-1 hover:bg-slate-700 rounded text-blue-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        <div className="space-y-1">
          {knowledgeBases.map((base) => (
            <button
              key={base.id}
              onClick={() => onSelectBase(base.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeBaseId === base.id 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-slate-900/30 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-transparent hover:border-slate-600'
              }`}
            >
              <span className="text-base">{base.icon || '📂'}</span>
              <span className="truncate">{base.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2 bg-slate-800/50">
        <button 
          onClick={onUploadClick}
          className="w-full bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
        >
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          NAHRAŤ DOKUMENTÁCIU
        </button>
        <button 
          onClick={onSaveProject}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
          SYNCHRONIZOVAŤ PROJEKT
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 space-y-6 py-4">
        <div>
          <h4 className="text-[9px] font-black text-blue-500 uppercase tracking-tighter mb-3 flex items-center justify-between">
            Aktívne manuály
            <span className="bg-blue-500/10 text-blue-400 px-1.5 rounded">{manuals.length}</span>
          </h4>
          <div className="space-y-1.5">
            {manuals.length === 0 ? (
              <div className="text-[10px] text-slate-600 italic p-6 text-center border border-dashed border-slate-700 rounded-xl">
                Priečinok je prázdny.
              </div>
            ) : (
              manuals.map((m) => (
                <div key={m.id} className="group flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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

        <div>
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-3 flex items-center gap-2">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M7.74 2L1 14l3.37 6h15.26l3.37-6L16.26 2H7.74z" /></svg>
            Cloud Projekty
          </h4>
          <div className="space-y-2">
            {savedProjects.length === 0 ? (
              <p className="text-[10px] text-slate-700 italic px-2">Žiadne projekty v cloude.</p>
            ) : (
              savedProjects.map((project) => (
                <div 
                  key={project.id} 
                  onClick={() => onLoadProject(project.id)}
                  className={`group cursor-pointer flex items-center justify-between p-3 rounded-xl border transition-all ${
                    currentProjectId === project.id ? 'bg-blue-600 border-blue-400 shadow-xl' : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-[10px] font-bold truncate ${currentProjectId === project.id ? 'text-white' : 'text-slate-200'}`}>{project.name}</span>
                    <span className={`text-[8px] flex items-center gap-1 ${currentProjectId === project.id ? 'text-blue-200' : 'text-slate-500'}`}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {new Date(project.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${currentProjectId === project.id ? 'bg-white' : 'bg-green-500'} shadow-sm shadow-black/50`}></div>
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
