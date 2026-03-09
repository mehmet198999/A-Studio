#!/bin/bash
# Domain Warming – Update Script (kein Docker)
set -e

APP_DIR="/opt/domain-warming"
echo ">>> Stoppe Services..."
systemctl stop warming-backend warming-worker warming-scheduler warming-frontend

echo ">>> Aktualisiere Code..."
cp -r "$(dirname "$0")/../../"* "$APP_DIR/"

echo ">>> Installiere neue Abhängigkeiten..."
cd "$APP_DIR/backend"
venv/bin/pip install -q -r requirements.txt

echo ">>> Baue Frontend..."
cd "$APP_DIR/frontend"
npm install -q
npm run build

echo ">>> Starte Services..."
systemctl start warming-backend warming-worker warming-scheduler warming-frontend

echo ">>> Update fertig!"
systemctl status warming-backend --no-pager | head -5
