from pathlib import Path
from git import Repo

def init_repo(path: str) -> Repo:
    """Initialise a git repository at the given path."""
    return Repo.init(path)

def clone_repo(source: str, dest: str) -> Repo:
    """Clone a repository from source to dest and return the repo."""
    return Repo.clone_from(source, dest)

def create_branch(repo: Repo, branch_name: str) -> None:
    """Create and checkout a new branch."""
    repo.git.checkout('-b', branch_name)

def commit_all(repo: Repo, message: str) -> str:
    """Commit all current changes with the provided message."""
    repo.git.add(A=True)
    commit = repo.index.commit(message)
    return commit.hexsha

def push_branch(repo: Repo, branch_name: str, remote_name: str = 'origin') -> None:
    """Push the specified branch to the remote."""
    repo.git.push(remote_name, branch_name)
