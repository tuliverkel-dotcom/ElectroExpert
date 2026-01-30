
import React, { useState, useRef, useEffect, memo } from 'react';
import { Message } from '../types';
import MermaidDiagram from './MermaidDiagram';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isAnalyzing: boolean;
  activeManualsCount: number;
}

// Komponent pre zobrazenie schémy na celú obrazovku
const CADViewerModal = ({ content, onClose }: { content: string, onClose: () => void }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col animate-in fade-in duration-200">
      <div className="bg-slate-900 border-b border-slate-700 p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">CAD Prehliadač</h3>
            <p className="text-[10px] text-slate-400">Režim zobrazenia vektorovej grafiky</p>
          </div>
        </div>
        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-slate-700">
          ZAVRIEŤ PREHLIADAČ ✕
        </button>
      </div>
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[#1e293b] relative">
        {/* Mriežka na pozadí pre CAD feel */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div 
          className="w-full h-full flex items-center justify-center transform scale-100 origin-center"
          dangerouslySetInnerHTML={{ __html: content }} 
        />
      </div>
    </div>
  );
};

interface MessageItemProps {
  msg: Message;
  onZoom: (svgContent: string) => void;
}

const MessageItem = memo(({ msg, onZoom }: MessageItemProps) => {
  const { content, sources, role, timestamp } = msg;

  const renderContent = () => {
    const parts = [];
    let lastIndex = 0;
    
    const combinedRegex = /(```mermaid\n[\s\S]*?```)|(```svg\n[\s\S]*?```)/g;
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
            <div className="flex justify-between items-end mb-2">
              <div className="text-[10px] font-black text-green-400 uppercase flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                Elektro Výkres (As-Built)
              </div>
              <button 
                onClick={() => onZoom(svgCode)}
                className="text-[9px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors shadow-lg"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                Zväčšiť (CAD View)
              </button>
            </div>
            
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 overflow-hidden shadow-inner flex justify-center relative min-h-[200px]">
              <div dangerouslySetInnerHTML={{ __html: svgCode }} className="w-full h-full max-h-[300px]" />
              <div className="absolute bottom-2 right-2 opacity-50 text-[9px] text-slate-500 font-mono">Generované: ElectroExpert AI</div>
            </div>
            
             <div className="flex justify-between items-center mt-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
               <span className="text-[9px] text-slate-500 italic">
                 💡 Tip: Tento súbor je kompatibilný s AutoCAD, EPLAN a CorelDraw.
               </span>
              <button 
                onClick={() => {
                  const blob = new Blob([svgCode], { type: 'image/svg+xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `schema_export_${Date.now()}.svg`;
                  a.click();
                }}
                className="text-[9px] text-slate-400 hover:text-white flex items-center gap-1 font-bold"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003 3h-10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Stiahnuť pre CAD (.svg)
              </button>
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

  const getShareableText = () => {
    let cleanText = content.replace(/```[\s\S]*?```/g, '\n[ 📎 POZRI PRILOŽENÚ SCHÉMU V APLIKÁCII ]\n');
    cleanText = cleanText.replace(/\*\*/g, '*'); 
    return `🔧 *ElectroExpert Riešenie*\n📅 ${new Date(timestamp).toLocaleString('sk-SK')}\n\n${cleanText}\n\n🤖 Vygenerované AI`;
  };

  const handleShare = (platform: 'whatsapp' | 'email' | 'copy' | 'doc') => {
    const text = getShareableText();
    
    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'email') {
      window.open(`mailto:?subject=${encodeURIComponent("Technické riešenie")}&body=${encodeURIComponent(text)}`, '_self');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(text);
      alert("Text riešenia bol skopírovaný do schránky.");
    } else if (platform === 'doc') {
      let htmlContent = content
        .replace(/\n/g, '<br>')
        .replace(/## (.*)/g, '<h2>$1</h2>')
        .replace(/# (.*)/g, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/```[\s\S]*?```/g, '<i>[Schéma bola vynechaná pre kompatibilitu Wordu]</i>');

      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>ElectroExpert Export</title></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + htmlContent + footer;

      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `dokumentacia_${new Date().getTime()}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
    }
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
            <div className="text-[9px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Zdroje:</div>
            <div className="flex flex-wrap gap-2">
              {sources.map((src, i) => (
                <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="bg-slate-900/50 border border-slate-700 hover:border-blue-400 px-2 py-1 rounded text-[10px] text-blue-400 truncate max-w-[150px]">
                  {src.title || 'Zdroj'}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {role === 'assistant' && (
        <div className="mt-2 ml-1 p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider pl-1 hidden sm:inline">Odoslať:</span>
          
          <button onClick={() => handleShare('whatsapp')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
          
          <button onClick={() => handleShare('email')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <span className="hidden sm:inline">Email</span>
          </button>

          <button onClick={() => handleShare('doc')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Stiahnuť .DOC
          </button>
          
          <button onClick={() => handleShare('copy')} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-all border border-transparent hover:border-slate-600 hover:bg-slate-700" title="Kopírovať text">
             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>
          </button>
        </div>
      )}
      
      {role === 'user' && (
        <div className="mt-1 mr-2 text-[10px] text-slate-500">
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
});

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isAnalyzing, activeManualsCount }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [zoomedSvg, setZoomedSvg] = useState<string | null>(null);

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
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} onZoom={setZoomedSvg} />
        ))}
        {isAnalyzing && (
          <div className="flex justify-start animate-in fade-in duration-300">
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
            placeholder={activeManualsCount > 0 ? "Opíšte problém (napr. 'nejde motor')..." : "Nahrajte manuály v ľavom paneli..."}
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
