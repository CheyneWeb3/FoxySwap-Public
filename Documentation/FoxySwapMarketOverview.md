# Foxy NFT Marketplace — User Guide & Docs

## What Foxy is

Foxy is a full-stack NFT marketplace + creator tool:

* **Marketplace:** explore collections, view items, buy/offer, list for sale, bid in auctions, track your profile activity.
* **Creator:** spin up a brand-new ERC-721 collection via the **Factory** (or initialize a template clone), with **EIP-2981 royalties**, reveal flow, HTTPS/IPFS/IPNS/Arweave support.
* **Extras:** batch/staking helper, enumeration, per-tx mint caps, mint price controls.

Front-end is a modern React SPA (Material UI), wallet by **AppKit**, and chain calls with **ethers**.
Backend (included as `bkpOfServerFullAPI/`) exposes indexing & order endpoints the UI uses for discovery (collections, items, listings, sales, auctions).

---

## Quick start (users)

### 1) Connect your wallet

* Click **Connect Wallet** (top-right).
* Choose your network (e.g. Roburna / testnet per your config banner).
* You’ll see your address chip once connected.

### 2) Explore the market

* Go to **Explore**.
* Filters & sorting let you browse **Collections**, **Trending**, and **Latest** (the API powers these feeds).
* Click a **collection** to open its detail page; click an **item** to open the item page.

### 3) Buy an NFT (fixed price)

1. Open the **item page**.
2. If it has a “Buy now” price, press **Buy** and confirm in your wallet.
3. Ownership updates after the transaction confirms; you’ll see the NFT in **Profile → Owned**.

### 4) Place an offer (make a bid on fixed-price items)

* On an item, use **Make offer** (if enabled).
* Enter an amount and confirm.
* Creators/sellers can accept offers from their item or profile.

### 5) Bid in an auction

* Open **Auctions** or any auction item.
* Hit **Place bid**, enter your bid (must be ≥ current + min increment), and confirm.
* When the timer ends:

  * **Highest bidder** can **Claim** the NFT.
  * **Seller** can **Settle** and receive funds (minus protocol fee, if any).

### 6) List an NFT for sale

1. Go to **Profile → Owned**.
2. Click **List for sale** on the token you own.
3. Choose **Fixed price** *or* **Auction**:

   * **Fixed price:** set price in ETH.
   * **Auction:** set start price, end time, and (optionally) a buy-now.
4. Approve the marketplace to transfer that token (first time only), then sign the listing tx.

### 7) Create your own collection (no code)

Go to **Create** (your landing “Foxy Creator” page).

**Form (typical fields):**

* **Name / Symbol** – what wallets/marketplaces show.
* **Base URI (post-reveal)** – where metadata lives (HTTPS, IPFS, IPNS, Arweave, or `data:`).
* **Not revealed URI** – single placeholder JSON used before reveal.
* **Mint price (ETH)** – price per NFT at mint.
* **Max supply** – hard cap.
* **Max mint / tx** – limit per wallet per tx.
* **Category** – your tag (art, music, …).
* **Royalties (EIP-2981)** – default % for secondary sales (common range 0–5%; default 3%).

  * Foxy exposes `royaltyInfo(tokenId, salePrice)` so **royalty-aware** marketplaces pay you automatically on resales. Not every marketplace enforces royalties; enforcement depends on the venue.

**What happens on deploy**

* If your **target address** is the **Factory**, Foxy calls `createCollection` (and pays any factory fee from the UI automatically).
* If your target is a **Collection (clone)**, Foxy calls `initialize` with your parameters.
* When confirmed, you’re redirected to your **collection page** with mint UI live.

**After launch controls**

* Update **mint price**, **toggle pause**, **set base URI / extension**, **set placeholder URI**, **reveal**, **max mint / tx**, **set/reset royalties**, and use **stake()** helper.

---

## Pages & what they do

### Explore

* Grid of collections/items, with stats like supply, owners, floor, volume (from your API).
* Clicking a card → Collection or Item page.

### Collection page

* Header with name, description, social links, category.
* **Mint panel** (if owner left mint open): quantity, mint button, running total minted.
* **Filters** for traits (if metadata has attributes), tokens grid, floor price and activity.
* **Admin panel** (visible to collection owner):

  * Set base URI / extension, set placeholder, **Reveal**, **Pause/Unpause** mint, **Price**, **Max per tx**, and **Royalties**.

### Item page

* Large image, attributes read from resolved metadata (supports HTTPS/IPFS/IPNS/Arweave/data).
* **For sale** → “Buy now” panel.
* **Offers** → list of current offers; accept/cancel if owner.
* **Auction** → current bid, min increment, countdown, bid history, bid button.
* **Activity** → transfers, listings, sales.

### Sell page

* Wizard to list an NFT you own:

  * **Approve** marketplace (once per collection).
  * Pick **fixed price** or **auction** params.
  * Post listing to the API & sign any required messages/txs.
  * Listing appears on your Item page and in Explore feeds.

### Auctions page

* All live auctions (sorting by soonest ending / highest bids).
* Each card links to the auction’s item page; shows highest bid and time remaining.

### Profile

* **Owned** – NFTs you hold.
* **Listings** – active fixed-price listings.
* **Offers/Bids** – your outbound offers & bids.
* **Activity** – purchases, sales, transfers.
* **Settings** – network/account widgets via AppKit.

### Creator landing (marketing page)

* Big hero headline, value props, 3-image showcase, “Why Foxy”, “How it works”, “Under the hood”, FAQ, and CTAs.
* Background supports **your slides & blobs toggler** just like your Liquidity page.

---

## Mints, reveals & metadata

* **Placeholder phase**: collection exposes one **Not Revealed URI** for all tokens (e.g. `/placeholder/0.json`).
* **Reveal**: owner flips `reveal()` → collection begins serving per-token URIs from **Base URI + tokenId + extension** (e.g. `https://cdn.site/meta/123.json`).
* **Hosting** is agnostic: **HTTPS, IPFS, IPNS, Arweave, data:** are all accepted; the UI resolves them for display.
* **Enumeration** is on → wallets/indexers can page tokens and show **tokenOfOwnerByIndex**.

---

## Royalties (EIP-2981) — how they work

* You set a **default royalty** (e.g. 3%) and optionally **per-token overrides** later.
* On a resale, royalty-aware marketplaces call `royaltyInfo(tokenId, salePrice)` and pay that percentage to your **receiver**.
* Not all venues enforce royalties; Foxy returns correct data on-chain, but payment depends on marketplace policy.

---

## Fees

* **Mint fee split**: every mint sends a hard-coded **treasury fee** (BPS) to the protocol; the rest goes to your **creator payout** address immediately.
* **Marketplace fee** (if configured) applies on sales/auctions via the market contracts or settlement layer.
* **Gas**: the signer pays gas on deploy, mint, list, buy, bid, etc.

---

## Safety & custody

* Foxy uses standard **OpenZeppelin v5** building blocks and on-chain **ERC-721** approvals:

  * To list, you approve the marketplace **for that token/collection**.
  * You remain the owner until a sale/settlement moves the token.
* Mint functions are reentrancy-safe; staking helper uses a convenience **`stake(address, uint256[])`** batch transfer.

---

## End-to-end flows (quick recipes)

### A) Launch a collection

1. **Create** → fill the form (name, symbol, URIs, price, supply, max per tx, royalties).
2. Confirm the **Create Now** transaction (factory or initialize).
3. Land on your **collection page** with mint open.
4. (Optional) later: set base extension, reveal, change royalties or price.

### B) Mint from a collection

1. Open the **collection** → **Mint** panel.
2. Enter quantity and press **Mint**.
3. Confirm; minted tokens appear in **Profile → Owned**.

### C) List for sale

1. **Profile → Owned** → choose NFT → **List for sale**.
2. Choose **Fixed price** or **Auction** and set the params.
3. Approve (first time) and sign the listing.

### D) Buy or Bid

* **Buy**: on item page, press **Buy** → confirm in wallet.
* **Bid**: on auction, press **Place bid** → enter amount → confirm.

### E) Accept an offer

1. On your item, open **Offers**.
2. Pick an offer → **Accept** → confirm.

---


## FAQ (for users)

**Do I own the contract I deploy?**
Yes. The wallet that deploys/initializes becomes **owner** and can reveal, set price, pause, and set royalties.

**Can I use normal HTTPS servers for metadata?**
Yes. HTTPS, IPFS, IPNS, Arweave and even `data:` URIs work. You store strings on-chain; Foxy resolves them on the front-end.

**What % should I set for royalties?**
Common range is **0–5%**. Foxy defaults to **3%**. You can change this later on your collection page. Royalties apply to **secondary sales** on royalty-aware marketplaces.

**Where do mint proceeds go?**
Proceeds split on-chain: a **treasury fee** (BPS) to protocol; **the rest** straight to your **creator payout** address.

**Can I stake my NFTs?**
Yes — the contract includes a convenience `stake(address, uint256[])` batch transfer to your staking contract.

**What if my image/metadata aren’t updating after reveal?**
Hard refresh or clear cache. If you’re on IPFS/IPNS/Arweave, gateway caches can lag. Make sure your **Base URI** is correct and each `tokenId.json` is reachable.

---

## Troubleshooting

* **“Insufficient funds” / “User rejected”** → Top-up your wallet or re-try the transaction.
* **Can’t buy / bid** → Check you’re on the **correct network** shown in the top banner.
* **Images not loading** → Verify metadata URLs. For IPFS/IPNS/Arweave, try another gateway.
* **Listing not visible** → Refresh; confirm your API is reachable (see `config.ts → API_BASE`).
* **Royalties not paid on a resale** → Depends on the marketplace. Foxy exposes EIP-2981 correctly; some platforms ignore royalties.

---

If you want, I can also turn this into a polished in-app **Docs** page (same tone/sections) and wire it to `/docs/foxy-creator` so your CTA buttons land on brand.
