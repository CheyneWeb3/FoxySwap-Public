# Roburna Testnet CLI

A small Node.js CLI toolkit for Roburna Testnet wallet and faucet testing.

## Menu

Run:

```bash
node menu.mjs
```

Options:

```text
1) Faucet test — one available saved wallet
2) Show all saved wallet balances + totals
3) Sweep all funded saved wallets
4) Generate and add more test wallets
5) Exit
```

## Network

- Chain ID: `159`
- Native test token: `RBAT`
- RPC: `https://preseed-testnet-1.roburna.com`
- Faucet: `https://faucet.roburna.com`
- Explorer: `https://testnet.rbascan.com`

## Install

Node.js 20+ recommended.

```bash
npm install
node menu.mjs
```

On Ubuntu / Debian / WSL, if Node is missing:

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

## Generate more wallets

Choose menu option 4 or run:

```bash
node generate-wallets.mjs
```

It asks how many wallets to add, generates them locally, appends them to:

```text
wallets-unified.json
```

and writes a public copy without private keys to:

```text
wallets-unified-public.json
```

## Faucet test

Choose menu option 1 or run:

```bash
node faucet-one.mjs
```

It uses one wallet marked `available-for-future-testing`, performs the signed faucet challenge/claim flow, waits for the RBAT balance to increase, then marks the wallet as used/cooldown in the local registry.

Use the faucet test only in an authorized test environment and respect the faucet service's eligibility/cooldown rules.

## Balances and totals

Choose menu option 2 or run:

```bash
node balances-all.mjs
```

It checks saved wallet files, deduplicates addresses, and prints all balances and the aggregate RBAT total.

## Sweep

Choose menu option 3 or run:

```bash
node sweep-all.mjs
```

It asks you to paste a destination EVM address, shows the destination back to you, and requires typing `YES` before sending.

It then finds funded saved wallets and attempts to transfer their available RBAT balance minus a gas reserve.

Always verify the destination address before typing `YES`.

## Private wallet registry

The ZIP does **not** contain any real private keys.

`wallets-unified.example.json` only demonstrates the format.

The real private registry is:

```text
wallets-unified.json
```

Protect it:

```bash
chmod 600 wallets-unified.json
```

Never send a populated `wallets-unified.json` unless you intentionally want to give the recipient control of all included wallets.

## Direct npm commands

```bash
npm run menu
npm run faucet
npm run balances
npm run sweep
npm run generate
```

## Security

This toolkit is intended for testnet use.

Private keys are stored locally in plain-text JSON/key files. Do not use valuable mainnet wallets with this package, and do not commit private wallet files to Git.
