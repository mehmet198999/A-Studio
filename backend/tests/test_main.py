from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_project_crud():
    project = {"name": "Demo", "repo": "git@example.com/demo.git", "stack": "fastapi"}
    create_res = client.post("/projects", json=project)
    assert create_res.status_code == 200
    assert create_res.json() == project
    list_res = client.get("/projects")
    assert list_res.status_code == 200
    assert project in list_res.json()
