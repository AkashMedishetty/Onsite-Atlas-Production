#!/usr/bin/env bash
# deploy_fix.sh – one-shot script to finish Onsite-Atlas VPS setup
# Adjust these 3 variables only if you change versions/ports later.
RELEASE="/opt/onsite-atlas/releases/2025-06-17/ONSITE ATLAS"
REACT_ROOT="/var/www/atlas_2025-06-17"
BACKEND_PORT=5001

set -e

echo "=== 1) TLS certificate ====================================="
CRT="/etc/ssl/certs/atlas-self.crt"
KEY="/etc/ssl/private/atlas-self.key"
if [[ ! -f "$CRT" || ! -f "$KEY" ]]; then
  echo "Generating self-signed cert ..."
  openssl req -x509 -nodes -days 365 \
          -newkey rsa:2048 \
          -keyout "$KEY" \
          -out   "$CRT" \
          -subj "/CN=$(curl -s ifconfig.me || echo 103.194.228.106)"
else
  echo "Self-signed cert already exists → skipping"
fi

echo "=== 2) Uploads symlink ====================================="
UPLOAD_SRC="$RELEASE/server/public/uploads"
UPLOAD_DST="/var/www/atlas-uploads"
mkdir -p /var/www
if [[ -L "$UPLOAD_DST" || -d "$UPLOAD_DST" ]]; then
  echo "Symlink/dir $UPLOAD_DST already present"
else
  ln -s "$UPLOAD_SRC" "$UPLOAD_DST"
  echo "Symlink created: $UPLOAD_DST → $UPLOAD_SRC"
fi

echo "=== 3) Write Nginx site file ==============================="
SITE=/etc/nginx/sites-available/atlas
cat > "$SITE" <<EOF
# ---------- HTTP → HTTPS redirect ----------
server {
    listen 80;
    server_name $(curl -s ifconfig.me || echo 103.194.228.106);
    client_max_body_size 50M;
    return 301 https://\$host\$request_uri;
}

# ---------- Main HTTPS site ----------
upstream atlas_backend {
    server 127.0.0.1:${BACKEND_PORT};
}

server {
    listen 443 ssl;
    server_name $(curl -s ifconfig.me || echo 103.194.228.106);

    ssl_certificate     ${CRT};
    ssl_certificate_key ${KEY};

    client_max_body_size 50M;

    root ${REACT_ROOT};
    index index.html;

    location /api/ {
        proxy_pass http://atlas_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://atlas_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    location / {
        try_files \$uri /index.html;
    }

    location /uploads/      { alias /var/www/atlas-uploads/;  autoindex off; }
    location /api/uploads/  { alias /var/www/atlas-uploads/;  autoindex off; }
}
EOF

echo "=== 4) Enable site & reload Nginx =========================="
ln -sf "$SITE" /etc/nginx/sites-enabled/atlas
nginx -t
systemctl reload nginx
echo "Nginx reloaded OK"

echo "=== 5) Ensure Express trusts proxy ========================="
APP_JS="$RELEASE/server/src/app.js"
if ! grep -q "app.set('trust proxy'" "$APP_JS"; then
  sed -i "0,/const app = express();/s//const app = express();\napp.set('trust proxy', true);/" "$APP_JS"
  echo "Inserted app.set('trust proxy', true); into app.js"
  pm2 restart atlas-backend-2025-06-17 || true
else
  echo "trust proxy already set – skipping PM2 restart"
fi

echo "=== ALL DONE ==============================================="
echo "Visit:  https://$(curl -s ifconfig.me || echo 103.194.228.106)"
echo "If browser warns about cert, click 'Advanced → Continue'."
