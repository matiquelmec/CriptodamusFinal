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
            sl_atr_multiplier: 2.0,  // UPGRADED: More breathing room for retests
            risk_per_trade: 0.01 // 1%
        },
        // NEW: Fibonacci Deep Retracement Penalty
        fibonacci_penalties: {
            enabled: true,
            deep_retracement_penalty: -10,  // Penalizar entradas en 61.8-78.6%
            penalize_above_618: true  // Activar penalización para >61.8%
        }
    },

    // --- KERNEL SECURITY (THE SAFETY NET) ---
    kernel: {
        max_daily_loss_percent: 5.0,        // -5% Daily Stop Loss (Hard Lockout)
        volatility_shutdown_multiplier: 3.0, // 3x Average Volatility = Black Swan (Kill Switch)
        profit_skimming_threshold: 10.0,    // +10% Total PnL = Harvest Alert
        max_consecutive_losses: 4           // Psychological Stop (Optional)
    },

    // --- RISK ENGINES ---
    risk: {
        degraded_mode_penalty: 0.5, // NEW: Cut size by 50% if News Blind (Degraded Mode)
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
            min_sl_distance_percent: 1.2, // Safety Floor for SL
            smart_breakeven_buffer_percent: 0.2, // Fee coverage (0.1% Entry + 0.1% Exit)

            // NEW: Professional Structural Logic
            min_tp_distance_percent: 0.8, // 0.8% Min Target (Avoids Cent-Wins)
            max_sl_distance_percent: 2.5, // 2.5% Max Cap (Avoids Ruin)
            smart_sl_structure_lookback: true // Enable Structural Invalidation Search
        },
        // NEW: "The Psychologist's Hack" (Contrarian Sentiment Rule)
        psychologistHack: {
            enabled: true,
            ema20_proximity_threshold: 0.003, // 0.3% distance from EMA 20
            retail_long_extreme: 2.5,        // LS Ratio > 2.5 (Wait for Long Flush)
            retail_short_extreme: 0.4,       // LS Ratio < 0.4 (Wait for Short Squeeze)
            penalty_score: 45                // Penalty to prevent entry during retail euphoria
        }
    },

    // --- PAU PERDICES: ADVANCED EXIT SYSTEM (Hybrid Multi-Factor) ---
    exit_strategy: {
        // Trailing Stop (después de TP1)
        trailing_stop: {
            enabled: true,
            atr_distance: 2.0,  // UPGRADED: 2× ATR (wider trail, fewer whipsaws)
            min_profit_to_activate: 2.5  // UPGRADED: Start trailing later (more confidence)
        },

        // Momentum Exhaustion
        momentum: {
            enabled: true,
            rsi_threshold: 70,  // RSI >70 para LONG
            min_hours_check: 2,  // Revisar después de 2h
            max_flat_percent: 1.0  // Si movió <1% en 2h con RSI alto
        },

        // Divergencia Regular (Reversión)
        reversal: {
            enabled: true,
            lookback_candles: 10,  // Buscar divergencia en últimas 10 velas
            min_rsi_delta: 5  // RSI debe bajar >5 puntos con precio subiendo
        },

        // Time Decay (Soft Pressure)
        time_decay: {
            enabled: true,
            soft_start_hours: 6,  // Empezar a estrechar SL a las 6h
            hard_limit_hours: 12,  // Cierre forzoso solo si FLAT
            sl_tighten_rate: 0.1,  // Reducir SL distance 10% por hora

            // NEW: Forced Breakeven (12h sin TP1)
            forced_breakeven: {
                enabled: true,
                hours: 12,  // Mover SL a breakeven después de 12h
                stage_threshold: 0  // Solo si no ha tocado TP1 (stage 0)
            }
        },

        // NEW: Nuclear Event Protection (Smart Defense)
        event_protection: {
            enabled: true,
            pre_event_minutes: 60, // Activate defense 1 hour before
            actions: {
                profitable_threshold: 0.5, // Move to Breakeven if > 0.5% profit
                weak_loss_threshold: -1.0, // Close if loss is currently < -1.0% (Risk of slippage)
                critical_action: 'HOLD_WITH_SL' // Deep drawdown: Hold with original SL
            }
        }
    },

    // --- PAU PERDICES: DYNAMIC POSITION SIZING (Drawdown Protection) ---
    pau_drawdown_scaling: {
        enabled: true,
        initial_balance: 1000, // Starting capital (USD)
        base_risk_percent: 0.01, // 1% base risk per trade

        // Drawdown Scaling Table (Pau Method)
        // Reduces position size automatically during losing streaks
        scaling_thresholds: [
            { max_dd: 3, multiplier: 1.00 },    // 0-3% DD → Full risk (100%)
            { max_dd: 5, multiplier: 0.75 },    // 3-5% DD → Reduced (75%)
            { max_dd: 8, multiplier: 0.50 },    // 5-8% DD → Half risk (50%)
            { max_dd: 10, multiplier: 0.25 },   // 8-10% DD → Minimal (25%)
            { max_dd: Infinity, multiplier: 0 } // >10% DD → STOP trading
        ],

        // Safety: Force stop trading if DD exceeds this
        max_allowed_drawdown: 10, // 10% hard stop

        // Recovery: Resume normal risk when DD reduces below this
        recovery_threshold: 2 // <2% DD → back to 100% risk
    },

    // --- SCORING MATRIX ---
    scoring: {
        min_score_entry: 60, // DIAGNOSTIC MODE: Reduced from 75 to 60
        min_score_to_list: 60, // DIAGNOSTIC MODE: Match entry
        god_mode_threshold: 90,
        filters: { // NEW: Hard Filters
            min_adx: 15, // DIAGNOSTIC MODE: Reduced from 20 to 15 (Allow weaker trends)
            min_volume_24h: 5000000 // $5M Liquidity Floor
        },
        weights: {
            // Trend Following (KING)
            ema_alignment_bullish: 25, // UP from 15
            ema_alignment_bearish: 25, // UP from 15

            // Momentum (RETAIL NERF)
            rsi_oversold: 5,   // DOWN from 10
            rsi_overbought: 5, // DOWN from 10
            rsi_divergence: 15, // DOWN from 20 (Strong but laggy)

            // Volume / Institutional (GOD MODE BUFFS)
            volume_spike: 25, // UP from 20
            order_block_retest: 25, // UP from 20
            liquidation_flutter: 25, // UP from 20
            cvd_divergence_boost: 30, // UP from 25
            ml_confidence_max: 30,
            harmonic_pattern: 20,

            // Patterns
            chart_pattern_breakout: 15,
            golden_ticket_pattern: 30, // UP from 25

            // Strategic Overrides
            freeze_protocol_boost: 25
        },
        // NEW: Advisor Specific Weights (Normalized to Scoring Impact)
        advisor: {
            hidden_divergence: 15,
            sfp_sweep: 30,         // BOOST: Institutional Trap (+5)
            order_block_retest: 25, // BOOST: Key Level (+5)
            volume_absorption: 30, // BOOST: Hidden Accumulation (+5)
            fractal_alignment: 10,
            z_score_extreme: 20,
            pinball_setup: 15,
            // NEW CENTRALIZED WEIGHTS
            trend_ema200: 15, // UP from 10
            trend_slope_boost: 10, // UP from 5
            trend_ema_cross: 5,
            vwap_position: 20, // BOOST: Institutional Baseline (+5)
            momentum_macd: 4, // NERF from 5
            momentum_rsi: 4,  // NERF from 5
            stoch_cross_extreme: 5, // NERF from 10
            bollinger_zone: 5,
            contrarian_sentiment: 10,
            liquidation_cascade: 30, // BOOST: Fuel (+5)
            fvg_proximity: 10,
            value_area_deviation: 10,
            harmonic_pattern: 20,
            rsi_trendline_break: 15,
            funding_rate_extreme: 15,
            coinbase_premium: 30, // BOOST: Institutional Trust (+5)
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
