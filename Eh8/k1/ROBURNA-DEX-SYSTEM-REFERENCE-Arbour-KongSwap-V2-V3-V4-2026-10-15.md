# Roburna Multi-DEX System Reference
## Arbour V2/V3 + KongSwap V2/V3/V4 + Kong Universal Router + Analytics + Route API + Arbitrage Integration

**Network:** Roburna Testnet  
**Chain ID:** `159` (`0x9f`)  
**Reference date:** 2026-10-15  
**Status:** Engineering handoff / system reference for the next test system and future SDK work.  
**Scope:** Contracts, protocol mechanics, routing, pool discovery, quoting, Universal Router construction, analytics/API integration, liquidity models, execution safety, and arbitrage integration. Wallet UI/private-key scripting is intentionally deferred to a later document.

---

# 1. Purpose and system boundary

This document consolidates the DEX mechanics proven and used across the Roburna work into one technical reference. The system is not a single DEX and not a single router. It is a collection of independent on-chain venues that can be normalized above the contract layer.

```text
Roburna Testnet — chain 159
│
├── Arbour
│   ├── V2
│   │   ├── Factory
│   │   ├── Pair contracts
│   │   └── Router02
│   └── V3
│       ├── Factory
│       ├── Pool contracts
│       ├── QuoterV2
│       ├── Swap Router
│       └── Nonfungible Position Manager
│
└── KongSwap
    ├── V2
    │   ├── Factory
    │   ├── Pair contracts
    │   └── Router02
    ├── V3
    │   ├── Factory
    │   ├── Pool contracts
    │   ├── QuoterV2
    │   ├── SwapRouter02
    │   └── Nonfungible Position Manager
    ├── Permit2
    ├── V4
    │   ├── PoolManager singleton
    │   ├── StateView
    │   ├── V4Quoter
    │   ├── PositionManager
    │   ├── PositionDescriptor
    │   ├── HookFactory
    │   └── Dynamic Fee Hook
    └── V4-capable Universal Router
        ├── V2 execution
        ├── V3 execution
        ├── V4 execution
        └── mixed two-step execution
```

The most important architectural boundary is:

> **Arbour and KongSwap are separate exchanges. Kong's Universal Router must not be treated as a universal router for Arbour.**

A multi-exchange route selector may compare Arbour and KongSwap quotes, but execution must be dispatched to the contracts belonging to the winning exchange.

That gives the clean architecture:

```text
                    normalized quote / route layer
                              |
             +----------------+----------------+
             |                                 |
          ARBOUR                            KONGSWAP
             |                                 |
      +------+------+                  +-------+-------+
      |             |                  |       |       |
     V2            V3                 V2      V3      V4
      |             |                  \       |      /
 direct router  direct router           \------|-----/
                                              |
                                           Permit2
                                              |
                                       Universal Router
```

The goal of the future SDK should be to provide one control plane while preserving these native mechanics underneath it.

---

# 2. Canonical network and token configuration

| Item | Value |
|---|---|
| Network | Roburna Testnet |
| Chain ID | `159` |
| Chain ID hex | `0x9f` |
| Native token | `RBA` |
| Native decimals | `18` |
| Primary RPC used in these tests | `https://preseed-testnet-1.roburna.com` |
| Explorer | `https://testnet.rbascan.com` |
| Wrapped native | `WRBA` |
| WRBA address | `0xA3e8E81810c2908EE72b8E8a13371BEd42D91e7b` |

Frequently used test tokens:

| Token | Address | Decimals |
|---|---|---:|
| WRBA | `0xA3e8E81810c2908EE72b8E8a13371BEd42D91e7b` | 18 |
| Roburna Test USDC / tUSDC | `0xbd3f91DA35bD5750D7D80BB01aE9f9117875a87f` | 6 |
| Roburna Test USDT / tUSDT | `0xD813D5763b205A717a111c9Eda5fB684584d1996` | 6 |

## Execution-price rule

Do **not** build the future router, SDK, or arb engine around a hardcoded historical stable-per-WRBA value. Older test scripts used values such as `0.752 stable/WRBA`; later tests proved those assumptions become stale as pools are traded or repaired.

The execution rule adopted by the later scripts is:

```text
REFERENCE_PRICE_USED=NO
SIZING_SOURCE=LIVE_ONCHAIN_QUOTES_ONLY
```

For an execution decision:

1. read current pool state;
2. quote the actual intended amount;
3. compare executable outputs across the allowed venues;
4. apply slippage policy;
5. build exact calldata;
6. simulate that exact calldata at current state;
7. only then sign/broadcast.

An analytics USD reference is useful for charts and normalization; it is not an execution oracle.

---

# 3. Master contract registry

## 3.1 Arbour V2

| Contract | Address |
|---|---|
| V2 Factory | `0xE756Af80bC019689B4C4508026147deb80C108B9` |
| V2 Router02 | `0xE8B48213F7675f69007516ddc1944d439E71D0d8` |

The analytics configuration recorded Arbour V2 as Uniswap-V2-compatible with a verified fixed fee of 30 bps.

## 3.2 Arbour V3

| Contract | Address |
|---|---|
| V3 Factory | `0x75aaA4B8d474b0Ac63ceac35cf6F371d8808631B` |
| V3 Swap Router | `0xE0960f56D353194F8abE52180325a21bd146dabE` |
| V3 QuoterV2 | `0x4b12d2869B8581c286F8583e4d2167cAEC3dC9fa` |
| V3 Nonfungible Position Manager | `0x862854A6c985370d5F4942d9AaB151248512C1ed` |

Used/confirmed Arbour V3 tiers:

| Fee units | Percent | Tick spacing |
|---:|---:|---:|
| `500` | 0.05% | `10` |
| `3000` | 0.30% | `60` |
| `10000` | 1.00% | `200` |

## 3.3 KongSwap V2

| Contract | Address |
|---|---|
| V2 Factory | `0x20FB330Cc3943607C7576129A7f87c143C891FE4` |
| V2 Router02 | `0x05ABA6ba27AEba82bcc036Cd9E2fd12486DD7b24` |

Kong V2 pair init-code hash used by the deployed routing stack:

```text
0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f
```

## 3.4 KongSwap V3

| Contract | Address |
|---|---|
| V3 Factory | `0xb12FD27E6e2A0141ccB94d8A033d91f9b20DBEbB` |
| Multicall2 | `0xf043dF67e028C5d792BeeF9D4d9967a5e2b783a0` |
| ProxyAdmin | `0xF7F2ed6072C8dA60d1DC6b36d6B9269335091a00` |
| TickLens | `0x3e40fC95182b63E88494811812B6Abc0aA72731f` |
| NFT Descriptor Library | `0xbd4883d8F88c2C89530E4413FD28905264b17c83` |
| Position Descriptor Implementation | `0x0049C3bA04086179Fe1bbDE2F5ad2111b5282b4c` |
| Position Descriptor Proxy | `0xb8CeC5c0745594ddba38F037db0F08c6064Cd4dA` |
| Nonfungible Position Manager | `0x65Da9A8cd05D27013b0813080d61b8B38B055e63` |
| V3 Migrator | `0x2d090B4770b13DED4453893b8614FC1Fe31dE64C` |
| V3 Staker | `0xC040EA6BbBC453650a1f94A9E8e73a372F2C58a8` |
| QuoterV2 | `0x783252F3B5dB5D97149FE420107d83af1Cc92EcD` |
| SwapRouter02 | `0xd515E86ae4D4BFd0ac289569EfC78b2d16Ca48C3` |

Kong V3 pool init-code hash:

```text
0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54
```

Used/confirmed Kong V3 tiers:

| Fee units | Percent | Tick spacing |
|---:|---:|---:|
| `500` | 0.05% | `10` |
| `3000` | 0.30% | `60` |
| `10000` | 1.00% | `200` |

Do not assume V3 fee `100` simply because V4 uses a 100-unit tier. For V3, query the factory for the exact `(tokenA, tokenB, fee)` pool.

## 3.5 Kong Permit2

```text
Permit2
0x9c59f4869f10339F4E7fACF0D7aa17C42a7BE016
```

## 3.6 KongSwap V4

| Contract | Address |
|---|---|
| PoolManager | `0x9787Fb47999637Ce22147B71Dd2Ae96BA1549154` |
| StateView | `0x5d6815fA355f0245B89046Ff871F6531A87611c5` |
| V4 Quoter | `0x9Ca9F06EF6CD7e18d9854216e6e171448352ae37` |
| PositionDescriptor | `0x26693F946dCF862C36B9716951a4438743005331` |
| PositionManager | `0x5aD568Aa2035f316e565B671E320C505831367e5` |
| V4-capable Universal Router | `0xD5b519Ef1972d9D387CBbf6bFCA5b37Be0DF4B4e` |
| HookFactory | `0x641Df17D7da8eBd895CCf53FC3fdF404F07Fb447` |
| Dynamic Fee Hook | `0x62243BcAc77d6F182328D26B6E908507216dC080` |

Pinned package lineage from the deployed V4 system:

```text
@uniswap/v4-core@1.0.2
@uniswap/v4-periphery@1.0.3
@uniswap/universal-router@2.1.0
local hook compiler: solc 0.8.26
```

Roburna was explicitly tested for Cancun/EIP-1153 transient-storage support before the V4 deployment was accepted.

---

# 4. Protocol models: V2 vs V3 vs V4

## V2

A V2 pool is its own pair contract.

Identity:

```text
factory + token0 + token1 -> pair address
```

State is reserve based:

```text
reserve0
reserve1
```

LP ownership is fungible ERC20 pair tokens.

## V3

A V3 pool is its own pool contract and is selected by:

```text
factory + token0 + token1 + fee -> pool address
```

State is concentrated-liquidity based:

```text
sqrtPriceX96
tick
active liquidity
initialized ticks
```

LP positions are ERC721 NFTs owned through the Nonfungible Position Manager.

## V4

V4 does **not** deploy one pool contract per pool. All pools are state entries inside the singleton PoolManager.

Identity is a `PoolKey`:

```solidity
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}
```

Conceptually:

```text
PoolId = keccak256(abi.encode(PoolKey))
```

A reusable SDK must never model a V4 `PoolId` as though it were a V2/V3 contract address.

---

# 5. Fee-tier master table

## Arbour V3 and Kong V3 tiers used

```text
500    -> 0.05% -> tick spacing 10
3000   -> 0.30% -> tick spacing 60
10000  -> 1.00% -> tick spacing 200
```

## Kong V4 static/no-hook tiers used

```text
100    -> 0.01% -> tick spacing 1
500    -> 0.05% -> tick spacing 10
3000   -> 0.30% -> tick spacing 60
10000  -> 1.00% -> tick spacing 200
```

Dynamic-fee hook pools are a separate category. Their PoolKey/hook metadata must be retained and they must not be flattened into a static fee tier.

---

# 6. Arbour V2 mechanics

## Discovery

```text
factory.getPair(tokenA, tokenB)
factory.allPairsLength()
factory.allPairs(index)
```

Useful pair reads:

```text
token0()
token1()
getReserves()
totalSupply()
balanceOf(lpOwner)
```

A non-zero pair address does not mean the pool is tradeable. The later scripts correctly checked:

```text
reserve0 > 0
reserve1 > 0
```

## Quote

Arbour Router02 can provide `getAmountsOut`, or the V2 formula can be evaluated from reserves when the fee model is known.

## Swap

Typical exact-input path:

```text
1. get pair
2. verify reserves
3. get live quote
4. approve tokenIn to Arbour V2 Router when required
5. build swapExactTokensForTokens
6. apply amountOutMin
7. simulate exact calldata
8. broadcast
9. verify receipt + balance delta
```

Execution contract:

```text
0xE8B48213F7675f69007516ddc1944d439E71D0d8
```

Arbour V2 execution does not use Kong Permit2 or Kong Universal Router.

---

# 7. Arbour V3 mechanics

## Pool discovery

```text
factory.getPool(tokenIn, tokenOut, fee)
```

Factory:

```text
0x75aaA4B8d474b0Ac63ceac35cf6F371d8808631B
```

## State pre-check

```text
pool.slot0()
pool.liquidity()
```

`liquidity()` is current active/in-range liquidity. It is not the sum of all historical deposits and is not necessarily the sum of every NFT's liquidity.

## Quote

QuoterV2:

```text
0x4b12d2869B8581c286F8583e4d2167cAEC3dC9fa
```

Interface pattern:

```solidity
quoteExactInputSingle({
    tokenIn,
    tokenOut,
    amountIn,
    fee,
    sqrtPriceLimitX96: 0
})
```

A pool can exist but still be unable to quote the requested amount. Therefore the route state is not simply `pool exists`.

Recommended progression:

```text
pool exists
 -> active liquidity > 0
 -> quote succeeds for this exact amount
 -> final swap simulation succeeds
 -> executable
```

## Swap

Router:

```text
0xE0960f56D353194F8abE52180325a21bd146dabE
```

Execution pattern:

```solidity
exactInputSingle({
    tokenIn,
    tokenOut,
    fee,
    recipient,
    deadline,
    amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96
})
```

For ordinary market swaps, `sqrtPriceLimitX96=0` is the normal unrestricted-by-custom-boundary path. For controlled empty-pool repair, the repair tooling instead used an explicit target sqrt limit.

---

# 8. Kong V2 mechanics

## Contracts

```text
Factory
0x20FB330Cc3943607C7576129A7f87c143C891FE4

Router02
0x05ABA6ba27AEba82bcc036Cd9E2fd12486DD7b24
```

The routing implementation used the standard Uniswap-V2-style quote formula:

```text
amountInWithFee = amountIn * 997

amountOut =
    amountInWithFee * reserveOut
    -----------------------------------------
    reserveIn * 1000 + amountInWithFee
```

This corresponds to the standard 0.30% V2 calculation.

One historical analytics registry snapshot still carried Kong V2 fee metadata as unverified. For the future SDK, keep execution behavior and analytics metadata distinct: verify the deployed contract/runtime behavior and version the fee metadata rather than silently trusting an old UI label.

## Direct execution

Direct Router02 is useful for diagnostics, isolated V2 tests, and liquidity management.

## Universal Router execution

Kong V2 swaps can also be executed through the Kong Universal Router using top-level command:

```text
V2_SWAP_EXACT_IN = 0x08
```

For a future SDK, this gives a common Kong execution surface across V2/V3/V4.

---

# 9. Kong V3 mechanics

## Discovery

```text
factory.getPool(tokenA, tokenB, fee)
```

Factory:

```text
0xb12FD27E6e2A0141ccB94d8A033d91f9b20DBEbB
```

## Quote

QuoterV2:

```text
0x783252F3B5dB5D97149FE420107d83af1Cc92EcD
```

Use the same pool-exists -> active-liquidity -> quote-succeeds progression as Arbour V3.

A major behavior found in testing was an initialized Kong V3 pool whose quoter reverted with `Unexpected error`. The early script allowed that one route failure to abort the whole buy. The corrected route architecture treats that as:

```text
KONG_V3_<fee>_UNAVAILABLE=<reason>
```

and continues all other candidates.

That policy should be permanent in the SDK.

## Direct execution

SwapRouter02:

```text
0xd515E86ae4D4BFd0ac289569EfC78b2d16Ca48C3
```

Useful for:

- isolated V3 tests;
- controlled price repair;
- deterministic V3-only tooling;
- diagnostics.

## Universal Router execution

Top-level command:

```text
V3_SWAP_EXACT_IN = 0x00
```

V3 paths are packed:

```text
token0
uint24 fee
token1
[uint24 fee
token2 ...]
```

The current builder supports one-hop V3 and two-V3-hop exact-input paths.

---

# 10. Permit2 architecture

Permit2:

```text
0x9c59f4869f10339F4E7fACF0D7aa17C42a7BE016
```

The tested contract-layer authorization topology for Kong Universal Router ERC20 input is:

```text
ERC20 token
  └─ allowance -> Permit2

Permit2
  └─ allowance -> selected Universal Router

Universal Router
  └─ executes V2/V3/V4 route
```

The package helper used:

```text
ERC20.approve(Permit2, MaxUint256)
```

when ERC20 allowance was insufficient, then:

```text
Permit2.approve(token, router, MAX_UINT160, expiration)
```

when the Permit2 allowance to the selected router was insufficient or expiring.

A future browser wallet SDK may choose Permit2 signature workflows rather than persisting the same on-chain approval pattern, but that is a wallet/signing-layer decision. The contract topology above should remain independent from UI design.

---

# 11. Kong V4 architecture

PoolManager:

```text
0x9787Fb47999637Ce22147B71Dd2Ae96BA1549154
```

StateView:

```text
0x5d6815fA355f0245B89046Ff871F6531A87611c5
```

V4Quoter:

```text
0x9Ca9F06EF6CD7e18d9854216e6e171448352ae37
```

PositionManager:

```text
0x5aD568Aa2035f316e565B671E320C505831367e5
```

Universal Router:

```text
0xD5b519Ef1972d9D387CBbf6bFCA5b37Be0DF4B4e
```

V4 is a singleton architecture. There is no one pool contract to call per pair. A V4 pool reference should retain:

```text
poolId
currency0
currency1
fee
tickSpacing
hooks
hookData
```

Do not normalize away the hook address: it is part of pool identity.

---

# 12. Kong V4 dynamic-fee hook

Known deployed hook infrastructure:

```text
HookFactory
0x641Df17D7da8eBd895CCf53FC3fdF404F07Fb447

DynamicFeeHook
0x62243BcAc77d6F182328D26B6E908507216dC080
```

Recorded hook metadata:

```text
permissionMask = 128
permission     = beforeSwap
initialFee     = 3000
currentFee     = 3000  # at captured state
```

A hook-enabled pool should carry at least:

```text
hook address
hookData
dynamicFee flag
reported current fee
permission mask
hook code hash, when available
```

If a hook later implements custom accounting, pool TVL/reserve semantics may differ from ordinary no-hook pools. The analytics and risk layer must preserve this distinction.

---

# 13. V4 StateView and the TVL limitation

StateView is the read lens used for authoritative V4 core state such as active liquidity, price/tick, and other pool state.

The current analytics registry explicitly recorded:

```text
StateView     = configured
ReservesLens  = null
V4 TVL        = partial
```

This distinction matters:

> **StateView is not a ReservesLens.**

Do not derive a fake total reserve/TVL number from `activeLiquidity`.

The lack of a compatible ReservesLens does **not** prevent:

- live V4 quotes;
- StateView active-liquidity reads;
- tick/price reads;
- swap execution;
- swap event indexing;
- hook indexing;
- position management.

For execution depth and arbitrage, the intended trade amount should be passed through the live V4 quoter.

---

# 14. V4 quoting

A V4 exact-input quote is PoolKey based. Conceptually:

```text
poolKey
zeroForOne
exactAmount
hookData
```

Direction:

```text
zeroForOne = tokenIn == poolKey.currency0
```

The current routing code bounds V4 exact input to the valid `uint128` amount range.

A V4 quote failure should invalidate only that candidate. It must not suppress V2/V3 quotes.

---

# 15. Kong Universal Router topology

The V4-capable Kong Universal Router is:

```text
0xD5b519Ef1972d9D387CBbf6bFCA5b37Be0DF4B4e
```

Its deployed topology ties together:

```text
Permit2
0x9c59f4869f10339F4E7fACF0D7aa17C42a7BE016

WRBA/WETH9
0xA3e8E81810c2908EE72b8E8a13371BEd42D91e7b

Kong V2 Factory
0x20FB330Cc3943607C7576129A7f87c143C891FE4

Kong V3 Factory
0xb12FD27E6e2A0141ccB94d8A033d91f9b20DBEbB

Kong V4 PoolManager
0x9787Fb47999637Ce22147B71Dd2Ae96BA1549154

Kong V3 PositionManager
0x65Da9A8cd05D27013b0813080d61b8B38B055e63

Kong V4 PositionManager
0x5aD568Aa2035f316e565B671E320C505831367e5
```

This is the contract-level reason it can execute Kong V2/V3/V4 routes but not Arbour swaps.

---

# 16. Universal Router top-level commands used here

```text
V3_SWAP_EXACT_IN          = 0x00
V2_SWAP_EXACT_IN          = 0x08
V4_SWAP                   = 0x10
V4_INITIALIZE_POOL        = 0x13
V4_POSITION_MANAGER_CALL  = 0x14
```

The Universal Router execution method is:

```solidity
execute(bytes commands, bytes[] inputs, uint256 deadline)
```

The route builder returns a transaction description including:

```text
to
data
value
commands
inputs
deadline
minimumAmountOut
executionMode
```

For the ERC20 swap paths used here, `value` is normally zero unless a future native-token path explicitly requires native value.

---

# 17. V4 periphery action constants

The tested `@uniswap/v4-periphery@1.0.3` action values are:

```text
INCREASE_LIQUIDITY              0x00
DECREASE_LIQUIDITY              0x01
MINT_POSITION                   0x02
BURN_POSITION                   0x03
INCREASE_LIQUIDITY_FROM_DELTAS  0x04
MINT_POSITION_FROM_DELTAS       0x05
SWAP_EXACT_IN_SINGLE            0x06
SWAP_EXACT_IN                   0x07
SWAP_EXACT_OUT_SINGLE           0x08
SWAP_EXACT_OUT                  0x09
DONATE                          0x0a
SETTLE                          0x0b
SETTLE_ALL                      0x0c
SETTLE_PAIR                     0x0d
TAKE                            0x0e
TAKE_ALL                        0x0f
TAKE_PORTION                    0x10
TAKE_PAIR                       0x11
CLOSE_CURRENCY                  0x12
CLEAR_OR_TAKE                   0x13
SWEEP                           0x14
WRAP                            0x15
UNWRAP                          0x16
MINT_6909                       0x17
BURN_6909                       0x18
```

Routing constants:

```text
MSG_SENDER         = 0x0000000000000000000000000000000000000001
ADDRESS_THIS       = 0x0000000000000000000000000000000000000002
OPEN_DELTA         = 0
CONTRACT_BALANCE   = 2^255
DYNAMIC_FEE_FLAG   = 0x800000
OVERRIDE_FEE_FLAG  = 0x400000
ALL_HOOK_MASK      = 0x3fff
BEFORE_SWAP_FLAG   = 1 << 7
```

These belong in one pinned protocol module in the future SDK. Do not duplicate them across UI, arb, and CLI code.

---

# 18. Kong exact-input route shapes supported by the current builder

The current route builder supports one or two exact-input steps.

## Single-step

```text
V2
V3
V4
```

## Two-step

```text
V2 -> V2
V3 -> V3

V2 -> V3
V3 -> V2

V2 -> V4
V3 -> V4

V4 -> V2
V4 -> V3

V4 -> V4
```

This is a useful initial SDK boundary. If a later system needs three or more steps, do not simply append steps blindly. Intermediate-token custody, V2 direct-pair transfers, V3 payer flags, V4 delta accounting, gas, and slippage attribution must all be handled deliberately.

---

# 19. Mixed-route intermediate-token mechanics

Mixed routing works because the builder intentionally controls where intermediate output is held.

## V2 -> V3

```text
V2 output recipient = ADDRESS_THIS
V3 input             = CONTRACT_BALANCE
final output         = final recipient
```

## V3 -> V2

The builder can compute the second V2 pair and direct the V3 output to that pair, then perform the V2 command from the pair's incoming balance.

## V2 -> V4 / V3 -> V4

The first leg can leave the intermediate token at the router. The V4 action settles the router-held token into PoolManager accounting and consumes an open delta for the second leg.

## V4 -> V2

The V4 output can be sent directly to the second-leg V2 pair, avoiding an unknown residual intermediate token at the Universal Router.

## V4 -> V3

V4 output can go to `ADDRESS_THIS`; V3 then consumes `CONTRACT_BALANCE`.

## V4 -> V4

The first V4 action produces the intermediate amount; the second V4 action consumes the open delta/accounting state.

A valuable post-condition from the smoke tests is:

```text
Universal Router unexpected token balances == 0
```

The final execution smoke specifically checked that the router ended empty.

---

# 20. Normalized route model for a future SDK

The route should be represented as data, not as UI-specific branching.

Example shape:

```ts
type Route = {
  chainId: 159
  kind: string
  bridge: Address | null
  amountIn: bigint
  amountOut: bigint
  steps: RouteStep[]
}

type RouteStep = {
  exchange: "arbour" | "kongswap"
  protocol: "v2" | "v3" | "v4"

  tokenIn: Address
  tokenOut: Address

  pair?: Address
  pool?: Address
  poolId?: Hex

  fee?: number
  tickSpacing?: number

  hooks?: Address
  hookData?: Hex

  amountIn: bigint
  amountOut: bigint
}
```

The execution layer can then dispatch based on `exchange + protocol`.

---

# 21. Quote -> route -> build -> simulate -> execute pipeline

Recommended permanent pipeline:

```text
DISCOVER ELIGIBLE POOLS
         |
         v
QUOTE ALL ELIGIBLE ROUTES
         |
         v
MARK FAILED/EMPTY ROUTES UNAVAILABLE
         |
         v
SORT BY EXECUTABLE OUTPUT
         |
         v
SELECT ROUTE
         |
         v
BUILD EXACT CALLDATA
         |
         v
CHECK APPROVAL REQUIREMENTS
         |
         v
FRESH REQUOTE / FINAL SIMULATION
         |
         v
ESTIMATE GAS
         |
         v
SIGN
         |
         v
BROADCAST SAFELY
         |
         v
VERIFY RECEIPT + OUTPUT DELTA
```

Discovery and execution should remain separate. This is essential for an SDK, arb engine, browser UI, server agent, and test harness.

---

# 22. Multi-exchange route selection

The desired cross-exchange candidate set is:

```text
Arbour V2
Arbour V3 500
Arbour V3 3000
Arbour V3 10000

Kong V2
Kong V3 500
Kong V3 3000
Kong V3 10000

Kong V4 100
Kong V4 500
Kong V4 3000
Kong V4 10000

+ valid hook-enabled Kong V4 pools
```

For an exact-input comparison, every candidate must quote the **same input amount**.

The winning venue can change after any liquidity or swap state change, so no previous best route should be cached as an execution decision.

The multi-exchange selector can compare all of the above, but execution must be dispatched:

```text
Arbour winner -> Arbour router / Arbour builder
Kong winner   -> Kong Universal Router or explicit Kong direct router
```

---

# 23. Direct stable/stable vs bridged routes

For a conversion such as tUSDC -> tUSDT, do not assume WRBA is always the best bridge.

Compare:

```text
DIRECT
  tUSDC -> tUSDT

BRIDGED
  tUSDC -> WRBA -> tUSDT
```

and, where supported, all valid venue combinations for both legs.

For a non-atomic sequential two-transaction workflow:

1. execute leg 1;
2. measure the **actual** bridge-token balance delta;
3. re-quote every eligible leg-2 venue using that exact received amount;
4. select leg 2 fresh.

For production trading, an atomic router/executor path is preferable where supported.

---

# 24. Dead-pool and reverting-quoter policy

One broken route must not crash the route engine.

Bad behavior:

```text
quote Kong V3 500
  -> revert
  -> abort entire buy
```

Correct behavior:

```text
quote Kong V3 500
  -> revert
  -> mark route unavailable
  -> continue Arbour V2/V3 + Kong V2/V3/V4
```

Suggested candidate states:

```ts
type CandidateStatus =
  | "QUOTED"
  | "PAIR_MISSING"
  | "POOL_MISSING"
  | "ZERO_RESERVES"
  | "ZERO_ACTIVE_LIQUIDITY"
  | "QUOTE_REVERT"
  | "SIMULATION_REVERT"
  | "STALE"
```

The fatal route-search condition should be:

```text
no executable candidates remain
```

not merely one individual quote failure.

---

# 25. Amount-sensitive routing

The best venue for `1` token is not necessarily the best venue for `1,000` tokens.

Quotes must be sized to the actual intended trade.

For operator workflows that requested approximately a target output, the later scripts used iterative live sizing:

```text
small live probe
 -> estimate required input
 -> quote exact updated input
 -> resize
 -> repeat
```

That is still an exact-input execution method whose input was sized toward a target. It should not be mislabeled as protocol-native exact-output routing.

Useful SDK trade-mode distinction:

```text
EXACT_INPUT
TARGET_OUTPUT_ESTIMATE
EXACT_OUTPUT
```

---

# 26. Quote freshness and fingerprints

A quote should carry enough metadata to know whether it is still valid.

Recommended fields:

```text
quoteBlock
quotedAt
expiresAtBlock / maxAgeBlocks
routeFingerprint
amountIn
amountOut
pool/pair IDs
fees
hook identity
```

A later Kong runtime test already used concepts such as:

```text
quoteBlock
expiresAtBlock
maxAgeBlocks
routeFingerprint
```

For arbitrage, always re-quote and re-simulate before execution.

---

# 27. Quote provenance

A unified SDK should preserve where a value came from.

Recommended labels:

```text
ONCHAIN_V2_RESERVES
ONCHAIN_V2_ROUTER
ONCHAIN_V3_QUOTER
ONCHAIN_V4_QUOTER
KONG_ROUTE_API
ANALYTICS_INDEXER
ANALYTICS_SNAPSHOT
```

Then enforce policies such as:

```text
trade execution requires fresh ONCHAIN_* or fresh KONG_ROUTE_API
historical charting may use ANALYTICS_*
```

Do not treat a chart price and an executable quote as the same trust class.

---

# 28. V2 liquidity ownership and removal

V2 LP ownership is pair ERC20 balance:

```text
pair.balanceOf(wallet)
```

Complete removal:

```text
approve LP token -> Router02
removeLiquidity(...)
verify pair.balanceOf(wallet) == 0
```

There is no NFT lifecycle in V2.

---

# 29. V3 liquidity ownership and NFT lifecycle

V3 positions are ERC721 NFTs in the position manager.

Important fields:

```text
token0
token1
fee
tickLower
tickUpper
liquidity
tokensOwed0
tokensOwed1
```

Correct full cleanup:

```text
if liquidity > 0:
    decrease 100% liquidity

collect:
    amount0Max = MaxUint128
    amount1Max = MaxUint128

re-read position

burn only if:
    liquidity == 0
    tokensOwed0 == 0
    tokensOwed1 == 0
```

If liquidity is already zero but tokens remain owed, collect first.

This exact zero-state rule applies to both Arbour V3 and Kong V3 position NFTs.

---

# 30. V4 liquidity ownership and NFT lifecycle

V4 liquidity positions are also NFTs, but management is through the V4 PositionManager action system:

```text
modifyLiquidities(bytes unlockData, uint256 deadline)
```

Useful reads:

```text
balanceOf(owner)
ownerOf(tokenId)
nextTokenId()
getPositionLiquidity(tokenId)
getPoolAndPositionInfo(tokenId)
```

The action lifecycle includes:

```text
MINT_POSITION
INCREASE_LIQUIDITY
DECREASE_LIQUIDITY
BURN_POSITION
SETTLE_PAIR
TAKE_PAIR
```

For zero-liquidity NFT cleanup, the gate used in the tooling is:

```text
getPositionLiquidity(tokenId) == 0
```

Then simulate an official burn action before broadcasting.

V4 does not expose V3's `tokensOwed0/tokensOwed1` fields in the same way, so do not fabricate a V3-style burn check for V4.

---

# 31. V4 zero-liquidity burn encoding

For an already zero-liquidity V4 NFT, the cleanup flow used:

```text
BURN_POSITION = 0x03
TAKE_PAIR     = 0x11
```

Burn params:

```text
uint256 tokenId
uint128 amount0Min
uint128 amount1Min
bytes hookData
```

Take-pair params:

```text
address currency0
address currency1
address recipient
```

Then:

```text
PositionManager.modifyLiquidities(unlockData, deadline)
```

Safety sequence:

```text
fresh owner check
fresh getPositionLiquidity(tokenId)
liquidity == 0
eth_call simulation
broadcast
post-burn verification
```

---

# 32. NFT enumeration and flaky RPC behavior

During V4 cleanup testing, some RPC calls intermittently returned missing-revert-data errors while scanning PositionManager token IDs.

A safe inventory procedure is:

```text
expected owned count = PositionManager.balanceOf(wallet)

scan ownerOf(tokenId) across the token ID range

if discovered-owned count != balanceOf:
    repeat/rescan

never begin destructive operations until:
    owned count matches exactly
    unresolved lookups == 0
```

After a burn, do not treat an arbitrary `ownerOf` RPC error as proof that the NFT disappeared.

Better proof:

```text
wallet NFT balance decreased by exactly one
AND
ownerOf(tokenId) deterministically reports nonexistent
```

This belongs in the future position-management SDK, not just one cleanup script.

---

# 33. Full-range V3 LP mechanics

The recent V3 LP tests used full-range positions. For tick spacing 60, the full-range bounds used were:

```text
tickLower = -887220
tickUpper =  887220
```

For a future V3 LP module:

1. use exact integer V3 liquidity math for planning;
2. do not use floating-point math as final authority;
3. run a fresh on-chain `callStatic.mint` immediately before the real mint;
4. derive minimum amounts/slippage from that fresh state.

---

# 34. Empty V3 pool price repair

An initialized V3 pool can have zero active liquidity while retaining an old stored tick/price.

You cannot create a second V3 pool for the same:

```text
token0
token1
fee
```

The controlled repair pattern used was:

```text
1. confirm intended pool
2. confirm active liquidity is zero, or only controlled temporary liquidity exists
3. mint tiny temporary full-range bootstrap liquidity
4. read current sqrtPriceX96
5. compare to exact target sqrtPriceX96
6. choose the mathematically correct swap direction
7. execute with target sqrtPriceLimitX96 hard stop
8. verify final price
9. remove temporary bootstrap
10. mint final intended LP
```

The swap direction must be derived from token ordering and sqrt price, not from a human label such as “WRBA went down.”

---

# 35. Token economics vs pool ratios

A V3/V4 pool ratio is a token ratio, not a USD price.

Example used in recent repair work:

```text
tUSDT = $1.02
WRBA  = $0.2868
```

Then:

```text
1 WRBA = 0.2868 / 1.02
       = 0.2811764705882353 tUSDT
```

The target V3 price is therefore that token ratio and its corresponding `sqrtPriceX96`.

Do not write a USD value directly into a pool initializer unless the opposite token's USD value has deliberately been included in the conversion.

---

# 36. Analytics system architecture

Known analytics project:

```text
~/roburna-dex-analytics
```

Its intended separation is:

```text
on-chain logs + state
        |
        v
     indexer
        |
        v
    PostgreSQL
        |
        +------> internal/private API
        |
        +------> publisher
                    |
                    v
             static/cacheable public snapshots
```

The data model intentionally separates:

```text
Exchange
Protocol
Deployment
```

so two DEXes containing the same token pair are not accidentally merged.

Example deployment IDs:

```text
arbour-v2
kongswap-v2
kongswap-v3
kongswap-v4
```

Arbour V3 exists operationally and was used by the swap/LP scripts. A captured analytics registry state did not yet show `arbour-v3`, so future integration should verify the **current** registry rather than assuming it is already indexed.

---

# 37. Analytics registry commands

```bash
cd ~/roburna-dex-analytics

./konganalytics dex list

./konganalytics dex template V2
./konganalytics dex template V3
./konganalytics dex template V4

./konganalytics dex validate /path/to/my.dex.json
./konganalytics dex add /path/to/my.dex.json

./konganalytics indexer
```

The registry files hot-reload. Adding a compatible venue does not inherently require a frontend rebuild.

Captured registry files included:

```text
arbour-v2.dex.json
kongswap-v2.dex.json
kongswap-v3.dex.json
kongswap-v4.dex.json
```

Before beginning the next system, run:

```bash
./konganalytics dex list
```

and reconcile the actual live registry with the desired operational set:

```text
Arbour V2
Arbour V3
KongSwap V2
KongSwap V3
KongSwap V4
```

---

# 38. Analytics adapter model

Known adapter types:

```text
V2 -> uniswap-v2
V3 -> uniswap-v3
V4 -> uniswap-v4-poolmanager
```

A reusable deployment record should preserve:

```text
deployment_id
exchange_id
exchange_name
protocol
adapter
factory/core address
router
quoter
position manager
state view
reserves lens
fee source
start block
capabilities
```

This same shape is a good starting point for the future SDK registry.

---

# 39. Indexing model

## V2

Track:

```text
pair address
token0
token1
reserves
created block
updated block
PairCreated
Sync
Swap
Mint
Burn
```

## V3

Track:

```text
pool address
token0
token1
fee
tick spacing
sqrtPriceX96
tick
active liquidity
created block
PoolCreated
Initialize
Swap
Mint
Burn
PositionManager ownership
```

## V4

Track:

```text
poolId
currency0
currency1
fee
dynamic_fee
last_swap_fee
tick_spacing
hooks
hook_code_hash
hook_permission_mask
sqrtPriceX96
tick
active liquidity
TVL completeness metadata
PositionManager ownership
PoolManager events
hook events
```

The indexer work also stored block hash/cursor state and included reorg-aware cursor validation. Preserve that behavior if the data is used by arbitrage logic.

---

# 40. Kong contract-runtime route API

The Kong contract project also has a runtime route API. This is separate from the analytics publication system.

Default ports in the source:

```text
Route API: 8088
Monitor:   8090
```

Known endpoints:

```text
GET  /health
GET  /tokens
GET  /quote
POST /build
GET  /pools
GET  /events
GET  /positions/:owner
```

This API is highly useful for a future SDK because it already exposes normalized Kong V2/V3/V4 route information and can build Universal Router calldata.

---

# 41. Route API — GET /health

Purpose:

- chain connectivity;
- block number;
- RPC count;
- indexer cursor;
- indexer lag;
- database health/time;
- deployment status;
- critical contract addresses.

A caller should reject execution data if:

```text
chainId != 159
or
indexer/runtime health is outside policy
or
expected router/Permit2 contracts differ from pinned deployment
```

---

# 42. Route API — GET /tokens

Returns the runtime manifest token registry.

For operator UX, symbols are convenient. Internally normalize every token to:

```text
checksum address
decimals
symbol/name metadata
```

Never infer decimals from a symbol.

---

# 43. Route API — GET /quote

Query fields:

```text
tokenIn
tokenOut
amountIn
raw=true|false
```

If `raw=false`, `amountIn` is parsed using token decimals. If `raw=true`, the caller supplies raw integer units.

Conceptual call:

```bash
curl -s \
  'http://127.0.0.1:8088/quote?tokenIn=WRBA&tokenOut=tUSDT&amountIn=100'
```

Response concept:

```json
{
  "chainId": 159,
  "tokenIn": {},
  "tokenOut": {},
  "amountIn": "...",
  "best": {},
  "routes": []
}
```

Serialized route steps can contain:

```text
protocol
tokenIn
tokenOut
pair
poolId
tickSpacing
hooks
hookData
hook
fee
amountIn
amountOut
gasEstimate
initializedTicksCrossed
```

This is already close to a future SDK route DTO.

---

# 44. Route API — POST /build

The build endpoint:

```text
1. resolves tokens
2. requotes routes
3. chooses routeIndex
4. validates recipient
5. applies slippage/deadline
6. builds Universal Router calldata
7. optionally reports approval state for owner
```

Conceptual body:

```json
{
  "tokenIn": "WRBA",
  "tokenOut": "tUSDT",
  "amountIn": "100",
  "raw": false,
  "routeIndex": 0,
  "recipient": "0x...",
  "owner": "0x...",
  "slippageBps": 100,
  "deadlineSeconds": 600
}
```

Response includes:

```text
chainId
tokenIn
tokenOut
amountIn
route
transaction
approvals
```

Approval detail can include:

```text
ERC20 -> Permit2
Permit2 -> selected transaction.to router
```

If a selected route contains V4, the builder refuses it when the V4-capable Universal Router is not available.

---

# 45. Route API — GET /pools

The runtime API can expose indexed:

```text
v2
v3
v4
v4Hooks
```

Useful for:

- pool discovery;
- dashboards;
- selecting test pools;
- arb graph construction.

It should not replace a live amount-specific quote for execution.

---

# 46. Route API — GET /events

Supports bounded event retrieval and optional protocol filter.

Useful for:

- activity monitoring;
- swap-triggered arb refresh;
- liquidity mutation tracking;
- debugging;
- transaction attribution.

For extremely latency-sensitive arbitrage, direct RPC subscriptions/log streams may be preferable to polling an API, but the endpoint is useful as a normalized data source.

---

# 47. Route API — GET /positions/:owner

Returns indexed V3 and V4 ownership records.

Useful for:

- LP dashboards;
- finding position NFTs;
- zero-liquidity cleanup candidates;
- reconciliation.

Before a destructive action such as burn, always re-read the live PositionManager. Indexed ownership is discovery data, not destructive-operation authority.

---

# 48. Kong route engine search behavior

The route engine effectively does:

```text
quote direct V2
quote best direct V3 over configured fee tiers
quote direct V4 over matching V4 pools

for each configured bridge token:
    quote input -> bridge on V2/V3/V4
    for each successful first leg:
        quote bridge -> output on V2/V3/V4

sort candidates by amountOut descending
```

That gives both direct and mixed routes.

The current builder limit is up to two exact-input steps.

---

# 49. Kong V4 action encoding should remain centralized

The future SDK should not make every service know V4 settlement internals.

Recommended boundary:

```text
KongV4Adapter
    -> quote state
    -> produce normalized route step

KongUniversalRouterBuilder
    -> convert normalized route steps into command bytes + action bytes
```

That isolates:

- `OPEN_DELTA`;
- `CONTRACT_BALANCE`;
- payer flags;
- `SETTLE`/`SETTLE_ALL`;
- `TAKE`/`TAKE_PAIR`;
- intermediate router custody.

---

# 50. Kong project operational entrypoint

Known contract project:

```bash
cd ~/kongswap-contracts-roburna-testnet-v0.9.0
```

A common operational pattern used throughout testing:

```bash
docker compose run --rm \
  --entrypoint node \
  dexctl \
  /app/path/to/script.mjs
```

Important project files/modules seen in the deployed package:

```text
deployments/159/addresses.json
config/chains/roburna-testnet.yml

src/lib/config.js
src/lib/manifest.js
src/lib/runtime-manifest.js
src/lib/abis.js
src/lib/routing.js
src/lib/v4-actions.js
src/lib/v4-artifacts.js

src/runtime/indexer.js
src/runtime/router-api.js
src/runtime/monitor.js
```

For the future SDK, parse the manifest directly instead of scraping shell output.

---

# 51. Kong deployment manifest as source of truth

Primary Kong deployment registry:

```text
deployments/159/addresses.json
```

Recommended startup validation:

```text
load manifest
verify chainId == 159
verify expected contract addresses
verify code exists at each critical address
optionally verify code hashes
verify router topology for high-assurance startup
```

The contract package previously performed bytecode/topology audits for deployed V2/V3/V4 components. Preserve that evidence-first startup style.

---

# 52. Arbour deployment config should stay separate

Arbour is not part of the Kong deployment manifest.

A future config could be:

```json
{
  "exchange": "arbour",
  "chainId": 159,
  "v2": {
    "factory": "0xE756Af80bC019689B4C4508026147deb80C108B9",
    "router": "0xE8B48213F7675f69007516ddc1944d439E71D0d8"
  },
  "v3": {
    "factory": "0x75aaA4B8d474b0Ac63ceac35cf6F371d8808631B",
    "router": "0xE0960f56D353194F8abE52180325a21bd146dabE",
    "quoter": "0x4b12d2869B8581c286F8583e4d2167cAEC3dC9fa",
    "positionManager": "0x862854A6c985370d5F4942d9AaB151248512C1ed",
    "feeTiers": [500, 3000, 10000]
  }
}
```

This prevents accidental cross-wiring between exchanges.

---

# 53. Suggested consolidated venue registry

```json
{
  "chainId": 159,
  "wrappedNative": "0xA3e8E81810c2908EE72b8E8a13371BEd42D91e7b",
  "venues": [
    {"id":"arbour-v2",  "exchange":"arbour",   "protocol":"V2"},
    {"id":"arbour-v3",  "exchange":"arbour",   "protocol":"V3"},
    {"id":"kongswap-v2","exchange":"kongswap", "protocol":"V2"},
    {"id":"kongswap-v3","exchange":"kongswap", "protocol":"V3"},
    {"id":"kongswap-v4","exchange":"kongswap", "protocol":"V4"}
  ]
}
```

Avoid identifiers such as simply `"v3"`, because protocol version alone does not identify the exchange.

---

# 54. Suggested SDK adapter interface

```ts
interface DexAdapter {
  id: string
  exchange: string
  protocol: "V2" | "V3" | "V4"

  discoverPools(): Promise<PoolRef[]>

  readPoolState(pool: PoolRef): Promise<PoolState>

  quoteExactInput(req: ExactInputRequest): Promise<Quote | null>

  buildExactInput(
    quote: Quote,
    recipient: Address,
    slippageBps: number,
    deadline: number
  ): Promise<BuiltTransaction>

  approvalRequirements?(
    owner: Address,
    quote: Quote
  ): Promise<ApprovalRequirement[]>
}
```

Implementations:

```text
ArbourV2Adapter
ArbourV3Adapter
KongV2Adapter
KongV3Adapter
KongV4Adapter
KongUniversalRouterBuilder
```

The selector should not need to know how each quote is obtained. The executor should not need to know why the selector picked it.

---

# 55. Suggested normalized pool references

## V2

```ts
{
  exchange: "arbour" | "kongswap",
  protocol: "V2",
  factory,
  router,
  pair,
  token0,
  token1
}
```

## V3

```ts
{
  exchange: "arbour" | "kongswap",
  protocol: "V3",
  factory,
  router,
  quoter,
  positionManager,
  pool,
  token0,
  token1,
  fee,
  tickSpacing
}
```

## V4

```ts
{
  exchange: "kongswap",
  protocol: "V4",
  poolManager,
  stateView,
  quoter,
  positionManager,
  universalRouter,
  permit2,
  poolId,
  key: {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks
  },
  hookData
}
```

---

# 56. Suggested quote object

```ts
type Quote = {
  chainId: 159
  exchange: string
  protocol: "V2" | "V3" | "V4"

  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  amountOut: bigint

  pair?: Address
  pool?: Address
  poolId?: Hex

  fee?: number
  tickSpacing?: number
  hooks?: Address
  hookData?: Hex

  blockNumber: bigint
  quotedAt: number
  expiresAtBlock?: bigint

  executable: boolean
  failureReason?: string
}
```

For arbitrage, add:

```text
routeFingerprint
gasEstimate
source block/state identity
expected gross profit
expected net profit
minimum profit floor
tax assumptions
simulation result
```

---

# 57. Suggested approval object

Approval state should be separate from route state.

```ts
type ApprovalRequirement = {
  token: Address
  owner: Address
  spender: Address
  required: bigint
  current: bigint
  expiresAt?: number
  kind: "ERC20_ALLOWANCE" | "PERMIT2_ALLOWANCE"
}
```

Contract-level spender map:

```text
Arbour V2 swap       -> Arbour V2 Router
Arbour V3 swap       -> Arbour V3 Router
Arbour V3 LP         -> Arbour V3 PositionManager

Kong V2 direct       -> Kong V2 Router
Kong V3 direct       -> Kong V3 SwapRouter02
Kong V3 LP           -> Kong V3 PositionManager

Kong Universal swap  -> ERC20 -> Permit2 -> Universal Router
Kong V4 LP           -> use the tested V4 PositionManager/Permit2 settlement flow
```

Swap approvals and LP approvals are different concerns.

---

# 58. Slippage policy

Typical test setting:

```text
SLIPPAGE_BPS=100
```

which is 1%.

Exact-input minimum:

```text
amountOutMinimum =
    quotedAmountOut * (10000 - slippageBps) / 10000
```

For LP removal, derive `amount0Min` and `amount1Min` from fresh simulation/quote rather than permanently using zero in production automation.

For controlled V3 price repair, use a hard `sqrtPriceLimitX96` in addition to ordinary amount protections.

---

# 59. Final simulation policy

The safer execution pattern evolved to:

```text
quote
 -> select
 -> approval transactions if required
 -> fresh quote
 -> exact provider.call / callStatic
 -> estimateGas
 -> sign
 -> broadcast
```

If a route fails **before broadcast** during final simulation:

```text
exclude route
requote remaining routes
select another
```

Once a signed transaction may have been broadcast, do not immediately fail over to another swap. First resolve the first transaction by nonce/hash to avoid duplicate execution.

---

# 60. Safe raw-transaction broadcast policy

A robust autonomous executor should:

```text
1. build unsigned transaction
2. choose nonce
3. estimate gas
4. sign locally
5. compute expected tx hash before broadcast
6. send the exact signed raw tx
7. if the RPC response is ambiguous:
       look up receipt by expected hash
       look up transaction by expected hash
       rebroadcast only the exact same signed raw tx if appropriate
8. never build a different transaction just because send() timed out
```

This preserves exactly-once intent much better than blind retry loops.

---

# 61. Pending nonce anomaly found in testing

The Roburna RPC produced a state such as:

```text
latest = 1381
pending = 0
```

`pending < latest` is not a valid normal account-nonce relationship.

Safer policy:

```text
pending == latest
    normal

pending > latest
    genuine pending transaction may exist -> stop/fail closed

pending < latest
    stale/impossible pending RPC response
    -> resample
    -> require stable latest nonce
```

Do not interpret every `latest != pending` as proof of a pending transaction.

---

# 62. Arbitrage integration architecture

The DEX stack should be used by the arbitrage engine through adapters, not copied/reimplemented independently.

Recommended separation:

```text
Analytics/indexer
    -> discovery + historical context + event triggers

Live RPC quote adapters
    -> authoritative current executable prices

Kong Route API
    -> Kong V2/V3/V4 route enumeration + calldata build

Arbitrage planner
    -> graph + cycles + gross/net-profit model

Atomic executor
    -> final current-state simulation + transaction
```

Analytics should identify opportunities; live chain state should authorize execution.

---

# 63. Historical arbitrage package capability warning

A validated historical `roburna-multidex-arb-v2.0.0` package recorded:

```text
Arbour V2 = enabled
Kong V2   = enabled
Kong V3   = swap venue
Kong V4   = swap venue
```

At that version, flash-source state was:

```text
Arbour V2 = enabled
Kong V2   = enabled
Kong V3   = audit-only
Kong V4   = audit-only
```

This is historical package evidence, not a statement about every later arb version.

A future capability registry should use independent flags:

```text
CAN_DISCOVER
CAN_QUOTE
CAN_SWAP
CAN_ADD_LIQUIDITY
CAN_REMOVE_LIQUIDITY
CAN_PROVIDE_FLASH_SOURCE
CAN_SETTLE_FLASH_CALLBACK
CAN_ATOMICALLY_ARB
```

Do not infer flash capability from swap capability.

---

# 64. Pool discovery for arbitrage

## V2

Use:

```text
PairCreated events
factory.allPairs
factory.getPair
```

## V3

Use:

```text
PoolCreated events
factory.getPool
```

Capture:

```text
token0
token1
fee
tickSpacing
pool address
creation block
```

## V4

Use PoolManager `Initialize` and relevant PoolManager events.

Capture:

```text
PoolId
PoolKey
hooks
fee mode
tick spacing
initialization block
```

There is no child V4 pool address to scan.

---

# 65. Event-driven arb refresh model

A scalable design:

```text
Indexer / live event stream
        |
        +--> V2 Sync/Swap/liquidity event
        +--> V3 Swap/Mint/Burn/tick-state mutation
        +--> V4 PoolManager Swap/liquidity event
        +--> hook fee update
        |
        v
invalidate affected graph edges
        |
        v
re-quote only affected routes
        |
        v
search cycles
        |
        v
build exact execution candidate
        |
        v
final eth_call simulation
        |
        v
broadcast only if net profit > configured floor
```

This is more efficient than repeatedly quoting every possible edge at the same frequency.

---

# 66. Arbitrage profitability model

Compare net executable economics, not quote spread alone:

```text
gross token profit
- swap fees
- flash fee
- transfer/tax loss
- gas
- safety margin
= net executable profit
```

For taxed/non-standard tokens, prefer actual balance-delta simulation rather than nominal transfer assumptions.

Historical arb validation already used actual received deltas and final atomic simulation as authority.

---

# 67. Analytics vs live quote vs route API

These are different data classes.

## Analytics/indexer

Best for:

```text
pool discovery
history
volume
activity
TVL where complete
alerts
candidate generation
```

## Direct live on-chain quote

Best for:

```text
execution validation
arb validation
final route comparison
```

## Kong route API

Best for:

```text
Kong V2/V3/V4 route enumeration
mixed routes
Universal Router calldata construction
approval requirement discovery
```

The future SDK can expose all three, but should preserve provenance and freshness.

---

# 68. Suggested future SDK package layout

```text
@roburna/chain
    network config
    RPC pool
    token metadata
    block freshness
    simulation
    safe broadcast

@roburna/venues
    arbour-v2
    arbour-v3
    kongswap-v2
    kongswap-v3
    kongswap-v4

@roburna/kong-router
    Permit2 requirements
    Universal Router builder
    V4 action encoding
    mixed routes

@roburna/quotes
    candidate generation
    quote normalization
    quote freshness
    best-route selection

@roburna/liquidity
    V2 LP
    V3 positions
    V4 positions

@roburna/analytics
    analytics client
    route API client
    pool/event/position types

@roburna/arb
    graph
    cycle search
    gas/profit model
    simulation
    executor adapters

@roburna/wallet
    later:
    signer abstraction
    wallet connection
    approvals UX
    transaction UX
```

Wallet/private-key scripting is deliberately not specified here because it should be designed as a separate layer over the same quote/build/simulate interfaces.

---

# 69. Recommended quote/execution SDK boundary

Conceptual application flow:

```ts
const quotes = await dex.quoteExactInput({
  chainId: 159,
  tokenIn: WRBA,
  tokenOut: TUSDT,
  amountIn,
  venues: "all"
})

const selected = quotes.best

const build = await dex.build(selected, {
  recipient,
  slippageBps: 100
})

const firstSimulation = await dex.simulate(build)
if (!firstSimulation.ok) {
  // invalidate selected route and requote
}

const approvals = await dex.approvals(build, owner)

// signer/wallet layer handles approvals

const finalSimulation = await dex.simulate(build)

// signer/execution layer broadcasts only after final validation
```

Execution dispatch:

```text
selected.exchange == arbour
    -> Arbour direct builder/router

selected.exchange == kongswap
    -> Kong Universal Router builder
       or explicit direct Kong diagnostic route when requested
```

---

# 70. Recommended arbitrage SDK boundary

```ts
const changed = await analytics.changedPools()
const graph = arb.updateGraph(changed)

for (const candidate of graph.cycles()) {
  const live = await dex.requoteCycle(candidate)
  if (!live.profitable) continue

  const tx = await arbExecutor.build(live)
  const sim = await chain.simulate(tx)

  if (!sim.ok) continue
  if (sim.netProfit < configuredFloor) continue

  await executor.broadcastSafe(tx)
}
```

This keeps historical data, live quotes, and atomic execution cleanly separated.

---

# 71. Suggested future control-plane commands

A future CLI/API can expose one normalized operator surface:

```text
roburna dex list
roburna dex status

roburna pools list --exchange arbour --protocol v3
roburna pools list --exchange kongswap --protocol v4
roburna pool inspect <id>

roburna quote WRBA tUSDT 100 --venues all
roburna route WRBA tUSDT 100 --max-hops 2
roburna build <route-id> --recipient 0x...
roburna simulate <build-id>

roburna positions 0x...
roburna lp add ...
roburna lp remove ...
roburna nft cleanup ...

roburna analytics status

roburna arb discover
roburna arb simulate <candidate>
roburna arb execute <candidate>
```

These commands should call shared SDK modules rather than each containing independent ABI/routing logic.

---

# 72. Commands for the current systems

## Inspect current Kong deployment manifest

```bash
cd ~/kongswap-contracts-roburna-testnet-v0.9.0

python3 - <<'PY'
import json
j = json.load(open('deployments/159/addresses.json'))
print(json.dumps(j, indent=2))
PY
```

## Check analytics DEX registry

```bash
cd ~/roburna-dex-analytics
./konganalytics dex list
```

## Validate a new analytics venue definition

```bash
./konganalytics dex validate /path/to/my.dex.json
```

## Add it

```bash
./konganalytics dex add /path/to/my.dex.json
```

## Run/watch indexer

```bash
./konganalytics indexer
```

## Check Kong route API

Depending on the current compose/network binding:

```bash
curl -s http://127.0.0.1:8088/health
curl -s http://127.0.0.1:8088/tokens
curl -s http://127.0.0.1:8088/pools
```

## Live Kong quote

```bash
curl -s \
  'http://127.0.0.1:8088/quote?tokenIn=WRBA&tokenOut=tUSDT&amountIn=10'
```

## Build a Kong route without automatically signing it

```bash
curl -s \
  -X POST \
  -H 'content-type: application/json' \
  http://127.0.0.1:8088/build \
  --data '{
    "tokenIn":"WRBA",
    "tokenOut":"tUSDT",
    "amountIn":"10",
    "recipient":"0x0000000000000000000000000000000000000001",
    "slippageBps":100,
    "deadlineSeconds":600
  }'
```

For a real test, replace the recipient and inspect the returned route/transaction before any signing step.

---

# 73. Source-of-truth hierarchy

## Contract addresses

```text
1. current deployment manifest / explicitly pinned Arbour config
2. code-at-address verification
3. current analytics registry
4. old logs/docs
```

## Pool existence

```text
1. live factory/PoolManager state
2. indexed on-chain events
3. analytics snapshots
```

## Executable price

```text
1. fresh live quoter/reserve quote
2. exact final transaction simulation
3. fresh healthy route API
4. analytics only for discovery/history
```

## Wallet LP state

```text
1. live pair / live PositionManager
2. indexed position ownership
3. cached UI
```

---

# 74. Constants that must remain versioned

Do not scatter these across multiple projects:

```text
chain ID
RPC URLs
wrapped-native address
token addresses and decimals
factory addresses
router addresses
quoter addresses
position managers
Permit2
Universal Router
V4 PoolManager
StateView
V4 Quoter
hook addresses
V2 init-code hash
V3 init-code hash
fee tiers
tick spacing
V4 action constants
Universal Router command constants
```

Keep them in a deployment manifest that includes:

```text
schemaVersion
deployment version
chainId
generatedAt
source package versions
code hashes where practical
```

---

# 75. Startup validation for the future combined system

Before enabling writes:

```text
[ ] RPC chainId == 159
[ ] WRBA code exists
[ ] token decimals match registry

[ ] Arbour V2 factory/router code exists
[ ] Arbour V3 factory/router/quoter/PM code exists

[ ] Kong V2 factory/router code exists
[ ] Kong V3 factory/quoter/router/PM code exists
[ ] Kong Permit2 code exists
[ ] Kong V4 PoolManager/StateView/Quoter/PM code exists
[ ] Kong Universal Router code exists
[ ] configured hook code exists when enabled

[ ] analytics chainId matches
[ ] route API chainId matches
[ ] indexer lag is inside policy

[ ] read-only quote smoke passes
[ ] route builder smoke passes
[ ] exact simulation passes
[ ] live execution remains disabled until explicitly enabled
```

---

# 76. Capability matrix recommendation

Do not use one generic `enabled` flag for every capability.

| Venue | Discover | Quote | Swap | LP | NFT positions | Kong Universal Router | Flash source |
|---|---|---|---|---|---|---|---|
| Arbour V2 | yes | yes | yes | yes | no | no | version/system dependent |
| Arbour V3 | yes | yes | yes | yes | yes | no | separate validation required |
| Kong V2 | yes | yes | yes | yes | no | yes | version/system dependent |
| Kong V3 | yes | yes | yes | yes | yes | yes | separate validation required |
| Kong V4 | yes | yes | yes | yes | yes | yes | unlock/settlement adapter required |

The final column should be populated only from the arb/executor version currently running.

---

# 77. Active pool liquidity vs wallet position liquidity

For V3/V4:

```text
pool active liquidity
```

is not the same thing as:

```text
wallet position liquidity
```

because:

- positions may be out of range;
- multiple LPs can own positions;
- ranges differ;
- V4 is singleton accounting.

Use the PositionManager to manage wallet LP. Use pool/StateView active liquidity to judge immediate swap availability.

---

# 78. Pool existence vs quote success vs executable transaction

Model these as separate states:

```text
pool exists
    |
    v
usable state/liquidity exists
    |
    v
quote succeeds for this exact amount
    |
    v
transaction build succeeds
    |
    v
final call simulation succeeds
    |
    v
executable
```

This is especially important for V3 and V4.

---

# 79. Current analytics-state caveat

A captured analytics registry successfully contained:

```text
Arbour V2
KongSwap V2
KongSwap V3
KongSwap V4
```

Operational scripts also used Arbour V3 extensively. Therefore, before building the new unified system, explicitly check whether `arbour-v3` is now registered in analytics.

Do not silently assume the analytics registry and the executable venue set are identical.

---

# 80. Historical/stale data that should not become SDK constants

Do not promote these into durable configuration:

```text
0.752 stable/WRBA
old one-off pool balances
old route winners
old wallet balances
old active-LP counts
old price-repair targets
old analytics pool counts
```

Those are historical test-state observations.

Durable configuration is:

```text
contract addresses
protocol versions
init-code hashes
package versions
fee-tier definitions
router/action constants
```

Live values must be re-read.

---

# 81. Recommended build order for the next separate system

## Phase 1 — immutable/config foundation

```text
network registry
contract deployment registry
token registry
RPC provider abstraction
health/code checks
```

## Phase 2 — venue adapters

```text
Arbour V2
Arbour V3
Kong V2
Kong V3
Kong V4
```

## Phase 3 — routing

```text
normalized quote model
candidate generation
dead-route handling
amount-sensitive best-route selector
freshness/fingerprint model
```

## Phase 4 — execution builders

```text
Arbour direct V2 builder
Arbour direct V3 builder
Kong Universal Router builder
simulation module
safe broadcast module
```

## Phase 5 — analytics integration

```text
analytics API client
Kong route API client
event-driven pool invalidation
pool graph
```

## Phase 6 — arbitrage integration

```text
cycle search
profit model
gas model
flash capability adapters
atomic executor
```

## Phase 7 — wallet layer

```text
wallet connection
signer abstraction
Permit2 UX
approval UX
transaction UX
LP management UX
```

Do not begin by merging all shell scripts into one giant program. Extract shared protocol mechanics into modules first.

---

# 82. Final architecture summary

The clean mental model is:

```text
                         ROBURNA CHAIN 159
                                |
            +-------------------+-------------------+
            |                                       |
         ARBOUR                                  KONGSWAP
            |                                       |
      +-----+-----+                     +-----------+-----------+
      |           |                     |           |           |
     V2          V3                    V2          V3          V4
      |           |                     |           |           |
 direct        direct                   +-----------+-----------+
 router        router                               |
                                                    |
                                                 Permit2
                                                    |
                                                    v
                                           Universal Router
                                                    |
                                           V2 / V3 / V4
                                         + mixed 2-step routes
```

Above the contract layer:

```text
                    +----------------------+
                    | normalized DEX SDK   |
                    +----------+-----------+
                               |
               +---------------+----------------+
               |                                |
       live quote/execution             analytics/indexer
               |                                |
               +---------------+----------------+
                               |
                        arbitrage engine
```

The core design rule is:

> **Use one normalized control plane while preserving each exchange/protocol's native mechanics beneath it.**

Do not flatten V2 pairs, V3 pools, and V4 PoolIds into the same primitive.  
Do not flatten Arbour and KongSwap into one execution router.  
Do not flatten analytics prices and executable quotes into one trust level.  
Do not infer flash capability from swap capability.  
Do not allow one dead pool to kill a multi-venue route search.

With those boundaries preserved, the current Roburna work can be converted cleanly into a reusable SDK and later combined with the analytics, arbitrage, wallet, and other systems.

---

# Appendix A — Contract address master list

## Network tokens

```text
WRBA
0xA3e8E81810c2908EE72b8E8a13371BEd42D91e7b

tUSDC
0xbd3f91DA35bD5750D7D80BB01aE9f9117875a87f

tUSDT
0xD813D5763b205A717a111c9Eda5fB684584d1996
```

## Arbour V2

```text
Factory
0xE756Af80bC019689B4C4508026147deb80C108B9

Router02
0xE8B48213F7675f69007516ddc1944d439E71D0d8
```

## Arbour V3

```text
Factory
0x75aaA4B8d474b0Ac63ceac35cf6F371d8808631B

Swap Router
0xE0960f56D353194F8abE52180325a21bd146dabE

QuoterV2
0x4b12d2869B8581c286F8583e4d2167cAEC3dC9fa

Position Manager
0x862854A6c985370d5F4942d9AaB151248512C1ed
```

## Kong V2

```text
Factory
0x20FB330Cc3943607C7576129A7f87c143C891FE4

Router02
0x05ABA6ba27AEba82bcc036Cd9E2fd12486DD7b24
```

## Kong V3

```text
Factory
0xb12FD27E6e2A0141ccB94d8A033d91f9b20DBEbB

Multicall2
0xf043dF67e028C5d792BeeF9D4d9967a5e2b783a0

ProxyAdmin
0xF7F2ed6072C8dA60d1DC6b36d6B9269335091a00

TickLens
0x3e40fC95182b63E88494811812B6Abc0aA72731f

NFT Descriptor Library
0xbd4883d8F88c2C89530E4413FD28905264b17c83

Position Descriptor Implementation
0x0049C3bA04086179Fe1bbDE2F5ad2111b5282b4c

Position Descriptor Proxy
0xb8CeC5c0745594ddba38F037db0F08c6064Cd4dA

Position Manager
0x65Da9A8cd05D27013b0813080d61b8B38B055e63

V3 Migrator
0x2d090B4770b13DED4453893b8614FC1Fe31dE64C

V3 Staker
0xC040EA6BbBC453650a1f94A9E8e73a372F2C58a8

QuoterV2
0x783252F3B5dB5D97149FE420107d83af1Cc92EcD

SwapRouter02
0xd515E86ae4D4BFd0ac289569EfC78b2d16Ca48C3
```

## Kong common routing

```text
Permit2
0x9c59f4869f10339F4E7fACF0D7aa17C42a7BE016

V4-capable Universal Router
0xD5b519Ef1972d9D387CBbf6bFCA5b37Be0DF4B4e
```

## Kong V4

```text
PoolManager
0x9787Fb47999637Ce22147B71Dd2Ae96BA1549154

StateView
0x5d6815fA355f0245B89046Ff871F6531A87611c5

V4Quoter
0x9Ca9F06EF6CD7e18d9854216e6e171448352ae37

PositionDescriptor
0x26693F946dCF862C36B9716951a4438743005331

PositionManager
0x5aD568Aa2035f316e565B671E320C505831367e5

HookFactory
0x641Df17D7da8eBd895CCf53FC3fdF404F07Fb447

DynamicFeeHook
0x62243BcAc77d6F182328D26B6E908507216dC080
```

---

# Appendix B — Kong init-code hashes and package pins

```text
V2 pair init-code hash
0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f

V3 pool init-code hash
0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54
```

```text
@uniswap/v4-core@1.0.2
@uniswap/v4-periphery@1.0.3
@uniswap/universal-router@2.1.0
```

---

# Appendix C — Recommended future filesystem

```text
config/
  chains/
    roburna-159.json

  deployments/
    arbour.json
    kongswap.json

src/
  chain/
    provider.ts
    simulation.ts
    tx-broadcast.ts

  tokens/
    registry.ts

  venues/
    arbour-v2.ts
    arbour-v3.ts
    kong-v2.ts
    kong-v3.ts
    kong-v4.ts

  kong/
    permit2.ts
    universal-router.ts
    v4-actions.ts

  routing/
    quote.ts
    candidates.ts
    selector.ts
    fingerprints.ts

  liquidity/
    v2.ts
    v3.ts
    v4.ts

  analytics/
    client.ts
    route-api.ts
    types.ts

  arb/
    graph.ts
    planner.ts
    simulator.ts

  wallet/
    # deliberately later
```

---

# Appendix D — Engineering rules worth carrying forward

```text
1. Contract address is not proof of usable liquidity.
2. Pool existence is not proof a quote will succeed.
3. One quote failure must not abort a multi-route search.
4. Execution prices come from live state, not stale reference prices.
5. Compare routes at the same amountIn.
6. Requote after material state changes.
7. Final exact calldata simulation is authoritative.
8. Arbour and Kong are separate execution domains.
9. Kong V4 pools are PoolIds/PoolKeys, not pool contracts.
10. V4 StateView is not a reserves lens.
11. Analytics data is excellent for discovery, not final execution authority.
12. Separate CAN_SWAP from CAN_FLASH.
13. Position NFT burn must be preceded by live zero-state validation.
14. Ambiguous transaction sends must be resolved by hash before failover.
15. Version protocol constants and deployment data in one registry.
```

---

# Appendix E — Verification checklist before the next test

Before using this document as input to the next combined system:

```text
[ ] read current ~/kongswap-contracts-roburna-testnet-v0.9.0/deployments/159/addresses.json
[ ] verify critical contract bytecode exists
[ ] run ~/roburna-dex-analytics/./konganalytics dex list
[ ] confirm whether arbour-v3 is registered
[ ] check route API /health
[ ] check current RPC chain ID
[ ] run read-only direct quotes on each venue
[ ] test a Kong V2 route through Universal Router
[ ] test a Kong V3 route through Universal Router
[ ] test a Kong V4 route through Universal Router
[ ] test a mixed Kong two-step route
[ ] confirm router ends with no unexpected token balances
[ ] compare Arbour direct quotes against Kong routes
[ ] validate current arb capability matrix separately
[ ] keep live execution disabled until all simulations pass
```

---

## Reference status

This document is a consolidation of the deployed contract manifests, routing source, analytics registry/runtime behavior, liquidity tooling, swap tests, cleanup tests, and execution lessons used in the Roburna DEX work through 2026-10-15.

Treat it as a detailed engineering handoff, not as a substitute for live-chain verification. Contract addresses and protocol topology are durable configuration; pool prices, liquidity, balances, route winners, pool counts, and arb opportunities are live state and must be re-read.
