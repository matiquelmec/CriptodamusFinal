import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, BookOpen, ChevronDown, Check, RefreshCw } from 'lucide-react';
import { streamMarketAnalysis } from '../services/geminiService';
import { ChatMessage, Strategy } from '../types';
import { getMarketContextForAI, getTechnicalAnalysis, getFearAndGreedIndex } from '../services/cryptoService';
import { STRATEGIES } from '../services/strategyContext';

interface AIChatProps {
    selectedSymbol: string;
}

const AIChat: React.FC<AIChatProps> = ({ selectedSymbol }) => {
  const [currentStrategy, setCurrentStrategy] = useState<Strategy>(STRATEGIES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showStrategySelector, setShowStrategySelector] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // PREPARE INPUT ON SYMBOL CHANGE (NO AUTO-FIRE)
  useEffect(() => {
      // 1. Reset Chat with a System Ready Message
      setMessages([{
          id: Date.now().toString(),
          role: 'model',
          content: `Activo seleccionado: **${selectedSymbol}**.\n\nEl motor autónomo ha cargado los datos de mercado. Presiona enviar para ejecutar la estrategia **${currentStrategy.name}**.`,
          timestamp: Date.now(),
          isThinking: false
      }]);

      // 2. Pre-fill the input so the user just has to hit Enter
      setInput("Generar Análisis Integral");
      
  }, [selectedSymbol, currentStrategy]);

  const handleStrategyChange = (strategy: Strategy) => {
      if (strategy.id === currentStrategy.id) return;
      setCurrentStrategy(strategy);
      setShowStrategySelector(false);
  };

  const handleReset = () => {
    setIsLoading(false);
    setMessages([]);
    setInput("Generar Análisis Integral");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput(''); // Clear input after sending
    setIsLoading(true);

    let botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        content: '',
        timestamp: Date.now(),
        isThinking: true
    }]);

    try {
      const contextPromise = Promise.all([
          getMarketContextForAI(),
          getTechnicalAnalysis(selectedSymbol),
          getFearAndGreedIndex()
      ]);

      const [marketContext, techAnalysis, sentimentData] = await Promise.race([
          contextPromise,
          new Promise<any[]>((resolve) => setTimeout(() => resolve(["Contexto timeout", "Análisis técnico parcial", null]), 4000))
      ]);

      const sentimentString = sentimentData ? `Valor ${sentimentData.value}` : "N/A";
      const combinedContext = `${marketContext}\n${sentimentString}\n${techAnalysis}`;
      
      const stream = streamMarketAnalysis(userMsg.content, combinedContext, currentStrategy.systemInstruction);
      
      let botResponse = '';

      for await (const chunk of stream) {
          botResponse += chunk;
          setMessages(prev => prev.map(msg => 
              msg.id === botMsgId ? { ...msg, content: botResponse, isThinking: false } : msg
          ));
      }

    } catch (error) {
      setMessages(prev => prev.map(msg => 
          msg.id === botMsgId ? { ...msg, content: 'Error en motor matemático. Intente nuevamente.', isThinking: false } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface border border-border rounded-xl shadow-sm overflow-hidden relative">
      {/* Header with Strategy Selector & Status */}
      <div className="p-3 border-b border-border bg-background/50 backdrop-blur-sm z-20 flex justify-between items-center">
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
                <Bot size={16} className="text-accent" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wide">Asesor Autónomo</h2>
                {/* Status Indicator */}
                <div className="flex items-center gap-1 bg-success/10 px-1.5 rounded-full border border-success/20 ml-2">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                    </span>
                    <span className="text-[9px] font-mono text-success font-bold uppercase">Ready</span>
                </div>
            </div>
             <button 
                onClick={() => setShowStrategySelector(!showStrategySelector)}
                className="flex items-center gap-1.5 px-2 py-0.5 bg-surface border border-border rounded hover:bg-white/5 transition-colors w-fit"
            >
                <BookOpen size={10} className="text-secondary" />
                <span className="text-[10px] font-mono font-medium truncate max-w-[100px] md:max-w-none">{currentStrategy.name}</span>
                <ChevronDown size={10} className={`text-secondary transition-transform ${showStrategySelector ? 'rotate-180' : ''}`} />
            </button>
        </div>

        <button 
            onClick={handleReset} 
            title="Limpiar Chat"
            className="p-1.5 text-secondary hover:text-primary hover:bg-white/5 rounded transition-colors"
        >
            <RefreshCw size={14} />
        </button>
        
        {/* Dropdown for Strategy Selection */}
        {showStrategySelector && (
            <div className="absolute top-14 left-2 right-2 p-3 bg-surface border border-border rounded-lg shadow-xl z-30 animate-in fade-in slide-in-from-top-2">
                <h3 className="text-xs font-mono font-bold text-secondary mb-3 uppercase">Seleccionar Estrategia</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {STRATEGIES.map(strategy => (
                        <div 
                            key={strategy.id}
                            onClick={() => handleStrategyChange(strategy)}
                            className={`p-3 rounded border cursor-pointer transition-all ${
                                currentStrategy.id === strategy.id 
                                ? 'bg-accent/10 border-accent' 
                                : 'bg-background border-border hover:border-secondary'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-bold font-mono ${currentStrategy.id === strategy.id ? 'text-accent' : 'text-primary'}`}>
                                    {strategy.name}
                                </span>
                                {currentStrategy.id === strategy.id && <Check size={12} className="text-accent" />}
                            </div>
                            <p className="text-[10px] text-secondary mb-2 leading-relaxed">
                                {strategy.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-primary text-background' : 'bg-accent/10 text-accent border border-accent/20'
            }`}>
              {msg.role === 'user' ? <User size={12} /> : <Sparkles size={12} />}
            </div>
            
            <div className={`max-w-[95%] rounded p-3 text-xs leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-primary text-background' 
                : 'bg-surface border border-border text-primary'
            }`}>
              {msg.isThinking ? (
                  <div className="flex items-center gap-2 text-secondary py-1">
                      <Loader2 size={12} className="animate-spin" />
                      <span className="font-mono text-[10px]">Procesando datos macro y técnicos...</span>
                  </div>
              ) : (
                <div className="markdown-body font-mono whitespace-pre-wrap">
                  {msg.content}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-background">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Consulta sobre ${selectedSymbol}...`}
            className="flex-1 bg-surface border border-border rounded pl-3 pr-2 py-2 text-xs text-primary placeholder-secondary/50 focus:border-accent focus:outline-none font-mono transition-all disabled:opacity-50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-accent hover:bg-accentHover text-white rounded font-mono text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-accent/20 shrink-0"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <> <Send size={14} /> <span>Enviar</span> </>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;