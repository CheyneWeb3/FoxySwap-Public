# Foxy Bot (srver.zip) — API Endpoints + Telegram Actions

This documentation is **source-of-truth from the code in**:

* `api/src/index.ts`
* `bot/src/index.ts`
* `bot/src/modules/activityFeed.ts`
* `bot/src/modules/shills.ts`
* `bot/src/modules/roles.ts`
* `bot/src/modules/cloudflare.ts`

> Important: this zip does **NOT** include the on-chain watcher/indexer that writes into Mongo (`activities`, `collections`). So this doc covers **what exists here** (API + bot). Any watcher endpoints are not present in this zip.

---

## 1) API Service

### Base / Port

* Port: `API_PORT` (default `8099`)
* CORS: `CORS_ORIGIN` (default `"*"`)

### `GET /health`

Health check.

**Response**

```json
{ "ok": true }
```

---

### `GET /v1/chains`

Returns supported chains and their RPC/multicall/native symbol from `foxyswapChains.js`.

**Response**

```json
{
  "chains": [
    {
      "chainId": 56,
      "rpcs": ["https://..."],
      "multicall3": "0x...",
      "nativeSymbol": "BNB"
    }
  ]
}
```

---

### `GET /v1/contracts/:chainId`

Returns marketplace + factory addresses for a chain.

**Path Params**

* `chainId` (number)

**Response**

```json
{
  "chainId": 56,
  "marketplace": "0x...",
  "factory721": "0x...",
  "factory1155": "0x..."
}
```

**Errors**

* `400 { "error": "bad chainId" }` if chainId invalid

---

### `GET /v1/activity`

Activity feed from Mongo `activities` collection.

**Query Params**

* `chainId` (optional number)
* `type` (optional string, exact match)
* `limit` (optional number, default 50, clamped 1..200)
* `cursor` (optional ObjectId string; pagination “older than”)

**Behavior**

* Sorted newest-first (`_id: -1`)
* If `cursor` provided, it applies: `_id < cursor`
* Returns `nextCursor` = last item’s `_id`

**Response**

```json
{
  "items": [ /* activity docs */ ],
  "nextCursor": "65af...."
}
```

---

### `GET /v1/collections/new`

New collections from Mongo `collections` collection.

**Query Params**

* `chainId` (optional number)
* `limit` (optional number, default 50, clamped 1..200)
* `cursor` (optional ObjectId string)

**Response**

```json
{
  "items": [ /* collection docs */ ],
  "nextCursor": "65af...."
}
```

---

### `GET /v1/collections/:chainId/:collectionAddress/mints`

Returns mint activity **for a specific collection**, sourced from Mongo `activities`.

**Path Params**

* `chainId` (number)
* `collectionAddress` (address string; validated basic `0x` + length)

**Query Params**

* `limit` (default 50, clamped 1..200)
* `cursor` (optional ObjectId)

**Filters**

* `chainId` matches
* `nft == collectionAddress.toLowerCase()`
* `type` in:

```txt
erc721.mint
erc721.mint_paid
erc1155.mint_single
erc1155.mint_batch
erc1155.mint_paid_single
erc1155.mint_paid_batch
```

**Response**

```json
{
  "items": [ /* mint activity docs */ ],
  "nextCursor": "65af...."
}
```

**Errors**

* `400 { "error": "bad chainId" }`
* `400 { "error": "bad collectionAddress" }`

---

## 2) Telegram Bot

### Bot Startup

* Requires: `TELEGRAM_BOT_TOKEN`
* Optional help link: `BOT_DOCS_URL`

On `/start` it replies:

> `🦊 FoxySwap telemetry bot online. Type /help`

---

## 3) Roles & Permissions

### Role levels

Order (lowest → highest):

* `user`
* `operator`
* `admin`
* `owner`

### Owner

Owner IDs come from env:

* `OWNER_TG_IDS="123,456,..."`

### Stored roles

Mongo collection:

* `tg_roles` (documents contain `telegramUserId`, `role`, timestamps)

### Permission gates in commands

* Many commands require `admin` or `operator`
* `/setrole` requires `owner`

If blocked:

> `❌ Not allowed.`

---

## 4) Telegram Commands (exact)

### Core

#### `/help`

Prints the full help menu (includes docs link if `BOT_DOCS_URL` set).

#### `/chatid`

Prints:

* chat id, type, title, username
* your user id, username, name
* notes about channels having negative IDs
* instructions to run `/feedon` inside channel
* instructions to use `/filters`

#### `/whoami`

Shows your role:

> `You are: <role> (id: <telegramUserId>)`

#### `/cloudflare`

Shows locally captured Cloudflare tunnel info (from `readTunnelState()`), and **optionally** on-chain value if configured.

* Optional envs:

  * `URL_REGISTRY_ADDRESS`
  * `URL_REGISTRY_RPC_URL`
  * `URL_REGISTRY_TUNNEL_ID` (default `2`)

It attempts to call on-chain:

* `getTunnel(uint256)` or `url(uint256)`

If no local tunnel captured:

> `No Cloudflare tunnel URL captured yet. Make sure the tunnel process is running.`

---

## 5) Activity Feed (Market + Factories + Mints)

This is the feature you asked for: bot posts activity with NFT media/metadata.

### How it works (from code)

* Bot reads **Mongo `activities`** directly (not from API)
* Uses a checkpoint in Mongo `bot_checkpoints`:

  * name: `"activity_last_id"`
  * Stores last processed Mongo `_id`
* Default behavior: **starts at latest** (no backfill spam)
* Processes new activities in ascending `_id` order

### Enrichment & Media rules (exact)

* For **market events missing nft/tokenId**, bot queries the marketplace contract:

  * `listings(listingId)`
  * `auctions(listingId)`
* Fetches NFT metadata:

  * ERC721: `tokenURI(tokenId)`
  * ERC1155: `uri(tokenId)` and replaces `{id}` with 64-hex
* Fetches JSON with safety limits:

  * `METADATA_HTTP_TIMEOUT_MS` (default 12000)
  * `METADATA_MAX_BYTES` (default 2097152)
* IPFS support:

  * `IPFS_GATEWAYS` comma list (uses first gateway)
  * converts `ipfs://...` into `https://<gateway>/...`

**When a collection event lacks a tokenId** it uses preview token:

* default preview token id: `"1"`

**Media selection order**

1. `animation_url` if enabled and looks like mp4/webm
2. else `image` if present
3. else optional fallback: `FEED_MEDIA_FALLBACK` (must look like an image)

**Caption limit**

* caption truncated at ~950 chars; if longer, bot sends follow-up text message.

### Inline buttons (“Actions:”)

If buttons exist:

* Bot sends media+caption
* Then sends a separate message `"Actions:"` with inline keyboard.

Buttons link to `FEED_LINK_BASE` (default `https://foxyswap.net/market`):

* NFT: `${FEED_LINK_BASE}/${chainId}/token/${collection}/${tokenId}`
* Collection: `${FEED_LINK_BASE}/${chainId}/token/${collection}`

Buttons:

* For market buys: **Buy Now**
* For auctions/bids: **Bid Now**
* Always: **View NFT**, **View Collection** (when possible)

---

## 6) Feed Commands (Admin)

Mongo collection used:

* `feed_chats`

Each feed chat doc:

* `chatId` (string, stored from `ctx.chat.id` — can be negative)
* `enabled` boolean
* `subscriptions`: list of `{ chainId, collectionAddress }`
* `chainIds` list (defaults to all supported chain IDs)
* `groups`: `{ market, factory, mints }`
* timestamps

### `/feedon` (admin+)

Enables feed in the current chat.

**Reply**

> `✅ Activity feed enabled in this chat.`

### `/feedoff` (admin+)

Disables feed in the current chat.

**Reply**

> `✅ Activity feed disabled in this chat.`

### `/filters` (admin+)

Shows inline toggle menu for:

* Market
* Factories
* Mints

This uses callback actions:

* `feed_toggle:market`
* `feed_toggle:factory`
* `feed_toggle:mints`

Toggles update the stored `groups` flags.

### `/sub <chainId> <collectionAddress>` (admin+)

Adds a **collection subscription** for this chat.

Rules:

* chainId must be in supported `CHAIN_IDS`
* address must be `0x...` and basic length

**Reply**

> `✅ Subscribed this chat to <chainId>:<addr>`

### `/unsub <chainId> <collectionAddress>` (admin+)

Removes subscription.

**Reply**

> `✅ Unsubscribed <chainId>:<addr>`

### `/subs`

Lists subscriptions for current chat.

If none:

> `No collection subscriptions set for this chat. (If none, chat receives all enabled events.)`

**Important subscription behavior**

* If a chat has **NO subscriptions**, it receives **ALL enabled events**.
* If a chat has **1+ subscriptions**, it only receives events where doc matches:

  * `doc.collection` OR `doc.nft` OR `doc.contractAddress` equals subscribed address (lowercased)

---

## 7) Debug Feed (Operator, DM only)

Mongo collection:

* `debug_chats`

### `/debugon` (operator+; DM only)

Enables raw JSON activity feed to your DM.

### `/debugoff` (operator+; DM only)

### `/debugfilters` (operator+; DM only)

Shows inline toggle menu (same groups: market/factory/mints)

Callback actions:

* `debug_toggle:market`
* `debug_toggle:factory`
* `debug_toggle:mints`

Debug messages send:

* `🧪 Raw Activity (<type>)`
* plus a JSON code block (truncated to ~3800 chars)

---

## 8) Shills System

Mongo collections:

* `shill_chats`
* `shill_messages`

### Chat management (Admin)

#### `/addchat` (admin+)

Enables shills in current chat.

* interval defaults to: `DEFAULT_SHILL_INTERVAL_SEC` (default 3600, minimum 60)

#### `/rmchat` (admin+)

Disables shills in current chat.

#### `/setinterval <seconds>` (admin+)

Sets chat shill interval (must be >= 60)

### Message management (Operator)

#### `/addshill <text>` (operator+)

Adds a shill message.
Reply includes inserted id.

#### `/listshills` (operator+)

Shows last 12 shills (id + preview)

#### `/delshill <id>` (operator+)

Deletes by ObjectId.

#### `/shillnow` (operator+)

Sends a random shill from last 50 messages to every enabled shill chat.

* Rate limited by: `SHILL_RATE_LIMIT_MS` (default 450ms)
* If send fails (bot removed/forbidden), it disables that chat.

### Scheduler loop

`startShillSchedulerLoop()` runs forever:

* checks every 10 seconds
* sends when interval elapsed

---

## 9) Activity Types Currently Supported 

These are the types the bot explicitly formats and posts (everything else falls back to a generic message / debug view):

### Factory

* `factory.erc721.collection_created`
* `factory.erc1155.collection_created`

### ERC721 mints

* `erc721.mint`
* `erc721.mint_paid`

### ERC1155 mints

* `erc1155.mint_single`
* `erc1155.mint_paid_single`
* `erc1155.mint_batch` *(grouped into one message per tx)*
* `erc1155.mint_paid_batch` *(grouped)*

### Market

* `market.listed`
* `market.listing_price_updated`
* `market.listing_cancelled`
* `market.purchased`
* `market.auction_created`
* `market.bid_placed`
* `market.auction_cancelled`
* `market.auction_settled`
* `market.auction_force_cancelled`

---
