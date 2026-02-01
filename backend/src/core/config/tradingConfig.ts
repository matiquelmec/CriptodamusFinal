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
            s_tier: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XAGUSDT', 'XAUUSDT'],
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
    // PAU PERDICES STRATEGY CONFIG
    pauStrategy: {
        asset: 'PAXGUSDT', // Use PAXG as crypto-proxy for Gold (Binance Spot)
        asset_backup: 'XAUUSDT', // Use XAUUSDT (Binance Futures) if available
        timeframe: '15m', // Preferred timeframe
        rsi: {
            bull_support: 40,
            bear_resistance: 60
        },
        dates: {
            london_open: 8, // UTC Hour (approx)
            ny_close: 17
        },
        risk: {
            sl_atr_multiplier: 1.5,
            risk_per_trade: 0.01 // 1%
        }
    },

    // --- RISK ENGINES ---
    risk: {
        whale_volume_ratio: 3.5, // Volume > 3.5x average triggers whale alert
        volatility_threshold_multiplier: 3.0, // Range > 3x average range triggers volatility alert
        max_slippage: 0.02,
        max_leverage_default: 20,
        protection: {
            max_daily_drawdown: 0.05, // 5% Daily Stop
            max_total_exposure: 0.25  // 25% Portfolio Exposure limit
        },
        // NEW: Macro Environment Thresholds
        macro: {
            dxy_risk: 104.0,       // DXY Index Level considered "Risk Off"
            gold_risk_off: 2750.0  // Gold Price ($) indicating Flight to Safety
        },
        // NEW: Institutional Safety Filters
        safety: {
            whipsaw_cooldown_hours: 4,
            direction_flip_penalty: 25,
            high_conviction_threshold: 85,
            min_sl_distance_percent: 1.2,
            smart_breakeven_buffer_percent: 0.1 // Fee coverage
        }
    },

    // --- SCORING MATRIX ---
    scoring: {
        min_score_entry: 75, // UPGRADED: Institutional Grade (Was 60)
        god_mode_threshold: 90,
        filters: { // NEW: Hard Filters
            min_adx: 20, // Avoid Chop
            min_volume_24h: 5000000 // $5M Liquidity Floor
        },
        weights: {
            // Trend Following
            ema_alignment_bullish: 15,
            ema_alignment_bearish: 15,

            // Momentum
            rsi_oversold: 10,
            rsi_overbought: 10,
            rsi_divergence: 20,

            // Volume / Institutional (BOOSTED)
            volume_spike: 20,
            order_block_retest: 20, // Institutional Pivot
            liquidation_flutter: 20, // Fuel
            cvd_divergence_boost: 25, // Smart Money Footprint
            ml_confidence_max: 30,
            harmonic_pattern: 20, // NEW: Geometric Confluence

            // Patterns
            chart_pattern_breakout: 15,
            golden_ticket_pattern: 25,

            // Strategic Overrides
            freeze_protocol_boost: 25
        },
        // NEW: Advisor Specific Weights (Normalized to Scoring Impact)
        advisor: {
            hidden_divergence: 15, // Was 5
            sfp_sweep: 20,         // Was 4 (Institutional Signal)
            order_block_retest: 15, // Was 2.5
            volume_absorption: 20, // Was 4
            fractal_alignment: 10, // Was 3
            z_score_extreme: 20, // Was 4 (Mean Reversion Power)
            pinball_setup: 15, // Was 3.5
            // NEW CENTRALIZED WEIGHTS
            trend_ema200: 10,
            trend_slope_boost: 5,
            trend_ema_cross: 5,
            vwap_position: 10,
            momentum_macd: 5,
            momentum_rsi: 5,
            stoch_cross_extreme: 10,
            bollinger_zone: 5,
            contrarian_sentiment: 15,
            liquidation_cascade: 20, // Was 4
            fvg_proximity: 10,
            value_area_deviation: 10,
            harmonic_pattern: 20, // Was 4
            rsi_trendline_break: 15,
            funding_rate_extreme: 15,
            coinbase_premium: 20, // Was 4 (Institutional Trust)
            ttm_squeeze_bias: 10,
            fractal_tie_breaker: 10
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

    // --- TELEGRAM NOTIFICATIONS ---
    telegram: {
        enabled: true,
        botToken: '8524882455:AAGghZYyLsfMD6Xo-I2qcOxxHbgT5Ucc4Kw', // Injected by Setup Script
        chatId: '6463158372', // User ID
        minScoreAlert: 75, // Only alert if score >= 75
        alertCooldown: 240 // 4 hours cooldown for same symbol
    }
} as const;

export type TierLevel = 'S' | 'A' | 'B' | 'C';
