
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Zap, CalendarDays, BarChart, Newspaper, ShieldAlert } from 'lucide-react';
import MacroIndicators from './MacroIndicators';
import MacroStrip from './MacroStrip';
import SystemStatus from './SystemStatus';

const Layout: React.FC = () => {
    return (
        // Use 100dvh for better mobile browser support (address bar handling)
        <div className="h-[100dvh] bg-background text-primary font-sans selection:bg-accent/30 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex-shrink-0 z-50 sticky top-0">
                <div className="container mx-auto px-4 h-full flex items-center justify-between">
                    <NavLink to="/" className="flex items-center gap-3 group cursor-pointer">
                        {/* Criptodamus Logo - Creative Integration */}
                        <div className="relative h-12 w-48 flex items-center justify-start transition-all duration-300 group-hover:scale-105 group-hover:brightness-110">
                            {/* Glow effect behind the logo */}
                            <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                            <img
                                src="/logo.png"
                                alt="Criptodamus"
                                className="w-full h-full object-contain object-left relative z-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                            />
                        </div>
                    </NavLink>

                    {/* Macro Indicators - Desktop only */}
                    <div className="hidden lg:block">
                        <MacroIndicators />
                    </div>

                    {/* System Health Heartbeat - All Devices */}
                    <div className="ml-auto mr-4">
                        <SystemStatus />
                    </div>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-1 p-1 bg-surface border border-border rounded-lg">
                        <NavLink
                            to="/"
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${isActive ? 'bg-border text-white shadow-sm' : 'text-secondary hover:text-primary'
                                }`
                            }
                        >
                            <LayoutDashboard size={14} /> Terminal
                        </NavLink>
                        <NavLink
                            to="/oportunidades"
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${isActive ? 'bg-border text-white shadow-sm' : 'text-secondary hover:text-primary'
                                }`
                            }
                        >
                            <Zap size={14} /> Oportunidades
                        </NavLink>
                        <NavLink
                            to="/eventos"
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${isActive ? 'bg-border text-white shadow-sm' : 'text-secondary hover:text-primary'
                                }`
                            }
                        >
                            <CalendarDays size={14} /> Eventos
                        </NavLink>
                        <NavLink
                            to="/noticias"
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${isActive ? 'bg-border text-white shadow-sm' : 'text-secondary hover:text-primary'
                                }`
                            }
                        >
                            <Newspaper size={14} /> Noticias
                        </NavLink>
                        <NavLink
                            to="/sistema"
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${isActive ? 'bg-border text-white shadow-sm' : 'text-secondary hover:text-primary'
                                }`
                            }
                        >
                            <ShieldAlert size={14} /> Logs y Errores
                        </NavLink>
                    </nav>
                </div>
            </header>

            {/* Main Content Area */}
            {/* 
         On Mobile: overflow-y-auto allows the whole page content to scroll.
         pb-48 (192px) ensures extra space at the bottom so the last element isn't hidden behind the fixed bottom nav.
         On Desktop (lg): overflow-hidden keeps the layout rigid/dashboard-like if the page content handles scrolling (like dashboard), 
         but for general pages we might want auto.
         We will keep lg:overflow-hidden but allow pages to handle their scroll if needed, or wrap pages in containers.
      */}
            <main className="flex-1 overflow-y-auto lg:overflow-hidden p-4 container mx-auto pb-48 lg:pb-4">
                <Outlet />
            </main>

            {/* Macro Strip Footer - Hidden on mobile to save space, visible on desktop */}
            <div className="hidden lg:block">
                <MacroStrip />
            </div>

            {/* Mobile Nav - Fixed Bottom */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border flex justify-around p-3 pb-safe z-50 shadow-2xl">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 ${isActive ? 'text-accent' : 'text-secondary'}`
                    }
                >
                    <BarChart size={20} />
                    <span className="text-[10px] font-medium">Trade</span>
                </NavLink>
                <NavLink
                    to="/oportunidades"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 ${isActive ? 'text-accent' : 'text-secondary'}`
                    }
                >
                    <Zap size={20} />
                    <span className="text-[10px] font-medium">Radar</span>
                </NavLink>
                <NavLink
                    to="/eventos"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 ${isActive ? 'text-accent' : 'text-secondary'}`
                    }
                >
                    <CalendarDays size={20} />
                    <span className="text-[10px] font-medium">Eventos</span>
                </NavLink>
                <NavLink
                    to="/noticias"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 ${isActive ? 'text-accent' : 'text-secondary'}`
                    }
                >
                    <Newspaper size={20} />
                    <span className="text-[10px] font-medium">Noticias</span>
                </NavLink>
                <NavLink
                    to="/sistema"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 ${isActive ? 'text-accent' : 'text-secondary'}`
                    }
                >
                    <ShieldAlert size={20} />
                    <span className="text-[10px] font-medium">Logs</span>
                </NavLink>
            </nav>
        </div>
    );
};

export default Layout;
