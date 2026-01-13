-- Add columns for Professional Monitoring (Trader Grade)

ALTER TABLE public.signals_audit 
ADD COLUMN IF NOT EXISTS stage SMALLINT DEFAULT 0, -- 0=Entry, 1=TP1, 2=TP2, 3=TP3
ADD COLUMN IF NOT EXISTS activation_price FLOAT8, -- The REAL price where entry happened (includes slippage)
ADD COLUMN IF NOT EXISTS fees_paid FLOAT8 DEFAULT 0, -- Accumulated fees in USD equivalent (or %)
ADD COLUMN IF NOT EXISTS realized_pnl_percent FLOAT8 DEFAULT 0, -- PnL locked in so far
ADD COLUMN IF NOT EXISTS max_price_reached FLOAT8; -- For trailing stop logic (High Water Mark)

-- Comment on columns
COMMENT ON COLUMN public.signals_audit.stage IS 'Current Trade Stage: 0 (Open), 1 (TP1 Hit / BE), 2 (TP2 Hit), 3 (TP3 Hit)';
COMMENT ON COLUMN public.signals_audit.activation_price IS 'Actual execution price including slippage';
COMMENT ON COLUMN public.signals_audit.fees_paid IS 'Estimated fees paid (0.1% roundtrip approximation)';
