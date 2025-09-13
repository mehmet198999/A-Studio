import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["AUTH_TOKEN"] = "test-token"

from backend.app.main import Base, SessionLocal, app, engine, get_db  # noqa: E402

Base.metadata.create_all(bind=engine)


@pytest.fixture()
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def get_auth_headers(client: TestClient) -> dict[str, str]:
    res = client.post("/token", json={"username": "admin", "password": "secret"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_project_requires_auth(client):
    response = client.get("/projects")
    assert response.status_code == 401


def test_jobs_require_auth(client):
    response = client.get("/jobs")
    assert response.status_code == 401


def test_project_crud(client):
    headers = get_auth_headers(client)
    project = {"name": "Demo", "repo": "git@example.com/demo.git", "stack": "fastapi"}
    create_res = client.post("/projects", json=project, headers=headers)
    assert create_res.status_code == 200
    assert create_res.json()["name"] == "Demo"
    list_res = client.get("/projects", headers=headers)
    assert list_res.status_code == 200
    assert any(p["name"] == "Demo" for p in list_res.json())


def test_job_endpoints(client):
    headers = get_auth_headers(client)
    req = {"prompt": "Add feature", "type": "frontend"}
    res = client.post("/jobs", json=req, headers=headers)
    assert res.status_code == 200
    job_id = res.json()["job_id"]
    list_res = client.get("/jobs", headers=headers)
    assert list_res.status_code == 200
    assert any(job["id"] == job_id for job in list_res.json())
    status_res = client.get(f"/jobs/{job_id}", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] in {"queued", "started", "finished"}
