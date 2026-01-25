
import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    mermaid: any;
  }
}

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const sanitizeChart = (raw: string) => {
    // Odstránenie markdown značiek ak ich AI omylom nechala vnútri
    let cleaned = raw.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    
    // Základná oprava: Ak chýba deklarácia grafu
    if (!cleaned.startsWith('graph') && !cleaned.startsWith('flowchart') && !cleaned.startsWith('sequenceDiagram')) {
      cleaned = 'graph TD\n' + cleaned;
    }
    return cleaned;
  };

  useEffect(() => {
    if (window.mermaid && ref.current) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: 'Inter, system-ui, sans-serif',
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
      });
      
      const renderDiagram = async () => {
        setIsRendering(true);
        setRenderError(null);
        
        try {
          const sanitized = sanitizeChart(chart);
          const id = `mermaid-svg-${Math.random().toString(36).substr(2, 9)}`;
          
          // Skúsime vyrenderovať schému
          const { svg } = await window.mermaid.render(id, sanitized);
          
          if (ref.current) {
            ref.current.innerHTML = svg;
            setSvgContent(svg);
          }
        } catch (err: any) {
          console.error('Mermaid render failure:', err);
          setRenderError(err.message || 'Neznáma chyba syntaxe');
        } finally {
          setIsRendering(false);
        }
      };

      renderDiagram();
    }
  }, [chart]);

  const downloadSVG = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `electro-schema-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(chart);
    alert('Kód schémy skopírovaný.');
  };

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={copyCode} title="Kopírovať Mermaid kód" className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 shadow-xl transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>
        </button>
        {!renderError && (
          <button onClick={downloadSVG} title="Stiahnuť SVG" className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded border border-blue-400 shadow-xl transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003 3h-10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        )}
      </div>

      <div className={`bg-slate-950/50 rounded-xl border ${renderError ? 'border-red-500/50' : 'border-slate-700'} overflow-hidden shadow-inner p-6 min-h-[150px] flex items-center justify-center transition-all ${isRendering ? 'animate-pulse' : ''}`}>
        {renderError ? (
           <div className="text-center p-6 bg-red-500/5 rounded-lg border border-red-500/20 w-full">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <p className="text-red-400 text-xs font-bold uppercase mb-1">Chyba vykresľovania schémy</p>
              <p className="text-[10px] text-slate-500 mb-4 font-mono">{renderError}</p>
              <div className="flex justify-center gap-2">
                <button onClick={copyCode} className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
                  Skopírovať kód
                </button>
                <button onClick={() => window.location.reload()} className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  Obnoviť stránku
                </button>
              </div>
           </div>
        ) : (
          <div ref={ref} className="w-full flex justify-center"></div>
        )}
      </div>
    </div>
  );
};

export default MermaidDiagram;
