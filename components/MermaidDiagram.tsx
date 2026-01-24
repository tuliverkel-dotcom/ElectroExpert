
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
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (window.mermaid && ref.current) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
      });
      
      const renderDiagram = async () => {
        setIsRendering(true);
        setRenderError(false);
        try {
          // Unikátne ID zaručuje, že sa nebudú prepisovať existujúce diagramy
          const id = `mermaid-svg-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await window.mermaid.render(id, chart);
          if (ref.current) {
            ref.current.innerHTML = svg;
            setSvgContent(svg);
          }
        } catch (err) {
          console.error('Mermaid error:', err);
          setRenderError(true);
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
    alert('Syntax schémy skopírovaná.');
  };

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={copyCode} title="Kopírovať Mermaid kód" className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 shadow-xl transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>
        </button>
        <button onClick={downloadSVG} title="Stiahnuť SVG" className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded border border-blue-400 shadow-xl transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </button>
      </div>

      <div className={`bg-slate-950/50 rounded-xl border border-slate-700 overflow-hidden shadow-inner p-6 min-h-[150px] flex items-center justify-center transition-all ${isRendering ? 'animate-pulse' : ''}`}>
        {renderError ? (
           <div className="text-center p-4">
              <p className="text-red-400 text-[10px] font-bold uppercase mb-2">Chyba v syntaxi schémy</p>
              <button onClick={copyCode} className="text-[9px] text-slate-500 underline">Skopírovať kód pre manuálnu opravu</button>
           </div>
        ) : (
          <div ref={ref} className="w-full"></div>
        )}
      </div>
    </div>
  );
};

export default MermaidDiagram;
