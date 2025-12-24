
// STANDALONE VERIFICATION SCRIPT (No Imports)

// --- INTERFACES ---
interface DerivativesData {
    openInterest: number;
    openInterestValue: number;
    fundingRate: number;
    fundingRateDaily: number;
    buySellRatio: number;
}

interface CVDData {
    current: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    divergence: 'BULLISH_ABSORPTION' | 'BEARISH_EXHAUSTION' | 'NONE';
    candleDelta: number;
}

interface VolumeExpertAnalysis {
    derivatives: DerivativesData;
    cvd: CVDData;
    coinbasePremium: {
        index: number;
        gapPercent: number;
        signal: 'INSTITUTIONAL_BUY' | 'INSTITUTIONAL_SELL' | 'NEUTRAL';
    };
    liquidity: {
        bidAskSpread: number;
        marketDepthScore: number;
    };
}

// --- CONSTANTS ---
const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1'; // May default to Blocked if 451
const BINANCE_SPOT_API = 'https://data-api.binance.vision/api/v3'; // Uses Vision (CORS Friendly)
const COINBASE_API = 'https://api.coinbase.com/v2';

// --- HELPERS ---
const fetchWithTimeout = async (url: string, timeout = 4000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// --- LOGIC ---

async function getDerivativesData(symbol: string): Promise<DerivativesData> {
    const fSymbol = symbol.replace('/', '').toUpperCase();
    console.log(`[DERIVATIVES] Fetching for ${fSymbol}...`);

    try {
        const [oiRes, fundingRes] = await Promise.all([
            fetchWithTimeout(`${BINANCE_FUTURES_API}/openInterest?symbol=${fSymbol}`),
            fetchWithTimeout(`${BINANCE_FUTURES_API}/premiumIndex?symbol=${fSymbol}`)
        ]);

        if (!oiRes.ok || !fundingRes.ok) throw new Error(`API Error: ${oiRes.status}/${fundingRes.status}`);

        const oiData = await oiRes.json();
        const fundingData = await fundingRes.json();
        const price = parseFloat(fundingData.markPrice);
        const openInterest = parseFloat(oiData.openInterest);

        return {
            openInterest,
            openInterestValue: openInterest * price,
            fundingRate: parseFloat(fundingData.lastFundingRate),
            fundingRateDaily: parseFloat(fundingData.lastFundingRate) * 3,
            buySellRatio: 1
        };
    } catch (error) {
        console.error("Derivatives Error:", error);
        return {
            openInterest: 0, openInterestValue: 0, fundingRate: 0, fundingRateDaily: 0, buySellRatio: 1
        };
    }
}

async function getCoinbasePremium(symbol: string): Promise<VolumeExpertAnalysis['coinbasePremium']> {
    const base = symbol.replace('/USDT', '').replace('USDT', '');
    const cbSymbol = `${base}-USD`;
    const bnSymbol = `${base}USDT`;
    console.log(`[PREMIUM] Fetching ${cbSymbol} vs ${bnSymbol}...`);

    if (!['BTC', 'ETH', 'SOL'].includes(base)) return { index: 0, gapPercent: 0, signal: 'NEUTRAL' };

    try {
        const [bnRes, cbRes] = await Promise.all([
            fetchWithTimeout(`${BINANCE_SPOT_API}/ticker/price?symbol=${bnSymbol}`),
            fetchWithTimeout(`${COINBASE_API}/prices/${cbSymbol}/spot`)
        ]);

        if (!bnRes.ok || !cbRes.ok) throw new Error('Price API Error');
        const bnData = await bnRes.json();
        const cbData = await cbRes.json();

        const bnPrice = parseFloat(bnData.price);
        const cbPrice = parseFloat(cbData.data.amount);
        const gap = cbPrice - bnPrice;

        return {
            index: gap,
            gapPercent: (gap / bnPrice) * 100,
            signal: (gap / bnPrice) * 100 > 0.05 ? 'INSTITUTIONAL_BUY' : (gap / bnPrice) * 100 < -0.05 ? 'INSTITUTIONAL_SELL' : 'NEUTRAL'
        };
    } catch (error) {
        console.error("Premium Error:", error);
        return { index: 0, gapPercent: 0, signal: 'NEUTRAL' };
    }
}

async function getInstantCVD(symbol: string): Promise<CVDData> {
    const fSymbol = symbol.replace('/', '').toUpperCase();
    console.log(`[CVD] Fetching aggTrades for ${fSymbol}...`);

    try {
        const res = await fetchWithTimeout(`${BINANCE_SPOT_API}/aggTrades?symbol=${fSymbol}&limit=500`);
        if (!res.ok) throw new Error('Trades API Error');
        const trades = await res.json();

        let cvdDelta = 0;
        let buyVol = 0;
        let sellVol = 0;

        trades.forEach((t: any) => {
            const qty = parseFloat(t.q);
            if (t.m) { // Maker was Buyer -> Sell Aggressor
                cvdDelta -= qty;
                sellVol += qty;
            } else { // Maker was Seller -> Buy Aggressor
                cvdDelta += qty;
                buyVol += qty;
            }
        });

        return {
            current: cvdDelta,
            trend: buyVol > sellVol * 1.5 ? 'BULLISH' : sellVol > buyVol * 1.5 ? 'BEARISH' : 'NEUTRAL',
            divergence: 'NONE',
            candleDelta: cvdDelta
        };
    } catch (error) {
        console.error("CVD Error:", error);
        return { current: 0, trend: 'NEUTRAL', divergence: 'NONE', candleDelta: 0 };
    }
}

async function verify() {
    console.log("=== STARTING STANDALONE VERIFICATION ===");

    // 1. BTC
    const derivatives = await getDerivativesData('BTC/USDT');
    const premium = await getCoinbasePremium('BTC/USDT');
    const cvd = await getInstantCVD('BTC/USDT');

    console.log("\n>>> BTC RESULTS:");
    console.log(`Interest: $${(derivatives.openInterestValue / 1e9).toFixed(2)}B USD`);
    console.log(`Funding: ${derivatives.fundingRate.toFixed(4)}%`);
    console.log(`Premium: ${premium.gapPercent.toFixed(3)}% (${premium.signal})`);
    console.log(`CVD Delta: ${cvd.candleDelta.toFixed(2)} (${cvd.trend})`);

    // 2. SOL
    console.log("\n>>> SOL RESULTS:");
    const solDeriv = await getDerivativesData('SOL/USDT');
    console.log(`Interest: $${(solDeriv.openInterestValue / 1e6).toFixed(2)}M USD`);

    console.log("\n=== VERIFICATION SUCCESS (IF DATA VISIBLE) ===");
}

verify();
