#!/bin/bash
# ============================================================
# Domain Warming – HestiaCP / VPS Install Script
# Kein Docker nötig. Direkt auf dem Server laufen lassen.
# Getestet auf: Ubuntu 20.04 / 22.04 mit HestiaCP
# ============================================================
set -e

APP_DIR="/opt/domain-warming"
DOMAIN=""           # z.B. warming.meinedomain.de
ADMIN_PASS=""       # Admin-Passwort fürs Dashboard

echo "=============================="
echo " Domain Warming Installer"
echo "=============================="

# ── Konfiguration abfragen ─────────────────────────────────
if [ -z "$DOMAIN" ]; then
  read -p "Domain (z.B. warming.meinedomain.de): " DOMAIN
fi
if [ -z "$ADMIN_PASS" ]; then
  read -sp "Admin-Passwort fürs Dashboard: " ADMIN_PASS
  echo
fi

AUTH_TOKEN=$(openssl rand -hex 24)
DB_PASS=$(openssl rand -hex 16)

echo ""
echo ">>> Installiere System-Pakete..."
apt-get update -q
apt-get install -y python3.11 python3.11-venv python3-pip nodejs npm redis-server postgresql nginx

# ── PostgreSQL ─────────────────────────────────────────────
echo ">>> Konfiguriere PostgreSQL..."
sudo -u postgres psql -c "CREATE USER warming WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE warming OWNER warming;" 2>/dev/null || true

# ── App-Verzeichnis ────────────────────────────────────────
echo ">>> Kopiere App..."
mkdir -p "$APP_DIR"
cp -r "$(dirname "$0")/../../"* "$APP_DIR/" 2>/dev/null || true

# ── Backend / Python venv ──────────────────────────────────
echo ">>> Installiere Python-Abhängigkeiten..."
cd "$APP_DIR/backend"
python3.11 -m venv venv
venv/bin/pip install -q --upgrade pip
venv/bin/pip install -q -r requirements.txt

# ── .env schreiben ─────────────────────────────────────────
cat > "$APP_DIR/backend/.env" << ENV
DATABASE_URL=postgresql+psycopg2://warming:${DB_PASS}@localhost/warming
REDIS_URL=redis://localhost:6379/0
AUTH_TOKEN=${AUTH_TOKEN}
ADMIN_PASSWORD=${ADMIN_PASS}
# Outlook OAuth2 (optional – Azure AD App Client ID eintragen):
# OUTLOOK_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENV

# ── Frontend / Next.js Build ───────────────────────────────
echo ">>> Baue Frontend..."
cd "$APP_DIR/frontend"
cat > .env.local << FENV
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
FENV
npm install -q
npm run build

# ── Systemd Services ───────────────────────────────────────
echo ">>> Erstelle Systemd Services..."

cat > /etc/systemd/system/warming-backend.service << SVC
[Unit]
Description=Domain Warming Backend (FastAPI)
After=network.target postgresql.service redis.service

[Service]
User=www-data
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

cat > /etc/systemd/system/warming-worker.service << SVC
[Unit]
Description=Domain Warming RQ Worker
After=network.target redis.service warming-backend.service

[Service]
User=www-data
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/backend/venv/bin/python -m app.worker
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

cat > /etc/systemd/system/warming-scheduler.service << SVC
[Unit]
Description=Domain Warming Daily Scheduler
After=network.target redis.service

[Service]
User=www-data
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/backend/venv/bin/python -m app.scheduler
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SVC

cat > /etc/systemd/system/warming-frontend.service << SVC
[Unit]
Description=Domain Warming Frontend (Next.js)
After=network.target

[Service]
User=www-data
WorkingDirectory=${APP_DIR}/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Port=3000

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable warming-backend warming-worker warming-scheduler warming-frontend
systemctl start warming-backend warming-worker warming-scheduler warming-frontend

# ── Nginx Config ───────────────────────────────────────────
echo ">>> Konfiguriere Nginx..."
cat > "/etc/nginx/sites-available/warming" << NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    # Redirect HTTP → HTTPS (Certbot ergänzt dies automatisch)
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    # SSL wird von Certbot automatisch eingetragen
    # ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    # Backend API (FastAPI)
    location /api/ {
        rewrite ^/api/(.*) /\$1 break;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }

    # Frontend (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/warming /etc/nginx/sites-enabled/warming
nginx -t && systemctl reload nginx

# ── SSL mit Certbot ────────────────────────────────────────
echo ">>> Installiere SSL-Zertifikat..."
apt-get install -y certbot python3-certbot-nginx -q
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" || \
  echo "WARNUNG: Certbot fehlgeschlagen – SSL manuell einrichten"

# ── Fertig ─────────────────────────────────────────────────
echo ""
echo "=============================="
echo " Installation abgeschlossen!"
echo "=============================="
echo ""
echo "  Dashboard: https://${DOMAIN}"
echo "  Login:     admin / ${ADMIN_PASS}"
echo "  API:       https://${DOMAIN}/api"
echo ""
echo "  Auth-Token (für .env):  ${AUTH_TOKEN}"
echo ""
echo "  Services prüfen:"
echo "    systemctl status warming-backend"
echo "    systemctl status warming-worker"
echo "    systemctl status warming-scheduler"
echo ""
echo "  Logs:"
echo "    journalctl -u warming-backend -f"
echo ""
echo "  Outlook OAuth2 aktivieren:"
echo "    1. Azure Portal → App registrieren (kostenlos)"
echo "    2. Client ID in ${APP_DIR}/backend/.env eintragen"
echo "    3. systemctl restart warming-backend"
