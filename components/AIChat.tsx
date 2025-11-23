import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Key, BookOpen, ChevronDown, Check, Info } from 'lucide-react';
import { streamMarketAnalysis, initializeGemini, resetSession } from '../services/geminiService';
import { ChatMessage, Strategy } from '../types';
import { getMarketContextForAI, getTechnicalAnalysis, getFearAndGreedIndex } from '../services/cryptoService';
import { STRATEGIES } from '../services/strategyContext';

interface AIChatProps {
    selectedSymbol: string;
}

const AIChat: React.FC<AIChatProps> = ({ selectedSymbol }) => {
  const [currentStrategy, setCurrentStrategy] = useState<Strategy>(STRATEGIES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Sistema conectado. Estrategia activa: **${STRATEGIES[0].name}**. Selecciona un activo para comenzar.`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [showStrategySelector, setShowStrategySelector] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const envKey = process.env.API_KEY;
    if (envKey) {
        initializeGemini(envKey);
        setHasKey(true);
    }
  }, []);

  useEffect(() => {
      if (selectedSymbol) {
          setInput(`Analiza ${selectedSymbol} usando la estrategia actual.`);
      }
  }, [selectedSymbol]);

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim().length > 0) {
        initializeGemini(apiKey);
        setHasKey(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStrategyChange = (strategy: Strategy) => {
      if (strategy.id === currentStrategy.id) return;
      
      setCurrentStrategy(strategy);
      resetSession(); // Reset AI memory context
      setMessages([
          {
              id: Date.now().toString(),
              role: 'model',
              content: `Estrategia cambiada a: **${strategy.name}**.\n\n${strategy.description}`,
              timestamp: Date.now()
          }
      ]);
      setShowStrategySelector(false);
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
    setInput('');
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
      // Parallel data fetching for speed
      const [marketContext, techAnalysis, sentimentData] = await Promise.all([
          getMarketContextForAI(),
          getTechnicalAnalysis(selectedSymbol),
          getFearAndGreedIndex()
      ]);

      const sentimentString = sentimentData 
        ? `SENTIMIENTO MACRO (Fear & Greed Index): Valor ${sentimentData.value} (${sentimentData.value_classification}).` 
        : "SENTIMIENTO MACRO: No disponible.";

      const combinedContext = `
${marketContext}

${sentimentString}

${techAnalysis}

INSTRUCCIÓN CRÍTICA: El usuario está viendo el gráfico de ${selectedSymbol}.
1. CONSULTA EL CALENDARIO ECONÓMICO DE HOY (Google Search) para verificar eventos de alto impacto.
2. Usa los "DATOS TÉCNICOS CALCULADOS" (Especialmente RVOL y Soportes) como TU VERDAD ABSOLUTA.
No alucines patrones que no estén respaldados por los números provistos.
      `.trim();
      
      const stream = streamMarketAnalysis(userMsg.content, combinedContext, currentStrategy.systemInstruction);
      
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
          msg.id === botMsgId ? { ...msg, content: 'Error: No pude obtener los datos de análisis técnico o realizar la búsqueda. Verifica tu conexión.', isThinking: false } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasKey) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-8 bg-surface border border-border rounded-xl">
              <div className="bg-background p-4 rounded-full mb-4 border border-border">
                  <Key className="text-accent" size={32} />
              </div>
              <h2 className="text-xl font-mono font-bold text-primary mb-2">Autenticación</h2>
              <p className="text-secondary text-center mb-6 max-w-md text-sm">
                  Ingresa tu API Key de Google Gemini para activar el Asesor.
              </p>
              <form onSubmit={handleKeySubmit} className="w-full max-w-sm flex gap-2">
                  <input 
                    type="password" 
                    placeholder="API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1 bg-background border border-border rounded px-3 py-2 text-primary focus:border-accent outline-none font-mono text-xs"
                  />
                  <button type="submit" className="bg-accent text-white px-4 py-2 rounded font-mono text-xs">
                      Entrar
                  </button>
              </form>
          </div>
      )
  }

  return (
    <div className="h-full flex flex-col bg-surface border border-border rounded-xl shadow-sm overflow-hidden relative">
      {/* Header with Strategy Selector */}
      <div className="p-3 border-b border-border bg-background/50 backdrop-blur-sm z-20">
        <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
                <Bot size={16} className="text-accent" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wide">Asesor IA</h2>
            </div>
             <button 
                onClick={() => setShowStrategySelector(!showStrategySelector)}
                className="flex items-center gap-1.5 px-2 py-1 bg-surface border border-border rounded hover:bg-white/5 transition-colors"
            >
                <BookOpen size={10} className="text-secondary" />
                <span className="text-[10px] font-mono font-medium truncate max-w-[100px] md:max-w-none">{currentStrategy.name}</span>
                <ChevronDown size={10} className={`text-secondary transition-transform ${showStrategySelector ? 'rotate-180' : ''}`} />
            </button>
        </div>
        
        {/* Dropdown for Strategy Selection */}
        {showStrategySelector && (
            <div className="absolute top-12 left-0 right-0 mx-2 p-3 bg-surface border border-border rounded-lg shadow-xl z-30 animate-in fade-in slide-in-from-top-2">
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
                            
                            {/* Strategy Details Badge Grid */}
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-border/50">
                                <div>
                                    <span className="text-[9px] text-secondary uppercase block mb-0.5">Riesgo</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        strategy.riskProfile === 'Conservador' ? 'bg-success/10 text-success' : 
                                        strategy.riskProfile === 'Agresivo' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                                    }`}>
                                        {strategy.riskProfile}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[9px] text-secondary uppercase block mb-0.5">Timeframe</span>
                                    <span className="text-[10px] font-mono text-primary bg-background px-1.5 py-0.5 rounded border border-border">
                                        {strategy.timeframe}
                                    </span>
                                </div>
                            </div>

                             {/* Expanded Details */}
                             <div className="mt-2 space-y-1">
                                <div className="flex gap-1 items-start">
                                    <Info size={8} className="text-secondary mt-0.5" />
                                    <p className="text-[9px] text-secondary/80">
                                        <span className="font-bold text-secondary">Entrada:</span> {strategy.details.entryCriteria}
                                    </p>
                                </div>
                                <div className="flex gap-1 items-start">
                                    <Info size={8} className="text-secondary mt-0.5" />
                                    <p className="text-[9px] text-secondary/80">
                                        <span className="font-bold text-secondary">Gestión:</span> {strategy.details.riskManagement}
                                    </p>
                                </div>
                             </div>
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
            
            <div className={`max-w-[90%] rounded p-2 text-xs leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-primary text-background' 
                : 'bg-background border border-border text-primary'
            }`}>
              {msg.isThinking ? (
                  <div className="flex items-center gap-2 text-secondary">
                      <Loader2 size={12} className="animate-spin" />
                      <span className="font-mono text-[10px]">Analizando estructura, noticias y volumen...</span>
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
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Consultar al Agente...`}
            className="w-full bg-surface border border-border rounded pl-3 pr-10 py-2 text-xs text-primary placeholder-secondary/50 focus:border-accent focus:outline-none font-mono transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-accent hover:text-white hover:bg-accent rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;