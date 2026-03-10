#!/bin/bash
# ============================================================
# Domain Warming – HestiaCP / VPS Install Script
# Direkter GitHub-Clone – kein manuelles Kopieren nötig!
#
# Einmaliger Befehl auf dem VPS:
#   curl -fsSL https://raw.githubusercontent.com/mehmet198999/A-Studio/claude/automate-domain-warming-7zLJg/deploy/hestiacp/install.sh | sudo bash
#
# Getestet auf: Ubuntu 20.04 / 22.04 mit HestiaCP
# ============================================================
set -e

GITHUB_REPO="https://github.com/mehmet198999/A-Studio.git"
GITHUB_BRANCH="claude/automate-domain-warming-7zLJg"
APP_DIR="/opt/domain-warming"

echo "=============================="
echo " Domain Warming Installer"
echo " Quelle: GitHub"
echo "=============================="

# ── Konfiguration abfragen ─────────────────────────────────
read -p "Domain (z.B. warming.meinedomain.de): " DOMAIN
read -sp "Admin-Passwort fürs Dashboard: " ADMIN_PASS; echo
read -p "SSL-E-Mail (für Let's Encrypt): " SSL_EMAIL
echo ""

AUTH_TOKEN=$(openssl rand -hex 24)
DB_PASS=$(openssl rand -hex 16)

# ── System-Pakete ───────────────────────────────────────────
echo ">>> Installiere System-Pakete..."
apt-get update -q
apt-get install -y -q \
  git curl \
  python3.11 python3.11-venv python3-pip \
  nodejs npm \
  redis-server postgresql \
  nginx certbot python3-certbot-nginx

# ── Code von GitHub laden ───────────────────────────────────
echo ">>> Lade Code von GitHub (Branch: ${GITHUB_BRANCH})..."
if [ -d "$APP_DIR/.git" ]; then
  echo "    Repo existiert bereits – aktualisiere..."
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$GITHUB_BRANCH"
  git -C "$APP_DIR" pull origin "$GITHUB_BRANCH"
else
  git clone --branch "$GITHUB_BRANCH" --depth 1 "$GITHUB_REPO" "$APP_DIR"
fi
echo "    Code geladen: $APP_DIR"

# ── PostgreSQL ─────────────────────────────────────────────
echo ">>> Konfiguriere PostgreSQL..."
sudo -u postgres psql -c "CREATE USER warming WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE warming OWNER warming;" 2>/dev/null || true

# ── Backend / Python venv ──────────────────────────────────
echo ">>> Installiere Python-Abhängigkeiten..."
cd "$APP_DIR/backend"
python3.11 -m venv venv
venv/bin/pip install -q --upgrade pip
venv/bin/pip install -q -r requirements.txt

# ── .env schreiben ─────────────────────────────────────────
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cat > "$APP_DIR/backend/.env" << ENV
DATABASE_URL=postgresql+psycopg2://warming:${DB_PASS}@localhost/warming
REDIS_URL=redis://localhost:6379/0
AUTH_TOKEN=${AUTH_TOKEN}
ADMIN_PASSWORD=${ADMIN_PASS}
# Outlook OAuth2 – Azure AD App Client ID eintragen:
# OUTLOOK_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENV
  echo "    .env erstellt"
else
  echo "    .env bereits vorhanden – wird nicht überschrieben"
fi

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
After=network.target warming-backend.service

[Service]
User=www-data
WorkingDirectory=${APP_DIR}/frontend
Environment=NODE_ENV=production
ExecStart=$(which npm) start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable warming-backend warming-worker warming-scheduler warming-frontend
systemctl start redis-server postgresql
systemctl start warming-backend warming-worker warming-scheduler warming-frontend

# ── Nginx Config ───────────────────────────────────────────
echo ">>> Konfiguriere Nginx..."
cat > "/etc/nginx/sites-available/warming" << NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    # Backend API
    location /api/ {
        rewrite ^/api/(.*) /\$1 break;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }

    # Frontend
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
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── SSL ────────────────────────────────────────────────────
echo ">>> Installiere SSL-Zertifikat..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" || \
  echo "WARNUNG: Certbot fehlgeschlagen – SSL manuell einrichten"

# ── Fertig ─────────────────────────────────────────────────
echo ""
echo "=============================="
echo " Installation abgeschlossen!"
echo "=============================="
echo ""
echo "  Dashboard: https://${DOMAIN}"
echo "  Login:     admin / ${ADMIN_PASS}"
echo ""
echo "  .env Datei:  ${APP_DIR}/backend/.env"
echo "  Auth-Token:  ${AUTH_TOKEN}"
echo ""
echo "  Services:"
echo "    systemctl status warming-backend"
echo "    journalctl -u warming-backend -f"
echo ""
echo "  Outlook OAuth2 aktivieren:"
echo "    nano ${APP_DIR}/backend/.env"
echo "    → OUTLOOK_CLIENT_ID eintragen"
echo "    systemctl restart warming-backend"
echo ""
echo "  Updates:"
echo "    sudo ${APP_DIR}/deploy/hestiacp/update.sh"
