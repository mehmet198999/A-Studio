import os
import sys
from unittest.mock import patch
from git import Repo

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
os.environ["REDIS_URL"] = "redis://localhost:6379/0"

from backend.app.tasks import enqueue_feature_job, job_db, run_dummy_job


def test_run_dummy_job_stores_url(tmp_path):
    remote_path = tmp_path / "remote.git"
    remote_repo = Repo.init(remote_path, bare=True)

    workdir = tmp_path / "work"
    repo = Repo.init(workdir)
    (workdir / "init.txt").write_text("init")
    repo.git.add("init.txt")
    repo.index.commit("init")
    origin = repo.create_remote("origin", remote_repo.git_dir)
    origin.push("master:master")

    class DummyJob:
        def __init__(self):
            self.meta = {}
        def save_meta(self):
            self.saved = True

    dummy_job = DummyJob()
    branch = "feature/test"

    with patch("backend.app.tasks.get_current_job", return_value=dummy_job):
        run_dummy_job(remote_repo.git_dir, branch)

    assert dummy_job.meta["url"] == f"https://{branch}.app.a-server.ch"
    assert branch in [h.name for h in remote_repo.heads]


def test_enqueue_feature_job_records_job(monkeypatch):
    class DummyJob:
        def __init__(self):
            self.id = "test-id"

    def fake_enqueue(*args, **kwargs):
        return DummyJob()

    monkeypatch.setattr("backend.app.tasks.queue.enqueue", fake_enqueue)
    job_id = enqueue_feature_job("Do something", "frontend")

    assert job_id == "test-id"
    assert job_id in job_db
    assert job_db[job_id]["prompt"] == "Do something"
    assert job_db[job_id]["type"] == "frontend"
    assert job_db[job_id]["status"] == "queued"
    job_db.clear()
