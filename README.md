# A-Studio

Prototype backend and frontend for A-WEB Studio.

## Structure

- `backend/` – FastAPI with a project API and RQ-based job queue.
- `frontend/` – Next.js dashboard styled with Tailwind CSS for project management.
- `worker` – background worker processing feature jobs.
- `docker-compose.yml` – Traefik-powered stack including Postgres and Redis.

## Development

Copy `.env.example` to `.env` and adjust as needed.
Important variables:

- `DATABASE_URL` – SQL database connection string (default uses Postgres).
- `REDIS_URL` – Redis instance for the job queue.
- `AUTH_TOKEN` – token required for authenticated API access.
- `NEXT_PUBLIC_API_URL` – URL of the backend API for the frontend.
- `BRANCH_NAME` – branch subdomain used by Traefik for previews.

Bring up the app with Docker Compose:

```bash
docker-compose up --build
```

The dashboard will be reachable at http://localhost:3000 and the API at http://localhost:8000.

## Testing

Run backend tests:

```bash
cd backend
python -m pytest
```

Run frontend checks:

```bash
cd frontend
npm test
```
