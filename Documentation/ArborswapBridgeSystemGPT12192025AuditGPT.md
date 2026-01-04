## Roburna Arborswap Bridge System — Comprehensive GPT Created Security Audit Report.

**Revision:** Includes **BridgeCore (flat)** + **FeeManager** + **MultiOwnerGovernance** + **GeneralV2Adapter** + **Vault (implementation you provided)**, and assumes **ValidatorManager is a single EOA operator** (no on-chain threshold validation).

**In-Scope**

* `BridgeCore` / `FeeManager` / `MultiOwnerGovernance` from: `bridgecore251219Flat.sol`
* `GeneralV2Adapter` from: `GeneralV2Adapter.sol`
* `Vault.sol` implementation
* 
**Out-of-Scope**

* Off-chain validator/operator script logic and infrastructure
* Token contracts for mint/burn (“IMintableBurnable” implementations)
* Router contracts and DEX liquidity conditions
* Any other contracts not included above

---

# 1) Executive Summary

### Security Posture

This bridge is a **trusted-operator bridge** (custodial model) because releases are authorized solely by an **EOA operator**. Under this model, **key compromise = total loss** of bridge-custodied funds.

### Audit Verdict

**NOT production-ready as-is.**
There is at least **one Critical functional/security issue** in BridgeCore that breaks the refund safety guarantee for mint/burn deposits, plus **Critical design exposure** due to a single EOA validator.

### Highest-Risk Items

1. **BC-01 (Critical): Refund for mint/burn deposits is broken** — BridgeCore burns tokens on deposit, but refund attempts to withdraw those tokens from the Vault (which never received them), causing reverts and refund DoS.
2. **BC-02 (Critical – Design): Single EOA validator** can unilaterally drain vault funds (non-mintable path) and mint assets (mintable path).
3. **BC-03 (High): 1-hour “signature validity” window** will strand legitimate releases under common operational delays.

---

# 2) Methodology & Assumptions

### Review Method

* Manual, line-by-line security review of control flows and external call boundaries.
* Access control review (roles, pausing, privileged actions).
* Threat modeling aligned to your stated design: **validatorManager is an EOA operator**.

### Key Assumptions (Must Hold in Production)

* The operator only executes releases corresponding to valid deposits.
* Admin/governance keys are secured and not shared.
* Vault is correctly configured (supported tokens, bridgeCore set).
* Swap adapter/router behave as assumed (Uniswap V2-style), and tokens conform to ERC20 expectations (many don’t).

---

# 3) Architecture Overview

## 3.1 BridgeCore

### Deposit

* Validates: not blacklisted, amount in min/max bounds, token supported.
* Generates `depositId`.
* If token is configured mint/burn:

  * Transfers tokens into BridgeCore and burns them.
  * Stores deposit info with `token = originalToken`, `amount = originalAmount`.
  * **No vault custody created.**
* Otherwise:

  * Converts deposit asset into **USDC** (via swapAdapter).
  * Deposits USDC into **Vault**.
  * Stores deposit info with `token = usdcToken`, `amount = usdcAmount`.

### Release (executeReleaseFromValidator)

* Only callable by `msg.sender == validatorManager` (EOA or contract address).
* Enforces an expiry window: `block.timestamp <= timestamp + 1 hour`
* Handles two categories:

  * mint/burn route (mints then optional swap, fees)
  * USDC vault route (withdraw USDC then optional swap, fees)

### Refund

* After 24 hours, allows depositor to refund if not processed.
* Refund always calls `vault.withdraw(depositInfo.token, depositInfo.amount, depositInfo.user)`.

## 3.2 Vault

* Custody for supported ERC20 tokens (and tracks native in accounting, though bridge-core deposit uses ERC20 path).
* Only `bridgeCore` can call `deposit()` and `withdraw()`.
* Governance can emergency withdraw and pause/unpause (via governance pauser address).
* Has internal accounting `tokenBalances[token]` updated only via Vault functions and `receive()`.

## 3.3 GeneralV2Adapter

* Swap wrapper with `whitelistedAdapters[msg.sender]` access control.
* For token-to-token swaps, always uses 3-hop path: `tokenIn -> wrappedToken -> tokenOut`.
* Uses SafeERC20 transfers/approvals, and UniswapV2-like router calls.

## 3.4 Governance / FeeManager

* Governance is owner-based proposals with threshold.
* FeeManager requires callers to have `ADMIN_ROLE` to call `collectFee` and withdraw.

---

# 4) Threat Model (Given Validator = EOA)

With a single EOA “validator manager”:

* **Bridge security is dominated by operational key security**, not Solidity correctness.
* If that key is compromised, an attacker can:

  * trigger releases to themselves,
  * drain vault liquidity,
  * mint arbitrary amounts of mintable tokens (subject to token implementation),
  * route swaps to value-extract where liquidity allows.

**Therefore, even perfectly written Solidity does not make this bridge safe in production without strong key management or multisig/threshold controls.**

---

# 5) Findings Summary

| ID          |              Severity | Title                                                                                                                          | Component            |
| ----------- | --------------------: | ------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| **BC-01**   |          **Critical** | Mint/burn deposit refunds are broken (refund withdraws from vault for tokens that were burned & never vaulted)                 | BridgeCore           |
| **BC-02**   | **Critical (Design)** | Single EOA validator can unilaterally authorize releases & drains; BridgeCore does not verify proofs/signatures                | System / BridgeCore  |
| **BC-03**   |              **High** | 1-hour release expiry (`timestamp + 1 hour`) will strand legitimate releases                                                   | BridgeCore           |
| **BC-04**   |              **High** | Misconfiguration can brick deposits/releases (adapter whitelist, FeeManager role, Vault supported token, Vault bridgeCore set) | System               |
| **BC-05**   |            **Medium** | ERC20 approve patterns may fail (zero-reset tokens) and increase allowance attack surface                                      | BridgeCore / Adapter |
| **BC-06**   |            **Medium** | RefundExpiredDeposits scales poorly (O(n) scan) and can become uncallable; also batch can revert on a single failing refund    | BridgeCore           |
| **AD-01**   |            **Medium** | Adapter forces 3-hop path via wrapped token; breaks edge cases (tokenIn/out == wrapped) & adds slippage                        | GeneralV2Adapter     |
| **VA-01**   |            **Medium** | Vault internal accounting can desync from real balances (direct ERC20 transfers / forced ETH)                                  | Vault                |
| **VA-02**   |               **Low** | `receive()` restricts native receipts to bridgeCore, but forced ETH can still bypass it; accounting won’t reflect forced funds | Vault                |
| **GOV-01**  |               **Low** | Governance has no expiry/timelock; permissive execution rules                                                                  | Governance           |
| **INFO-01** |                  Info | Semantics of outputToken differ across branches; potential UX confusion                                                        | BridgeCore           |

---

# 6) Detailed Findings & Recommendations

## BC-01 — Critical — Mint/Burn Deposit Refunds Are Broken

### Where

* `deposit()` mintable/burnable branch stores:

  * `token = original token`
  * `amount = original amount`
  * burns tokens
* `refundDeposit()` always:

  * `vault.withdraw(depositInfo.token, depositInfo.amount, depositInfo.user);`

### Impact

* **Refund will revert** for mint/burn deposits because Vault never held those tokens.
* Refund batch processing can be **DoS’d** if one refund reverts.
* Breaks the primary safety property: “if release doesn’t happen, user can refund.”

### Required Fix

Add an explicit deposit type flag and handle refunds correctly:

**Recommended design**

* Extend `DepositInfo` with `bool isMintable;`
* On mintable deposit: set `isMintable=true` and store original fields.
* On refund:

  * if `isMintable`: **mint back** `originalAmount` to `user` (reverse the burn)
  * else: vault withdraw of stored USDC

Also: In `refundExpiredDeposits`, wrap each refund in `try/catch` to avoid reverting the entire batch.

---

## BC-02 — Critical (Design) — Single EOA Validator = Total Loss on Compromise

### Where

* `executeReleaseFromValidator` gates only:

  * `require(msg.sender == address(validatorManager))`

### Impact

* Operator can release arbitrary vault funds or mint arbitrary mintable tokens.
* Compromise of operator key drains vault liquidity rapidly.

### Required / Strong Recommendation

* Replace EOA validator with a **multisig** at minimum (2/3 or 3/5).
* Add operational controls:

  * hardware wallet signers
  * key rotation process
  * monitoring and emergency pause runbooks
* If you want real bridge security: on-chain signature/proof verification (threshold validation).

---

## BC-03 — High — 1-Hour “Signature Validity” Will Strand Releases

### Where

* `require(block.timestamp <= timestamp + SIGNATURE_VALIDITY_PERIOD)` where period is 1 hour.

### Impact

Legitimate releases delayed > 1 hour will **fail permanently**, forcing refunds and breaking bridge UX.

### Fix

* Remove this check, or extend to days, or replace with a more meaningful replay-prevention mechanism.
* Replay prevention should rely on `processedDeposits[depositId]`, not short time windows.

---

## BC-04 — High — Misconfiguration Can Brick the Bridge

### Dependencies that must be correct

* Adapter: BridgeCore must be whitelisted (`whitelistedAdapters[bridgeCore]=true`)
* FeeManager: BridgeCore must have `ADMIN_ROLE` or fee collection reverts
* Vault: must have `bridgeCore` set, must support `usdcToken`
* BridgeCore: must have `vault`, `usdcToken`, `swapAdapter`, `wrappedToken` set

### Recommendation

Add a `preflightCheck()` view in BridgeCore that validates:

* adapter whitelist status for BridgeCore
* FeeManager admin role for BridgeCore
* Vault `bridgeCore == address(this)`
* Vault `isSupportedToken(usdcToken) == true`
* nonzero critical addresses

---

## BC-05 — Medium — Approve Pattern Compatibility & Allowance Risk

### Where

* BridgeCore approves vault and adapter via `approve(amount)`; adapter approves router.

### Impact

* Some tokens require allowance reset to 0 before changing (e.g., certain stablecoins).
* Lingering allowances increase blast radius if router/adapter changes.

### Fix

Use `forceApprove()` (OZ SafeERC20) or zero-reset pattern.

---

## BC-06 — Medium — RefundExpiredDeposits Scalability & Batch Fragility

### Where

* Refund batch scans entire `depositIds` array and processes up to `maxCount`.

### Impact

* As array grows, scanning becomes expensive and can be uncallable.
* A single revert can break the batch.

### Fix

* Maintain a `refundCursor` index to avoid rescanning from 0.
* Use `try/catch` around each refund call.

---

## AD-01 — Medium — Adapter Forces 3-Hop Wrapped Path

### Where

* `swapExactTokensForTokens(tokenIn, tokenOut...)` always builds:

  * `[tokenIn, wrappedToken, tokenOut]`

### Impact

* If `tokenIn == wrappedToken` or `tokenOut == wrappedToken`, path degenerates and can revert.
* Unnecessary hop increases slippage and dependency on wrapped pairs.

### Fix

Build conditional paths:

* if tokenIn == wrappedToken: `[wrappedToken, tokenOut]`
* if tokenOut == wrappedToken: `[tokenIn, wrappedToken]`
* else: attempt direct `[tokenIn, tokenOut]` then fallback to wrapped route.

---

## VA-01 — Medium — Vault Accounting Desync (TokenBalances vs Real Balances)

### Where

* Vault tracks balances in `tokenBalances[token]` and does **not** reconcile to actual token balances.

### Impact

* Direct transfers to Vault address (ERC20) won’t update `tokenBalances`.
* Forced ETH can bypass `receive` restrictions (selfdestruct), leaving `tokenBalances[0]` inaccurate.
* Result: funds can become “stuck” from the contract’s accounting perspective.

### Fix Options

**Option A (Recommended):** Add governance-only sync methods:

* `syncERC20(token)` sets `tokenBalances[token] = IERC20(token).balanceOf(address(this))`
* `syncNative()` sets `tokenBalances[0] = address(this).balance`

**Option B:** Use `balanceOf()` and `address(this).balance` as truth (and remove internal accounting), but that changes semantics and requires careful review.

---

## VA-02 — Low — receive() Restriction is Not a Complete Defense

### Where

* `receive()` requires sender is bridgeCore.

### Note

This blocks normal transfers but not forced ETH. That’s fine if you provide sync/recovery.

---

## GOV-01 — Low — Governance Has No Timelock/Expiry

### Impact

Operational risk: fast execution of sensitive calls if threshold met, no delay for human intervention.

### Recommendation

For production:

* timelock for changes to validator, vault, adapter, fee manager
* proposal expiry windows

---

## INFO-01 — Output Token Semantics Inconsistency

* Some branches treat `outputToken == address(0)` as native, others as “default USDC” semantics.
* This can confuse integrators and UIs.

**Recommendation:** Standardize meaning of `address(0)` across the system.

---

# 7) Centralization & “No Malicious Issue” Reality Check

Because the validator is a single EOA:

* The on-chain system **cannot** ensure non-malicious behavior.
* The best you can do is:

  * reduce exploit surface,
  * enforce least privilege,
  * implement circuit breakers,
  * harden operations (multisig / HSM / monitoring).

If you plan to grow beyond test:

* **Multisig is the minimum** for credibility.

---

# 8) Required Remediation Plan (Ordered)

### Must Fix Before Any Real Users

1. **BC-01** mint/burn refund correctness + batch refund resiliency
2. Replace validator EOA with **multisig** (or implement threshold verification)

### Strongly Recommended

3. Remove/extend **BC-03** 1-hour expiry
4. Add `preflightCheck()` and deployment guardrails
5. Fix adapter path edge cases and reduce forced hops
6. Vault accounting sync/recovery functions

---

# 9) Deployment Checklist (Hard Requirements)

### Vault

* `governance` set correctly
* `setBridgeCore(BridgeCoreAddress)`
* `addSupportedToken(usdcToken)` (ERC20 only; vault deposit/withdraw disallow native)

### BridgeCore

* `setVault(VaultAddress)`
* `setUsdcToken(usdcToken)`
* `setSwapAdapter(AdapterAddress)`
* `setWrappedToken(WrappedNativeToken)`
* `setFeeManager(FeeManagerAddress)`
* `setValidatorManager(Operator/MultisigAddress)`
* Set supportedTokens correctly (including native if intended)

### Adapter

* `setWhitelistedAdapter(BridgeCoreAddress, true)`
* Router and wrapped token set correctly

### FeeManager

* Grant `ADMIN_ROLE` to BridgeCore (or redesign FeeManager to accept bridge role)

---

# 10) Recommended Test Suite (Minimal)

### Critical correctness

* Mintable deposit → refund after timeout → success (mint back)
* Non-mintable deposit → stored in vault as USDC → refund returns USDC
* Batch refund continues after a single failing entry (if try/catch added)

### Release behavior

* Release under normal delay > 1 hour (validate updated policy)
* Release for mintable tokens with outputToken swaps
* Fee paths (including fee swap failure fallback)

### Vault accounting

* Direct ERC20 transfer to Vault → syncERC20 recovers
* Forced ETH → syncNative recovers

---

# 11) Final Assessment

### Severity Summary

* **Critical:** BC-01, BC-02
* **High:** BC-03, BC-04
* **Medium:** BC-05, BC-06, AD-01, VA-01
* **Low/Info:** VA-02, GOV-01, INFO-01

### Production Readiness

* **Not production-ready** until BC-01 is fixed and the validator model is upgraded beyond a single EOA (or equivalent on-chain threshold security is implemented).

---
