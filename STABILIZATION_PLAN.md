# Stabilization Plan ("funktioniert noch nicht")

## Aktueller Stand (nach Build-Checks)
- Frontend ließ sich initial nicht bauen wegen TypeScript-Fehlern in `accounts.tsx` und `campaigns.tsx`.
- Nach den Fixes baut das Frontend wieder erfolgreich (`next build`).
- Backend-Module lassen sich kompilieren (`python -m compileall backend/app`).

## Strategie für die nächsten Schritte

1. **Build-Gates dauerhaft einführen (sofort)**
   - Frontend: `npm run build` als Pflichtcheck vor jedem Merge.
   - Backend: mindestens `python -m compileall backend/app` und idealerweise automatisierte API-Tests.

2. **Smoke-Test-Flow definieren (kurzfristig)**
   - Login → Domains anlegen → Account importieren → Kampagne starten.
   - Ziel: in < 5 Minuten reproduzierbar prüfen, ob Kern-Flow lebt.

3. **API-Vertragsprüfung zwischen Frontend/Backend (kurzfristig)**
   - Typen aus Backend-Schemas ableiten oder OpenAPI-Client generieren.
   - Ziel: UI-Fehler durch Feldabweichungen früh erkennen.

4. **Fehler-Transparenz erhöhen (kurzfristig)**
   - Einheitliche Fehlerbehandlung im Frontend (`res.ok` + `detail` Mapping).
   - Technische Fehler in Logs strukturieren (Endpoint, Payload, Status).

5. **Regression-Schutz mit minimalem Testpaket (mittelfristig)**
   - 1–2 API-Tests für Auth/Accounts/Campaigns.
   - 1 E2E-Szenario für den Kern-Flow.

6. **Release-Readiness Checkliste (mittelfristig)**
   - Env-Variablen validieren (`AUTH_TOKEN`, `ADMIN_PASSWORD`, OAuth-Settings).
   - Datenbank-Migration/Schema-Prüfung vor Deploy.

## Priorisierung
- **P0:** Build muss grün sein (jetzt erreicht).
- **P1:** Smoke-Test-Flow + zentrale API-Pfade testen.
- **P2:** Automatisierte Regression (API + E2E) aufsetzen.
