#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/stacks/new-guy/utilities/resist-nft-factory"
APP="$ROOT/frontend/src/AppV2.tsx"
CSS="$ROOT/frontend/src/factory.css"
INDEX="$ROOT/frontend/index.html"
PUBLIC="https://resist-factory-testnet.hausserver.xyz"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/root/resist-factory-before-app-dark-completion-v2-$STAMP"

FRONT_IMAGE="resist-nft-factory-frontend:testnet"
ROLLBACK_IMAGE="resist-nft-factory-frontend:before-app-dark-completion-v2-$STAMP"

DEPLOYED=0

fail() {
  echo
  echo "FAIL: $*" >&2

  if [[ "$DEPLOYED" = "1" ]]; then
    echo
    echo "===== AUTOMATIC FRONTEND ROLLBACK ====="
    docker tag "$ROLLBACK_IMAGE" "$FRONT_IMAGE" || true
    (
      cd "$ROOT"
      ./factory testnet up
    ) || true
  elif [[ -d "$BACKUP/frontend/src" ]]; then
    echo
    echo "===== SOURCE ROLLBACK (NOT DEPLOYED) ====="
    cp -a "$BACKUP/frontend/src/AppV2.tsx" "$APP" 2>/dev/null || true
    cp -a "$BACKUP/frontend/src/factory.css" "$CSS" 2>/dev/null || true
    cp -a "$BACKUP/frontend/index.html" "$INDEX" 2>/dev/null || true
    echo "PASS: source restored; live frontend was never changed"
  fi

  exit 1
}

[[ "$EUID" -eq 0 ]] || fail "run as root"

for F in "$APP" "$CSS" "$INDEX"; do
  [[ -f "$F" ]] || fail "missing $F"
done

echo "============================================================"
echo " RESIST NFT FACTORY — APP DARK COMPLETION V2"
echo "============================================================"
echo
echo "Fixes dark mode THROUGH the real app, not only the outer shell."
echo
echo "Projects / collection page:"
echo "  - project cards"
echo "  - mint card"
echo "  - PRICE / SUPPLY / STATE metric boxes"
echo "  - collection container"
echo "  - NFT cards"
echo "  - NFT titles / labels / View Details"
echo
echo "NFT details modal:"
echo "  - modal content surface"
echo "  - heading / description"
echo "  - verified badge"
echo "  - rarity boxes"
echo "  - traits and rarity pills"
echo "  - on-chain rows"
echo "  - address/code values"
echo "  - copy buttons"
echo "  - TON Viewer / GetGems / Metadata JSON actions"
echo
echo "Other normal Factory pages:"
echo "  - generic cards / forms / helper text retain dark variables"
echo "  - yellow CTA buttons keep dark navy text for contrast"
echo
echo "Protected:"
echo "  - all 8 widget theme CSS constants"
echo "  - transparent widget bootstrap"
echo "  - widget CSS bridge"
echo "  - compact iframe widgets"
echo "  - generated launch-page themes"
echo "  - API / DB / contracts / TON state"
echo
echo "No TON transaction."

echo
echo "===== 1. BACKUP + CAPTURE PROTECTED WIDGET BASELINE ====="

mkdir -p "$BACKUP/frontend/src"
cp -a "$APP" "$BACKUP/frontend/src/AppV2.tsx"
cp -a "$CSS" "$BACKUP/frontend/src/factory.css"
cp -a "$INDEX" "$BACKUP/frontend/index.html"

docker image inspect "$FRONT_IMAGE" >/dev/null 2>&1 \
  || fail "missing current frontend image"

docker tag "$FRONT_IMAGE" "$ROLLBACK_IMAGE"

python3 - "$APP" "$BACKUP/widget-protected.sha256" <<'PY'
from pathlib import Path
import hashlib
import sys

src = Path(sys.argv[1]).read_text(encoding="utf-8")
dst = Path(sys.argv[2])

names = [
    "MINT_WIDGET_DEFAULT_CSS",
    "COLLECTION_WIDGET_DEFAULT_CSS",
    "WIDGET_BARE_MINT_CSS",
    "WIDGET_BARE_COLLECTION_CSS",
    "WIDGET_COSMIC_MINT_CSS",
    "WIDGET_COSMIC_COLLECTION_CSS",
    "WIDGET_GLASS_MINT_CSS",
    "WIDGET_GLASS_COLLECTION_CSS",
    "WIDGET_TRANSPARENT_BOOTSTRAP_CSS",
]

def template(name: str):
    needle = f"const {name}=`"
    a = src.find(needle)
    if a < 0:
        return None
    b = src.find("`;", a + len(needle))
    if b < 0:
        raise SystemExit(
            f"FAIL: unterminated protected template {name}"
        )
    return src[a:b+2]

rows = []

for name in names:
    value = template(name)
    if value is None:
        if name == "WIDGET_TRANSPARENT_BOOTSTRAP_CSS":
            continue
        raise SystemExit(
            f"FAIL: missing protected widget CSS {name}"
        )

    digest = hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()

    rows.append((name, digest))
    print(
        f"PASS: captured -> {name} -> {digest[:16]}"
    )

a = src.find("function useWidgetCssBridge")
b = src.find("function WidgetPreview", a)

if a < 0 or b <= a:
    raise SystemExit(
        "FAIL: protected widget CSS bridge not found"
    )

bridge = src[a:b]
digest = hashlib.sha256(
    bridge.encode("utf-8")
).hexdigest()

rows.append(("useWidgetCssBridge", digest))

dst.write_text(
    "\n".join(
        f"{name} {digest}"
        for name, digest in rows
    ) + "\n",
    encoding="utf-8"
)

print(
    f"PASS: captured -> useWidgetCssBridge -> {digest[:16]}"
)
print("PASS: protected widget baseline captured")
PY

echo "Backup:         $BACKUP"
echo "Rollback image: $ROLLBACK_IMAGE"

echo
echo "===== 2. VERIFY APP THEME + TARGET COMPONENTS ====="

grep -Fq 'data-rf-app-theme' "$APP" \
  || fail "Factory app theme state is missing"

grep -Fq 'RESIST_FACTORY_APP_THEME_PREPAINT_A_V1' "$INDEX" \
  || fail "Factory theme prepaint is missing"

for TEXT in \
  "rf-projectgrid" \
  "rf-metrics" \
  "rf-parent-nft-card" \
  "rf-parent-detail-modal" \
  "rf-parent-rarity-metrics" \
  "rf-parent-trait-card" \
  "rf-parent-address-list" \
  "rf-parent-modal-links"
do
  grep -Fq "$TEXT" "$CSS" \
    || fail "expected component CSS missing: $TEXT"
done

echo "PASS: theme state exists"
echo "PASS: project + NFT target components exist"

echo
echo "===== 3. APPEND FINAL DARK COMPLETION LAYER ====="

if grep -Fq \
  "RESIST_FACTORY_APP_DARK_COMPLETION_V2" \
  "$CSS"
then
  echo "PASS: V2 marker already present; leaving source unchanged"
else
  cat >> "$CSS" <<'CSS'

/* =========================================================
   RESIST_FACTORY_APP_DARK_COMPLETION_V2

   Final dark-mode completion for the NORMAL Factory app.
   It intentionally requires .rf-site:not(.rf-compact), so
   compact iframe widgets retain their independent themes.
   ========================================================= */

/* ---------- Base app foregrounds ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact) {
  color: #f4f7fb !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-page {
  color: #f4f7fb !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
:is(
  .rf-pagehead h1,
  .rf-pagehead h2,
  .rf-card > h1,
  .rf-card > h2,
  .rf-card > h3
) {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
:is(
  .rf-pagehead p,
  .rf-card > p,
  .rf-status,
  .rf-help,
  .rf-muted
) {
  color: #a9bfce !important;
  -webkit-text-fill-color: #a9bfce !important;
  opacity: 1 !important;
}

/* ---------- Projects directory ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-projectgrid > a,
html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-projectgrid article {
  border-color: #315f7b !important;
  background: #0f1f2e !important;
  color: #f4f7fb !important;
  box-shadow: 0 5px 0 #02060a !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-projectgrid
:is(h2,h3,b,strong) {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-projectgrid p {
  color: #adc3d2 !important;
  -webkit-text-fill-color: #adc3d2 !important;
  opacity: 1 !important;
}

/* ---------- Project hero stays readable ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-projecthero {
  border-color: #315f7b !important;
  color: #ffffff !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-projecthero
:is(span,h1,p,b,strong) {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
  text-shadow: 0 2px 10px rgba(0,0,0,.55);
}

/* ---------- Mint box + metrics on project page ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-card {
  border-color: #315f7b !important;
  background: #0f1f2e !important;
  color: #f4f7fb !important;
  box-shadow: 0 5px 0 #02060a !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-card
:is(.rf-kicker,h2,h3) {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-metrics > div {
  border-color: #3e7594 !important;
  background: #13283b !important;
  color: #f4f7fb !important;
  box-shadow: none !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-metrics > div small {
  color: #9eb7c8 !important;
  -webkit-text-fill-color: #9eb7c8 !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-metrics > div
:is(b,strong) {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

/* Yellow CTA remains yellow with NAVY text — never white on yellow. */
html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-card > button:not(.rf-app-theme-toggle),
html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-launch-button,
html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-wizard-nav > :last-child {
  background: #ffe55d !important;
  color: #092e58 !important;
  -webkit-text-fill-color: #092e58 !important;
}

/* ---------- Collection / NFT cards ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-nft-card {
  border-color: #315f7b !important;
  background: #0d1c2a !important;
  color: #f5f9fc !important;
  box-shadow:
    0 6px 0 #02070c,
    0 18px 42px rgba(0,0,0,.28) !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-nft-open {
  background: transparent !important;
  color: #f5f9fc !important;
  -webkit-text-fill-color: #f5f9fc !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-nft-image {
  border-bottom-color: #315f7b !important;
  background: #07131e !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-nft-placeholder {
  background: #07131e !important;
  color: #d9edf8 !important;
  -webkit-text-fill-color: #d9edf8 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-nft-info {
  background: #102436 !important;
  color: #f5f9fc !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-nft-info .rf-kicker {
  color: #9fdcf7 !important;
  -webkit-text-fill-color: #9fdcf7 !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-nft-info h3 {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-view-details {
  border-top-color: #315f7b !important;
  color: #b2cad8 !important;
  -webkit-text-fill-color: #b2cad8 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-view-details
:is(span,b,strong) {
  color: #75d7ff !important;
  -webkit-text-fill-color: #75d7ff !important;
  opacity: 1 !important;
}

/* ID sticker intentionally stays yellow with navy text. */
html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
:is(
  .rf-parent-nft-id,
  .rf-parent-id-sticker
) {
  border-color: #5b91b1 !important;
  background: #ffe55d !important;
  color: #092e58 !important;
  -webkit-text-fill-color: #092e58 !important;
  box-shadow: 3px 4px 0 #02070c !important;
}

/* ---------- NFT detail modal shell ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-backdrop {
  background: rgba(1,7,13,.88) !important;
  backdrop-filter: blur(12px) !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-detail-modal {
  border-color: #315f7b !important;
  background: #091622 !important;
  color: #f5f9fc !important;
  box-shadow:
    0 8px 0 #02060a,
    0 40px 110px rgba(0,0,0,.66) !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-art {
  border-right-color: #315f7b !important;
  background: #050f18 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-content {
  background:
    linear-gradient(
      145deg,
      #0d1d2b 0%,
      #091722 100%
    ) !important;
  color: #f5f9fc !important;
}

/* ---------- Modal heading / description ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-heading h2 {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-heading .rf-kicker {
  color: #9fdcf7 !important;
  -webkit-text-fill-color: #9fdcf7 !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-description {
  color: #b5cad8 !important;
  -webkit-text-fill-color: #b5cad8 !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-verified {
  border-color: #4f92b6 !important;
  background: #123049 !important;
  color: #a4e7ff !important;
  -webkit-text-fill-color: #a4e7ff !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-close {
  border-color: #5b98b8 !important;
  background: #15364e !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  box-shadow: 3px 4px 0 #02070c !important;
}

/* ---------- Rarity ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-rarity-metrics > div {
  border-color: #315f7b !important;
  background: #11283a !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-rarity-metrics small {
  color: #9db9c9 !important;
  -webkit-text-fill-color: #9db9c9 !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-rarity-metrics strong {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-rarity-note {
  color: #9fb9c8 !important;
  -webkit-text-fill-color: #9fb9c8 !important;
  opacity: 1 !important;
}

/* ---------- Modal section titles ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-section-title h3 {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-section-title > span {
  color: #75d7ff !important;
  -webkit-text-fill-color: #75d7ff !important;
  opacity: 1 !important;
}

/* ---------- Traits ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-trait-card {
  border-color: #315f7b !important;
  background: #102538 !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-trait-card small {
  color: #9eb9c9 !important;
  -webkit-text-fill-color: #9eb9c9 !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-trait-card strong {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-trait-rarity-row span {
  border-color: #345f79 !important;
  background: #17354b !important;
  color: #c6dce8 !important;
  -webkit-text-fill-color: #c6dce8 !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-trait-rarity-row b {
  color: #75d7ff !important;
  -webkit-text-fill-color: #75d7ff !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-detail-empty {
  border-color: #315f7b !important;
  background: #102538 !important;
  color: #b7cedc !important;
  -webkit-text-fill-color: #b7cedc !important;
}

/* ---------- On-chain details ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-address-list > div {
  border-color: #315f7b !important;
  background: #0f2334 !important;
  color: #f6f9fb !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-address-list span {
  color: #9eb9c9 !important;
  -webkit-text-fill-color: #9eb9c9 !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-address-list code {
  color: #f4f9fc !important;
  -webkit-text-fill-color: #f4f9fc !important;
  opacity: 1 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-address-list button {
  border-color: #4f8faf !important;
  background: #17374f !important;
  color: #9ce5ff !important;
  -webkit-text-fill-color: #9ce5ff !important;
  box-shadow: none !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-address-list button:hover:not(:disabled) {
  border-color: #75d7ff !important;
  background: #1d4663 !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

/* ---------- Modal actions ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-links a {
  border-color: #315f7b !important;
  background: #153149 !important;
  color: #dff5ff !important;
  -webkit-text-fill-color: #dff5ff !important;
  box-shadow: none !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-links a:nth-child(2) {
  background: #ffe55d !important;
  color: #092e58 !important;
  -webkit-text-fill-color: #092e58 !important;
}

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
.rf-parent-modal-links a:hover {
  border-color: #75d7ff !important;
}

/* ---------- Defensive visibility ---------- */

html[data-rf-app-theme="dark"]
.rf-site:not(.rf-compact)
:is(
  .rf-parent-detail-modal,
  .rf-parent-rarity-metrics,
  .rf-parent-trait-grid,
  .rf-parent-address-list,
  .rf-parent-nft-info,
  .rf-metrics
)
:is(
  h1,h2,h3,h4,
  p,small,span,strong,b,code
) {
  opacity: 1 !important;
}

/* Mobile modal art divider. */
@media (max-width: 900px) {
  html[data-rf-app-theme="dark"]
  .rf-site:not(.rf-compact)
  .rf-parent-modal-art {
    border-right: 0 !important;
    border-bottom: 2px solid #315f7b !important;
  }
}
CSS
fi

echo "PASS: final dark completion CSS present"

echo
echo "===== 4. PROVE PATCH IS APP-ONLY ====="

python3 - "$CSS" <<'PY'
from pathlib import Path
import sys

s = Path(sys.argv[1]).read_text(encoding="utf-8")

marker = "RESIST_FACTORY_APP_DARK_COMPLETION_V2"
a = s.rfind(marker)

if a < 0:
    raise SystemExit(
        "FAIL: dark completion V2 marker missing"
    )

block = s[a:]

if ".rf-widget-root" in block:
    raise SystemExit(
        "FAIL: V2 patch directly targets widget internals"
    )

if ".rf-launch-page" in block:
    raise SystemExit(
        "FAIL: V2 patch targets generated launch pages"
    )

if ".rf-site:not(.rf-compact)" not in block:
    raise SystemExit(
        "FAIL: V2 patch is not scoped away from compact widgets"
    )

if 'html[data-rf-app-theme="dark"]' not in block:
    raise SystemExit(
        "FAIL: V2 patch is not dark-mode scoped"
    )

required = [
    ".rf-metrics > div",
    ".rf-parent-nft-info",
    ".rf-parent-detail-modal",
    ".rf-parent-rarity-metrics > div",
    ".rf-parent-trait-card",
    ".rf-parent-address-list > div",
    ".rf-parent-modal-links a",
]

for value in required:
    if value not in block:
        raise SystemExit(
            f"FAIL: missing dark target {value}"
        )

print("PASS: V2 is dark-mode scoped")
print("PASS: V2 excludes compact iframe widgets")
print("PASS: V2 does not target widget-root")
print("PASS: V2 does not target launch pages")
print("PASS: project + NFT detail hard-coded surfaces covered")
PY

echo
echo "===== 5. VERIFY PROTECTED WIDGET INTERNALS BYTE-IDENTICAL ====="

python3 - "$APP" "$BACKUP/widget-protected.sha256" <<'PY'
from pathlib import Path
import hashlib
import sys

src = Path(sys.argv[1]).read_text(encoding="utf-8")

expected = dict(
    line.split(" ", 1)
    for line in Path(sys.argv[2]).read_text(
        encoding="utf-8"
    ).splitlines()
    if line.strip()
)

def template(name: str):
    needle = f"const {name}=`"
    a = src.find(needle)
    if a < 0:
        return None
    b = src.find("`;", a + len(needle))
    if b < 0:
        raise SystemExit(
            f"FAIL: unterminated protected template {name}"
        )
    return src[a:b+2]

for name, digest in expected.items():
    if name == "useWidgetCssBridge":
        a = src.find("function useWidgetCssBridge")
        b = src.find("function WidgetPreview", a)

        if a < 0 or b <= a:
            raise SystemExit(
                "FAIL: protected widget bridge disappeared"
            )

        value = src[a:b]
    else:
        value = template(name)

        if value is None:
            raise SystemExit(
                f"FAIL: protected widget template disappeared: {name}"
            )

    current = hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()

    if current != digest:
        raise SystemExit(
            f"FAIL: protected widget internals changed: {name}"
        )

    print(
        f"PASS: protected unchanged -> "
        f"{name} -> {current[:16]}"
    )

print("PASS: all protected widget internals byte-identical")
PY

echo
echo "===== 6. BUILD TESTNET ====="

cd "$ROOT"
./factory testnet build

echo "PASS: production build"

echo
echo "===== 7. VERIFY COMPILED CANDIDATE BEFORE LIVE START ====="

VERIFY="rf-dark-completion-v2-$STAMP"

docker rm -f "$VERIFY" >/dev/null 2>&1 || true
docker create \
  --name "$VERIFY" \
  "$FRONT_IMAGE" \
  >/dev/null

TMP="/tmp/$VERIFY"
rm -rf "$TMP"
mkdir -p "$TMP"

docker cp \
  "$VERIFY:/usr/share/nginx/html/." \
  "$TMP/"

docker rm -f "$VERIFY" >/dev/null

FOUND_CSS=0

for F in "$TMP"/assets/*.css; do
  [[ -f "$F" ]] || continue

  if grep -Fq \
       "RESIST_FACTORY_APP_DARK_COMPLETION_V2" \
       "$F" &&
     grep -Fq \
       "rf-parent-detail-modal" \
       "$F" &&
     grep -Fq \
       "rf-parent-nft-info" \
       "$F" &&
     grep -Fq \
       "rf-metrics" \
       "$F"
  then
    FOUND_CSS=1
    echo "PASS: compiled dark completion -> $(basename "$F")"
    break
  fi
done

[[ "$FOUND_CSS" = "1" ]] \
  || fail "compiled frontend missing dark completion V2"

grep -Fq \
  "RESIST_FACTORY_APP_THEME_PREPAINT_A_V1" \
  "$TMP/index.html" \
  || fail "compiled index lost theme prepaint"

echo "PASS: compiled candidate verified"

echo
echo "===== 8. START UPDATED FRONTEND ====="

./factory testnet up
DEPLOYED=1

echo
echo "===== 9. WAIT FOR PUBLIC HEALTH ====="

OK=0

for i in $(seq 1 30); do
  if curl -fsS \
    "$PUBLIC/api/health" \
    -o /tmp/rf-dark-completion-v2-health.json \
    2>/dev/null
  then
    echo "health attempt $i: HTTP 200"
    OK=1
    break
  fi

  echo "health attempt $i: waiting..."
  sleep 2
done

[[ "$OK" = "1" ]] \
  || fail "public API did not become healthy"

python3 -m json.tool \
  /tmp/rf-dark-completion-v2-health.json

echo
echo "===== 10. VERIFY PUBLIC ROUTES ====="

for URL in \
  "$PUBLIC/" \
  "$PUBLIC/projects" \
  "$PUBLIC/my-collections" \
  "$PUBLIC/widgets"
do
  CODE="$(
    curl -sS \
      -o /dev/null \
      -w '%{http_code}' \
      "$URL"
  )"

  [[ "$CODE" = "200" ]] \
    || fail "$URL returned HTTP $CODE"

  echo "PASS: HTTP 200 -> $URL"
done

echo
echo "===== 11. VERIFY PUBLIC CSS REALLY CONTAINS V2 ====="

curl -fsS \
  "$PUBLIC/?dark-completion-v2=$STAMP" \
  -o /tmp/rf-dark-completion-v2-index.html

PUBLIC_CSS="$(
  grep -oE 'href="/assets/[^"]+\.css"' \
    /tmp/rf-dark-completion-v2-index.html \
    | head -1 \
    | cut -d'"' -f2
)"

[[ -n "$PUBLIC_CSS" ]] \
  || fail "could not discover public CSS asset"

curl -fsS \
  "$PUBLIC$PUBLIC_CSS" \
  -o /tmp/rf-dark-completion-v2-public.css

grep -Fq \
  "RESIST_FACTORY_APP_DARK_COMPLETION_V2" \
  /tmp/rf-dark-completion-v2-public.css \
  || fail "public CSS missing V2 marker"

grep -Fq \
  "rf-parent-detail-modal" \
  /tmp/rf-dark-completion-v2-public.css \
  || fail "public CSS missing NFT modal rules"

grep -Fq \
  "rf-metrics" \
  /tmp/rf-dark-completion-v2-public.css \
  || fail "public CSS missing project metric rules"

echo "PASS: public CSS contains V2"
echo "PASS: public CSS contains NFT modal dark rules"
echo "PASS: public CSS contains project metric dark rules"

echo
echo "============================================================"
echo " PASS: FACTORY APP DARK COMPLETION V2 IS LIVE"
echo "============================================================"
echo
echo "DARK mode now expects:"
echo "  - project page cards are dark"
echo "  - PRICE / SUPPLY / STATE boxes are dark"
echo "  - NFT card information panels are dark"
echo "  - NFT detail modal right side is dark"
echo "  - rarity boxes are dark"
echo "  - trait cards are dark"
echo "  - on-chain rows are dark"
echo "  - headings / traits / addresses are readable"
echo "  - yellow buttons use navy text"
echo
echo "LIGHT mode remains unchanged."
echo "Compact iframe widget themes remain independent."
echo "Protected widget internals remain byte-identical."
echo "No TON transaction was sent."
