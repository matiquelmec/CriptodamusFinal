import React, { useState, useEffect } from 'react';
import { Coffee, Pizza, Rocket, Diamond, X, Heart } from 'lucide-react';
import { API_CONFIG } from '../services/config';

interface DonationWidgetProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export const DonationWidget: React.FC<DonationWidgetProps> = ({
  isVisible = false,
  onClose
}) => {
  const [showDonation, setShowDonation] = useState(isVisible);
  const [selectedAmount, setSelectedAmount] = useState(5000);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-show después de 5 minutos de uso (solo una vez)
  useEffect(() => {
    const hasShown = localStorage.getItem('donation_widget_shown');
    if (!hasShown) {
      const timer = setTimeout(() => {
        setShowDonation(true);
        localStorage.setItem('donation_widget_shown', 'true');
      }, 5 * 60 * 1000); // 5 minutos

      return () => clearTimeout(timer);
    }
  }, []);

  const donationLevels = [
    {
      icon: Coffee,
      amount: API_CONFIG.PLANS.DONATIONS.COFFEE.amount,
      name: 'Café',
      badge: API_CONFIG.PLANS.DONATIONS.COFFEE.badge,
      color: 'from-amber-600 to-orange-600',
      description: 'Me compraste un café ☕'
    },
    {
      icon: Pizza,
      amount: API_CONFIG.PLANS.DONATIONS.PIZZA.amount,
      name: 'Pizza',
      badge: API_CONFIG.PLANS.DONATIONS.PIZZA.badge,
      color: 'from-red-600 to-pink-600',
      description: 'Una pizza para programar 🍕'
    },
    {
      icon: Rocket,
      amount: API_CONFIG.PLANS.DONATIONS.ROCKET.amount,
      name: 'Rocket',
      badge: API_CONFIG.PLANS.DONATIONS.ROCKET.badge,
      color: 'from-blue-600 to-indigo-600',
      description: 'Combustible para la nave 🚀'
    },
    {
      icon: Diamond,
      amount: API_CONFIG.PLANS.DONATIONS.DIAMOND.amount,
      name: 'Diamond',
      badge: API_CONFIG.PLANS.DONATIONS.DIAMOND.badge,
      color: 'from-purple-600 to-violet-600',
      description: 'Eres increíble! 💎'
    }
  ];

  const processDonation = async (amount: number) => {
    setIsProcessing(true);

    try {
      // Analytics
      if (window.gtag) {
        window.gtag('event', 'donation_initiated', {
          value: amount,
          currency: 'CLP'
        });
      }

      // Crear preferencia de MercadoPago
      const response = await fetch('/api/donation/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          description: `Donación Criptodamus - ${donationLevels.find(l => l.amount === amount)?.name || 'Custom'}`,
          external_reference: `donation_${Date.now()}`,
        })
      });

      if (!response.ok) {
        throw new Error('Error creando preferencia de pago');
      }

      const { init_point } = await response.json();

      // Redirect a MercadoPago
      window.location.href = init_point;

    } catch (error) {
      console.error('Error procesando donación:', error);
      alert('Error procesando la donación. Intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setShowDonation(false);
    onClose?.();
  };

  if (!showDonation) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full relative border border-gray-700 shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
            <Heart className="w-8 h-8 text-white" fill="currentColor" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            ¿Te ha ayudado Criptodamus?
          </h2>
          <p className="text-gray-300 text-sm">
            Este proyecto es 100% gratuito. Si te ha sido útil para ganar dinero,
            considera apoyar el desarrollo con una pequeña donación.
          </p>
        </div>

        {/* Donation levels */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {donationLevels.map((level) => {
            const isSelected = selectedAmount === level.amount;
            return (
              <button
                key={level.amount}
                onClick={() => setSelectedAmount(level.amount)}
                className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                  isSelected
                    ? 'border-purple-500 bg-purple-500/20 scale-105'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                }`}
              >
                <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r ${level.color} flex items-center justify-center`}>
                  <level.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-white font-bold text-sm mb-1">{level.name}</div>
                <div className="text-purple-400 font-bold text-xs">
                  ${level.amount.toLocaleString('es-CL')}
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {level.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">
            O elige un monto personalizado:
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(Number(e.target.value))}
              className="w-full pl-8 pr-12 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
              placeholder="5000"
              min="1000"
              max="100000"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">CLP</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => processDonation(selectedAmount)}
            disabled={isProcessing || selectedAmount < 1000}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all transform active:scale-95"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </div>
            ) : (
              `Donar $${selectedAmount.toLocaleString('es-CL')} CLP`
            )}
          </button>

          <button
            onClick={handleClose}
            className="w-full py-2 text-gray-400 hover:text-white transition text-sm"
          >
            Tal vez en otra ocasión
          </button>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <span>🔒</span>
            Pago seguro via MercadoPago
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente del botón flotante
export const DonationFloatingButton: React.FC = () => {
  const [showWidget, setShowWidget] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowWidget(true)}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white shadow-lg hover:scale-110 hover:shadow-2xl transition-all transform z-40 group"
        title="Apoya el proyecto ❤️"
      >
        <Coffee size={24} />
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />

        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          ¿Te gusta? Apóyanos ☕
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      </button>

      <DonationWidget
        isVisible={showWidget}
        onClose={() => setShowWidget(false)}
      />
    </>
  );
};

export default DonationWidget;