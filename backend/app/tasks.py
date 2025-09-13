import tempfile
from pathlib import Path
from rq import Queue
from redis import Redis
from git import Repo

from .git_utils import create_branch, commit_all, push_branch

redis_conn = Redis()
queue = Queue(connection=redis_conn)

def enqueue_dummy(repo_url: str, branch_name: str) -> str:
    return queue.enqueue(run_dummy_job, repo_url, branch_name).id

def run_dummy_job(repo_url: str, branch_name: str) -> str:
    tmpdir = tempfile.mkdtemp()
    repo = Repo.clone_from(repo_url, tmpdir)
    create_branch(repo, branch_name)
    Path(tmpdir, 'dummy.txt').write_text('hello')
    commit_hash = commit_all(repo, 'Add dummy file')
    push_branch(repo, branch_name)
    return commit_hash
