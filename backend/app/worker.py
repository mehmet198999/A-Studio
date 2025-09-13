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
    job_db.setdefault(job_id, {"status": "started", "logs": []})
    job_db[job_id]["status"] = "started"
    logs = job_db[job_id]["logs"]

    model = {"qwen": "Qwen", "deepseek": "DeepSeek", "llama": "Llama"}.get(type.lower(), "Qwen")
    logs.append(f"Selected model {model}")

    tmpdir = tempfile.mkdtemp()
    repo = init_repo(tmpdir)
    branch_name = f"feature-{job_id}"
    create_branch(repo, branch_name)
    Path(tmpdir, "feature.txt").write_text(f"{prompt} using {model}")
    commit_hash = commit_all(repo, f"Add feature with {model}")
    logs.append(f"Committed {commit_hash}")
    try:
        push_branch(repo, branch_name)
        logs.append("Pushed branch")
    except Exception as e:
        logs.append(f"Push failed: {e}")
    job_db[job_id]["status"] = "finished"
    return commit_hash


def run_worker() -> None:
    redis_conn = Redis()
    with Connection(redis_conn):
        worker = Worker(list(map(Queue, listen)))
        worker.work()


if __name__ == "__main__":
    run_worker()
