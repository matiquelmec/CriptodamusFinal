import React from 'react';

const App: React.FC = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
            <div className="max-w-2xl text-center animate-fade-in">
                <h1 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-6 leading-tight">
                    Si quieres ganarle al mercado,<br />
                    necesitas un sistema inteligente y eficiente.
                </h1>
                <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded-full opacity-80"></div>
            </div>
        </div>
    );
};

export default App;
