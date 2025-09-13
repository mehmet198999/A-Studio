from pathlib import Path
from git import Repo

from backend.app.git_utils import create_branch, commit_all, push_branch


def test_branch_commit_and_push(tmp_path):
    remote_path = tmp_path / 'remote.git'
    remote_repo = Repo.init(remote_path, bare=True)

    workdir = tmp_path / 'work'
    repo = Repo.clone_from(remote_repo.git_dir, workdir)

    (workdir / 'file.txt').write_text('content')
    repo.git.add('file.txt')
    repo.index.commit('initial')
    create_branch(repo, 'feature/test')
    Path(workdir / 'new.txt').write_text('new')
    commit_all(repo, 'Add new file')
    push_branch(repo, 'feature/test')

    assert 'feature/test' in [h.name for h in remote_repo.heads]

