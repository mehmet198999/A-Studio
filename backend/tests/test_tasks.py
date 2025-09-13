from unittest.mock import patch
from git import Repo

from backend.app.tasks import run_dummy_job


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
