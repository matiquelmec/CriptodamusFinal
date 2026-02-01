/**
 * TRADING CONFIGURATION CENTER
 * 
 * Central source of truth for all "magic numbers", asset lists, and thresholds.
 * This file is designed to be easily adjustable by humans or AI agents.
 * 
 * NOTE: API KEYS MUST NOT BE HERE. USE .env FOR SECRETS.
 */

export const TradingConfig = {
    // --- SYSTEM MODE ---
    TOURNAMENT_MODE: true, // Master Switch: 'Elite 9' + 'Nuclear Shield' + 'MTF Logic'

    // --- ASSET MANAGEMENT ---
    assets: {
        // The Elite 9 for the Tournament
        tournament_list: [
            'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT',
            'XRPUSDT', 'DOGEUSDT', 'PAXGUSDT', 'NEARUSDT', 'SUIUSDT'
        ],
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
        min_score_entry: 55, // ADJUSTED: Tuned down from 65 for ranging conditions
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
            pinball_setup: 3.5,
            // NEW CENTRALIZED WEIGHTS (Audit Remediation)
            trend_ema200: 2,
            trend_slope_boost: 1,
            trend_ema_cross: 1,
            vwap_position: 1.5,
            momentum_macd: 1.5,
            momentum_rsi: 1,
            stoch_cross_extreme: 2,
            bollinger_zone: 1,
            contrarian_sentiment: 3, // Euphoria/Capitulation
            liquidation_cascade: 4,
            fvg_proximity: 2,
            value_area_deviation: 1.5,
            harmonic_pattern: 4,
            rsi_trendline_break: 3,
            funding_rate_extreme: 3,
            coinbase_premium: 4, // Institutional Trust
            ttm_squeeze_bias: 2,
            fractal_tie_breaker: 3
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
    },
    // --- PAU PERDICES (GOLD MASTER) CONFIG ---
    pauStrategy: {
        asset: 'PAXGUSDT', // Use PAXG as crypto-proxy for Gold (Binance Spot)
        timeframe: '15m', // Preferred timeframe
        rsi: {
            period: 14,
            bull_support: 40, // Constance Brown Rule: Must hold 40
            bear_resistance: 60,
            divergence_lookback: 20
        },
        fibonacci: {
            retracement_min: 0.382,
            retracement_max: 0.50, // The Golden Zone
            extension_tp1: 0, // Previous High
            extension_tp2: -0.272,
            extension_tp3: -0.618
        },
        risk: {
            sl_atr_multiplier: 1.5, // Volatility buffer
            risk_per_trade: 0.01, // 1%
            max_daily_loss: 0.03 // 3%
        },
        sessions: {
            london_start_hour: 8, // UTC (Adjust logic to use local/UTC properly)
            london_end_hour: 16,
            ny_start_hour: 13,
            ny_end_hour: 21,
            // Avoid hours (Asian Session dead zone)
            avoid_start: 22,
            avoid_end: 6
        }
    }
} as const;

export type TierLevel = 'S' | 'A' | 'B' | 'C';
