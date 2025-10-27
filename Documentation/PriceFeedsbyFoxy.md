# 🦊 PriceFeeds by Foxy  
### On-Chain Oracle Feeds for USD-Denominated Asset Pricing  

---

## 📖 Overview

**PriceFeeds by Foxy** deliver accurate, on-chain USD prices for multiple assets across supported EVM networks such as **Roburna (chain ID 159)**.  
Each feed is a **Chainlink-compatible oracle** implementing the `AggregatorV3Interface` standard — allowing **drop-in compatibility** with any dApp or smart contract expecting Chainlink feeds.

The system provides:
- **8-decimal outputs** (standard Chainlink precision)  
- **18-decimal normalized outputs** via a convenience function for modern DeFi math  
- **Immutable, on-chain data sources** updated by an authorized operator  
- **Public, permissionless reads** for anyone integrating with FoxySwap and partner systems  

---

## 🧱 Architecture

| Component | Address / Role | Description |
|------------|----------------|-------------|
| **Master Feed** | `0x165B865aa579CAb69d8C9bda63e1b827C7EDFc9C` | Central on-chain contract storing all asset prices and timestamps. |
| **Per-Asset Feed** | See below | Exposes Chainlink-compatible read functions for a single asset. |
| **Consumer Contract** | Any DeFi / dApp contract | Reads prices using Chainlink methods (`latestRoundData`, `getRoundData`, etc.). |

Each per-asset feed queries the master feed for its specific token’s data and exposes it through the familiar Chainlink interface.

---

## 💡 Key Features

- ✅ **Fully Chainlink-compatible** (`AggregatorV3Interface`)
- ✅ **8-decimal outputs** (native) and **18-decimal option** for DeFi protocols
- ✅ **USD-based valuation** for all supported assets
- ✅ **Purely on-chain** (no off-chain aggregation required)
- ✅ **Publicly queryable** — no keys or subscriptions
- ✅ **Lightweight and efficient**, with one contract per asset

---

## ⚙️ Supported Assets & Feed Addresses

| Asset | Symbol | Feed Address | Description |
|:------|:-------|:-------------|:-------------|
| USD Coin | **USDC** | `0x3D5Ec2A05C243A00F0A3e405044ffdE5dc75df13` | Foxy USDC / USD |
| Wrapped Ether | **WETH** | `0x90204BeD87F0207975cD8DF2D5dAb50C9ACa5C0E` | Foxy WETH / USD |
| Bitcoin | **BTC** | `0x6dF18544cD11384d6Dee65692c658F54b83AEc94` | Foxy BTC / USD |
| Ripple | **XRP** | `0xFcfE926D38C4804e51E23a615AF3C5648ad50173` | Foxy XRP / USD |
| Tether | **USDT** | `0x8C5533B1d8E6db7D121CDd5a2a60C2408f6F579F` | Foxy USDT / USD |
| Binance Coin | **BNB** | `0xAf837C2f12f839b65F2F327E80e3528fe54B7CFF` | Foxy BNB / USD |
| Wrapped Roburna | **RBAT** | `0x7145A2439b238c57B26b25105A23792e9963c803` | Foxy RBAT / USD |

All feeds reference the master feed and reflect **USD prices** for their respective assets.

---

## 🔌 Contract Interface

Each PriceFeed by Foxy implements the following public functions:

| Function | Description | Output Type |
|-----------|--------------|--------------|
| `decimals()` | Returns feed decimal precision (typically 8). | `uint8` |
| `description()` | Returns human-readable feed label (e.g. “Foxy BTC / USD”). | `string` |
| `version()` | Returns feed version (currently `1`). | `uint256` |
| `latestRoundData()` | Returns the most recent round data. | `(uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)` |
| `getRoundData(uint80 _roundId)` | Returns data for a given round ID (only the latest round supported). | Same as above |
| `TokenPriceIn18()` | Returns latest price scaled to 18 decimals plus timestamp. | `(uint256 price18, uint64 updatedAt)` |

All are **read-only (`view`)** and require no gas when called off-chain.

---

## 🧭 Usage Examples

### 🔹 Standard Chainlink-Style (8 Decimals)

```solidity
AggregatorV3Interface feed =
    AggregatorV3Interface(0x90204BeD87F0207975cD8DF2D5dAb50C9ACa5C0E); // WETH/USD

(, int256 price,, uint256 updatedAt,) = feed.latestRoundData();
// Example: price = 249876000000  →  $24,987.60
````

### 🔹 18-Decimal Extended Read

```solidity
(uint256 price18, uint64 updatedAt) =
    TokenPriceFeed(0x90204BeD87F0207975cD8DF2D5dAb50C9ACa5C0E).TokenPriceIn18();

// Example: price18 = 24987600000000000000000 → $24,987.60 × 1e18
```

---

## 🧮 Decimal Scaling Logic

The `TokenPriceIn18()` function adjusts price decimals automatically:

```
if DECIMALS = 8  →  multiply by 1e10
if DECIMALS = 18 →  unchanged
if DECIMALS > 18 →  divide by 10^(DECIMALS − 18)
```

This ensures a consistent **1e18-scaled output** for fixed-point DeFi calculations such as AMMs, lending pools, staking contracts, and vaults.

---

## 🧠 Round Data Model

Each update from the master feed generates a **synthetic round**, preserving Chainlink data structure compatibility.

| Field             | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `roundId`         | Timestamp of the latest update (used as unique round ID). |
| `startedAt`       | Equal to `updatedAt`.                                     |
| `answeredInRound` | Equal to `roundId`.                                       |
| `answer`          | Latest USD price (8 decimals).                            |
| `updatedAt`       | Timestamp when the master feed was updated.               |

*Historical rounds are not stored* — feeds remain lightweight and efficient.

---

## 🪙 Solidity Consumer Example

```solidity
interface IFoxyFeed {
    function TokenPriceIn18()
        external
        view
        returns (uint256 price18, uint64 updatedAt);
}

contract ExampleConsumer {
    address constant WETH_FEED = 0x90204BeD87F0207975cD8DF2D5dAb50C9ACa5C0E;

    function getWethUsdPrice() external view returns (uint256) {
        (uint256 usdPrice18, ) = IFoxyFeed(WETH_FEED).TokenPriceIn18();
        return usdPrice18;
    }
}
```

---

## 🛰️ Integration Notes

* Feeds are **publicly readable** — no API keys or credentials required.
* Each token feed is **immutable**, permanently bound to a master feed.
* Master feed is the **single source of truth** for all asset prices.
* All prices are **denominated in USD** and updated on-chain.
* Ideal for use in:

  * DEX routers
  * Staking and rewards contracts
  * Vault and lending protocols
  * Token launch and bonding curves
  * Portfolio or analytics dashboards

---

## 📍 Reference Summary

| Parameter               | Value                                                    |
| ----------------------- | -------------------------------------------------------- |
| **Master Feed Address** | `0x165B865aa579CAb69d8C9bda63e1b827C7EDFc9C`             |
| **Network**             | Roburna Testnet (`chainId 159`)                          |
| **Precision**           | 8 decimals (native), 18 decimals (extended)              |
| **Currency Reference**  | USD                                                      |
| **Compatibility**       | Fully `AggregatorV3Interface` compliant                  |
| **Update Method**       | Operator-posted on-chain updates                         |
| **Explorer**            | [https://rbascan.com/](https://rbascan.com/)             |
| **Dashboard**           | [https://foxyswap.net/feeds](https://foxyswap.net/feeds) |

---

## 🧭 Example Feed Verification

You can view feed details, latest prices, and update timestamps via the [Foxy Feeds Dashboard](https://foxyswap.net/feeds)
or directly on-chain using block explorers like [RBAScan](https://rbascan.com/).

---

## 🦊 Summary

**PriceFeeds by Foxy** provide a unified, transparent, and efficient solution for on-chain price discovery —
serving as a **universal oracle layer** for all Foxy ecosystem contracts and any third-party DeFi protocols that require
USD-denominated asset values with standard or 18-decimal precision.

> Drop-in Chainlink replacement.
> Zero dependencies.
> 100% on-chain.
> Built for the Foxy ecosystem. 🦊

---

