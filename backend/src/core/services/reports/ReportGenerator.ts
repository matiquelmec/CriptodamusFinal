import { AIOpportunity } from '../../types';

export class ReportGenerator {

    /**
     * Generates a deterministic, expert-level report from an AIOpportunity.
     * Replaces the need for an LLM by using structured logic templates.
     */
    static generateReport(opportunity: AIOpportunity): string {
        // Destructure using correct type properties
        const { symbol, confidenceScore, side, entryZone, stopLoss, takeProfits, reasoning, metrics, riskRewardRatio, timeframe } = opportunity;

        const typeLabel = side === 'LONG' ? '🟢 BUY' : '🔴 SELL';
        const tier = opportunity.tier || 'C';
        const currentPrice = entryZone.currentPrice || entryZone.min;
        const score = confidenceScore; // Alias for logic compatibility

        // 1. HEADLINE & VERDICT
        let verdict = "NEUTRAL";
        let urgency = "ESPERAR";
        let emoji = "⚪";

        if (score >= 90) { verdict = "COMPRA FUERTE"; urgency = "INMEDIATA"; emoji = "🚀"; }
        else if (score >= 75) { verdict = "COMPRA"; urgency = "ALTA"; emoji = "🟢"; }
        else if (score >= 60) { verdict = "COMPRA ESPECULATIVA"; urgency = "MEDIA"; emoji = "🟡"; }

        if (side === 'SHORT') {
            if (score >= 90) { verdict = "VENTA FUERTE"; emoji = "💥"; }
            else if (score >= 75) { verdict = "VENTA"; emoji = "🔴"; }
            else if (score >= 60) { verdict = "VENTA ESPECULATIVA"; emoji = "🟠"; }
        }

        const header = `
# REPORTE EJECUTIVO: ${symbol} (${timeframe})
**VEREDICTO:** ${emoji} ${verdict} (Score: ${score}/100)
**Nivel:** ${tier} | **RR:** ${riskRewardRatio} | **Urgencia:** ${urgency}
`;

        // 2. TECHNICAL & ADVANCED BREAKDOWN
        // Ensure reasoning exists (it is optional in type but populated in our logic)
        const reasons = reasoning || [];

        const volumeReasons = reasons.filter(r => r.toLowerCase().includes('volume') || r.includes('CVD') || r.includes('Premium') || r.includes('Wall') || r.includes('Iceberg'));
        const trendReasons = reasons.filter(r => r.includes('Trend') || r.includes('EMA') || r.includes('MTF') || r.includes('Structure') || r.includes('Tendencia') || r.includes('Estructura'));
        const riskReasons = reasons.filter(r => r.includes('risk') || r.includes('Stop') || r.includes('Sniper') || r.includes('Volatility') || r.includes('Correlation') || r.includes('FILTRO') || r.includes('Riesgo'));
        const mlReasons = reasons.filter(r => r.includes('IA') || r.includes('Brain') || r.includes('Cerebro'));
        const sentimentReasons = reasons.filter(r => r.includes('Sentiment') || r.includes('News') || r.includes('Noticias'));

        const usedReasons = new Set([...volumeReasons, ...trendReasons, ...riskReasons, ...mlReasons, ...sentimentReasons]);
        const strategyReasons = reasons.filter(r => !usedReasons.has(r));

        let sections = [];

        // STRATEGY SECTION
        sections.push(`## 🎯 Estrategia: ${opportunity.strategy}`);
        if (strategyReasons.length > 0) {
            sections.push(strategyReasons.map(r => `- ${r}`).join('\n'));
        }

        // Helper for safe number formatting
        const safeNum = (val: number | undefined | null, decimals: number = 2, suffix: string = ''): string => {
            if (val === undefined || val === null || isNaN(val)) return 'N/A';
            return val.toFixed(decimals) + suffix;
        };

        // INSTITUTIONAL FLOW (God Mode)
        // Check metrics safely
        if (volumeReasons.length > 0 || (metrics && metrics.volumeExpert)) {
            sections.push(`## 🏦 Flujo Institucional (God Mode)`);
            if (metrics?.volumeExpert?.coinbasePremium?.gapPercent !== undefined) {
                const gapVal = metrics.volumeExpert.coinbasePremium.gapPercent;
                const gap = safeNum(gapVal, 3);
                if (gap !== 'N/A') {
                    sections.push(`- **Coinbase Premium:** ${gap}% ${Number(gapVal) > 0 ? '(Compras)' : '(Ventas)'}`);
                }
            }
            if (metrics?.cvdDivergence) {
                sections.push(`- **Divergencia CVD:** ${metrics.cvdDivergence.type} (Actividad Smart Money)`);
            }
            if (volumeReasons.length > 0) {
                sections.push(volumeReasons.map(r => `- ${r}`).join('\n'));
            }
        }

        // TREND & STRUCTURE
        if (trendReasons.length > 0) {
            sections.push(`## 🌊 Tendencia y Estructura`);
            sections.push(trendReasons.map(r => `- ${r}`).join('\n'));
            if (metrics?.structure) sections.push(`- **Alineación EMA:** ${metrics.structure}`);
        }

        // AI & SENTIMENT
        if (mlReasons.length > 0 || sentimentReasons.length > 0) {
            sections.push(`## 🧠 IA y Sentimiento`);
            if (mlReasons.length > 0) sections.push(mlReasons.map(r => `- ${r}`).join('\n'));
            if (sentimentReasons.length > 0) sections.push(sentimentReasons.map(r => `- ${r}`).join('\n'));
        }

        // RISK MANAGEMENT
        if (riskReasons.length > 0) {
            sections.push(`## 🛡️ Evaluación de Riesgo`);
            sections.push(riskReasons.map(r => `- ${r}`).join('\n'));
        }

        // PLAN
        // Helper for safely accessing TPs
        const tp1 = takeProfits.tp1;
        const tp2 = takeProfits.tp2;
        const tp3 = takeProfits.tp3;

        const riskPlan = `
## 📋 Plan de Ejecución
- **Zona de Entrada:** $${safeNum(entryZone.min, 4)} - $${safeNum(entryZone.max, 4)}
- **Stop Loss:** $${safeNum(stopLoss, 4)}
- **Toma de Ganancias 1:** $${safeNum(tp1, 4)}
- **Toma de Ganancias 2:** $${safeNum(tp2, 4)}
- **Toma de Ganancias 3:** $${safeNum(tp3, 4)}
- **Apalancamiento Rec:** ${opportunity.recommendedLeverage || 1}x (Kelly: ${safeNum((opportunity.kellySize || 0) * 100, 0)}%)
`;

        return header + '\n' + sections.join('\n\n') + '\n' + riskPlan;
    }

    /**
     * Converts report to JSON for frontend parsing
     */
    static generateJSON(opportunity: AIOpportunity): any {
        return {
            ...opportunity,
            humanReport: this.generateReport(opportunity)
        };
    }
}
