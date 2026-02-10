import { Router } from 'express';
import { correlationMatrix } from '../core/services/risk/CorrelationMatrix';

const router = Router();

/**
 * GET /api/advanced/correlation-matrix
 * Retorna matriz de correlación en tiempo real
 */
router.get('/correlation-matrix', async (req, res) => {
    try {
        const data = correlationMatrix.generateMatrix();
        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('[API Advanced] Correlation matrix error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate correlation matrix'
        });
    }
});

/**
 * GET /api/advanced/correlation/:asset1/:asset2
 * Retorna correlación específica entre dos assets
 */
router.get('/correlation/:asset1/:asset2', async (req, res) => {
    try {
        const { asset1, asset2 } = req.params;
        const corr = correlationMatrix.getCorrelation(asset1, asset2);

        res.json({
            success: true,
            data: {
                asset1,
                asset2,
                correlation: corr,
                timestamp: Date.now()
            }
        });
    } catch (error) {
        console.error('[API Advanced] Correlation query error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get correlation'
        });
    }
});

/**
 * GET /api/advanced/health-check
 * Verifica estado de servicios avanzados
 */
router.get('/health-check', async (req, res) => {
    try {
        const status = {
            correlationMatrix: {
                active: true,
                lastUpdate: correlationMatrix.getLastUpdate(),
                assetsTracked: correlationMatrix.getTrackedAssets().length,
                trackedAssets: correlationMatrix.getTrackedAssets()
            },
            timestamp: Date.now()
        };

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('[API Advanced] Health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed'
        });
    }
});

/**
 * GET /api/advanced/market-intelligence
 * Retorna análisis completo del mercado con insights automáticos
 */
router.get('/market-intelligence', async (req, res) => {
    try {
        const { correlationAnalyzer } = await import('../core/services/risk/CorrelationAnalyzer');

        // Obtener oportunidades actuales (si están disponibles en caché)
        // Por ahora enviamos array vacío, se puede integrar con scanner cache
        const opportunities: any[] = [];

        const intelligence = correlationAnalyzer.analyze(opportunities);

        res.json({
            success: true,
            data: intelligence
        });
    } catch (error) {
        console.error('[API Advanced] Market intelligence error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate market intelligence'
        });
    }
});

export default router;
