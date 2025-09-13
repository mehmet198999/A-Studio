"""Utility helpers for interacting with git repositories."""

from pathlib import Path
from git import Repo, GitCommandError


def _raise(message: str, exc: Exception) -> None:
    """Raise a RuntimeError with a consistent message."""
    raise RuntimeError(message) from exc

def init_repo(path: str) -> Repo:
    """Initialise a git repository at the given path."""
    try:
        return Repo.init(path)
    except GitCommandError as exc:  # pragma: no cover - rare
        _raise(f"Failed to initialise repo at {path}", exc)

def clone_repo(source: str, dest: str) -> Repo:
    """Clone a repository from source to dest and return the repo."""
    try:
        return Repo.clone_from(source, dest)
    except GitCommandError as exc:  # pragma: no cover - network
        _raise(f"Failed to clone {source}", exc)

def create_branch(repo: Repo, branch_name: str) -> None:
    """Create and checkout a new branch."""
    try:
        repo.git.checkout("-b", branch_name)
    except GitCommandError as exc:
        _raise(f"Failed to create branch {branch_name}", exc)

def commit_all(repo: Repo, message: str) -> str:
    """Commit all current changes with the provided message."""
    try:
        repo.git.add(A=True)
        commit = repo.index.commit(message)
        return commit.hexsha
    except GitCommandError as exc:
        _raise("Failed to commit changes", exc)

def push_branch(repo: Repo, branch_name: str, remote_name: str = "origin") -> None:
    """Push the specified branch to the remote."""
    try:
        repo.git.push(remote_name, branch_name)
    except GitCommandError as exc:
        _raise(f"Failed to push branch {branch_name}", exc)
