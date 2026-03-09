#!/bin/bash
# Domain Warming – Update Script (zieht direkt von GitHub)
set -e

GITHUB_BRANCH="claude/automate-domain-warming-7zLJg"
APP_DIR="/opt/domain-warming"

echo ">>> Stoppe Services..."
systemctl stop warming-backend warming-worker warming-scheduler warming-frontend

echo ">>> Pull von GitHub (Branch: ${GITHUB_BRANCH})..."
git -C "$APP_DIR" fetch origin
git -C "$APP_DIR" checkout "$GITHUB_BRANCH"
git -C "$APP_DIR" pull origin "$GITHUB_BRANCH"

echo ">>> Installiere neue Abhängigkeiten..."
cd "$APP_DIR/backend"
venv/bin/pip install -q -r requirements.txt

echo ">>> Baue Frontend..."
cd "$APP_DIR/frontend"
npm install -q
npm run build

echo ">>> Starte Services..."
systemctl start warming-backend warming-worker warming-scheduler warming-frontend

echo ""
echo ">>> Update fertig!"
systemctl status warming-backend --no-pager | head -5
