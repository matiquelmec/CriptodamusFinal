/**
 * TRADING CONFIGURATION CENTER
 * 
 * Central source of truth for all "magic numbers", asset lists, and thresholds.
 * This file is designed to be easily adjustable by humans or AI agents.
 * 
 * NOTE: API KEYS MUST NOT BE HERE. USE .env FOR SECRETS.
 */

export const TradingConfig = {
    // --- ASSET MANAGEMENT ---
    assets: {
        tiers: {
            s_tier: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
            a_tier_bluechips: ['XRPUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT', 'TRXUSDT', 'TONUSDT', 'SUIUSDT', 'APTUSDT'],
            c_tier_patterns: ['PEPE', 'DOGE', 'SHIB', 'BONK', 'WIF', 'FLOKI', '1000SATS', 'ORDI', 'MEME', 'LUNA', 'LUNC'],
            ignored_symbols: ['USDCUSDT', 'FDUSDUSDT', 'USDPUSDT', 'TUSDUSDT', 'BUSDUSDT', 'DAIUSDT', 'EURUSDT']
        },
        // Explicit additional meme symbols if needed beyond pattern matching
        meme_list: [
            'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'BONKUSDT', 'WIFUSDT', 'FLOKIUSDT',
            'BOMEUSDT', 'MEMEUSDT', 'MYROUSDT', '1000SATSUSDT', 'ORDIUSDT'
        ],
        websocket: {
            max_streams: 10,
            safe_symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT']
        }
    },

    // --- RISK ENGINES ---
    risk: {
        whale_volume_ratio: 3.5, // Volume > 3.5x average triggers whale alert
        volatility_threshold_multiplier: 3.0, // Range > 3x average range triggers volatility alert
        max_slippage: 0.02,
        max_leverage_default: 20
    },

    // --- SCORING MATRIX ---
    scoring: {
        min_score_entry: 65, // RAISED: Quality over Quantity (World Class Standard)
        god_mode_threshold: 90,
        weights: {
            // Trend Following
            ema_alignment_bullish: 15,
            ema_alignment_bearish: 15,

            // Momentum
            rsi_oversold: 10,
            rsi_overbought: 10,
            rsi_divergence: 20, // High value signal

            // Volume / Institutional
            volume_spike: 10,
            order_block_retest: 15,
            liquidation_flutter: 10,

            // Patterns
            chart_pattern_breakout: 15,
            golden_ticket_pattern: 25, // Instant high conviction

            // Strategic Overrides
            freeze_protocol_boost: 25 // Centralized Weight for Freeze
        },
        // NEW: Advisor Specific Weights (0-10 Scale)
        advisor: {
            hidden_divergence: 5, // Holy Grail
            sfp_sweep: 4,         // High Prob
            order_block_retest: 2.5,
            volume_absorption: 4,
            fractal_alignment: 3,
            z_score_extreme: 4,
            pinball_setup: 3.5
        }
    },
    // NEW: Strategy Dynamic Weights (Regime Matrix)
    strategy_matrix: {
        TRENDING: {
            ichimoku_dragon: 0.40,
            breakout_momentum: 0.30,
            smc_liquidity: 0.20,
            quant_volatility: 0.10,
            mean_reversion: 0.00,
            meme_hunter: 0.00,
            divergence_hunter: 0.00
        },
        RANGING: {
            mean_reversion: 0.50,
            smc_liquidity: 0.30,
            quant_volatility: 0.20,
            ichimoku_dragon: 0.00,
            breakout_momentum: 0.00,
            meme_hunter: 0.00,
            divergence_hunter: 0.00
        },
        VOLATILE: {
            quant_volatility: 0.50,
            breakout_momentum: 0.30,
            meme_hunter: 0.20,
            smc_liquidity: 0.00,
            ichimoku_dragon: 0.00,
            mean_reversion: 0.00,
            divergence_hunter: 0.00
        },
        EXTREME: {
            divergence_hunter: 0.50,
            smc_liquidity: 0.30,
            mean_reversion: 0.20,
            ichimoku_dragon: 0.00,
            breakout_momentum: 0.00,
            quant_volatility: 0.00,
            meme_hunter: 0.00
        }
    },

    // --- INDICATOR CONSTANTS ---
    indicators: {
        rsi: {
            period: 14,
            overbought: 70,
            oversold: 30
        },
        macd: {
            fast: 12,
            slow: 26,
            signal: 9
        },
        bollinger: {
            period: 20,
            std_dev: 2
        },
        fractals: {
            period: 5
        }
    }
} as const;

export type TierLevel = 'S' | 'A' | 'B' | 'C';
