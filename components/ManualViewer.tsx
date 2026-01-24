
import React from 'react';
import { ManualFile } from '../types';

interface ManualViewerProps {
  manuals: ManualFile[];
}

const ManualViewer: React.FC<ManualViewerProps> = ({ manuals }) => {
  return (
    <div className="w-full md:w-1/3 bg-slate-900 overflow-y-auto hidden md:block">
      <div className="p-4 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Prehľad dát
        </h2>
      </div>

      <div className="p-4 space-y-6">
        {manuals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-center text-xs">Tu uvidíte náhľady schém a dokumentácie po nahratí súborov.</p>
          </div>
        ) : (
          manuals.map((manual) => (
            <div key={manual.id} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 group shadow-lg">
              <div className="bg-slate-700/50 p-2 text-[10px] text-slate-300 flex justify-between items-center">
                <span className="truncate max-w-[80%] font-mono">{manual.name}</span>
                <span className="bg-slate-800 px-1 rounded uppercase">{manual.type.split('/')[1]}</span>
              </div>
              <div className="aspect-[3/4] bg-slate-900 flex items-center justify-center overflow-hidden">
                {manual.type.includes('image') ? (
                  <img 
                    src={`data:${manual.type};base64,${manual.base64}`} 
                    alt={manual.name} 
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px]">PDF dokument</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ManualViewer;
