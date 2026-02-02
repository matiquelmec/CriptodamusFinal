-- ═══════════════════════════════════════════════════════════
-- PAU PERDICES: Portfolio Balance & Drawdown Tracking
-- ═══════════════════════════════════════════════════════════
-- Tracking de balance del portafolio y drawdown para dynamic position sizing

CREATE TABLE IF NOT EXISTS public.portfolio_metrics (
    id BIGSERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    current_balance DECIMAL(12, 2) NOT NULL,
    peak_balance DECIMAL(12, 2) NOT NULL,
    current_drawdown_pct DECIMAL(5, 2) NOT NULL, -- e.g., 7.50%
    risk_multiplier DECIMAL(4, 3) NOT NULL -- e.g., 0.500 (50%)
);

COMMENT ON TABLE public.portfolio_metrics IS 
'Tracking de balance del portafolio y drawdown para dynamic position sizing (Pau Perdices Method).
Permite calcular DD% actual y ajustar risk per trade automáticamente.';

COMMENT ON COLUMN public.portfolio_metrics.current_balance IS 
'Balance actual calculado: Initial Balance + Σ(PnL de todos los trades cerrados)';

COMMENT ON COLUMN public.portfolio_metrics.peak_balance IS 
'Balance máximo alcanzado (peak) - usado para calcular DD%';

COMMENT ON COLUMN public.portfolio_metrics.current_drawdown_pct IS 
'Drawdown actual: ((Peak - Current) / Peak) × 100';

COMMENT ON COLUMN public.portfolio_metrics.risk_multiplier IS 
'Multiplicador de riesgo aplicado según tabla Pau:
- 0-3% DD → 1.00 (100% risk)
- 3-5% DD → 0.75 (75% risk)
- 5-8% DD → 0.50 (50% risk)
- 8-10% DD → 0.25 (25% risk)
- >10% DD → 0.00 (STOP trading)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_timestamp 
ON public.portfolio_metrics(timestamp DESC);

-- View: Latest Portfolio Metrics
CREATE OR REPLACE VIEW v_current_portfolio AS
SELECT 
    current_balance,
    peak_balance,
    current_drawdown_pct,
    risk_multiplier,
    TO_TIMESTAMP(timestamp / 1000) as last_updated,
    CASE 
        WHEN current_drawdown_pct >= 10 THEN '🛑 STOPPED'
        WHEN current_drawdown_pct >= 8 THEN '⚠️ MINIMAL (25%)'
        WHEN current_drawdown_pct >= 5 THEN '⚠️ REDUCED (50%)'
        WHEN current_drawdown_pct >= 3 THEN '⚠️ CAUTION (75%)'
        ELSE '✅ NORMAL (100%)'
    END as risk_status
FROM public.portfolio_metrics
ORDER BY timestamp DESC
LIMIT 1;

COMMENT ON VIEW v_current_portfolio IS 
'Vista rápida del estado actual del portafolio con risk status visual';
