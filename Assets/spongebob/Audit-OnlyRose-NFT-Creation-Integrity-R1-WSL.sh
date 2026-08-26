#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

API="${ONLYROSE_API_CONTAINER:-rose-alpha-api-1}"
CHAIN="${ONLYROSE_CHAIN_CONTAINER:-rose-alpha-chain-builder-1}"
PUBLIC="${ONLYROSE_PUBLIC_URL:-https://onlyrose-nft.hausserver.xyz}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="/mnt/c/Users/cheyn/Downloads/OnlyRose-NFT-Creation-Integrity-R1-$STAMP"

mkdir -p "$OUT"
chmod 700 "$OUT"

fail() { echo "ERROR: $*" >&2; exit 1; }

echo "============================================================"
echo " ONLYROSE NFT CREATION INTEGRITY R1 — READ ONLY"
echo "============================================================"
echo "Audits all public NFTs/collections across:"
echo "  DB metadata -> published JSON -> fresh Helius DAS -> live creation source"
echo
echo "NO DB writes."
echo "NO source changes."
echo "NO container restart."
echo "NO Solana transaction."
echo

for cmd in docker python3 curl sha256sum grep sed awk; do
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd required"
done

docker info >/dev/null 2>&1 || fail "Docker unavailable"
docker inspect "$API" >/dev/null 2>&1 || fail "missing $API"
docker inspect "$CHAIN" >/dev/null 2>&1 || fail "missing $CHAIN"

echo "===== 1. RUNTIME IDENTITY ====="
{
  for c in "$API" "$CHAIN"; do
    echo "===== $c ====="
    docker inspect -f \
      'image_id={{.Image}} image={{.Config.Image}} status={{.State.Status}} restarting={{.State.Restarting}} restartCount={{.RestartCount}} user={{.Config.User}} cmd={{json .Config.Cmd}}' \
      "$c"
    echo "networks:"
    docker inspect -f \
      '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} aliases={{json $v.Aliases}} ip={{$v.IPAddress}}{{println}}{{end}}' \
      "$c"
    echo
  done
} | tee "$OUT/runtime.txt"

echo
echo "===== 2. EXACT CURRENT CHAIN BUILDER SOURCE ====="
docker cp "$CHAIN:/app/server.mjs" "$OUT/server.mjs" >/dev/null
docker cp "$CHAIN:/app/src/main.jsx" "$OUT/main.jsx" >/dev/null
docker cp "$CHAIN:/app/package.json" "$OUT/package.json" >/dev/null

SERVER_SHA="$(sha256sum "$OUT/server.mjs" | awk '{print $1}')"
MAIN_SHA="$(sha256sum "$OUT/main.jsx" | awk '{print $1}')"

echo "SERVER_SHA=$SERVER_SHA"
echo "MAIN_JSX_SHA=$MAIN_SHA"

python3 - "$OUT/server.mjs" > "$OUT/chain-creation-blocks.txt" <<'PY_SRC'
from pathlib import Path
import sys

lines=Path(sys.argv[1]).read_text(errors="replace").splitlines()
needles=(
    "createCollectionV1(",
    "createCollection(",
    "royalt",
    "plugins",
    "creators",
    "basisPoints",
    "royaltyBasisPoints",
    "royalty_basis_points",
    "updateAuthority",
)
windows=[]
for i,line in enumerate(lines):
    if any(n.lower() in line.lower() for n in needles):
        a=max(0,i-22)
        b=min(len(lines),i+42)
        if not any(a>=x and b<=y for x,y in windows):
            windows.append((a,b))

for a,b in windows:
    print(f"\n===== lines {a+1}-{b} =====")
    for n in range(a,b):
        print(f"{n+1:05d}: {lines[n]}")
PY_SRC

grep -n -Ei 'createCollectionV1|royalt|plugins|creators|basisPoints|updateAuthority' \
  "$OUT/server.mjs" > "$OUT/chain-relevant-lines.txt" || true

echo "PASS: live Chain Builder source captured"

echo
echo "===== 3. DB + FRESH HELIUS TRUTH ====="
docker exec -i "$CHAIN" node --input-type=module - > "$OUT/truth.json" <<'NODE_AUDIT'
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rpc = process.env.SOLANA_RPC_URL;
if (!rpc) throw new Error('SOLANA_RPC_URL missing');

const SECRET = /(password|passwd|secret|token|api.?key|mnemonic|seed|private|cipher|credential|authorization|cookie|session)/i;

function sanitize(value, key='') {
  if (SECRET.test(String(key))) return '<redacted>';
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(v => sanitize(v));
  if (typeof value === 'object') {
    const out={};
    for (const [k,v] of Object.entries(value)) out[k]=sanitize(v,k);
    return out;
  }
  return value;
}

async function getAsset(id) {
  if (!id) return null;
  const response = await fetch(rpc, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      jsonrpc:'2.0',
      id:'onlyrose-integrity-r1',
      method:'getAsset',
      params:{
        id,
        options:{
          showCollectionMetadata:true,
          showUnverifiedCollections:true,
        },
      },
    }),
  });
  const payload=await response.json();
  if (!response.ok || payload?.error || !payload?.result) {
    return { id, error: payload?.error?.message || `HTTP ${response.status}` };
  }
  return { id, result: payload.result };
}

try {
  const collectionsQ = await pool.query(`
    SELECT
      c.id::text AS collection_id,
      c.name,
      c.symbol,
      c.description,
      c.website,
      c.royalty_basis_points,
      c.status,
      c.visibility,
      c.supply,
      d.collection_address AS deployment_collection_address,
      d.candy_machine_address AS deployment_candy_machine_address,
      d.status AS deployment_status,
      mc.id::text AS market_collection_id,
      mc.collection_address AS market_collection_address
    FROM collection_drafts c
    LEFT JOIN LATERAL (
      SELECT collection_address,candy_machine_address,status
      FROM candy_machine_deployments d
      WHERE d.collection_id=c.id
      ORDER BY d.updated_at DESC
      LIMIT 1
    ) d ON true
    LEFT JOIN market_collections mc
      ON mc.collection_id=c.id
     AND mc.network='mainnet-beta'
    WHERE c.visibility='public'
      AND c.status IN ('ready','deploying','launched','live','published')
    ORDER BY c.name
  `);

  const itemsQ = await pool.query(`
    SELECT
      n.id::text AS item_id,
      n.collection_id::text AS collection_id,
      n.item_index,
      n.name,
      n.description,
      n.external_url,
      n.attributes,
      n.metadata_json,
      n.asset_id::text AS creator_asset_id,
      n.onchain_asset_address,
      a.original_name,
      a.content_type,
      a.status AS creator_asset_status,
      ma.asset_id AS market_asset_id,
      ma.metadata_uri,
      ma.image_url,
      ma.symbol AS market_symbol,
      ma.description AS market_description,
      ma.attributes AS market_attributes,
      ma.raw AS market_raw,
      ma.updated_at AS market_updated_at,
      mc.collection_address AS expected_collection_address
    FROM nft_metadata_items n
    JOIN collection_drafts c
      ON c.id=n.collection_id
    JOIN creator_assets a
      ON a.id=n.asset_id
     AND a.collection_id=n.collection_id
    LEFT JOIN market_assets ma
      ON ma.asset_id=n.onchain_asset_address
    LEFT JOIN market_collections mc
      ON mc.id=ma.market_collection_id
    WHERE c.visibility='public'
      AND c.status IN ('ready','deploying','launched','live','published')
      AND a.status='stored'
    ORDER BY c.name,n.item_index
  `);

  const jobsQ = await pool.query(`
    SELECT
      id::text,
      collection_id::text,
      collection_address,
      candy_machine_address,
      status,
      current_step,
      plan,
      state,
      created_at,
      updated_at
    FROM rose_launch_jobs
    ORDER BY created_at
  `);

  const collections = collectionsQ.rows.map(sanitize);
  const items = itemsQ.rows.map(sanitize);
  const jobs = jobsQ.rows.map(sanitize);

  const collectionAddresses=[];
  for (const c of collections) {
    const id=c.market_collection_address || c.deployment_collection_address;
    if (id && !collectionAddresses.includes(id)) collectionAddresses.push(id);
  }

  const assetIds=[];
  for (const item of items) {
    const id=item.onchain_asset_address || item.market_asset_id;
    if (id && !assetIds.includes(id)) assetIds.push(id);
  }

  const freshCollections=[];
  for (const id of collectionAddresses) {
    freshCollections.push(await getAsset(id));
    await new Promise(r=>setTimeout(r,120));
  }

  const freshAssets=[];
  for (const id of assetIds) {
    freshAssets.push(await getAsset(id));
    await new Promise(r=>setTimeout(r,120));
  }

  console.log(JSON.stringify({
    collections,
    items,
    jobs,
    freshCollections,
    freshAssets,
  },null,2));
} finally {
  await pool.end();
}
NODE_AUDIT

echo "PASS: DB and fresh Helius state captured"

echo
echo "===== 4. PUBLISHED JSON — ALL PUBLIC ITEMS ====="
python3 - "$OUT/truth.json" "$PUBLIC" > "$OUT/published.json" <<'PY_PUB'
import json,sys,urllib.request,urllib.error

truth=json.load(open(sys.argv[1]))
base=sys.argv[2].rstrip("/")
out=[]

for item in truth["items"]:
    cid=item["collection_id"]
    idx=item["item_index"]
    url=f"{base}/api/v1/public/collections/{cid}/metadata/{idx}.json?integrity=r1"
    row={
        "collection_id":cid,
        "item_index":idx,
        "name":item.get("name"),
        "url":url,
    }
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"OnlyRose-integrity-r1/1"})
        with urllib.request.urlopen(req,timeout=20) as r:
            row["http"]=r.status
            row["content_type"]=r.headers.get("content-type","")
            row["json"]=json.loads(r.read())
    except urllib.error.HTTPError as e:
        row["http"]=e.code
        row["error"]=e.read(500).decode("utf-8","replace")
    except Exception as e:
        row["http"]=0
        row["error"]=f"{type(e).__name__}: {e}"
    out.append(row)

print(json.dumps(out,indent=2,default=str))
PY_PUB

echo "PASS: all published item JSON responses captured"

echo
echo "===== 5. LAUNCH-PLAN METADATA / TRAIT RECOVERY CANDIDATES ====="
python3 - "$OUT/truth.json" > "$OUT/launch-plan-metadata-candidates.txt" <<'PY_PLAN'
import json,re,sys

truth=json.load(open(sys.argv[1]))
SECRET=re.compile(r"(password|passwd|secret|token|api.?key|mnemonic|seed|private|cipher|credential|authorization|cookie|session)",re.I)

interesting_keys={
    "attributes","traits","metadata","customMetadata","items","name","symbol",
    "description","uri","metadataUri","metadata_uri","royalty","royaltyBasisPoints",
    "royalty_basis_points","creators","creator","payout","payoutWallet","payout_wallet",
}

def walk(node,path="root",depth=0):
    if depth>12:
        return
    if isinstance(node,dict):
        safe={}
        for k,v in node.items():
            if SECRET.search(str(k)):
                continue
            if k in interesting_keys:
                safe[k]=v
        if safe:
            print(path, json.dumps(safe,ensure_ascii=False,default=str))
        for k,v in node.items():
            if SECRET.search(str(k)):
                continue
            walk(v,f"{path}.{k}",depth+1)
    elif isinstance(node,list):
        for i,v in enumerate(node[:1000]):
            walk(v,f"{path}[{i}]",depth+1)

for job in truth.get("jobs") or []:
    print("\n===== JOB =====")
    for k in ("id","collection_id","collection_address","candy_machine_address","status","current_step"):
        print(f"{k}={job.get(k)}")
    walk(job.get("plan"),"plan")
    walk(job.get("state"),"state")
PY_PLAN

echo "PASS: launch-plan metadata recovery candidates captured"

echo
echo "===== 6. CROSS-LAYER INTEGRITY REPORT ====="
python3 - "$OUT/truth.json" "$OUT/published.json" > "$OUT/INTEGRITY-REPORT.txt" <<'PY_REPORT'
import json,sys

truth=json.load(open(sys.argv[1]))
published=json.load(open(sys.argv[2]))

fresh_assets={
    x["id"]:x.get("result")
    for x in truth.get("freshAssets",[])
    if x.get("result")
}
fresh_cols={
    x["id"]:x.get("result")
    for x in truth.get("freshCollections",[])
    if x.get("result")
}
pub_map={(x["collection_id"],x["item_index"]):x for x in published}

summary={
    "collections":len(truth["collections"]),
    "items":len(truth["items"]),
    "fresh_assets":len(fresh_assets),
    "fresh_collections":len(fresh_cols),
    "metadata_http_200":sum(1 for x in published if x.get("http")==200),
    "empty_db_attributes":0,
    "empty_public_attributes":0,
    "asset_royalty_mismatch":0,
    "collection_royalty_mismatch":0,
    "collection_group_mismatch":0,
    "wrong_interface":0,
    "compressed_assets":0,
    "missing_fresh_assets":0,
}
issues=[]

print("ONLYROSE NFT CREATION INTEGRITY R1")
print("="*78)

print("\nCOLLECTIONS")
for c in truth["collections"]:
    addr=c.get("market_collection_address") or c.get("deployment_collection_address")
    chain=fresh_cols.get(addr) if addr else None
    expected=int(c.get("royalty_basis_points") or 0)
    actual=int((((chain or {}).get("royalty") or {}).get("basis_points")) or 0)
    creators=(chain or {}).get("creators") or []
    plugins=(chain or {}).get("plugins") or {}
    print(
        f"- {c.get('name')} | expected royalty={expected}bps | "
        f"Core collection royalty={actual}bps | creators={len(creators)} | "
        f"plugins={list(plugins.keys()) if isinstance(plugins,dict) else plugins} | "
        f"address={addr}"
    )
    if expected!=actual:
        summary["collection_royalty_mismatch"]+=1
        issues.append(("COLLECTION_ROYALTY",c.get("name"),f"expected {expected}, chain {actual}"))

print("\nNFTS")
for item in truth["items"]:
    aid=item.get("onchain_asset_address") or item.get("market_asset_id")
    chain=fresh_assets.get(aid)
    c=next((x for x in truth["collections"] if x["collection_id"]==item["collection_id"]),{})
    expected_royalty=int(c.get("royalty_basis_points") or 0)

    db_attrs=item.get("attributes")
    mj=item.get("metadata_json") if isinstance(item.get("metadata_json"),dict) else {}
    mj_attrs=mj.get("attributes") if isinstance(mj,dict) else None
    effective_db_attrs=db_attrs if isinstance(db_attrs,list) and db_attrs else (mj_attrs if isinstance(mj_attrs,list) else [])
    if not effective_db_attrs:
        summary["empty_db_attributes"]+=1

    pub=(pub_map.get((item["collection_id"],item["item_index"])) or {}).get("json") or {}
    pub_attrs=pub.get("attributes") if isinstance(pub,dict) else []
    if not pub_attrs:
        summary["empty_public_attributes"]+=1

    if not chain:
        summary["missing_fresh_assets"]+=1
        issues.append(("MISSING_HELIUS",item.get("name"),aid))
        print(f"- {item.get('name')} | asset={aid} | FRESH HELIUS MISSING")
        continue

    interface=chain.get("interface")
    if interface!="MplCoreAsset":
        summary["wrong_interface"]+=1
        issues.append(("INTERFACE",item.get("name"),interface))

    compressed=((chain.get("compression") or {}).get("compressed") is True)
    if compressed:
        summary["compressed_assets"]+=1
        issues.append(("COMPRESSED",item.get("name"),aid))

    group=next((g for g in (chain.get("grouping") or []) if g.get("group_key")=="collection"),{})
    expected_group=item.get("expected_collection_address")
    if expected_group and (not group.get("verified") or str(group.get("group_value") or "")!=str(expected_group)):
        summary["collection_group_mismatch"]+=1
        issues.append(("COLLECTION_GROUP",item.get("name"),f"expected {expected_group}, got {group}"))

    actual_royalty=int((((chain.get("royalty") or {}).get("basis_points")) or 0))
    if expected_royalty!=actual_royalty:
        summary["asset_royalty_mismatch"]+=1
        issues.append(("ASSET_ROYALTY",item.get("name"),f"expected {expected_royalty}, chain {actual_royalty}"))

    creators=chain.get("creators") or []
    authorities=chain.get("authorities") or []

    print(
        f"- {item.get('name')} | asset={aid} | attrs DB/public={len(effective_db_attrs)}/{len(pub_attrs or [])} | "
        f"royalty expected/chain={expected_royalty}/{actual_royalty} | creators={len(creators)} | "
        f"collection_verified={bool(group.get('verified'))} | interface={interface} | "
        f"compressed={compressed} | burnt={chain.get('burnt')} | mutable={chain.get('mutable')} | "
        f"authorities={authorities}"
    )

print("\nSUMMARY")
for k,v in summary.items():
    print(f"{k}={v}")

print("\nISSUES")
for kind,name,detail in issues:
    print(f"{kind}: {name}: {detail}")

print("\nDECISION FLAGS")
print("NEEDS_TRAIT_REPAIR="+str(summary["empty_db_attributes"]>0))
print("NEEDS_ONCHAIN_ROYALTY_REPAIR="+str(summary["asset_royalty_mismatch"]>0 or summary["collection_royalty_mismatch"]>0))
print("NEEDS_COLLECTION_GROUP_REPAIR="+str(summary["collection_group_mismatch"]>0))
print("NEEDS_STANDARD_REPAIR="+str(summary["wrong_interface"]>0 or summary["compressed_assets"]>0))
PY_REPORT

cat "$OUT/INTEGRITY-REPORT.txt"

echo
echo "===== 7. CURRENT COLLECTION-CREATION CODE ====="
sed -n '1,420p' "$OUT/chain-creation-blocks.txt"

echo
echo "===== 8. OUTPUT FILES ====="
echo "$OUT/runtime.txt"
echo "$OUT/chain-creation-blocks.txt"
echo "$OUT/chain-relevant-lines.txt"
echo "$OUT/truth.json"
echo "$OUT/published.json"
echo "$OUT/launch-plan-metadata-candidates.txt"
echo "$OUT/INTEGRITY-REPORT.txt"

echo
echo "============================================================"
echo " PASS: READ-ONLY NFT CREATION INTEGRITY AUDIT COMPLETE"
echo "============================================================"
echo "Paste INTEGRITY-REPORT.txt and the createCollectionV1 block here."
