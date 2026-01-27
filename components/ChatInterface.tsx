
import React, { useState, useRef, useEffect, memo } from 'react';
import { Message } from '../types';
import MermaidDiagram from './MermaidDiagram';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isAnalyzing: boolean;
  activeManualsCount: number;
}

const MessageItem = memo(({ msg }: { msg: Message }) => {
  const { content, sources, role, timestamp } = msg;
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mermaidRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{content.substring(lastIndex, match.index)}</span>);
    }
    parts.push(
      <div key={`diagram-${match.index}`} className="my-4">
        <div className="text-[10px] font-black text-blue-400 uppercase mb-2 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
          Technický nákres
        </div>
        <MermaidDiagram chart={match[1]} />
      </div>
    );
    lastIndex = mermaidRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(<span key={`text-end`}>{content.substring(lastIndex)}</span>);
  }

  // <--- TU JE ZMENA: Funkcia na vyčistenie textu pre zdieľanie
  const getShareableText = () => {
    // Odstráni zložité kódy schém, aby to v správe vyzeralo pekne
    let cleanText = content.replace(/```mermaid[\s\S]*?```/g, '\n[ 📎 POZRI PRILOŽENÚ SCHÉMU V APLIKÁCII ]\n');
    cleanText = cleanText.replace(/\*\*/g, '*'); // Markdown bold na WhatsApp bold
    return `🔧 *ElectroExpert Riešenie*\n📅 ${new Date(timestamp).toLocaleString('sk-SK')}\n\n${cleanText}\n\n🤖 Vygenerované AI`;
  };

  const handleShare = (platform: 'whatsapp' | 'email' | 'copy') => {
    const text = getShareableText();
    if (platform === 'whatsapp') {
      // <--- TU JE ZMENA: Otvorenie WhatsAppu
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'email') {
      window.open(`mailto:?subject=${encodeURIComponent("Technické riešenie")}&body=${encodeURIComponent(text)}`, '_self');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(text);
      alert("Text riešenia bol skopírovaný do schránky.");
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
          {parts.length > 0 ? parts : content}
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

      {/* <--- TU JE ZMENA: Panel zdieľania (Viditeľný len pre asistenta) */}
      {role === 'assistant' && (
        <div className="mt-2 ml-1 p-2 bg-slate-800/50 border border-slate-700/50 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider pl-1">Odoslať:</span>
          
          <button onClick={() => handleShare('whatsapp')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            WhatsApp
          </button>
          
          <button onClick={() => handleShare('email')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Email
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
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} />
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
