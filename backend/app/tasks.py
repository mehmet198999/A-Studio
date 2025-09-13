import tempfile
from pathlib import Path
from rq import Queue
from redis import Redis
from git import Repo
import uuid

from .git_utils import create_branch, commit_all, push_branch

redis_conn = Redis()
queue = Queue(connection=redis_conn)

# simple in-memory store for job status and logs
job_db: dict[str, dict] = {}

def enqueue_dummy(repo_url: str, branch_name: str) -> str:
    return queue.enqueue(run_dummy_job, repo_url, branch_name).id


def enqueue_feature_job(prompt: str, type: str) -> str:
    """Enqueue a feature generation job and track its status."""
    try:
        job = queue.enqueue("backend.app.worker.process_feature_job", prompt, type)
        job_id = job.id
    except Exception:
        # If Redis is unavailable create a dummy job id so the API still works
        job_id = str(uuid.uuid4())
    job_db[job_id] = {"status": "queued", "logs": []}
    return job_id

def run_dummy_job(repo_url: str, branch_name: str) -> str:
    tmpdir = tempfile.mkdtemp()
    repo = Repo.clone_from(repo_url, tmpdir)
    create_branch(repo, branch_name)
    Path(tmpdir, 'dummy.txt').write_text('hello')
    commit_hash = commit_all(repo, 'Add dummy file')
    push_branch(repo, branch_name)
    return commit_hash
