import React from 'react';

const App: React.FC = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black px-4 font-mono">
            <div className="max-w-4xl text-center">
                <div className="mb-8 opacity-50 text-sm tracking-widest text-green-500 uppercase">
                    &lt; System Advisory /&gt;
                </div>

                <h1 className="text-2xl md:text-4xl font-bold text-white mb-10 leading-snug">
                    Si quieres hackear el sistema financiero, no necesitas predecir el mercado; <br />
                    <span className="text-green-400">necesitas gestionar bien el riesgo y saber reaccionar a tiempo.</span>
                </h1>

                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                    Un sistema autónomo, inteligente y eficiente utiliza nodos para descentralizar la ventaja.
                </p>

                <div className="mt-12 flex justify-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse delay-150"></div>
                </div>
            </div>
        </div>
    );
};

export default App;
