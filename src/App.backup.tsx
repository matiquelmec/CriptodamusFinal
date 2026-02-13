
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import News from './pages/News';
import Calendar from './pages/Calendar';
import SystemLogs from './pages/SystemLogs';
import DebugDB from './pages/DebugDB';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="oportunidades" element={<Opportunities />} />
          <Route path="noticias" element={<News />} />
          <Route path="eventos" element={<Calendar />} />
          <Route path="sistema" element={<SystemLogs />} />
          <Route path="debug-db" element={<DebugDB />} />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
