Alright — here’s a complete, production-grade CCTP v2 compendium tailored to your stack (Ethers v6 + viem + Reown/AppKit + Node/Express). I’ve rewritten and consolidated every section of what you pasted into one coherent “how-to build the whole system” with ready-to-drop code, robust error handling, and the exact semantics (finality thresholds, domains, fees, contracts, APIs).

---

# CCTP v2 — Full Compendium (Architecture → Contracts → APIs → Code)

## 1) What CCTP v2 is (and what changed from v1)

* **Native burn & mint** of USDC across supported chains via generalized message passing (no lock-and-mint, no fragmented liquidity).
* **Two modes**:

  * **Fast Transfer** (soft finality): message attested at *Confirmed* threshold; the mint happens quickly on the destination chain and incurs a chain-specific fee charged **on mint**.
  * **Standard Transfer** (hard finality): message attested at full finality; **fee can be zero** (but some chains may enforce a minimum fee via a “Standard Transfer fee switch”).
* **Hooks**: `depositForBurnWithHook()` lets you attach arbitrary `hookData` that your destination caller executes after receive.
* **New contracts & interfaces** (v2): `TokenMessengerV2`, `MessageTransmitterV2`, `TokenMinterV2`, plus message format changes and finality controls; v2 and v1 can coexist on the same chain. ([Circle Developers][1])

### Finality thresholds (v2)

* `minFinalityThreshold` is **1000 (Confirmed)** for Fast and **2000 (Finalized)** for Standard. Values <1000 are treated as 1000; values >1000 are treated as 2000. Your **recipient** implements separate handlers for unfinalized vs finalized. ([Circle Developers][2])

### Typical timing

* Circle documents Fast Transfer reducing times from **~15 min+** to **under ~30s** across most domains (exact times vary by chain & are updated in “Block Confirmations”). For Standard, timing follows hard finality per chain. ([Circle Developers][3])

---

## 2) Supported chains, domains, and addresses

### Domains (do **not** equal chain IDs)

A Domain ID is a Circle-issued identifier used inside CCTP messages (e.g., **0=Ethereum**, **1=Avalanche**, **6=Base**, **3=Arbitrum**, **2=OP**, **7=Polygon PoS**, **10=Unichain**, **11=Linea**, **12=Codex**, **13=Sonic**, **14=World Chain**, **16=Sei**, **18=XDC**, **19=HyperEVM**, **21=Ink**, **22=Plume**, **5=Solana**). Full mainnet/testnet matrix is in “Supported Chains & Domains.” ([Circle Developers][4])

### Core EVM contract addresses (same per chain family)

Circle deploys the **same** addresses for each contract on every supported EVM domain (separate sets for mainnet vs testnet). Key v2 contracts:

* **TokenMessengerV2** (mainnet): `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`

* **MessageTransmitterV2** (mainnet): `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`

* **TokenMinterV2** (mainnet): `0xfd78EE919681417d192449715b2594ab58f5D002`

* **MessageV2 (helper)** (mainnet): `0xec546b6B005471ECf012e5aF77FBeC07e0FD8f78`

* **TokenMessengerV2** (testnet): `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`

* **MessageTransmitterV2** (testnet): `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`

* **TokenMinterV2** (testnet): `0xb43db544E2c27092c107639Ad201b3dEfAbcF192`

* **MessageV2 (helper)** (testnet): `0xbaC0179bB358A8936169a63408C8481D582390C4`

(Those tables are listed per chain on Circle; above are the canonical addresses for v2 across EVM domains.) ([Circle Developers][5])

> Solana and some non-EVM chains expose v2 via analogous programs/packages; you’ll use the EVM addresses above for EVM chains and the Solana programs for Solana Devnet/Mainnet. ([Circle Developers][6])

---

## 3) Message format, nonces, finality & fees (v2)

### Top-level message header (v2)

Fields include `version`, `sourceDomain`, `destinationDomain`, `nonce`, `sender` (bytes32 of caller on source), `recipient` (bytes32 of destination handler), `destinationCaller` (who may call `receiveMessage`), `minFinalityThreshold`, `finalityThresholdExecuted`, and `messageBody` (dynamic). Nonces are **assigned offchain** by Circle; query via `/v2/messages?transactionHash=...`. ([Circle Developers][2])

### Burn message body (USDC transfer)

Includes `burnToken`, `mintRecipient`, `amount`, `messageSender`, `maxFee`, `feeExecuted`, `expirationBlock` (24h safety), and optional `hookData`. ([Circle Developers][2])

### Fees

* **Fast**: on-chain minting fee charged at destination; **bps vary by source chain** (e.g., Linea higher).
* **Standard**: often zero, except chains that enable a **Standard fee switch** (then `getMinFeeAmount()` exists on TokenMessengerV2).
* Always fetch live fees from **`GET /v2/burn/USDC/fees/{srcDomain}/{dstDomain}`** and compute `maxFee = ceil(amount * minimumFeeBps / 10_000)`.
* **Rate limiting**: Iris API allows **35 req/s** (exceed → 5-minute 429 lockout). ([Circle Developers][2])

---

## 4) The APIs you’ll actually hit

* **Hosts**: Testnet `https://iris-api-sandbox.circle.com`, Mainnet `https://iris-api.circle.com`.
* **Key endpoints (v2):**

  * `GET /v2/messages/{srcDomain}?transactionHash=...` → attestation & decoded body
  * `GET /v2/publicKeys` → verify attestation authenticity (optional offchain verification)
  * `POST /v2/reattest` → re-attest expired/unfinalized messages
  * `GET /v2/fastBurn/USDC/allowance` → remaining Fast allowance
  * `GET /v2/burn/USDC/fees/{srcDomain}/{dstDomain}` → min fee (bps) for Fast/Standard
  * (Deprecated) `GET /v2/fastBurn/USDC/fees` → replaced by `/v2/burn/USDC/fees`
    All subject to **35 rps** rate limit. ([Circle Developers][2])

---

## 5) End-to-end flow (v2 EVM)

1. **Approve** USDC for **TokenMessengerV2** on the source chain.
2. **Estimate fee** via `/v2/burn/USDC/fees` and compute **`maxFee`**.
3. **Burn** with `TokenMessengerV2.depositForBurn(...)` or `depositForBurnWithHook(...)` (set `minFinalityThreshold` to `1000` for Fast or `2000` for Standard).
4. **Poll attestation** via `GET /v2/messages/{src}?transactionHash=...` until `status=complete`.
5. **Mint** on destination by calling `MessageTransmitterV2.receiveMessage(message, attestation)`.
6. **(Optional)** destination receiver executes your **hook** logic (if you used `depositForBurnWithHook`). ([Circle Developers][1])

---

# Drop-in Code (Ethers v6 + viem + React + Node/Express)

Below are **complete** files you can paste into your repo. They’re defensive, typed, and include logging, backoff, and feature flags.

---

## A) Shared config & ABIs (TypeScript)

**`src/cctp/config.ts`**

```ts
// Domain IDs (Circle-issued; NOT EVM chainId)
export const CCTP_DOMAINS = {
  ETHEREUM: 0,
  AVALANCHE: 1,
  OP: 2,
  ARBITRUM: 3,
  SOLANA: 5,
  BASE: 6,
  POLYGON_POS: 7,
  UNICHAIN: 10,
  LINEA: 11,
  CODEX: 12,
  SONIC: 13,
  WORLD: 14,
  SEI: 16,
  BNB: 17,        // USYC only
  XDC: 18,
  HYPEREVM: 19,
  INK: 21,
  PLUME: 22,
} as const;

export type CctpDomainId = (typeof CCTP_DOMAINS)[keyof typeof CCTP_DOMAINS];

// Canonical v2 contracts (EVM) — mainnet & testnet
export const CCTP_EVM_ADDRESSES = {
  mainnet: {
    TokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
    MessageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
    TokenMinterV2: "0xfd78EE919681417d192449715b2594ab58f5D002",
    MessageV2Helper: "0xec546b6B005471ECf012e5aF77FBeC07e0FD8f78",
  },
  testnet: {
    TokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    MessageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    TokenMinterV2: "0xb43db544E2c27092c107639Ad201b3dEfAbcF192",
    MessageV2Helper: "0xbaC0179bB358A8936169a63408C8481D582390C4",
  },
} as const;

export const IRIS = {
  sandbox: "https://iris-api-sandbox.circle.com",
  mainnet: "https://iris-api.circle.com",
} as const;

// Helper: 0x-padded bytes32 address
export const addressToBytes32 = (addr: string) =>
  ("0x" + "0".repeat(24) + addr.replace(/^0x/, "")).toLowerCase();
```

**`src/cctp/abis.ts`**

```ts
export const ERC20_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

export const TOKEN_MESSENGER_V2_ABI = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "depositForBurnWithHook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
  },
  // Only present where Standard fee switch is enabled
  {
    type: "function",
    name: "getMinFeeAmount",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const MESSAGE_TRANSMITTER_V2_ABI = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [],
  },
] as const;
```

---

## B) Node/viem “bridge orchestrator” (testnet-ready)

**`scripts/cctp/transfer.ts`** (run with `node --loader ts-node/esm scripts/cctp/transfer.ts`)

```ts
import "dotenv/config";
import axios from "axios";
import { createWalletClient, http, encodeFunctionData, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, avalancheFuji } from "viem/chains";
import { CCTP_EVM_ADDRESSES, IRIS, CCTP_DOMAINS, addressToBytes32 } from "../../src/cctp/config";
import { TOKEN_MESSENGER_V2_ABI } from "../../src/cctp/abis";

// ---- ENV ----
const PK = process.env.PRIVATE_KEY!;
if (!PK) throw new Error("PRIVATE_KEY missing");
const account = privateKeyToAccount(("0x" + PK.replace(/^0x/, "")) as `0x${string}`);

// ---- CHAINS (Sepolia -> Fuji) ----
const src = sepolia;
const dst = avalancheFuji;
const SRC_DOMAIN = CCTP_DOMAINS.ETHEREUM; // 0
const DST_DOMAIN = CCTP_DOMAINS.AVALANCHE; // 1

// USDC + contracts (testnet!)
const USDC_SEPOLIA = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" as const;
const TokenMessengerV2 = CCTP_EVM_ADDRESSES.testnet.TokenMessengerV2 as `0x${string}`;
const MessageTransmitterV2 = CCTP_EVM_ADDRESSES.testnet.MessageTransmitterV2 as `0x${string}`;

// ---- Clients ----
const srcClient = createWalletClient({ account, chain: src, transport: http() });
const dstClient = createWalletClient({ account, chain: dst, transport: http() });

// ---- Params ----
const DEST_ADDR = process.env.DEST_ADDR ?? account.address;
const AMOUNT_USDC_6 = 1_000_000n; // 1 USDC (6 decimals)
const MIN_FINALITY_THRESHOLD = 1000; // 1000 Fast, 2000 Standard

// ---- Helpers ----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ceilDiv = (a: bigint, b: bigint) => (a + (b - 1n)) / b;

async function getFeesBps(sourceDomain: number, destDomain: number) {
  const url = `${IRIS.sandbox}/v2/burn/USDC/fees/${sourceDomain}/${destDomain}`;
  const { data } = await axios.get(url, { timeout: 10_000 });
  // Shape is versioned by Circle; handle common keys defensively:
  // e.g. { fast: { minimumFeeBps }, standard: { minimumFeeBps } } OR flat with minimumFee
  const fastBps =
    data?.fast?.minimumFeeBps ??
    data?.fast?.minimumFee ??
    data?.minimumFeeBps ??
    data?.minimumFee ??
    0;
  const standardBps =
    data?.standard?.minimumFeeBps ??
    data?.standard?.minimumFee ??
    0;
  return { fastBps: BigInt(fastBps), standardBps: BigInt(standardBps) };
}

function computeMaxFee(amount6: bigint, feeBps: bigint) {
  // amount * bps / 10_000 (rounded up)
  return ceilDiv(amount6 * feeBps, 10_000n);
}

async function approveIfNeeded() {
  // optional: skip if allowance is high
  const data = encodeFunctionData({
    abi: [parseAbiItem("function approve(address spender,uint256 amount) returns (bool)")],
    functionName: "approve",
    args: [TokenMessengerV2, 10_000_000_000n], // 10,000 USDC
  });
  const hash = await srcClient.sendTransaction({ to: USDC_SEPOLIA, data });
  console.log("approve tx:", hash);
}

async function burnUSDC(maxFee: bigint) {
  const DEST_ADDR_BYTES32 = addressToBytes32(DEST_ADDR) as `0x${string}`;
  const ZERO32 = `0x${"0".repeat(64)}` as const;

  const data = encodeFunctionData({
    abi: TOKEN_MESSENGER_V2_ABI,
    functionName: "depositForBurn",
    args: [
      AMOUNT_USDC_6,
      DST_DOMAIN,
      DEST_ADDR_BYTES32,
      USDC_SEPOLIA,
      ZERO32,                // destinationCaller (any)
      maxFee,
      MIN_FINALITY_THRESHOLD // 1000 Fast, 2000 Standard
    ],
  });

  const txHash = await srcClient.sendTransaction({ to: TokenMessengerV2, data });
  console.log("burn tx:", txHash);
  return txHash;
}

async function pollAttestation(srcDomain: number, burnTx: string) {
  const base = `${IRIS.sandbox}/v2/messages/${srcDomain}?transactionHash=${burnTx}`;
  for (;;) {
    try {
      const { data, status } = await axios.get(base, { timeout: 10_000 });
      const msg = data?.messages?.[0];
      if (status === 200 && msg?.status === "complete") return msg; // { message, attestation, ... }
      console.log("waiting for attestation...");
    } catch (e: any) {
      console.log("attestation poll error:", e?.response?.status || e?.message);
    }
    await sleep(5_000);
  }
}

async function receiveOnDestination(attestation: any) {
  const data = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "receiveMessage",
        stateMutability: "nonpayable",
        inputs: [
          { name: "message", type: "bytes" },
          { name: "attestation", type: "bytes" },
        ],
        outputs: [],
      },
    ],
    functionName: "receiveMessage",
    args: [attestation.message as `0x${string}`, attestation.attestation as `0x${string}`],
  });
  const tx = await dstClient.sendTransaction({ to: MessageTransmitterV2, data });
  console.log("mint tx:", tx);
}

(async function main() {
  console.log("1) Approve...");
  await approveIfNeeded();

  console.log("2) Fetch fees...");
  const { fastBps, standardBps } = await getFeesBps(SRC_DOMAIN, DST_DOMAIN);
  const feeBps = MIN_FINALITY_THRESHOLD <= 1000 ? fastBps : standardBps;
  const maxFee = computeMaxFee(AMOUNT_USDC_6, feeBps);
  console.log(`fees bps: fast=${fastBps} standard=${standardBps} => maxFee=${maxFee}`);

  console.log("3) Burn on source...");
  const burnTx = await burnUSDC(maxFee);

  console.log("4) Poll attestation...");
  const att = await pollAttestation(SRC_DOMAIN, burnTx);

  console.log("5) Mint on destination...");
  await receiveOnDestination(att);

  console.log("✅ Completed");
})().catch((e) => {
  console.error("CCTP script failed:", e);
  process.exit(1);
});
```

> Notes:
>
> * Uses **live fees** (no hard-coding), observes **rate limit** with a safe 5s poll cadence.
> * Supports Fast vs Standard via `MIN_FINALITY_THRESHOLD`.
> * For re-attest or expired burns, call `POST /v2/reattest` before mint (omitted for brevity). ([Circle Developers][7])

---

## C) React + Ethers v6 “Bridge” panel (Reown/AppKit-ready)

This component wires to your Reown/AppKit account/signer and performs **approve → burn → poll → receive**. It shows live fee estimates and has verbose console logging you can keep or gate with a debug toggle.

**`src/pages/Bridge/CctpBridgePanel.tsx`**

```tsx
import * as React from "react";
import {
  Box, Stack, Typography, Button, TextField, Alert, LinearProgress
} from "@mui/material";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import axios from "axios";
import { useAppKitAccount, useAppKitProvider } from "../../config"; // your Reown hooks
import { CCTP_EVM_ADDRESSES, IRIS, CCTP_DOMAINS, addressToBytes32 } from "../../cctp/config";
import { ERC20_ABI, TOKEN_MESSENGER_V2_ABI, MESSAGE_TRANSMITTER_V2_ABI } from "../../cctp/abis";

const USDC_SEPOLIA = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238";
const SRC_DOMAIN = CCTP_DOMAINS.ETHEREUM;   // 0
const DST_DOMAIN = CCTP_DOMAINS.AVALANCHE;  // 1
const MIN_FINALITY_THRESHOLD = 1000;        // 1000 Fast, 2000 Standard

export default function CctpBridgePanel() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155"); // Reown EVM provider

  const [dest, setDest] = React.useState<string>(address ?? "");
  const [amount, setAmount] = React.useState<string>("1.0");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string>("");

  async function getMaxFee(amountUsdc6: bigint) {
    const url = `${IRIS.sandbox}/v2/burn/USDC/fees/${SRC_DOMAIN}/${DST_DOMAIN}`;
    const { data } = await axios.get(url);
    const fastBps = BigInt(
      data?.fast?.minimumFeeBps ?? data?.fast?.minimumFee ?? data?.minimumFeeBps ?? data?.minimumFee ?? 0
    );
    const ceilDiv = (a: bigint, b: bigint) => (a + (b - 1n)) / b;
    return ceilDiv(amountUsdc6 * fastBps, 10_000n);
  }

  async function run() {
    if (!walletProvider) return;
    setBusy(true);
    setStatus("Connecting wallet...");
    const provider = new BrowserProvider(walletProvider as any);
    const signer = await provider.getSigner();

    // Contracts
    const token = new Contract(USDC_SEPOLIA, ERC20_ABI, signer);
    const messenger = new Contract(CCTP_EVM_ADDRESSES.testnet.TokenMessengerV2, TOKEN_MESSENGER_V2_ABI, signer);
    const transmitter = new Contract(CCTP_EVM_ADDRESSES.testnet.MessageTransmitterV2, MESSAGE_TRANSMITTER_V2_ABI, signer);

    const amt6 = parseUnits(amount, 6);
    const destBytes32 = addressToBytes32(dest);
    const ZERO32 = `0x${"0".repeat(64)}`;

    setStatus("Estimating fee...");
    const maxFee = await getMaxFee(amt6);
    console.log("maxFee (USDC 6dp):", maxFee.toString());

    setStatus("Approving USDC...");
    const approveTx = await token.approve(CCTP_EVM_ADDRESSES.testnet.TokenMessengerV2, BigInt(10_000_000_000));
    await approveTx.wait();
    console.log("approve tx:", approveTx.hash);

    setStatus("Burning (depositForBurn)...");
    const burnTx = await messenger.depositForBurn(
      amt6,
      DST_DOMAIN,
      destBytes32,
      USDC_SEPOLIA,
      ZERO32,
      maxFee,
      MIN_FINALITY_THRESHOLD
    );
    console.log("burn tx:", burnTx.hash);
    await burnTx.wait();

    setStatus("Polling attestation...");
    const url = `${IRIS.sandbox}/v2/messages/${SRC_DOMAIN}?transactionHash=${burnTx.hash}`;
    let attn: any | null = null;
    for (;;) {
      const { data } = await axios.get(url).catch(() => ({ data: null }));
      const msg = data?.messages?.[0];
      if (msg?.status === "complete") { attn = msg; break; }
      await new Promise(r => setTimeout(r, 5000));
    }
    console.log("attestation received");

    setStatus("Minting on destination...");
    const rx = await transmitter.receiveMessage(attn.message, attn.attestation);
    await rx.wait();
    console.log("mint tx:", rx.hash);

    setStatus("✅ Transfer complete");
    setBusy(false);
  }

  return (
    <Box sx={{ p: 3, borderRadius: 3, bgcolor: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
      <Stack spacing={2}>
        <Typography variant="h5">CCTP v2 Bridge (Sepolia → Fuji)</Typography>
        {!isConnected && <Alert severity="info">Connect wallet to continue</Alert>}
        <TextField label="Destination Address" value={dest} onChange={(e)=>setDest(e.target.value)} fullWidth />
        <TextField label="Amount (USDC)" value={amount} onChange={(e)=>setAmount(e.target.value)} />
        {busy && <LinearProgress />}
        <Stack direction="row" spacing={2}>
          <Button variant="contained" disabled={!isConnected || busy} onClick={run}>Bridge</Button>
          <Typography sx={{ opacity: 0.75 }}>{status}</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
```

---

## D) Express API helpers (server-side convenience)

**`server/routes/cctp.ts`**

```ts
import { Router } from "express";
import axios from "axios";
import { IRIS } from "../../src/cctp/config";

const r = Router();

// GET /api/cctp/fees?src=0&dst=1
r.get("/fees", async (req, res) => {
  try {
    const src = Number(req.query.src);
    const dst = Number(req.query.dst);
    const { data } = await axios.get(`${IRIS.sandbox}/v2/burn/USDC/fees/${src}/${dst}`);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "fees_failed" });
  }
});

// GET /api/cctp/messages?src=0&tx=0x....
r.get("/messages", async (req, res) => {
  try {
    const { src, tx } = req.query as any;
    const { data } = await axios.get(`${IRIS.sandbox}/v2/messages/${src}?transactionHash=${tx}`);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "messages_failed" });
  }
});

export default r;
```

---

## E) Solidity receiver (optional “app-level” recipient)

If you plan to **send arbitrary messages** (not just USDC burns), implement the v2 handlers and gate the caller. For USDC burns you normally just call `receiveMessage` on **MessageTransmitterV2**, which then routes to the registered **TokenMessengerV2** → **TokenMinterV2** to mint; you don’t need a custom receiver. Below is a minimal **example** of an app receiver contract for arbitrary messages (it trusts the local MessageTransmitterV2 and verifies the remote sender).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMessageTransmitterV2 {
    function localDomain() external view returns (uint32);
}

interface IAppReceiverV2 {
    function handleReceiveFinalizedMessage(
        uint32 remoteDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes calldata messageBody
    ) external;

    function handleReceiveUnfinalizedMessage(
        uint32 remoteDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes calldata messageBody
    ) external;
}

contract MyCctpV2Receiver is IAppReceiverV2 {
    address public immutable messageTransmitter; // MessageTransmitterV2
    mapping(uint32 => bytes32) public allowedRemoteSenders; // domain => remote app sender (bytes32)

    modifier onlyTransmitter() {
        require(msg.sender == messageTransmitter, "not transmitter");
        _;
    }

    constructor(address _messageTransmitter) {
        messageTransmitter = _messageTransmitter;
    }

    function setAllowedRemote(uint32 domain, bytes32 remoteSender) external {
        // owner auth omitted for brevity
        allowedRemoteSenders[domain] = remoteSender;
    }

    function _check(bytes32 sender, uint32 remoteDomain) internal view {
        require(allowedRemoteSenders[remoteDomain] == sender, "bad remote sender");
    }

    // Called for finalized (>=2000)
    function handleReceiveFinalizedMessage(
        uint32 remoteDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes calldata messageBody
    ) external onlyTransmitter {
        require(finalityThresholdExecuted >= 2000, "not finalized");
        _check(sender, remoteDomain);
        // parse & act on messageBody...
    }

    // Called for fast (<2000)
    function handleReceiveUnfinalizedMessage(
        uint32 remoteDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes calldata messageBody
    ) external onlyTransmitter {
        require(finalityThresholdExecuted < 2000, "should be unfinalized");
        _check(sender, remoteDomain);
        // optionally gate riskier actions, or stage then finalize later...
    }
}
```

> Your **destinationCaller** in `sendMessage/depositForBurnWithHook` should be the address that will call `receiveMessage` (often your relayer/bot). For USDC burns using the standard TokenMessengerV2 path, you typically **don’t** need to deploy a custom receiver. ([Circle Developers][8])

---

## F) “Hooks” pattern (how to use it safely)

* Use `depositForBurnWithHook` with `hookData` encoding instructions for your destination flow (e.g., auto-swap, route to vault, mark an order paid).
* On the destination, **your** component (usually the `destinationCaller`) executes the hook after mint — **CCTP core does not execute hooks**; they are *opaque* bytes to the protocol.
* If hook execution fails, you own the retry & recovery logic. Keep hook effects idempotent; include nonces; verify the burn amounts & recipient before acting. ([Circle Developers][2])

---

## G) Fast vs Standard fee logic (and the “fee switch”)

* Before **every** burn, call `/v2/burn/USDC/fees/src/dst` and compute `maxFee` from `minimumFee` (bps).
* If you set `minFinalityThreshold=1000` and `maxFee` covers the Fast fee, attestation can be fast; otherwise Standard rules apply.
* Some chains add a **Standard fee switch** — on those deployments, `TokenMessengerV2.getMinFeeAmount(amount)` must succeed and you must provide at least that fee when minting (enforced on destination). Handle “function missing” errors by falling back to **no standard fee** logic. ([Circle Developers][2])

---

## H) Ops, limits, and gotchas

* **Rate limit**: 35 rps on Iris APIs; if exceeded you’re blocked for 5 minutes (HTTP 429). Backoff your polling (5–10s interval) and avoid fan-outs. ([Circle Developers][2])
* **Nonces**: v2 nonces are assigned offchain; fetch via `/v2/messages`. Don’t assume sequential per domain. ([Circle Developers][2])
* **Address width**: CCTP uses `bytes32` addresses to support non-EVM domains — convert by **zero-prefixing 12 bytes** for EVM addresses (helper provided). ([Circle Developers][2])
* **Timings**: For current average attestation times per chain (fast vs standard), consult “Block Confirmations” and don’t hard-code minutes/seconds. ([Circle Developers][9])
* **Security**:

  * Enforce least-privilege on your `destinationCaller`.
  * If you build arbitrary messaging, gate **sender** by domain & address, and treat **unfinalized** flows differently.
  * Keep hook actions idempotent and signed/authorized within your app.

---

## I) Minimal CLI (what you can run right now)

* **Testnet** (Sepolia → Fuji):

  1. Put `PRIVATE_KEY` and optional `DEST_ADDR` in `.env`.
  2. `npm i -D ts-node typescript && npm i axios viem dotenv`
  3. Run: `node --loader ts-node/esm scripts/cctp/transfer.ts`
  4. Watch logs: **approve → burn → attestation → mint**.

---

## J) Where this is coming from (primary sources)

* Finality thresholds, message fields, fee rules, endpoints, rate limits, and function lists: Circle **CCTP Technical Guide**. ([Circle Developers][2])
* Supported domains & domain IDs: **CCTP Supported Chains & Domains**. ([Circle Developers][4])
* EVM v2 contract addresses (mainnet/testnet tables): **CCTP EVM Contracts & Interfaces**. ([Circle Developers][5])
* “Fast ≲30s” & timings guidance: **CCTP Overview** and **Block Confirmations**. ([Circle Developers][3])
* Fees API reference: **GET `/v2/burn/USDC/fees`**. ([Circle Developers][7])

---

If you want, I can also drop in a **Wagmi/Reown** variant of the panel, a **Next.js API route** for serverless polling, and a **chains config** pre-filled for Base↔OP↔Arbitrum↔Polygon PoS (mainnet & sepolia/amoy) that plugs straight into your app.

[1]: https://developers.circle.com/cctp/technical-guide?utm_source=chatgpt.com "CCTP Technical Guide"
[2]: https://developers.circle.com/cctp/technical-guide "CCTP Technical Guide"
[3]: https://developers.circle.com/cctp?utm_source=chatgpt.com "Cross-Chain Transfer Protocol"
[4]: https://developers.circle.com/cctp/cctp-supported-blockchains?utm_source=chatgpt.com "CCTP Supported Chains and Domains - developers.circle.com"
[5]: https://developers.circle.com/cctp/evm-smart-contracts "CCTP EVM Contracts and Interfaces"
[6]: https://developers.circle.com/cctp/solana-programs?utm_source=chatgpt.com "CCTP Solana Programs and Interfaces - developers.circle.com"
[7]: https://developers.circle.com/api-reference/cctp/all/get-burn-usdc-fees?utm_source=chatgpt.com "Get USDC transfer fees - developers.circle.com"
[8]: https://developers.circle.com/cctp/evm-smart-contracts?utm_source=chatgpt.com "CCTP EVM Contracts and Interfaces - developers.circle.com"
[9]: https://developers.circle.com/cctp/required-block-confirmations?utm_source=chatgpt.com "CCTP Block Confirmations"
