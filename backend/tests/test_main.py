from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_auth_headers() -> dict[str, str]:
    res = client.post("/token", json={"username": "admin", "password": "secret"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_project_requires_auth():
    response = client.get("/projects")
    assert response.status_code == 401


def test_project_crud():
    headers = get_auth_headers()
    project = {"name": "Demo", "repo": "git@example.com/demo.git", "stack": "fastapi"}
    create_res = client.post("/projects", json=project, headers=headers)
    assert create_res.status_code == 200
    assert create_res.json() == project
    list_res = client.get("/projects", headers=headers)
    assert list_res.status_code == 200
    assert project in list_res.json()
