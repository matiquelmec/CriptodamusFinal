
/**
 * INDICATOR INTEGRITY SHIELD
 * 
 * Exhaustive validation for TechnicalIndicators data structures.
 * "Si un dato está mal, toda la señal es nula."
 */

import { TechnicalIndicators } from '../../../types';

export class IndicatorIntegrityShield {

    /**
     * Performs a recursive check for NaN, null, or illogical values in indicators.
     * @returns { boolean } True if the data is 100% clean.
     */
    static validate(data: TechnicalIndicators): { isValid: boolean, error?: string } {
        try {
            // 1. Root Primitives
            if (this.isInvalid(data.price)) return { isValid: false, error: 'PRICE_NAN' };
            if (this.isInvalid(data.rsi)) return { isValid: false, error: 'RSI_NAN' };
            if (this.isInvalid(data.atr)) return { isValid: false, error: 'ATR_NAN' };

            // 2. EMA Hierarchy (Critical for Trend)
            const emas = [data.ema20, data.ema50, data.ema100, data.ema200];
            for (const ema of emas) {
                if (this.isInvalid(ema)) return { isValid: false, error: 'EMA_NAN' };
            }

            // 3. MACD Structure
            if (data.macd) {
                if (this.isInvalid(data.macd.line) || this.isInvalid(data.macd.signal) || this.isInvalid(data.macd.histogram)) {
                    return { isValid: false, error: 'MACD_CORRUPTED' };
                }
            }

            // 4. Fibonacci Level Logic
            if (data.fibonacci) {
                const levels = [
                    data.fibonacci.level0, data.fibonacci.level0_236,
                    data.fibonacci.level0_382, data.fibonacci.level0_5,
                    data.fibonacci.level0_618, data.fibonacci.level0_786,
                    data.fibonacci.level1
                ];
                for (const lv of levels) {
                    if (this.isInvalid(lv)) return { isValid: false, error: 'FIBONACCI_NAN' };
                }
                // Logical check: Fibs shouldn't be all the same (horizontal price)
                if (data.fibonacci.level0 === data.fibonacci.level1 && data.atr > 0) {
                    return { isValid: false, error: 'FIBONACCI_LOGIC_ERROR' };
                }
            }

            // 5. Ichimoku Reliability
            if (data.ichimokuData) {
                const ichi = data.ichimokuData;
                if (this.isInvalid(ichi.tenkan) || this.isInvalid(ichi.kijun) || this.isInvalid(ichi.senkouA) || this.isInvalid(ichi.senkouB)) {
                    return { isValid: false, error: 'ICHIMOKU_NAN' };
                }
            }

            // 6. Bollinger Band Coherence
            if (data.bollinger) {
                if (this.isInvalid(data.bollinger.upper) || this.isInvalid(data.bollinger.lower)) {
                    return { isValid: false, error: 'BOLLINGER_NAN' };
                }
                if (data.bollinger.upper < data.bollinger.lower) {
                    return { isValid: false, error: 'BOLLINGER_INVERTED' };
                }
            }

            // 7. Order Flow (CVD)
            if (data.cvd && data.cvd.length > 0) {
                if (this.isInvalid(data.cvd[data.cvd.length - 1])) {
                    return { isValid: false, error: 'CVD_NAN' };
                }
            }

            return { isValid: true };
        } catch (e: any) {
            return { isValid: false, error: `VALIDATION_CRASH: ${e.message}` };
        }
    }

    private static isInvalid(val: any): boolean {
        return val === undefined || val === null || Number.isNaN(val) || !Number.isFinite(val);
    }
}
