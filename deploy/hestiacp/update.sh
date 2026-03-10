#!/bin/bash
# Domain Warming – Update Script (zieht direkt von GitHub)
set -e

APP_DIR="/opt/domain-warming"

# Optional override: GITHUB_BRANCH=main sudo ./update.sh
GITHUB_BRANCH="${GITHUB_BRANCH:-}"
if [ -z "$GITHUB_BRANCH" ]; then
  GITHUB_BRANCH=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
fi
if [ -z "$GITHUB_BRANCH" ] || [ "$GITHUB_BRANCH" = "HEAD" ]; then
  GITHUB_BRANCH=$(git -C "$APP_DIR" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
fi
if [ -z "$GITHUB_BRANCH" ]; then
  GITHUB_BRANCH="main"
fi

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
