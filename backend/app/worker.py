import os
import tempfile
from pathlib import Path
from rq import Worker, Queue, Connection, get_current_job
from redis import Redis

from .git_utils import init_repo, create_branch, commit_all, push_branch
from .tasks import job_db

listen = ["default"]


def process_feature_job(prompt: str, type: str) -> str:
    """Process a feature generation job."""
    job = get_current_job()
    job_id = job.id if job else "manual"
    entry = job_db.setdefault(
        job_id,
        {
            "prompt": prompt,
            "type": type,
            "status": "started",
            "logs": [],
            "score": None,
            "preview_url": None,
            "branch_url": None,
        },
    )
    entry["status"] = "started"
    logs = entry["logs"]

    model = {"frontend": "Frontend", "backend": "Backend", "doku": "Doku"}.get(type.lower(), "Frontend")
    logs.append(f"Selected model {model}")

    tmpdir = tempfile.mkdtemp()
    repo = init_repo(tmpdir)
    branch_name = f"feature-{job_id}"
    try:
        create_branch(repo, branch_name)
        Path(tmpdir, "feature.txt").write_text(f"{prompt} using {model}")
        commit_hash = commit_all(repo, f"Add feature with {model}")
        logs.append(f"Committed {commit_hash}")
        push_branch(repo, branch_name)
        logs.append("Pushed branch")
        preview_domain = os.environ.get("PREVIEW_DOMAIN", "app.a-server.ch")
        entry["preview_url"] = f"https://{branch_name}.{preview_domain}"
        entry["branch_url"] = f"https://example.com/{branch_name}"
    except Exception as e:
        logs.append(f"Error: {e}")
    entry["status"] = "finished"
    return commit_hash if "commit_hash" in locals() else ""


def run_worker() -> None:
    redis_conn = Redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    with Connection(redis_conn):
        worker = Worker(list(map(Queue, listen)))
        worker.work()


if __name__ == "__main__":
    run_worker()
