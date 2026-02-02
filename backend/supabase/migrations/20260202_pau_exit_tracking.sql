-- ═══════════════════════════════════════════════════════════
-- PAU PERDICES: Exit Tracking Migration
-- ═══════════════════════════════════════════════════════════
-- Añade tracking de razón de salida para analytics

-- Add exit reason column
ALTER TABLE public.signals_audit
ADD COLUMN IF NOT EXISTS exit_reason TEXT;

COMMENT ON COLUMN public.signals_audit.exit_reason IS 
'Razón de cierre del trade:
- STOP_LOSS: SL técnico (ATR × 1.5)
- TP1/TP2/TP3: Take profit targets
- REGULAR_BEARISH_DIV: Divergencia bearish (reversión)
- REGULAR_BULLISH_DIV: Divergencia bullish (reversión SHORT)
- MOMENTUM_EXHAUSTED: RSI >70/<30 sin movimiento
- TRAILING_STOP: Trailing stop (ATR × 1.0 desde máximo)
- MAX_TIME_FLAT: Cerrado por tiempo (>12h, FLAT)
- BREAKEVEN: Smart breakeven (después de TP1)
- EXPIRED: Señal PENDING no ejecutada';

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_signals_exit_reason 
ON public.signals_audit(exit_reason) 
WHERE exit_reason IS NOT NULL;

-- Analytics view: Exit reasons by frequency
CREATE OR REPLACE VIEW v_exit_reasons_stats AS
SELECT 
    exit_reason,
    COUNT(*) as total_signals,
    AVG(pnl_percent) as avg_pnl,
    COUNT(*) FILTER (WHERE pnl_percent > 0) as profitable,
    (COUNT(*) FILTER (WHERE pnl_percent > 0)::float / COUNT(*)::float * 100) as win_rate
FROM public.signals_audit
WHERE exit_reason IS NOT NULL
  AND status IN ('WIN', 'LOSS', 'BREAKEVEN')
GROUP BY exit_reason
ORDER BY total_signals DESC;

COMMENT ON VIEW v_exit_reasons_stats IS 
'Analytics de razones de salida: cuáles son más rentables';
