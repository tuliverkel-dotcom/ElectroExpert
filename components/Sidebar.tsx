
import React from 'react';
import { ManualFile, SavedProject } from '../types';

interface SidebarProps {
  manuals: ManualFile[];
  onUploadClick: () => void;
  onRemove: (id: string) => void;
  onSaveProject: () => void;
  savedProjects: SavedProject[];
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  currentProjectId: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  manuals, 
  onUploadClick, 
  onRemove, 
  onSaveProject, 
  savedProjects, 
  onLoadProject, 
  onDeleteProject,
  currentProjectId
}) => {
  return (
    <aside className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col hidden lg:flex">
      <div className="p-4 space-y-2 border-b border-slate-700">
        <button 
          onClick={onUploadClick}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Pridať manuál
        </button>
        <button 
          onClick={onSaveProject}
          className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Uložiť riešenie
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aktuálne dokumenty</h3>
          {manuals.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Žiadne manuály.</p>
          ) : (
            manuals.map((manual) => (
              <div key={manual.id} className="group flex items-center justify-between bg-slate-700/30 p-2 rounded-md border border-slate-700 hover:border-blue-500/50 transition-all">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                  <span className="text-[11px] text-slate-300 truncate">{manual.name}</span>
                </div>
                <button 
                  onClick={() => onRemove(manual.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 space-y-3 border-t border-slate-700/50">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Uložené riešenia</h3>
          {savedProjects.length === 0 ? (
            <p className="text-xs text-slate-600 italic">História je prázdna.</p>
          ) : (
            savedProjects.map((project) => (
              <div 
                key={project.id} 
                onClick={() => onLoadProject(project.id)}
                className={`group cursor-pointer flex items-center justify-between p-2 rounded-md border transition-all ${
                  currentProjectId === project.id 
                  ? 'bg-blue-900/20 border-blue-600/50' 
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className={`text-[11px] font-medium truncate ${currentProjectId === project.id ? 'text-blue-400' : 'text-slate-300'}`}>
                    {project.name}
                  </span>
                  <span className="text-[9px] text-slate-600">
                    {new Date(project.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <button 
                  onClick={(e) => onDeleteProject(project.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-400 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-4 bg-slate-900/50 mt-auto border-t border-slate-700">
        <div className="flex items-center gap-2 text-[10px] text-blue-400/60 font-medium">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          História je uložená lokálne
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
