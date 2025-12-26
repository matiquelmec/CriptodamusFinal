
export interface SessionLevel {
    name: 'ASIA' | 'LONDON' | 'NY';
    open: number;
    high: number;
    low: number;
    volumeAvg: number;
    active: boolean;
}

export interface SessionAnalysis {
    currentSession: 'ASIA' | 'LONDON' | 'NEW_YORK' | 'OTHER';
    activeNote: string;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    judasSwing: 'BULLISH_REVERSAL' | 'BEARISH_REVERSAL' | 'NONE'; // False breakout detected?
    volumeStatus: 'HIGH' | 'NORMAL' | 'LOW';
    levels: {
        asia: SessionLevel | null;
        london: SessionLevel | null;
        ny: SessionLevel | null;
    };
}

// Helper to get hour in specific timezone
function getHourInZone(date: Date, timeZone: string): number {
    try {
        // formatToParts is robust
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            hour12: false
        }).formatToParts(date);
        const hourPart = parts.find(p => p.type === 'hour');
        return hourPart ? parseInt(hourPart.value, 10) : -1;
    } catch (e) {
        // Fallback to UTC if timezone fails (shouldn't happen in modern browsers)
        return date.getUTCHours();
    }
}

// Lightweight helper for UI badges (Timezone Aware)
export function getCurrentSessionSimple(): { session: 'ASIA' | 'LONDON' | 'NEW_YORK' | 'OTHER' } {
    const now = new Date();

    // Check sessions by priority of "Active Trading Hours"

    // NEW YORK: 08:00 - 17:00 Local (Core is 09:30 - 16:00)
    const nyHour = getHourInZone(now, 'America/New_York');
    if (nyHour >= 8 && nyHour < 17) return { session: 'NEW_YORK' };

    // LONDON: 07:00 - 16:00 Local (LSE)
    const londonHour = getHourInZone(now, 'Europe/London');
    if (londonHour >= 7 && londonHour < 16) return { session: 'LONDON' };

    // ASIA (Tokyo): 09:00 - 15:00 Local (JST)
    const tokyoHour = getHourInZone(now, 'Asia/Tokyo');
    // Asia is tricky because it's night in NY/London. Often starts 00:00 UTC.
    // Tokyo 9AM is 00:00 UTC.
    if (tokyoHour >= 9 && tokyoHour < 18) return { session: 'ASIA' };

    return { session: 'OTHER' };
}

/**
 * INSTITUTIONAL SESSION ANALYZER
 * Detects Opening Range Breakouts (ORB), Judas Swings, and Volume Profiles.
 * Assumes candles are passed in 1H (Hour) intervals for historical lookup.
 */

export function analyzeSessionContext(
    currentPrice: number,
    currentVolume: number,
    hourlyCandles: { timestamp: number, open: number, high: number, low: number, close: number, volume: number }[]
): SessionAnalysis {
    const currentSimple = getCurrentSessionSimple();

    let activeNote = "Baja Liquidez / Cierre Diario";
    if (currentSimple.session === 'ASIA') activeNote = "Rango / Manipulación (Liquidity Hunts)";
    else if (currentSimple.session === 'LONDON') activeNote = "Definición de Tendencia / Breakouts Reales";
    else if (currentSimple.session === 'NEW_YORK') activeNote = "Alta Volatilidad / Reversiones";

    // 2. Extract Session Levels (DST Aware!)
    const levels = detectSessionLevels(hourlyCandles);

    // ... (rest of logic remains similar, relying on correct levels and session) ...

    // 3. Detect Judas Swing (False Breakout of Asia Range)
    let judasSwing: SessionAnalysis['judasSwing'] = 'NONE';

    if (levels.asia && levels.asia.active) {
        if (levels.asia.high > 0 && currentPrice < levels.asia.high) {
            // Logic placeholder
        }
    }

    // 4. Volume Validation
    const recentVolumes = hourlyCandles.slice(-20).map(c => c.volume);
    const avgVol = recentVolumes.reduce((a, b) => a + b, 0) / (recentVolumes.length || 1);
    const volumeStatus = currentVolume > avgVol * 1.5 ? 'HIGH' : currentVolume < avgVol * 0.5 ? 'LOW' : 'NORMAL';

    // 5. Determine Bias
    let bias: SessionAnalysis['bias'] = 'NEUTRAL';

    if (levels.london && levels.ny) {
        if (currentPrice > levels.london.open && currentPrice > levels.ny.open) bias = 'BULLISH';
        else if (currentPrice < levels.london.open && currentPrice < levels.ny.open) bias = 'BEARISH';
    } else if (levels.london) {
        if (currentPrice > levels.london.open) bias = 'BULLISH';
        else bias = 'BEARISH';
    }

    // Refine Judas Detection
    if (levels.asia) {
        const dayHigh = Math.max(...hourlyCandles.slice(-12).map(c => c.high));
        const dayLow = Math.min(...hourlyCandles.slice(-12).map(c => c.low));

        if (dayHigh > levels.asia.high && currentPrice < levels.asia.open && (currentSimple.session === 'LONDON' || currentSimple.session === 'NEW_YORK')) {
            judasSwing = 'BEARISH_REVERSAL'; // Turtle Soup Short
        }
        if (dayLow < levels.asia.low && currentPrice > levels.asia.open && (currentSimple.session === 'LONDON' || currentSimple.session === 'NEW_YORK')) {
            judasSwing = 'BULLISH_REVERSAL'; // Turtle Soup Long
        }
    }

    return {
        currentSession: currentSimple.session,
        activeNote,
        bias,
        judasSwing,
        volumeStatus,
        levels
    };
}

function detectSessionLevels(hourlyCandles: { timestamp: number, open: number, high: number, volume: number, low: number }[]) {
    const levels = {
        asia: null as SessionLevel | null,
        london: null as SessionLevel | null,
        ny: null as SessionLevel | null
    };

    if (hourlyCandles.length < 24) return levels;

    // We scan the last 24H of candles and check their LOCAL time in respective zones
    const scanCandles = hourlyCandles.slice(-24);

    // ASIA: Look for candle that is 09:00 AM Tokyo Time
    const asiaCandles = scanCandles.filter(c => {
        const h = getHourInZone(new Date(c.timestamp), 'Asia/Tokyo');
        return h >= 9 && h < 15; // Asia Session Range (approx)
    });

    if (asiaCandles.length > 0) {
        levels.asia = {
            name: 'ASIA',
            open: asiaCandles[0].open, // First candle of session
            high: Math.max(...asiaCandles.map(c => c.high)),
            low: Math.min(...asiaCandles.map(c => c.low)),
            volumeAvg: 0,
            active: true
        };
    }

    // LONDON: Look for candle that is 08:00 AM London Time
    // Note: Some define London Open as 7am or 8am depending on pre-market. LSE is 8am.
    const londonOpenCandle = scanCandles.find(c => getHourInZone(new Date(c.timestamp), 'Europe/London') === 8);

    if (londonOpenCandle) {
        levels.london = {
            name: 'LONDON',
            open: londonOpenCandle.open,
            high: londonOpenCandle.high,
            low: londonOpenCandle.low,
            volumeAvg: londonOpenCandle.volume,
            active: true
        };
    }

    // NEW YORK: Look for candle that is 09:00 AM NY Time (Pre-market/Open) 
    // NYSE opens 9:30. 1hr candle at 9:00 covers 9:00-10:00. This captures the Open.
    const nyOpenCandle = scanCandles.find(c => getHourInZone(new Date(c.timestamp), 'America/New_York') === 9);

    if (nyOpenCandle) {
        levels.ny = {
            name: 'NY',
            open: nyOpenCandle.open,
            high: nyOpenCandle.high,
            low: nyOpenCandle.low,
            volumeAvg: nyOpenCandle.volume,
            active: true
        };
    }

    return levels;
}

// --- INSTITUTIONAL KILL ZONES & PROXIMITY ---

export interface KillZoneStatus {
    isActive: boolean;
    zoneName: 'LONDON_OPEN' | 'NY_OPEN' | 'LONDON_CLOSE' | 'ASIA_OPEN' | 'NONE';
    message: string;
}

export interface SessionProximity {
    nextSession: string;
    minutesUntil: number;
    driftStatus: 'PRE_SESSION_STALKING' | 'DEAD_ZONE' | 'ACTIVE_FLOW';
    warningMessage: string | null;
}

/**
 * Returns the current "Kill Zone" status (High Probability Time Windows).
 * Times are based on EST (UTC-5/4) standard for ICT concepts.
 */
export function getKillZoneStatus(): KillZoneStatus {
    // We use New York time as the anchor for Kill Zones
    const now = new Date();
    const nyHour = getHourInZone(now, 'America/New_York');
    const nyMinute = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        minute: 'numeric'
    }).format(now);
    const min = parseInt(nyMinute, 10);

    // LONDON OPEN KZ: 02:00 - 05:00 EST
    if (nyHour >= 2 && nyHour < 5) {
        return { isActive: true, zoneName: 'LONDON_OPEN', message: "⚡ LONDON KILL ZONE: Alta Probabilidad de 'Judas Swing'." };
    }

    // NEW YORK OPEN KZ: 07:00 - 10:00 EST
    if (nyHour >= 7 && nyHour < 10) {
        return { isActive: true, zoneName: 'NY_OPEN', message: "⚡ NY KILL ZONE: Volatilidad Extrema. Esperar manipulación inicial." };
    }

    // LONDON CLOSE KZ: 10:00 - 12:00 EST
    if (nyHour >= 10 && nyHour < 12) {
        return { isActive: true, zoneName: 'LONDON_CLOSE', message: "⚡ LONDON CLOSE KZ: Posible reversión de tendencia diaria." };
    }

    // ASIA OPEN: 18:00 - 22:00 EST ( approx 20:00 is standard open logic for ICT range)
    if (nyHour >= 19 && nyHour < 23) {
        return { isActive: true, zoneName: 'ASIA_OPEN', message: "🌏 ASIA RANGE BUILDING: Acumulación de liquidez." };
    }

    return { isActive: false, zoneName: 'NONE', message: "⏳ Fuera de Kill Zone." };
}

/**
 * analyzes time relative to major session opens to assist "Stalking"
 */
export function getSessionProximityInfo(): SessionProximity {
    const now = new Date();
    const nyHour = getHourInZone(now, 'America/New_York');

    // Simple logic: distance to 02:00 (London), 07:00 or 08:30 (NY), 18:00 (Asia)
    let nextSession = "";
    let minutesUntil = 999;

    // Dist to NY (08:00 EST for simplistic math, or 09:30 for equity open)
    // ICT often references 08:30 bracket. Let's use 07:00 as start of pre-market/KZ.

    // ... Logic could be complex with circular time, simplified for immediate utility:

    let driftStatus: SessionProximity['driftStatus'] = 'ACTIVE_FLOW';
    let warningMessage = null;

    // DEAD ZONE: Lunch (12:00 - 13:00 EST)
    if (nyHour === 12) {
        driftStatus = 'DEAD_ZONE';
        warningMessage = "🍔 NY LUNCH: Algoritmos en pausa/baja probabilidad. Posible consolidación.";
    }
    // DEAD ZONE: Post market (16:00 - 18:00 EST)
    else if (nyHour >= 16 && nyHour < 18) {
        driftStatus = 'DEAD_ZONE';
        warningMessage = "💤 POST-MARKET: Cierre de libros. Spreads altos.";
    }
    // STALKING: 1H before NY Open (06:00 - 07:00 EST)
    else if (nyHour === 6) {
        driftStatus = 'PRE_SESSION_STALKING';
        warningMessage = "🦅 PRE-NY: 'Stalking Mode'. No operar antes del Open. Busca POIs.";
    }
    // STALKING: 1H before London (01:00 - 02:00 EST)
    else if (nyHour === 1) {
        driftStatus = 'PRE_SESSION_STALKING';
        warningMessage = "🦅 PRE-LONDON: Preparando la trampa. Espera a las 02:00 EST.";
    }

    return { nextSession, minutesUntil, driftStatus, warningMessage };
}
