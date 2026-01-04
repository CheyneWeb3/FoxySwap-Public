## Arborswap Bridge System — GPT'd Robots Smart Contract Security Audit Report contracts-12192025

**Client:** N/A Security AI Community Compared Audits
**Audit Target:** Bridge + Vault custody + Swap adapter + Governance (single-operator validator model)
**Networks:** EVM-compatible (chain-agnostic on-chain logic)

### In-Scope Artifacts (Provided)

* **BridgeCore** (flat file): `/mnt/data/bridgecore251219Flat.sol`
  Includes `BridgeCore`, `FeeManager`, `MultiOwnerGovernance`, and OpenZeppelin libraries.
* **GeneralV2Adapter**: `/mnt/data/GeneralV2Adapter.sol`
* **Vault implementation**: supplied in-message (Solidity 0.8.19), contract `Vault` (implements `IVault`)

### Out-of-Scope / Not Provided

* **ValidatorManager contract** logic (you stated it is **an EOA operator address** that “confirms” and calls `executeReleaseFromValidator`)
* Off-chain scripts / operational security controls
* Token implementations for “mintable/burnable” assets (`IMintableBurnable`)
* Router implementations for swapping (UniswapV2-compatible assumptions)

---

# 1) Executive Summary

### Audit Result (High Risk / Not Production-Ready As-Is)

This bridge architecture is **custodial / trusted-operator** due to the validator model being a **single EOA**. Under that model, on-chain contracts can be correct and still be unsafe operationally, because compromise or malice of the operator key results in **full loss of funds**.

Additionally, the current BridgeCore implementation contains a **Critical correctness issue** that breaks refund guarantees for “mintable/burnable” deposits.

### Key Conclusions

* **Critical bug**: Refund logic for mintable/burnable deposits is incorrect and can revert / DoS refunds.
* **Critical design risk**: Single EOA “validator” can unilaterally release vault funds and mint tokens.
* **High operational risk**: The 1-hour “signature validity” window will strand releases under normal delays.
* **Vault is generally straightforward**, but has accounting edge cases and forced-native-funds desync considerations.

---

# 2) Methodology

* Manual review of the provided Solidity sources.
* Control-flow review of deposit/release/refund paths.
* Review of access control, pause, reentrancy protection, and external call surfaces.
* Threat modeling based on your stated validator design (EOA operator).

Severity scale used: **Critical / High / Medium / Low / Informational**

---

# 3) System Architecture Summary

### BridgeCore (Core Bridge Logic)

**Deposit flow**

* Validates token support, amount bounds, and blacklist.
* Generates `depositId = keccak256(sender, token, amount, chainid, nonce, timestamp)`.
* If token is **mintableBurnableTokens[token] == true**:

  * Transfers token into BridgeCore and **burns** it.
  * Records `DepositInfo.token = original token` and `DepositInfo.amount = original amount`.
  * **No vault custody is created.**
* Else (non-mintable):

  * Swaps deposited asset to **USDC** via `swapAdapter` (or wraps native first).
  * Deposits USDC into `vault`.
  * Records `DepositInfo.token = usdcToken` and `DepositInfo.amount = usdcAmount`.

**Release flow**

* Only callable by `msg.sender == address(validatorManager)` (can be EOA).
* Marks deposit as processed.
* Two branches:

  * **Mintable release**: mints mintable token, optionally swaps to output token, collects fees.
  * **Non-mintable release**: withdraws USDC from vault, optionally swaps to output token, collects fees.

**Refund flow**

* After `REFUND_TIMEOUT = 24 hours`, user can refund if deposit not processed.
* Refund withdraws `DepositInfo.token` and `DepositInfo.amount` from vault to user.

### Vault (Custody)

* Stores ERC20 balances in `tokenBalances[token]`.
* Only `bridgeCore` can call `deposit()` and `withdraw()`.
* Governance contract address is the only entity that can set bridgeCore / supported tokens / emergency withdraws.
* `fundVault()` allows anyone to top up (native or ERC20) if supported.
* `receive()` only accepts native ETH if `msg.sender == bridgeCore`.

### GeneralV2Adapter (Swap Wrapper)

* UniswapV2-like router wrapper with a **whitelist** of allowed callers.
* Builds a path that always routes via `wrappedToken`.

---

# 4) Threat Model (Given Your Validator Setup)

You stated: **ValidatorManager is an EOA operator that confirms and calls releases** (“single Gov 1/1 for now”).

That means the bridge is functionally:

* **Trusted custodian model** (operator is the security boundary)
* Not a trustless bridge
* User funds are safe only if:

  * operator key is uncompromised
  * operator is honest
  * operator’s off-chain validation is correct

This is not automatically “bad,” but it must be treated as **critical** risk in production.

---

# 5) Findings Summary

| ID     |              Severity | Title                                                                                                  | Component                                |
| ------ | --------------------: | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| BC-01  |          **Critical** | Refund logic breaks for mintable/burnable deposits (burned assets refunded via vault withdrawal)       | BridgeCore                               |
| BC-02  | **Critical (Design)** | Single EOA validator can release arbitrary funds / mint arbitrarily                                    | BridgeCore / System                      |
| BC-03  |              **High** | 1-hour expiry for release (`timestamp + 1 hour`) will strand releases and force refunds                | BridgeCore                               |
| BC-04  |              **High** | Misconfiguration hazards: adapter whitelist + FeeManager role + vault supported token + bridgeCore set | System                                   |
| BC-05  |            **Medium** | Approval patterns may break with nonstandard ERC20s and increase allowance risk                        | BridgeCore / Adapter / Vault integration |
| BC-06  |            **Medium** | Batch refund iteration can become uncallable / griefable at scale                                      | BridgeCore                               |
| AD-01  |            **Medium** | Adapter forces 3-hop path via wrapped token; breaks for wrapped token edge cases                       | GeneralV2Adapter                         |
| VA-01  |            **Medium** | Vault accounting can desync from real balances (direct transfers / forced ETH)                         | Vault                                    |
| GOV-01 |               **Low** | Governance execution rules are permissive; no expiry/timelock                                          | MultiOwnerGovernance                     |

---

# 6) Detailed Findings & Recommendations

---

## BC-01 — Critical — Mintable/Burnable Refund Logic Is Incorrect

### Description

For mintable/burnable deposits, BridgeCore:

* transfers tokens in,
* **burns** them,
* stores `DepositInfo.token = originalToken` and `DepositInfo.amount = originalAmount`,
* **does not** deposit anything into the vault.

However `refundDeposit()` and `refundExpiredDeposits()` always do:

* `vault.withdraw(depositInfo.token, depositInfo.amount, depositInfo.user);`

### Impact

* Refunds for mintable/burnable deposits will **revert** (vault never had these tokens).
* Refund guarantees are broken.
* `refundExpiredDeposits()` can be **DoS’d** if it hits one expired mintable deposit that reverts, preventing batch refund processing.

### Recommendation (Required)

Add an explicit deposit type flag and refund accordingly.

**Suggested patch approach**

* Extend `DepositInfo`:

  * `bool isMintable;`
  * and/or store `storedToken` separately from `originalToken`
* On mintable deposit:

  * `isMintable = true`
  * store original token/amount clearly
* On refund:

  * if `isMintable`:

    * **mint** tokens back to the user (reverse burn), e.g. `IMintableBurnable(token).mint(user, originalAmount)`
    * mark `refunded=true`, `processedDeposits=true`
  * else:

    * withdraw USDC from vault as currently implemented

Also: in `refundExpiredDeposits`, consider **try/catch** to continue processing on failures and emit failure events.

---

## BC-02 — Critical (Design) — Single EOA Validator = Total Loss if Key Compromised

### Description

Release is gated by:

```solidity
require(msg.sender == address(validatorManager), "only validator manager");
```

With validatorManager being an **EOA operator**, that one key can call releases with arbitrary parameters.

### Impact

If operator key is compromised or malicious:

* **Non-mintable route:** can withdraw USDC from vault (and optionally swap), draining liquidity.
* **Mintable route:** can mint tokens and route them, manipulate fees, and pay themselves.

This is a full system compromise scenario.

### Recommendation (Strongly Recommended)

If you intend production usage:

* Replace EOA operator with:

  * **multisig** (e.g., 2/3 or 3/5) at minimum, and
  * optionally a **timelock** for high-risk admin actions (changing vault, fee manager, swap adapter).
* If you want a “confirming operator” model, you still need:

  * hardware wallet custody,
  * key rotation,
  * emergency pause runbooks,
  * monitoring + alerting.

If you want security resembling a real bridge:

* implement signature verification / threshold proofs on-chain, or
* use a ValidatorManager contract that enforces threshold signatures and message binding.

---

## BC-03 — High — 1-Hour Release Expiry Will Strand Funds

### Description

Release requires:

```solidity
require(block.timestamp <= timestamp + SIGNATURE_VALIDITY_PERIOD); // 1 hour
```

But `timestamp` is passed in and described as the “deposit timestamp from source chain.”

### Impact

Cross-chain confirmation and ops delays commonly exceed 1 hour. This will:

* make releases fail routinely,
* force users into refund paths,
* increase operational load and user loss of confidence,
* enable griefing by delaying operator execution until expiry.

### Recommendation

* Remove this requirement, OR increase it to days, OR validate freshness differently.
* If you want replay protection, rely on `processedDeposits[depositId]`.

---

## BC-04 — High — Misconfiguration Can Brick Core Functionality

### Description

Several required external dependencies must be correctly configured or the bridge reverts:

* `GeneralV2Adapter` requires BridgeCore to be **whitelisted caller**
* `FeeManager.collectFee` is `onlyAdmin` — BridgeCore must have appropriate role
* `Vault.deposit` requires USDC to be **supported token**
* `Vault.bridgeCore` must be set
* `BridgeCore.usdcToken` must be set before use

### Impact

Deployment mistakes can:

* block deposits (swap fails),
* block releases (fee collection reverts),
* trap funds.

### Recommendation

Add a `preflightCheck()` view in BridgeCore that checks:

* adapter whitelist status,
* FeeManager role for BridgeCore,
* Vault supportedTokens includes usdcToken,
* vault.bridgeCore == address(this),
* usdcToken != 0 and decimals set.

---

## BC-05 — Medium — Approval Pattern Risks

### Description

BridgeCore/Adapter use direct `approve(amount)` which can fail for tokens requiring zero-reset and leaves allowances exposed if external contracts are upgradeable.

### Impact

* Compatibility issues (nonstandard ERC20s)
* Increased blast radius if adapter/router compromised

### Recommendation

Use OpenZeppelin `SafeERC20.forceApprove()` (preferred) or zero-reset pattern:

* `approve(spender, 0); approve(spender, amount);`

---

## BC-06 — Medium — Batch Refund Scalability / DoS

### Description

`refundExpiredDeposits(maxCount)` scans an ever-growing `depositIds` list.

### Impact

Over time:

* transactions become too expensive,
* batch refunds become unreliable,
* griefing is possible via many small deposits.

### Recommendation

Maintain a cursor (`nextRefundIndex`) to avoid scanning from 0 each time, and/or store per-user refundable deposits.

---

## AD-01 — Medium — Adapter Path Construction Edge Cases

### Description

Adapter forces path `[tokenIn, wrappedToken, tokenOut]` always.

### Impact

If `tokenIn == wrappedToken` or `tokenOut == wrappedToken`, the path may include duplicates and revert on routers. Also adds unnecessary hops.

### Recommendation

Build paths conditionally:

* if `tokenIn == wrappedToken`: `[wrappedToken, tokenOut]`
* if `tokenOut == wrappedToken`: `[tokenIn, wrappedToken]`
* else: 3-hop or attempt 2-hop first

---

## VA-01 — Medium — Vault Accounting Desync (Direct Transfers / Forced ETH)

### Description

Vault uses internal `tokenBalances[token]` rather than `IERC20(token).balanceOf(address(this))`.

Edge cases:

* Anyone can transfer ERC20 directly to the Vault address (not via `fundVault`), increasing real balance but **not** `tokenBalances`.
* Native ETH can be **forced** into the vault via `selfdestruct` despite `receive()` restrictions; again, `tokenBalances[address(0)]` won’t update.

### Impact

* “Excess” funds may become stuck (not withdrawable via standard functions because accounting doesn’t see them).
* Emergency withdraw functions rely on `tokenBalances` and may not recover forced funds.

### Recommendation

Add governance-only reconciliation functions:

* `syncTokenBalance(token)` sets `tokenBalances[token] = IERC20(token).balanceOf(address(this))` (or adds delta) for ERC20
* For native: `syncNativeBalance()` sets `tokenBalances[0] = address(this).balance`

Or redesign to use `balanceOf()` as the source of truth.

---

## GOV-01 — Low — Governance Safety Posture (Permissive, No Timelock)

### Description

MultiOwnerGovernance allows execution once `votesFor >= threshold`. No timelock or expiry.

### Impact

Not a direct Solidity exploit, but increases operational risk.

### Recommendation

For production:

* add timelock for critical actions,
* add proposal expiry,
* consider quorum and explicit veto rules.

---

# 7) Centralization & Operational Security Assessment (Because Validator Is EOA)

With a single 1/1 operator:

* **This system’s security is dominated by key management**, not Solidity.
* The most likely real-world failure mode is:

  * phishing / malware on operator machine
  * leaked private key
  * malicious insider
  * compromised CI/CD or RPC endpoint poisoning off-chain validation

**Minimum production bar** (strongly recommended):

* Operator address = **multisig**, not EOA
* Hardware wallets for signers
* Separate pause key (already partially supported via `pauser`)
* Monitoring: alerts on:

  * vault withdrawals,
  * executeReleaseFromValidator calls,
  * governance changes,
  * adapter/router changes,
  * fee withdrawals

---

# 8) Required Changes Before “Production-Ready” Claim

To move from “test-ready” to “production-credible”:

1. **Fix BC-01** (mintable refund logic) — mandatory
2. Replace validator EOA with **multisig** — mandatory for meaningful security
3. Remove/extend **1-hour expiry** — strongly recommended
4. Add preflight checks and deployment guardrails — strongly recommended
5. Add vault balance sync or use real balances — recommended

---

# 9) Suggested Test Plan (High-Value)

### Critical Path Tests

* Mintable deposit → wait 24h → refund succeeds (mints back), no vault withdraw
* Non-mintable deposit → swap to USDC → vault balance increases → refund returns USDC
* Release after >1h (current behavior) demonstrates failure; then verify updated design works

### Adversarial / Misconfig Tests

* BridgeCore not whitelisted in adapter → deposits revert clearly
* BridgeCore missing FeeManager permissions → release reverts (ensure preflight catches)
* Vault not configured `bridgeCore` → deposit fails

### Vault Accounting Tests

* Direct ERC20 transfer to Vault → verify accounting desync → sync function restores recoverability
* Forced ETH via selfdestruct (in test) → verify `tokenBalances[0]` mismatch → sync

---

# 10) Final Assessment

### Security Rating (Given EOA Validator Model)

* **On-chain correctness:** **Medium** (due to BC-01 + expiry + misconfig risks)
* **System security:** **High Risk** (custodial single-key operator model)

Even after code fixes, with a single EOA validator the bridge remains **one private key away from total loss**.

---
