#!/bin/bash
# ============================================================
#  Domain Warming – Installations-Script
#  Unterstützt: Ubuntu 20/22/24, Debian 11/12,
#               CentOS 8/9, AlmaLinux, Rocky Linux
#  Aufruf: bash install-vps.sh
# ============================================================
set -e

# ── Farben ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[FEHLER]${NC} $1"; exit 1; }

# ── Banner ────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Domain Warming – VPS Installer        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ── Root prüfen ───────────────────────────────────────────────
[ "$EUID" -ne 0 ] && err "Bitte als root ausführen: sudo bash install-vps.sh"

# ── Distro erkennen ───────────────────────────────────────────
. /etc/os-release
DISTRO_ID="${ID}"
DISTRO_LIKE="${ID_LIKE:-}"

if [[ "$DISTRO_ID" == "ubuntu" || "$DISTRO_ID" == "debian" || "$DISTRO_LIKE" == *"debian"* ]]; then
    PKG_MANAGER="apt"
elif [[ "$DISTRO_ID" == "centos" || "$DISTRO_ID" == "rhel" || \
        "$DISTRO_ID" == "almalinux" || "$DISTRO_ID" == "rocky" || \
        "$DISTRO_LIKE" == *"rhel"* || "$DISTRO_LIKE" == *"fedora"* ]]; then
    PKG_MANAGER="dnf"
    command -v dnf &>/dev/null || PKG_MANAGER="yum"
else
    err "Nicht unterstützte Distribution: ${DISTRO_ID}. Unterstützt: Ubuntu, Debian, CentOS, AlmaLinux, Rocky."
fi

ok "Distribution erkannt: ${PRETTY_NAME} → Paketmanager: ${PKG_MANAGER}"

# ── Server-IP ermitteln ───────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
info "Erkannte Server-IP: ${SERVER_IP}"

# ── Konfiguration ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}══ Konfiguration ══════════════════════════════${NC}"

read -rp "Admin-Passwort für Dashboard [Standard: admin123]: " ADMIN_PW
ADMIN_PW=${ADMIN_PW:-admin123}

read -rp "GitHub-Repo URL [Standard: https://github.com/mehmet198999/A-Studio.git]: " REPO_URL
REPO_URL=${REPO_URL:-https://github.com/mehmet198999/A-Studio.git}

INSTALL_DIR="/opt/domain-warming"
AUTH_TOKEN=$(cat /proc/sys/kernel/random/uuid | tr -d '-')

echo ""
info "Installations-Verzeichnis: ${INSTALL_DIR}"
info "Frontend läuft später auf: http://${SERVER_IP}:3000"
info "Backend API läuft später auf: http://${SERVER_IP}:8000"
echo ""

# ── System aktualisieren ──────────────────────────────────────
info "System wird aktualisiert..."
if [ "$PKG_MANAGER" = "apt" ]; then
    apt-get update -qq
    apt-get upgrade -y -qq
else
    $PKG_MANAGER update -y -q
fi
ok "System aktualisiert"

# ── Basis-Pakete installieren ─────────────────────────────────
info "Basis-Pakete werden installiert..."
if [ "$PKG_MANAGER" = "apt" ]; then
    apt-get install -y -qq curl git ufw ca-certificates gnupg lsb-release
else
    $PKG_MANAGER install -y -q curl git ca-certificates gnupg
    # firewalld statt ufw auf RHEL-basierten Systemen
    $PKG_MANAGER install -y -q firewalld 2>/dev/null || true
fi
ok "Basis-Pakete installiert"

# ── Docker installieren ───────────────────────────────────────
if command -v docker &>/dev/null; then
    ok "Docker bereits installiert ($(docker --version | cut -d' ' -f3 | tr -d ','))"
else
    info "Docker wird installiert..."
    if [ "$PKG_MANAGER" = "apt" ]; then
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/${DISTRO_ID}/gpg | \
            gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo \
            "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
            https://download.docker.com/linux/${DISTRO_ID} \
            $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
            tee /etc/apt/sources.list.d/docker.list > /dev/null
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
        # CentOS / AlmaLinux / Rocky
        $PKG_MANAGER install -y -q yum-utils 2>/dev/null || true
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null || \
            $PKG_MANAGER config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        $PKG_MANAGER install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
    systemctl enable docker
    systemctl start docker
    ok "Docker installiert"
fi

# Docker Compose Alias
if ! command -v docker-compose &>/dev/null; then
    ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose 2>/dev/null || \
    ln -sf /usr/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose 2>/dev/null || true
fi

# ── Repo klonen / aktualisieren ───────────────────────────────
if [ -d "${INSTALL_DIR}/.git" ]; then
    info "Repo existiert bereits – wird aktualisiert..."
    git -C "${INSTALL_DIR}" pull origin main 2>/dev/null || git -C "${INSTALL_DIR}" pull origin master
    ok "Repo aktualisiert"
else
    info "Repo wird geklont..."
    git clone "${REPO_URL}" "${INSTALL_DIR}"
    ok "Repo geklont nach ${INSTALL_DIR}"
fi

cd "${INSTALL_DIR}"

# ── .env Datei erstellen ──────────────────────────────────────
info ".env Datei wird erstellt..."
cat > "${INSTALL_DIR}/.env" <<EOF
# Domain Warming – Konfiguration
# Generiert von install-vps.sh

ADMIN_PASSWORD=${ADMIN_PW}
AUTH_TOKEN=${AUTH_TOKEN}

DATABASE_URL=postgresql+psycopg2://postgres:postgres@postgres/warming
REDIS_URL=redis://redis:6379/0
EOF
ok ".env erstellt"

# ── docker-compose.yml anpassen (Server-IP für Frontend) ──────
info "docker-compose.yml wird für IP ${SERVER_IP} angepasst..."
sed -i "s|NEXT_PUBLIC_API_URL=http://localhost:8000|NEXT_PUBLIC_API_URL=http://${SERVER_IP}:8000|g" \
    "${INSTALL_DIR}/docker-compose.yml"
ok "docker-compose.yml angepasst"

# ── Firewall konfigurieren ────────────────────────────────────
info "Firewall wird konfiguriert..."
if command -v ufw &>/dev/null; then
    ufw allow 22/tcp  comment 'SSH'          > /dev/null
    ufw allow 3000/tcp comment 'Frontend'    > /dev/null
    ufw allow 8000/tcp comment 'Backend API' > /dev/null
    echo "y" | ufw enable > /dev/null 2>&1 || true
    ok "ufw: Port 22, 3000, 8000 freigegeben"
elif command -v firewall-cmd &>/dev/null; then
    systemctl enable --now firewalld 2>/dev/null || true
    firewall-cmd --permanent --add-port=22/tcp   > /dev/null
    firewall-cmd --permanent --add-port=3000/tcp > /dev/null
    firewall-cmd --permanent --add-port=8000/tcp > /dev/null
    firewall-cmd --reload > /dev/null
    ok "firewalld: Port 22, 3000, 8000 freigegeben"
else
    warn "Kein Firewall-Tool gefunden – Ports bitte manuell freigeben (22, 3000, 8000)"
fi

# ── Docker Container bauen & starten ─────────────────────────
info "Container werden gebaut... (kann einige Minuten dauern)"
docker compose -f "${INSTALL_DIR}/docker-compose.yml" \
    --env-file "${INSTALL_DIR}/.env" \
    up -d --build
ok "Container gestartet"

# ── Warten bis Backend gesund ─────────────────────────────────
info "Warte auf Backend..."
MAX_WAIT=60
COUNT=0
until curl -sf "http://localhost:8000/health" > /dev/null 2>&1; do
    sleep 2
    COUNT=$((COUNT + 2))
    if [ $COUNT -ge $MAX_WAIT ]; then
        warn "Backend antwortet nach ${MAX_WAIT}s noch nicht – trotzdem fortfahren"
        break
    fi
done
[ $COUNT -lt $MAX_WAIT ] && ok "Backend läuft"

# ── Status anzeigen ───────────────────────────────────────────
echo ""
docker compose -f "${INSTALL_DIR}/docker-compose.yml" ps
echo ""

# ── Zusammenfassung ───────────────────────────────────────────
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Installation erfolgreich!                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Dashboard:    ${BLUE}http://${SERVER_IP}:3000${NC}"
echo -e "  API:          ${BLUE}http://${SERVER_IP}:8000/docs${NC}"
echo ""
echo -e "  Login:"
echo -e "    Benutzername: ${YELLOW}admin${NC}"
echo -e "    Passwort:     ${YELLOW}${ADMIN_PW}${NC}"
echo ""
echo -e "  Nützliche Befehle:"
echo -e "    Logs anzeigen:    ${YELLOW}docker compose -C ${INSTALL_DIR} logs -f${NC}"
echo -e "    Stoppen:          ${YELLOW}docker compose -C ${INSTALL_DIR} down${NC}"
echo -e "    Neustarten:       ${YELLOW}docker compose -C ${INSTALL_DIR} restart${NC}"
echo -e "    Update + Rebuild: ${YELLOW}cd ${INSTALL_DIR} && git pull && docker compose up -d --build${NC}"
echo ""
