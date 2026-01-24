
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import MermaidDiagram from './MermaidDiagram';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isAnalyzing: boolean;
  activeManualsCount: number;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isAnalyzing, activeManualsCount }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAnalyzing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAnalyzing) return;
    onSendMessage(input);
    setInput('');
  };

  const renderMessageContent = (msg: Message) => {
    const { content, sources } = msg;
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

    return (
      <>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {parts.length > 0 ? parts : content}
        </div>
        {sources && sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-700/50">
            <div className="text-[9px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Zdroje z webu:</div>
            <div className="flex flex-wrap gap-2">
              {sources.map((src, i) => (
                <a 
                  key={i} 
                  href={src.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-slate-900/50 border border-slate-700 hover:border-blue-500 px-2 py-1 rounded text-[10px] text-blue-400 truncate max-w-[200px] transition-colors"
                >
                  {src.title || 'Zdroj informácie'}
                </a>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 border-r border-slate-800">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] md:max-w-[85%] rounded-2xl p-4 shadow-lg ${
              msg.role === 'user' 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
            }`}>
              {renderMessageContent(msg)}
              <div className={`text-[10px] mt-2 ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-500'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isAnalyzing && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none p-4 flex gap-2 items-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-xs text-slate-400 font-medium ml-2 italic tracking-tight">Analyzujem manuály a hľadám riešenie...</span>
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
            placeholder={activeManualsCount > 0 ? "Položte otázku k dokumentácii..." : "Nahrajte manuály do zložky..."}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 text-sm"
          />
          <button
            type="submit"
            disabled={isAnalyzing || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9 2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
