#!/bin/bash
# ============================================================
#  Domain Warming – Manuelles Update Script
#  Aufruf: bash /opt/domain-warming/deploy/update.sh
# ============================================================

INSTALL_DIR="/opt/domain-warming"
LOG_FILE="/var/log/domain-warming-update.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1" | tee -a "$LOG_FILE"; }
info() { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[FEHLER]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }

echo "" | tee -a "$LOG_FILE"
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}║     Domain Warming – Update               ║${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC}" | tee -a "$LOG_FILE"
echo ""

[ "$EUID" -ne 0 ] && err "Bitte als root ausführen"
[ ! -d "$INSTALL_DIR/.git" ] && err "Repo nicht gefunden: $INSTALL_DIR"

cd "$INSTALL_DIR"

# Aktuellen Stand holen
info "Prüfe auf neue Commits..."
git fetch origin main 2>&1 | tee -a "$LOG_FILE"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    ok "Bereits aktuell – kein Update nötig."
    exit 0
fi

info "Neuer Commit gefunden: $(git log --oneline HEAD..origin/main | head -5)"

# Pull
info "Lade neue Version..."
git pull origin main 2>&1 | tee -a "$LOG_FILE" || err "git pull fehlgeschlagen"

# Rebuild & Neustart
info "Baue Docker Container neu..."
docker compose --env-file "$INSTALL_DIR/.env" up -d --build 2>&1 | tee -a "$LOG_FILE" || err "Docker build fehlgeschlagen"

ok "Update abgeschlossen!"
echo ""
docker compose ps
