# 🧠 Criptodamus: System Intelligence Overview

## Is it Smart? (¿Es Inteligente?)
**YES.** Unlike basic trading bots that just check "RSI < 30", Criptodamus uses a **Multi-Layered Intelligence Pipeline**. It thinks like an Institutional Trader.

---

## 1. The 5-Layer Brain (Pipeline)

### Layer 1: The Eyes (Data Ingestion) 👁️
-   **Sources:** Binance (Price), CoinGecko (Gecko), NewsAPI (Sentiment).
-   **Function:** Ingests thousands of data points per second (Candles, Volume, Order Book).
-   **Intelligence:** Detects *Anomalies* (e.g., "Volume is 500% higher than average").

### Layer 2: The Logic (Technical Analysis) 📐
-   **Indicators:** RSI, MACD, EMA (Trends), Bollinger Bands, Stochastic, ATR.
-   **Pau Strategy Core:** Checks for the "Golden Zone" (Fibonacci 38-50%), Divergences, and Trend Alignment.
-   **Smart Feature:** It doesn't just calculate; it *interprets*. (e.g., "RSI is low, BUT Volume is high -> Absorption").

### Layer 3: The Instinct (Institutional Volume) 🐋
-   **Engine:** `VolumeExpertService`
-   **Indicators:**
    -   **CVD (Cumulative Volume Delta):** Sees if buyers are aggressive vs passive.
    -   **Order Blocks:** Remembers where price reacted previously.
    -   **SFP (Swing Failure Pattern):** Detects "Traps" (Liquidity Sweeps).
    -   **Coinbase Premium:** Checks if US Institutions are buying (Price diff between Coinbase & Binance).

### Layer 4: The Conscious (Macro & News) 🌍
-   **Macro:** Checks BTC Regime (Bull/Bear) and USDT Dominance.
    -   *Rule:* "If BTC is dumping, don't buy Alts (unless it's Gold/Hedge)."
-   **Sentiment:** Scans Global News.
    -   *Panic Protocol:* If news is terrifying (-0.8), it enters "Survivor Mode" or looks for "Blood Entries".
    -   *Euphoria Protocol:* If news is too good (+0.8), it warns of Tops.
    -   **Nuclear Shield:** Checks Economic Calendar (CPI/FOMC) and *PAUSES* trading 1 hour before impact.

### Layer 5: The Judge (Scoring & Filtering) ⚖️
-   **Scoring:** Merges all 50+ factors into a single number (0-100+).
    -   Base Strategy: +50 pts
    -   Volume Confirmation: +30 pts
    -   Macro Alignment: +20 pts
    -   Penalties: -30 pts (e.g., Fake Wall, Low Liquidity).
-   **The Gatekeeper:**
    -   **Zombie Filter:** `RVOL < 0.5` -> REJECTED.
    -   **Slippage Guard:** `Spread > 0.2%` -> REJECTED.

---

## 2. The Neural Network (Machine Learning) 🤖
*File: `ml/inference.ts`*
-   **Model:** TensorFlow / Python based model trained on 75,000 historical candles.
-   **Function:** It predicts the *probability* of the next move being UP or DOWN.
-   **Influence:**
    -   If Logic says BUY and ML says BUY -> **Confidence Boost (+30)**.
    -   If Logic says BUY but ML says DUMP -> **Confidence Penalty (-15)**.
    -   *It acts as a "Second Opinion" from a trained veteran.*

---

## 3. Summary of "Other Indicators"
Beyond the basics (RSI/MACD), we use:
1.  **Imbalance (Fair Value Gaps):** Magnets for price.
2.  **Icebergs:** Hidden orders in the Order Book.
3.  **Liquidation Clusters:** Where are the retailers' Stop Losses? (We hunt them).
4.  **Z-Score:** Statistical extremes (Standard Deviations).
5.  **Funding Rates:** Is the crowd over-leveraged?

## Verdict
The system is **Highly Intelligent**. It doesn't just follow rules; it **weighs evidence**, **senses danger** (Nuclear Shield), and **hunts liquidity** (Institutional logic), all while respecting the core rules of **Pau Perdices**.
