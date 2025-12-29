/**
 * Donation API Routes (TypeScript Version)
 * Maneja las donaciones con MercadoPago Chile
 */

import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

// Configuración MercadoPago (reemplazar con credenciales reales)
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'TEST-YOUR-ACCESS-TOKEN';
// const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY || 'TEST-YOUR-PUBLIC-KEY';

interface DonationRequest {
    amount: number;
    description?: string;
    external_reference?: string;
}

/**
 * POST /api/donation/create-preference
 * Crea una preferencia de pago en MercadoPago
 */
router.post('/create-preference', async (req: Request, res: Response) => {
    try {
        const { amount, description, external_reference } = req.body as DonationRequest;

        // Validaciones
        if (!amount || amount < 1000) {
            return res.status(400).json({
                error: 'El monto mínimo es $1.000 CLP'
            });
        }

        if (amount > 100000) {
            return res.status(400).json({
                error: 'El monto máximo es $100.000 CLP'
            });
        }

        // Crear preferencia en MercadoPago
        const preference = {
            items: [
                {
                    title: description || 'Donación Criptodamus',
                    quantity: 1,
                    unit_price: amount,
                    currency_id: 'CLP' // Corregido el type string a 'CLP'
                }
            ],
            payer: {
                email: 'donador@criptodamus.com'
            },
            back_urls: {
                success: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/donation/success`,
                failure: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/donation/failure`,
                pending: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/donation/pending`
            },
            auto_return: 'approved',
            external_reference: external_reference || `donation_${Date.now()}`,
            statement_descriptor: 'CRIPTODAMUS',
            payment_methods: {
                excluded_payment_types: [],
                installments: 1
            }
        };

        // En desarrollo, simular respuesta
        if (process.env.NODE_ENV !== 'production' || !MP_ACCESS_TOKEN.startsWith('APP_')) {
            console.log('Modo desarrollo: Simulando preferencia de MercadoPago');
            return res.json({
                init_point: `https://www.mercadopago.cl/checkout/v1/redirect?pref_id=TEST-${Date.now()}`,
                sandbox_init_point: `https://sandbox.mercadopago.cl/checkout/v1/redirect?pref_id=TEST-${Date.now()}`,
                preference_id: `TEST-${Date.now()}`,
                amount,
                description
            });
        }

        // En producción, hacer llamada real a MercadoPago
        const response = await axios.post(
            'https://api.mercadopago.com/checkout/preferences',
            preference,
            {
                headers: {
                    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Log para analytics
        console.log(`Donation preference created: ${response.data.id} - Amount: $${amount} CLP`);

        res.json({
            init_point: response.data.init_point,
            sandbox_init_point: response.data.sandbox_init_point,
            preference_id: response.data.id
        });

    } catch (error: any) {
        console.error('Error creating payment preference:', error);

        // En caso de error, devolver URL de donación alternativa
        res.status(500).json({
            error: 'Error procesando donación',
            alternative: 'https://paypal.me/criptodamus',
            message: 'Por favor intenta de nuevo o usa el método alternativo'
        });
    }
});

/**
 * POST /api/donation/webhook
 * Webhook para recibir notificaciones de MercadoPago
 */
router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const { type, data } = req.body;

        if (type === 'payment') {
            const paymentId = data.id;

            // En producción, verificar el pago con MercadoPago
            if (process.env.NODE_ENV === 'production' && MP_ACCESS_TOKEN.startsWith('APP_')) {
                const payment = await axios.get(
                    `https://api.mercadopago.com/v1/payments/${paymentId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
                        }
                    }
                );

                if (payment.data.status === 'approved') {
                    // Procesar donación exitosa
                    console.log(`Donation approved: ${paymentId} - Amount: $${payment.data.transaction_amount} CLP`);

                    // TODO: Actualizar base de datos con el badge del donador
                    // TODO: Enviar email de agradecimiento
                    // TODO: Activar features premium si corresponde
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

/**
 * GET /api/donation/stats
 * Estadísticas de donaciones (público)
 */
router.get('/stats', async (req: Request, res: Response) => {
    // En producción, esto vendría de la base de datos
    const stats = {
        total_donations: 42,
        total_amount: 285000,
        average_donation: 6785,
        top_donors: [
            { badge: 'Diamond Supporter', count: 2 },
            { badge: 'Rocket Supporter', count: 8 },
            { badge: 'Pizza Supporter', count: 15 },
            { badge: 'Coffee Supporter', count: 17 }
        ],
        recent_donors: [
            { name: 'Anónimo', amount: 5000, badge: 'Pizza Supporter', date: new Date(Date.now() - 86400000) },
            { name: 'CryptoTrader', amount: 10000, badge: 'Rocket Supporter', date: new Date(Date.now() - 172800000) },
            { name: 'HODLer', amount: 2000, badge: 'Coffee Supporter', date: new Date(Date.now() - 259200000) }
        ]
    };

    res.json(stats);
});

export default router;
