
import React, { useState, useRef, useEffect, memo } from 'react';
import { Message } from '../types';
import MermaidDiagram from './MermaidDiagram';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isAnalyzing: boolean;
  activeManualsCount: number;
}

// Komponent pre zobrazenie schémy na celú obrazovku (SVG CAD)
const CADViewerModal = ({ content, onClose }: { content: string, onClose: () => void }) => {
  // Pridaný poslucháč pre ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col animate-in fade-in duration-200">
      <div className="bg-slate-900 border-b border-slate-700 p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">CAD Prehliadač</h3>
            <p className="text-[10px] text-slate-400">Režim zobrazenia vektorovej grafiky (ESC pre zatvorenie)</p>
          </div>
        </div>
        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-slate-700 hover:border-slate-500">
          ZAVRIEŤ (ESC) ✕
        </button>
      </div>
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[#1e293b] relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div 
          className="w-full h-full flex items-center justify-center transform scale-100 origin-center"
          dangerouslySetInnerHTML={{ __html: content }} 
        />
      </div>
    </div>
  );
};

// NOVÝ: Komponent pre zobrazenie dokumentácie (A4 štýl)
const DocumentReaderModal = ({ content, onClose }: { content: string, onClose: () => void }) => {
  const printRef = useRef<HTMLDivElement>(null);

  // Pridaný poslucháč pre ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>ElectroExpert Manuál</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: A4; margin: 2cm; }
              body { background: white; color: black; font-family: 'Times New Roman', serif; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
              th, td { border: 1px solid #333; padding: 8px; text-align: left; }
              th { background-color: #f3f4f6; }
              h1 { font-size: 24pt; font-weight: bold; margin-bottom: 12pt; border-bottom: 2px solid black; }
              h2 { font-size: 18pt; font-weight: bold; margin-top: 16pt; margin-bottom: 8pt; color: #1e3a8a; }
              p { margin-bottom: 10pt; line-height: 1.5; text-align: justify; }
              .page-break { page-break-before: always; }
            </style>
          </head>
          <body>
            ${printContent}
            <script>
              setTimeout(() => { window.print(); window.close(); }, 500);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      <div className="bg-slate-900 border-b border-slate-700 p-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-900/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Dokumentácia</h3>
            <p className="text-[10px] text-slate-400">Náhľad pred tlačou (ESC pre zatvorenie)</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-blue-500 shadow-lg flex items-center gap-2">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003 3h-10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
             STIAHNUŤ PDF / TLAČIŤ
           </button>
           <button onClick={onClose} className="bg-slate-800 hover:bg-red-600 hover:border-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-slate-700">
             ZAVRIEŤ (ESC) ✕
           </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-10 flex justify-center bg-slate-800/50">
        {/* A4 Container */}
        <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl p-[20mm] text-black">
          <div ref={printRef} dangerouslySetInnerHTML={{ __html: content }} className="prose max-w-none text-black" />
        </div>
      </div>
    </div>
  );
};

interface MessageItemProps {
  msg: Message;
  onZoom: (svgContent: string) => void;
  onOpenDoc: (htmlContent: string) => void;
}

const MessageItem = memo(({ msg, onZoom, onOpenDoc }: MessageItemProps) => {
  const { content, sources, role, timestamp } = msg;

  const renderContent = () => {
    const parts = [];
    let lastIndex = 0;
    
    // Regex na hľadanie blokov: Mermaid, SVG, alebo HTML (Dokumentácia)
    const combinedRegex = /(```mermaid\n[\s\S]*?```)|(```svg\n[\s\S]*?```)|(```html\n[\s\S]*?```)/g;
    let match;

    while ((match = combinedRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{content.substring(lastIndex, match.index)}</span>);
      }

      const fullBlock = match[0];
      
      if (fullBlock.startsWith('```mermaid')) {
        const code = fullBlock.replace('```mermaid\n', '').replace('```', '');
        parts.push(
          <div key={`diagram-${match.index}`} className="my-4">
             <div className="text-[10px] font-black text-blue-400 uppercase mb-2 flex items-center gap-1">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
               Logická schéma
             </div>
             <MermaidDiagram chart={code} />
          </div>
        );
      } 
      else if (fullBlock.startsWith('```svg')) {
        const svgCode = fullBlock.replace('```svg\n', '').replace('```', '');
        parts.push(
          <div key={`svg-${match.index}`} className="my-6 group">
             {/* ... SVG Preview UI (zachované z minula) ... */}
            <div className="flex justify-between items-end mb-2">
              <div className="text-[10px] font-black text-green-400 uppercase flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                Elektro Výkres (As-Built)
              </div>
              <button onClick={() => onZoom(svgCode)} className="text-[9px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors shadow-lg">Zväčšiť (CAD View)</button>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 overflow-hidden shadow-inner flex justify-center relative min-h-[200px]">
              <div dangerouslySetInnerHTML={{ __html: svgCode }} className="w-full h-full max-h-[300px]" />
            </div>
          </div>
        );
      }
      else if (fullBlock.startsWith('```html')) {
        const htmlCode = fullBlock.replace('```html\n', '').replace('```', '');
        
        const downloadHtml = () => {
           const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = `manual_web_${Date.now()}.html`;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
           URL.revokeObjectURL(url);
        };

        const downloadWord = () => {
           const header = `
           <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
           <head><meta charset='utf-8'><title>Export</title></head><body>`;
           const footer = "</body></html>";
           const sourceHTML = header + htmlCode + footer;
           
           const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = `manual_editovatelny_${Date.now()}.doc`;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
           URL.revokeObjectURL(url);
        };

        parts.push(
          <div key={`doc-${match.index}`} className="my-6">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center space-y-4 max-w-sm mx-auto">
               <div className="w-16 h-16 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center border border-blue-500/30">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
               </div>
               <div>
                 <h3 className="text-lg font-bold text-white">Manuál Pripravený</h3>
                 <p className="text-xs text-slate-400 mt-1">Vyberte formát pre stiahnutie.</p>
               </div>
               <div className="flex flex-col gap-2 w-full">
                  <button 
                    onClick={downloadWord}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    STIAHNUŤ PRE WORD (.DOC)
                  </button>
                  <button 
                    onClick={downloadHtml}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-bold py-2 rounded-xl transition-all border border-slate-600 active:scale-95 text-xs flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    STIAHNUŤ WEB (.HTML)
                  </button>
                  <button 
                    onClick={() => onOpenDoc(htmlCode)}
                    className="w-full text-slate-500 hover:text-white py-1 text-[10px] underline decoration-slate-600 hover:decoration-white"
                  >
                    Len otvoriť náhľad
                  </button>
               </div>
            </div>
          </div>
        );
      }

      lastIndex = combinedRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(<span key={`text-end`}>{content.substring(lastIndex)}</span>);
    }
    
    return parts.length > 0 ? parts : content;
  };

  // ... (Zvyšok MessageItem ostáva rovnaký, len renderContent je upravený)
  
  const getShareableText = () => {
    let cleanText = content.replace(/```[\s\S]*?```/g, '\n[ 📎 POZRI PRILOŽENÝ SÚBOR V APLIKÁCII ]\n');
    cleanText = cleanText.replace(/\*\*/g, '*'); 
    return `🔧 *ElectroExpert Riešenie*\n📅 ${new Date(timestamp).toLocaleString('sk-SK')}\n\n${cleanText}\n\n🤖 Vygenerované AI`;
  };

  const handleShare = (platform: 'whatsapp' | 'email' | 'copy' | 'doc') => {
     // ... (Funkcia handleShare ostáva rovnaká) ...
     const text = getShareableText();
     if (platform === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
     else if (platform === 'email') window.open(`mailto:?subject=${encodeURIComponent("Technické riešenie")}&body=${encodeURIComponent(text)}`, '_self');
     else if (platform === 'copy') { navigator.clipboard.writeText(text); alert("Skopírované."); }
     else if (platform === 'doc') alert("Pre stiahnutie dokumentácie použite tlačidlo 'STIAHNUŤ SÚBOR'.");
  };

  return (
    <div className={`flex flex-col ${role === 'user' ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[90%] md:max-w-[85%] rounded-2xl p-4 shadow-lg ${
        role === 'user' 
        ? 'bg-blue-600 text-white rounded-tr-none' 
        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
      }`}>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {renderContent()}
        </div>
        
        {sources && sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-700/50">
            {/* ... Zdroje ... */}
          </div>
        )}
      </div>
      {/* ... Tlačidlá na zdieľanie (len pre assistanta) ... */}
       {role === 'assistant' && (
        <div className="mt-2 ml-1 p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
           {/* ... Tlačidlá ... */}
           <button onClick={() => handleShare('copy')} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-all border border-transparent hover:border-slate-600 hover:bg-slate-700">
             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>
          </button>
        </div>
      )}
    </div>
  );
});

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isAnalyzing, activeManualsCount }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [zoomedSvg, setZoomedSvg] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string | null>(null); // State pre otvorený dokument

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isAnalyzing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAnalyzing) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 border-r border-slate-800 overflow-hidden">
      {zoomedSvg && <CADViewerModal content={zoomedSvg} onClose={() => setZoomedSvg(null)} />}
      {docContent && <DocumentReaderModal content={docContent} onClose={() => setDocContent(null)} />}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} onZoom={setZoomedSvg} onOpenDoc={setDocContent} />
        ))}
        {isAnalyzing && (
          <div className="flex justify-start animate-in fade-in duration-300">
             {/* ... Loading indicator ... */}
             <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none p-4 flex gap-3 items-center">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-xs text-slate-400 font-medium italic">Analyzujem manuály a generujem postup...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-800/50 border-t border-slate-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isAnalyzing}
            placeholder={activeManualsCount > 0 ? "Opíšte požiadavku (napr. 'Vygeneruj manuál pre zákazníka')..." : "Nahrajte manuály v ľavom paneli..."}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all disabled:opacity-50 text-sm"
          />
          <button type="submit" disabled={isAnalyzing || !input.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9 2zm0 0v-8" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
