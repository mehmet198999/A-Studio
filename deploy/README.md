# Deployment Guide

## Option A: Docker (einfachste Methode)

```bash
cp .env.example .env
# .env anpassen (Passwörter, OUTLOOK_CLIENT_ID etc.)
docker compose up -d --build
```

Dashboard: http://localhost:3000

---

## Option B: HestiaCP / VPS ohne Docker (direkt von GitHub)

### Voraussetzungen
- Ubuntu 20.04/22.04
- Root-Zugriff per SSH
- Domain auf den Server zeigend (DNS A-Record gesetzt)

### Ein-Befehl-Installation (direkt von GitHub)

```bash
curl -fsSL https://raw.githubusercontent.com/mehmet198999/A-Studio/claude/automate-domain-warming-7zLJg/deploy/hestiacp/install.sh | sudo bash
```

Das Skript fragt nur 3 Dinge:
- **Domain** (z.B. `warming.meinedomain.de`)
- **Admin-Passwort** fürs Dashboard
- **E-Mail** für SSL-Zertifikat

Danach läuft alles automatisch:
- Code von GitHub laden (`git clone`)
- Python 3.11 + venv, Node.js, Redis, PostgreSQL, Nginx installieren
- SSL-Zertifikat via Let's Encrypt / Certbot
- 4 systemd-Services (Backend, Worker, Scheduler, Frontend)

### Services manuell steuern
```bash
# Status
systemctl status warming-backend warming-worker warming-scheduler warming-frontend

# Logs live
journalctl -u warming-backend -f
journalctl -u warming-worker -f

# Neustart nach .env-Änderungen
systemctl restart warming-backend warming-worker warming-scheduler
```

### .env Pfad auf dem VPS
```
/opt/domain-warming/backend/.env
```

### Update (zieht von GitHub)
```bash
sudo /opt/domain-warming/deploy/hestiacp/update.sh
```

---

## Outlook OAuth2 einrichten

1. **Azure-App registrieren** (kostenlos):
   - https://portal.azure.com → "App-Registrierungen" → Neu
   - Kontotyp: "Persönliche Microsoft-Konten"
   - Redirect URI: `http://localhost`
   - API-Berechtigungen: `IMAP.AccessAsUser.All`, `SMTP.Send`, `offline_access`
   - → Client ID kopieren

2. **In .env eintragen**:
   ```
   OUTLOOK_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

3. **Service neu starten**:
   ```bash
   systemctl restart warming-backend
   # oder bei Docker:
   docker compose restart backend
   ```

4. **Bulk-Umwandlung** im Dashboard:
   - Accounts → "Outlook OAuth2 Batch-Umwandlung" → Batch starten

---

## Gmail App-Passwörter

Gmail-SMTP funktioniert **nicht** mit normalem Passwort (Google blockiert dies).
App-Passwort generieren:
1. https://myaccount.google.com/security
2. "2-Schritt-Verifizierung" aktivieren
3. "App-Passwörter" → "E-Mail" → Generieren
4. 16-stelligen Code als Passwort in CSV verwenden

---

## Firstmail (firstmail.ltd)

- SMTP: `smtp.firstmail.ltd:465` (SSL)
- IMAP: `imap.firstmail.ltd:993` (SSL)
- Benutzername: vollständige E-Mail-Adresse
- Passwort: normales Konto-Passwort (kein OAuth2 nötig)
