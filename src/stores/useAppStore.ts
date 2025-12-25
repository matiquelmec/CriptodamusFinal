/**
 * Global App Store - Manejo de estado con Zustand
 * Store principal para toda la aplicación
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface Position {
  id: string;
  symbol: string;
  type: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPercent: number;
  openedAt: Date;
  status: 'open' | 'closed';
}

interface UserSettings {
  theme: 'dark' | 'light';
  language: 'es' | 'en';
  notifications: boolean;
  soundEnabled: boolean;
  autoTrade: boolean;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  defaultLeverage: number;
  favoriteSymbols: string[];
}

interface AppState {
  // User
  user: {
    id?: string;
    email?: string;
    plan: 'FREE' | 'TRIAL' | 'PRO';
    trialEndsAt?: Date;
    donationBadge?: string;
  };

  // Trading
  positions: Position[];
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;

  // Market
  selectedSymbol: string;
  watchlist: string[];
  marketStatus: 'open' | 'closed' | 'pre-market' | 'after-hours';

  // UI
  activeTab: string;
  isSidebarOpen: boolean;
  isLoading: boolean;
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: Date;
    read: boolean;
  }>;

  // Settings
  settings: UserSettings;

  // Actions
  setUser: (user: AppState['user']) => void;
  updateBalance: (balance: number) => void;
  addPosition: (position: Position) => void;
  closePosition: (positionId: string) => void;
  updatePosition: (positionId: string, updates: Partial<Position>) => void;
  setSelectedSymbol: (symbol: string) => void;
  toggleWatchlist: (symbol: string) => void;
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  resetStore: () => void;
}

const initialState = {
  user: {
    plan: 'FREE' as const,
  },
  positions: [],
  balance: 10000,
  equity: 10000,
  margin: 0,
  freeMargin: 10000,
  selectedSymbol: 'BTC',
  watchlist: ['BTC', 'ETH', 'SOL'],
  marketStatus: 'open' as const,
  activeTab: 'DASHBOARD',
  isSidebarOpen: true,
  isLoading: false,
  notifications: [],
  settings: {
    theme: 'dark' as const,
    language: 'es' as const,
    notifications: true,
    soundEnabled: true,
    autoTrade: false,
    riskLevel: 'moderate' as const,
    defaultLeverage: 10,
    favoriteSymbols: ['BTC', 'ETH'],
  },
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setUser: (user) => set({ user }),

        updateBalance: (balance) => set({
          balance,
          equity: balance + get().positions.reduce((acc, p) => acc + p.pnl, 0)
        }),

        addPosition: (position) => set((state) => ({
          positions: [...state.positions, position],
          margin: state.margin + (position.quantity * position.entryPrice) / state.settings.defaultLeverage,
          freeMargin: state.balance - state.margin
        })),

        closePosition: (positionId) => set((state) => {
          const position = state.positions.find(p => p.id === positionId);
          if (!position) return state;

          return {
            positions: state.positions.filter(p => p.id !== positionId),
            balance: state.balance + position.pnl,
            margin: state.margin - (position.quantity * position.entryPrice) / state.settings.defaultLeverage,
            freeMargin: state.balance - state.margin
          };
        }),

        updatePosition: (positionId, updates) => set((state) => ({
          positions: state.positions.map(p =>
            p.id === positionId ? { ...p, ...updates } : p
          )
        })),

        setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),

        toggleWatchlist: (symbol) => set((state) => ({
          watchlist: state.watchlist.includes(symbol)
            ? state.watchlist.filter(s => s !== symbol)
            : [...state.watchlist, symbol]
        })),

        setActiveTab: (activeTab) => set({ activeTab }),

        toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

        addNotification: (notification) => set((state) => ({
          notifications: [
            {
              ...notification,
              id: crypto.randomUUID(),
              timestamp: new Date(),
              read: false
            },
            ...state.notifications
          ].slice(0, 50) // Mantener máximo 50 notificaciones
        })),

        markNotificationRead: (id) => set((state) => ({
          notifications: state.notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          )
        })),

        clearNotifications: () => set({ notifications: [] }),

        updateSettings: (settings) => set((state) => ({
          settings: { ...state.settings, ...settings }
        })),

        resetStore: () => set(initialState)
      }),
      {
        name: 'criptodamus-store',
        partialize: (state) => ({
          user: state.user,
          watchlist: state.watchlist,
          settings: state.settings,
          favoriteSymbols: state.settings.favoriteSymbols
        })
      }
    )
  )
);