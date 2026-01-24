
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
        try {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          // Mermaid render vráti objekt s vlastnosťou svg
          const { svg } = await window.mermaid.render(id, chart);
          if (ref.current) {
            ref.current.innerHTML = svg;
            setSvgContent(svg);
          }
        } catch (err) {
          console.error('Mermaid render error:', err);
          if (ref.current) {
            ref.current.innerHTML = '<p class="text-red-400 text-[10px] p-4 text-center border border-dashed border-red-900/30 rounded-lg">Chyba pri generovaní náhľadu schémy. Skontrolujte syntax.</p>';
          }
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
    link.download = `electro-expert-draft-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPNG = () => {
    if (!ref.current) return;
    const svgElement = ref.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // Nastavenie rozmerov podľa SVG
    const svgSize = svgElement.getBoundingClientRect();
    const scale = 2; // Zvýšenie kvality
    canvas.width = svgSize.width * scale;
    canvas.height = svgSize.height * scale;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = '#0f172a'; // Pozadie ladiace s appkou
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `electro-expert-draft-${Date.now()}.png`;
        link.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyCode = () => {
    navigator.clipboard.writeText(chart);
    alert('Mermaid kód bol skopírovaný do schránky.');
  };

  return (
    <div className="relative group">
      {/* Exportný panel */}
      <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={copyCode}
          title="Kopírovať kód schémy"
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 shadow-xl transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        </button>
        <button 
          onClick={downloadSVG}
          title="Stiahnuť ako SVG (Vektor)"
          className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded border border-blue-400 shadow-xl transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <button 
          onClick={downloadPNG}
          title="Stiahnuť ako PNG (Obrázok)"
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 shadow-xl transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      <div className={`bg-slate-950/50 rounded-xl border border-slate-700 overflow-hidden shadow-inner p-6 min-h-[150px] flex items-center justify-center transition-all ${isRendering ? 'animate-pulse' : ''}`}>
        <div ref={ref} className="w-full"></div>
      </div>
    </div>
  );
};

export default MermaidDiagram;
