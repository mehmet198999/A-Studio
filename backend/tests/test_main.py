import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
os.environ["DATABASE_URL"] = "sqlite://"

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


#<<<<<<< codex/add-fastapi-dependency-for-token-check

def get_auth_headers() -> dict[str, str]:
    res = client.post("/token", json={"username": "admin", "password": "secret"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health():
=======
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


def test_health(client):
#>>>>>>> main
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


#<<<<<<< codex/add-fastapi-dependency-for-token-check
def test_project_requires_auth():
    response = client.get("/projects")
    assert response.status_code == 401


def test_project_crud():
    headers = get_auth_headers()
=======
def test_project_crud(client):
#>>>>>>> main
    project = {"name": "Demo", "repo": "git@example.com/demo.git", "stack": "fastapi"}
    create_res = client.post("/projects", json=project, headers=headers)
    assert create_res.status_code == 200
    assert create_res.json() == project
    list_res = client.get("/projects", headers=headers)
    assert list_res.status_code == 200
    assert project in list_res.json()

#<<<<<<< codex/implement-enqueue_feature_job-function

def test_job_endpoints():
    req = {"prompt": "Add feature", "type": "qwen"}
    res = client.post("/jobs", json=req)
    assert res.status_code == 200
    job_id = res.json()["job_id"]
    status_res = client.get(f"/jobs/{job_id}")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "queued"
#=======
#>>>>>>> main
