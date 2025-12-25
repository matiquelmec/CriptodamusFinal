import { scanMarketOpportunities } from '../services/engine/scannerLogic';
import { TradingStyle } from '../types';

self.onmessage = async (e: MessageEvent) => {
    const { type, style } = e.data;

    if (type === 'START_SCAN') {
        try {
            // console.log("Worker: Starting scan for ", style);
            const opportunities = await scanMarketOpportunities(style as TradingStyle);
            self.postMessage({ type: 'SCAN_COMPLETE', payload: opportunities });
        } catch (error: any) {
            console.error("Worker Error:", error);
            self.postMessage({ type: 'SCAN_ERROR', payload: error.message || "Unknown error in worker" });
        }
    }
};
