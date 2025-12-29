import React, { useState, useEffect } from 'react';
import { Calculator, AlertTriangle, CheckCircle } from 'lucide-react';

const RiskCalculator: React.FC = () => {
  const [accountBalance, setAccountBalance] = useState<number>(1000);
  const [riskPercentage, setRiskPercentage] = useState<number>(1);
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [stopLossPrice, setStopLossPrice] = useState<number>(0);
  const [positionSize, setPositionSize] = useState<number>(0);
  const [leverage, setLeverage] = useState<number>(1);
  const [riskAmount, setRiskAmount] = useState<number>(0);

  useEffect(() => {
    // Core logic from PDF: Position Size = (Account Balance * Risk %) / Distance to SL
    if (entryPrice > 0 && stopLossPrice > 0 && accountBalance > 0) {
      const riskAmt = accountBalance * (riskPercentage / 100);
      setRiskAmount(riskAmt);

      const priceDiffPercent = Math.abs((entryPrice - stopLossPrice) / entryPrice);

      if (priceDiffPercent > 0) {
        // Total value of the position (Not margin, but total exposure)
        const posSizeUSDT = riskAmt / priceDiffPercent;
        setPositionSize(posSizeUSDT);
      }
    }
  }, [accountBalance, riskPercentage, entryPrice, stopLossPrice]);

  return (
    <div className="h-full p-6 bg-surface border border-border rounded-xl shadow-sm">
      <div className="flex items-center gap-2 mb-6 text-primary">
        <Calculator size={20} className="text-accent" />
        <h2 className="text-lg font-mono font-semibold tracking-tight">Gestión de Riesgo & Posición</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label htmlFor="risk-account-balance" className="block text-xs font-mono text-secondary mb-1">Balance de Cuenta (USDT)</label>
            <input
              id="risk-account-balance"
              name="accountBalance"
              type="number"
              value={accountBalance}
              onChange={(e) => setAccountBalance(Number(e.target.value))}
              className="w-full bg-background border border-border rounded p-2 text-primary focus:border-accent focus:outline-none font-mono"
            />
          </div>

          <div>
            <label htmlFor="risk-percentage" className="block text-xs font-mono text-secondary mb-1">
              Riesgo por Trade (%) <span className="text-xs text-accent">(Recomendado: 1-2%)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="risk-percentage"
                name="riskPercentage"
                type="range"
                min="0.5"
                max="5"
                step="0.1"
                value={riskPercentage}
                onChange={(e) => setRiskPercentage(Number(e.target.value))}
                className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="font-mono w-12 text-right">{riskPercentage}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="risk-entry-price" className="block text-xs font-mono text-secondary mb-1">Precio Entrada</label>
              <input
                id="risk-entry-price"
                name="entryPrice"
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full bg-background border border-border rounded p-2 text-primary focus:border-accent focus:outline-none font-mono"
              />
            </div>
            <div>
              <label htmlFor="risk-stop-loss" className="block text-xs font-mono text-secondary mb-1">Stop Loss</label>
              <input
                id="risk-stop-loss"
                name="stopLoss"
                type="number"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(Number(e.target.value))}
                className="w-full bg-background border border-border rounded p-2 text-primary focus:border-danger focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-background rounded-xl p-6 border border-border flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertTriangle size={100} />
          </div>

          <div className="space-y-6 relative z-10">
            <div>
              <p className="text-xs text-secondary font-mono">Pérdida Máxima Aceptable</p>
              <p className="text-2xl font-mono text-danger font-bold">-${riskAmount.toFixed(2)}</p>
            </div>

            <div className="h-px bg-border w-full"></div>

            <div>
              <p className="text-xs text-secondary font-mono mb-1">Tamaño de Posición Total (Margin x Lev)</p>
              <p className="text-3xl font-mono text-primary font-bold tracking-tighter">
                {positionSize > 0 ? `$${positionSize.toFixed(2)}` : '$0.00'}
              </p>
              <p className="text-xs text-secondary mt-2">
                Este es el volumen total que debes comprar/vender para que, si toca el Stop Loss, pierdas exactamente ${riskAmount.toFixed(2)}.
              </p>
            </div>

            {riskPercentage > 3 && (
              <div className="flex items-start gap-2 bg-danger/10 p-3 rounded border border-danger/20">
                <AlertTriangle size={16} className="text-danger mt-0.5" />
                <p className="text-xs text-danger">
                  ¡Advertencia! Un riesgo superior al 3% viola las Reglas de Oro del sistema. Considera reducir el riesgo.
                </p>
              </div>
            )}
            {riskPercentage <= 2 && riskPercentage > 0 && (
              <div className="flex items-start gap-2 bg-success/10 p-3 rounded border border-success/20">
                <CheckCircle size={16} className="text-success mt-0.5" />
                <p className="text-xs text-success">
                  Gestión de riesgo aprobada por el sistema institucional.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskCalculator;
