
import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Clock, Hash, AlertTriangle } from 'lucide-react';

interface NewsItem {
    id: number;
    title: string;
    published_at: string;
    source: { title: string };
    url: string;
    currencies?: { code: string; title: string; slug: string }[];
}

const News: React.FC = () => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('ALL');

    const fetchNews = async () => {
        setLoading(true);
        try {
            const API_URL = import.meta.env.PROD
                ? 'https://criptodamusfinal.onrender.com'
                : 'http://localhost:3001';

            const response = await fetch(`${API_URL}/api/v1/market/news?currency=${filter === 'ALL' ? 'BTC' : filter}`);
            if (!response.ok) throw new Error('Error al cargar noticias');
            const data = await response.json();
            setNews(data);
            setError(null);
        } catch (err) {
            setError('No se pudo establecer conexión con el flujo de noticias.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
        const interval = setInterval(fetchNews, 60000 * 5); // Cada 5 minutos
        return () => clearInterval(interval);
    }, [filter]);

    return (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in">
            {/* Header Control */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-3">
                        <Newspaper className="text-accent" size={28} />
                        Terminal de Noticias Real-Time
                    </h1>
                    <p className="text-secondary text-sm">Flujo institucional directo de CryptoPanic & Criptodamus Intelligence</p>
                </div>

                <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border">
                    {['ALL', 'BTC', 'ETH', 'SOL'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === f ? 'bg-primary text-background shadow-lg' : 'text-secondary hover:text-primary'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* News Feed */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {loading && news.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent mb-4" />
                        <p className="text-secondary animate-pulse text-sm">Sincronizando con el flujo global...</p>
                    </div>
                ) : error ? (
                    <div className="bg-danger/10 border border-danger/20 p-6 rounded-xl flex items-center gap-4">
                        <AlertTriangle className="text-danger" size={32} />
                        <div>
                            <h3 className="text-danger font-bold">Error de Conexión</h3>
                            <p className="text-danger/80 text-sm">{error}</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 pb-24">
                        {news.map((item) => (
                            <div
                                key={item.id}
                                className="bg-surface border border-border hover:border-accent/40 rounded-xl p-5 transition-all group hover:shadow-xl hover:shadow-accent/5"
                            >
                                <div className="flex justify-between items-start gap-4 mb-3">
                                    <h2 className="text-lg font-bold text-primary leading-tight group-hover:text-accent transition-colors">
                                        {item.title}
                                    </h2>
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-background border border-border rounded-lg text-secondary hover:text-primary hover:border-accent transition-all flex-shrink-0"
                                    >
                                        <ExternalLink size={16} />
                                    </a>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-[10px] text-secondary font-bold uppercase tracking-wider">
                                    <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded border border-border">
                                        <Clock size={12} className="text-accent" />
                                        {item.published_at ? new Date(item.published_at).toLocaleString() : 'N/A'}
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-background px-2 py-1 rounded border border-border">
                                        <Hash size={12} className="text-accent" />
                                        {item.source?.title || 'Unknown Source'}
                                    </div>

                                    {item.currencies && item.currencies.length > 0 && (
                                        <div className="flex gap-2">
                                            {item.currencies.slice(0, 3).map(c => (
                                                <span key={c.code} className="text-accent border border-accent/20 px-2 py-1 rounded bg-accent/5">
                                                    #{c.code}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default News;
