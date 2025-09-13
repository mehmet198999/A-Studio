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
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_project_crud(client):
    project = {"name": "Demo", "repo": "git@example.com/demo.git", "stack": "fastapi"}
    create_res = client.post("/projects", json=project)
    assert create_res.status_code == 200
    assert create_res.json() == project
    list_res = client.get("/projects")
    assert list_res.status_code == 200
    assert project in list_res.json()

