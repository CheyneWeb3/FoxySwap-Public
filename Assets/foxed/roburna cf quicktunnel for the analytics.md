Yep. Use a temporary Cloudflare quick tunnel against **only the secured frontend on `127.0.0.1:51921`**.

Open a new WSL terminal and run:

```bash
cd ~/roburna-dex-analytics
set -e

echo "============================================================"
echo " KONGSWAP ANALYTICS — QUICK PUBLIC TUNNEL"
echo "============================================================"

echo
echo "===== LOCAL CHECK ====="

curl -fsS \
  http://127.0.0.1:51921/data/manifest.json \
  | python3 -m json.tool

echo
echo "===== START QUICK TUNNEL ====="

cloudflared tunnel \
  --no-autoupdate \
  --url http://127.0.0.1:51921
```

Cloudflare should print a temporary URL like:

```text
https://something-random.trycloudflare.com
```

Then test:

```text
https://something-random.trycloudflare.com/info
```

and:

```text
https://something-random.trycloudflare.com/data/manifest.json
```

Also deliberately test the blocked API:

```text
https://something-random.trycloudflare.com/api/v1/analytics/overview
```

That should return **404**.

The public path will therefore be:

```text
Internet
   ↓
trycloudflare.com
   ↓
127.0.0.1:51921
   ↓
KongSwap nginx
   ├── /info
   ├── /data/*.json
   └── /api/* → 404
```

Leave that terminal running while we test the site. Paste the `trycloudflare.com` URL it gives you and we'll check the public frontend next.
