#!/bin/bash
set -e

echo "==> Git pull..."
git pull origin $(git rev-parse --abbrev-ref HEAD)

# Prüfen ob package.json sich geändert hat (dann brauchen wir rebuild)
CHANGED=$(git diff HEAD@{1} HEAD --name-only 2>/dev/null || echo "")

if echo "$CHANGED" | grep -q "frontend/package"; then
  echo "==> package.json geändert → Frontend neu bauen..."
  docker compose up -d --build frontend
elif echo "$CHANGED" | grep -q "backend/"; then
  echo "==> Backend geändert → Backend neu bauen..."
  docker compose up -d --build backend worker scheduler
  docker compose restart frontend
else
  echo "==> Nur Frontend-Code geändert → Container neu starten..."
  docker compose up -d frontend
fi

echo ""
echo "✓ Fertig! Läuft unter http://localhost:3000"
docker compose ps --format "table {{.Name}}\t{{.Status}}"
