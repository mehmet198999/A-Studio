#!/bin/bash
# ============================================================
#  Domain Warming – Auto-Update Cron einrichten
#  Einmalig ausführen: bash /opt/domain-warming/deploy/setup-autoupdate.sh
# ============================================================

INSTALL_DIR="/opt/domain-warming"
UPDATE_SCRIPT="$INSTALL_DIR/deploy/update.sh"
CRON_JOB="*/5 * * * * bash $UPDATE_SCRIPT >> /var/log/domain-warming-update.log 2>&1"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
err()  { echo -e "${RED}[FEHLER]${NC} $1"; exit 1; }

[ "$EUID" -ne 0 ] && err "Bitte als root ausführen"

# update.sh ausführbar machen
chmod +x "$UPDATE_SCRIPT"
ok "update.sh ist ausführbar"

# Prüfen ob Cron schon existiert
if crontab -l 2>/dev/null | grep -q "domain-warming-update"; then
    ok "Auto-Update Cron läuft bereits."
else
    # Cron hinzufügen
    ( crontab -l 2>/dev/null; echo "$CRON_JOB" ) | crontab -
    ok "Cron Job eingerichtet: alle 5 Minuten wird auf Updates geprüft"
fi

echo ""
info "Aktueller Crontab:"
crontab -l

echo ""
echo -e "${GREEN}Fertig! Das System prüft nun alle 5 Minuten ob es neue Commits gibt.${NC}"
echo ""
echo "  Manuelles Update:    bash $UPDATE_SCRIPT"
echo "  Logs anzeigen:       tail -f /var/log/domain-warming-update.log"
echo "  Cron deaktivieren:   crontab -e  (die Zeile löschen)"
