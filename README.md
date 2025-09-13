# A-Studio

Prototype backend and frontend for A-WEB Studio.

## Structure

- `backend/` – FastAPI with a minimal project API and a DaisyUI-powered HTML view.
- `frontend/` – Next.js dashboard using Chakra UI for project management.

## Development

Bring up the app with Docker Compose:

```bash
docker-compose up --build
```

The dashboard will be reachable at http://localhost:3000 and the API at http://localhost:8000.
