
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Enable CORS for everyone (It's a public proxy for your app)
app.use(cors({ origin: '*' }));

// 2. Health Check
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), service: 'Bifrost v2' });
});

// 3. The Proxy Logic
app.get('/api', async (req, res) => {
    const targetUrl = req.query.target;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing target URL' });
    }

    try {
        console.log(`[Proxy] Forwarding to: ${targetUrl}`);

        // Stealth Headers to bypass standard blocks
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            timeout: 10000 // 10s timeout
        });

        // Forward the data back to the client
        res.json(response.data);

    } catch (error) {
        console.error(`[Proxy Error] ${error.message}`);

        if (error.response) {
            // Forward the upstream error status
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Proxy Request Failed', message: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`🛡️ Bifrost Proxy v2 running on port ${PORT}`);
});
