
// Mock of the logic inside processPriceTick/registration
const FEE_RATE = 0.001;
const SLIPPAGE = 0.0005;

function calculateNetPnL(entry: number, current: number, side: string, weight: number): number {
    const raw = ((current - entry) / entry) * 100 * (side === 'LONG' ? 1 : -1);
    const feeRatio = 0.001;
    return (raw - (feeRatio * 100)) * weight;
}

function testSignal(side: 'LONG' | 'SHORT', scanPrice: number, slPrice: number, marketPriceAtAudit: number) {
    console.log(`\n--- TESTING ${side} ---`);
    console.log(`Scan: $${scanPrice} | SL: $${slPrice} | Market: $${marketPriceAtAudit}`);

    // Registration checks if can activate
    const buffer = scanPrice * 0.003;
    const canEnter = side === 'LONG'
        ? marketPriceAtAudit <= (scanPrice + buffer)
        : marketPriceAtAudit >= (scanPrice - buffer);

    if (!canEnter) {
        console.log("Status: PENDING (Price too far)");
        return;
    }

    // Activation
    const slippage = marketPriceAtAudit * SLIPPAGE;
    const activationPrice = side === 'LONG' ? marketPriceAtAudit + slippage : marketPriceAtAudit - slippage;
    console.log(`Activated at: $${activationPrice.toFixed(4)} (Slip: $${slippage.toFixed(4)})`);

    // SL Check (Immediate)
    const slHit = side === 'LONG' ? marketPriceAtAudit <= slPrice : marketPriceAtAudit >= slPrice;

    if (slHit) {
        // Here is the Grace Period check
        const pnl = calculateNetPnL(activationPrice, marketPriceAtAudit, side, 1.0);
        console.log(`SL HIT! PnL: ${pnl.toFixed(4)}%`);

        const GRACE_PERIOD = 300;
        const age = 1; // 1 second old

        let finalAction = "CLOSE";
        if (age < GRACE_PERIOD && pnl > -3.0) {
            finalAction = "IGNORE (Grace Period)";
        }

        console.log(`Final Action: ${finalAction}`);
    } else {
        console.log("Status: ACTIVE (Safe)");
    }
}

// Scenario: PAXG LONG. Scan 2700. SL 2680. Market 2675.
testSignal('LONG', 2700, 2680, 2675);

// Scenario: SOL LONG. Scan 128. SL 126.5. Market 126.0
testSignal('LONG', 128, 126.5, 126.0);

// Scenario: Normal Trade
testSignal('LONG', 100, 99.2, 99.8);
