#!/usr/bin/env bash
# Serve the Vercel deployment at https://lekhak.piramalfinance.com on THIS machine.
#
# We don't own the piramalfinance.com DNS, so this maps the hostname in /etc/hosts to 127.0.0.1 and runs a local
# Caddy reverse proxy with a locally-trusted (mkcert) certificate that forwards to the real Vercel URL.
# Phones on the venue Wi-Fi can't resolve this name — give them the Vercel URL / QR codes instead.
#
# Usage:  sudo scripts/local-domain.sh [vercel-host]      (default: lekhak-piramal.vercel.app)
#         sudo scripts/local-domain.sh --remove
set -euo pipefail
HOST="lekhak.piramalfinance.com"
TARGET="${1:-lekhak-piramal.vercel.app}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/.local-domain"
if [[ "${1:-}" == "--remove" ]]; then
  sed -i '' "/[[:space:]]$HOST\$/d" /etc/hosts; pkill -f "caddy run --config $DIR/Caddyfile" || true
  echo "Removed $HOST from /etc/hosts and stopped the proxy."; exit 0
fi
if [[ $EUID -ne 0 ]]; then echo "Run with sudo (needs /etc/hosts and port 443)."; exit 1; fi
command -v caddy >/dev/null || { echo "Install caddy first: brew install caddy"; exit 1; }
command -v mkcert >/dev/null || { echo "Install mkcert first: brew install mkcert"; exit 1; }
REAL_USER="${SUDO_USER:-$USER}"
mkdir -p "$DIR"
# 1. hosts entry
grep -q "[[:space:]]$HOST\$" /etc/hosts || echo "127.0.0.1 $HOST" >> /etc/hosts
# 2. locally trusted certificate (install the local CA into the system/browser trust store once)
sudo -u "$REAL_USER" mkcert -install >/dev/null 2>&1 || mkcert -install
( cd "$DIR" && sudo -u "$REAL_USER" mkcert -cert-file cert.pem -key-file key.pem "$HOST" >/dev/null 2>&1 || mkcert -cert-file cert.pem -key-file key.pem "$HOST" )
# 3. Caddy reverse proxy → Vercel, rewriting the Host header so Vercel routes to the right project
cat > "$DIR/Caddyfile" <<CADDY
{
  admin off
}
https://$HOST {
  tls $DIR/cert.pem $DIR/key.pem
  reverse_proxy https://$TARGET {
    header_up Host $TARGET
    header_up X-Forwarded-Host $HOST
    transport http {
      tls_server_name $TARGET
    }
  }
}
http://$HOST {
  redir https://$HOST{uri}
}
CADDY
pkill -f "caddy run --config $DIR/Caddyfile" || true
nohup caddy run --config "$DIR/Caddyfile" > "$DIR/caddy.log" 2>&1 &
sleep 1
echo "✓ https://$HOST now serves https://$TARGET on this machine (proxy log: $DIR/caddy.log)."
echo "  Admin console: https://$HOST/admin   ·   Entrance screen: https://$HOST/entrance"
echo "  To undo: sudo $0 --remove"
