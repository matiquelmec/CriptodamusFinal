-- 20260113_add_real_data.sql
-- Description: Adds tables for storing real-time liquidations and order book walls.

-- 1. Table: Liquidation Heatmap ("The Blood Collector")
CREATE TABLE IF NOT EXISTS public.liquidation_heatmap (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  symbol text NOT NULL,
  price double precision NOT NULL,
  volume double precision NOT NULL, -- USD Value of the liquidation
  side text NOT NULL, -- 'LONG_LIQ' (Price went down) or 'SHORT_LIQ' (Price went up)
  timestamp bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT liquidation_heatmap_pkey PRIMARY KEY (id)
);

-- Index for fast retrieval by symbol and time (Last 24h queries)
CREATE INDEX IF NOT EXISTS idx_liquidation_symbol_time ON public.liquidation_heatmap (symbol, timestamp DESC);

-- 2. Table: Orderbook Snapshots ("The Wall Historian")
CREATE TABLE IF NOT EXISTS public.orderbook_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  symbol text NOT NULL,
  wall_price double precision NOT NULL,
  wall_volume double precision NOT NULL,
  side text NOT NULL, -- 'BID' (Support) or 'ASK' (Resistance)
  strength integer NOT NULL, -- 0-100 Score
  timestamp bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT orderbook_snapshots_pkey PRIMARY KEY (id)
);

-- Index for finding recent walls
CREATE INDEX IF NOT EXISTS idx_obs_symbol_time ON public.orderbook_snapshots (symbol, timestamp DESC);

-- Comments for documentation
COMMENT ON TABLE public.liquidation_heatmap IS 'Stores real-time liquidation events from Binance Stream';
COMMENT ON TABLE public.orderbook_snapshots IS 'Stores large limit orders detected during scan intervals';
