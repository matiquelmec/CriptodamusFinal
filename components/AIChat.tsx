
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, RefreshCw, Shield } from 'lucide-react';
import { streamMarketAnalysis } from '../services/geminiService';
import { ChatMessage } from '../types';
import { getMarketContextForAI, getRawTechnicalIndicators, getFearAndGreedIndex, getMarketRisk, getMacroContext } from '../services/cryptoService';

interface AIChatProps {
  selectedSymbol: string;
}

const AIChat: React.FC<AIChatProps> = ({ selectedSymbol }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // PREPARE INPUT ON SYMBOL CHANGE (NO AUTO-FIRE)
  useEffect(() => {
    // Reset Chat with Autonomous System Message
    setMessages([{
      id: Date.now().toString(),
      role: 'model',
      content: `### 🤖 Asesor Autónomo Institucional\n\n**Activo Seleccionado:** ${selectedSymbol}\n\nAnalizo el mercado con estrategia **SMC (Smart Money Concepts)** - enfoque institucional que detecta barridos de liquidez, Order Blocks y Fair Value Gaps.\n\nEl sistema detecta automáticamente el régimen de mercado (TRENDING, RANGING, VOLATILE, EXTREME) y ajusta el análisis según las condiciones macro.\n\n**Para comenzar:** Haz clic en **Enviar** para generar un análisis integral con plan DCA institucional.`,
      timestamp: Date.now(),
      isThinking: false
    }]);

    // Pre-fill the input
    setInput("Generar Análisis Integral");

  }, [selectedSymbol]);

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
      // UPGRADE: Fetch RAW data objects, not just strings
      // Also fetch Market Risk for the advisor
      const contextPromise = Promise.all([
        getMarketContextForAI(),
        getMacroContext(), // NEW: Structured macro data
        getRawTechnicalIndicators(selectedSymbol), // New robust function
        getFearAndGreedIndex(),
        getMarketRisk() // New Risk Fetch
      ]);

      const [marketContext, macroContext, techData, sentimentData, riskProfile] = await Promise.race([
        contextPromise,
        new Promise<any[]>((resolve) => setTimeout(() => resolve(["Contexto timeout", null, null, null, { level: 'LOW' }]), 4000))
      ]);

      const sentimentString = sentimentData ? `Fear & Greed: ${sentimentData.value}` : "Sentiment N/A";
      const combinedContextString = `${marketContext}\n${sentimentString}`;

      // Pass structured data + SMC Strategy ID (fixed)
      const stream = streamMarketAnalysis(
        userMsg.content,
        combinedContextString,
        macroContext, // NEW: Structured macro data
        techData, // Passing the object directly
        'smc_liquidity', // FIXED: Always use SMC Institutional
        riskProfile || { level: 'LOW', note: '' }
      );

      let botResponse = '';

      for await (const chunk of stream) {
        botResponse += chunk;
        setMessages(prev => prev.map(msg =>
          msg.id === botMsgId ? { ...msg, content: botResponse, isThinking: false } : msg
        ));
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg =>
        msg.id === botMsgId ? { ...msg, content: 'Error crítico en motor matemático. Los datos del mercado no son accesibles.', isThinking: false } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface border border-border rounded-xl shadow-sm overflow-hidden relative">
      {/* Header - Simplified */}
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
          {/* Fixed Strategy Display */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded w-fit">
            <Shield size={10} className="text-blue-400" />
            <span className="text-[10px] font-mono font-medium text-blue-400">SMC Institucional</span>
          </div>
        </div>

        <button
          onClick={handleReset}
          title="Limpiar Chat"
          className="p-1.5 text-secondary hover:text-primary hover:bg-white/5 rounded transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary text-background' : 'bg-accent/10 text-accent border border-accent/20'
              }`}>
              {msg.role === 'user' ? <User size={12} /> : <Sparkles size={12} />}
            </div>

            <div className={`max-w-[95%] rounded p-3 text-xs leading-relaxed shadow-sm ${msg.role === 'user'
              ? 'bg-primary text-background'
              : 'bg-surface border border-border text-primary'
              }`}>
              {msg.isThinking ? (
                <div className="flex items-center gap-2 text-secondary py-1">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="font-mono text-[10px]">Detectando régimen de mercado y analizando confluencias...</span>
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
            placeholder={`Analizar ${selectedSymbol} con SMC institucional...`}
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