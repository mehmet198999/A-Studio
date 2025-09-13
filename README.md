# A-Studio

Prototype backend and frontend for A-WEB Studio.

## Structure

- `backend/` – FastAPI with a project API and RQ-based job queue.
- `frontend/` – Next.js dashboard using Chakra UI for project management.
- `worker` – background worker processing feature jobs.
- `docker-compose.yml` – Traefik-powered stack including Postgres and Redis.

## Development

Copy `.env.example` to `.env` and adjust as needed.
Set the `REDIS_URL` environment variable to point to your Redis instance for the backend and worker.

Bring up the app with Docker Compose:

```bash
docker-compose up --build
```

The dashboard will be reachable at http://localhost:3000 and the API at http://localhost:8000.
