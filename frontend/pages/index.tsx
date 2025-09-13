import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface Project {
  name: string;
  repo: string;
  stack: string;
}

interface Job {
  id: string;
  prompt: string;
  type: string;
  status: string;
  score?: number;
  logs?: string[];
  preview_url?: string;
  branch_url?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [stack, setStack] = useState('');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState('frontend');
  const router = useRouter();

  const fetchProjects = (token: string) => {
    fetch(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  };

  const fetchJobs = (token: string) => {
    fetch(`${API_URL}/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setJobs)
      .catch(() => setJobs([]));
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchProjects(token);
    fetchJobs(token);
  }, [router]);

  const addProject = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, repo, stack }),
    });
    if (res.ok) {
      setName('');
      setRepo('');
      setStack('');
      fetchProjects(token);
    }
  };

  const createJob = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch(`${API_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt, type }),
    });
    if (res.ok) {
      setPrompt('');
      setType('frontend');
      fetchJobs(token);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Projekte</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="border p-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border p-2"
          placeholder="Repo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
        <input
          className="border p-2"
          placeholder="Stack"
          value={stack}
          onChange={(e) => setStack(e.target.value)}
        />
        <button
          className="bg-teal-500 text-white px-4"
          onClick={addProject}
        >
          Projekt anlegen
        </button>
      </div>
      <table className="w-full table-auto mb-8 border">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Repo</th>
            <th className="text-left p-2">Stack</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.name}>
              <td className="border p-2">{p.name}</td>
              <td className="border p-2">{p.repo}</td>
              <td className="border p-2">{p.stack}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h1 className="text-2xl mb-4">Jobs</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="border p-2 flex-grow"
          placeholder="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <select
          className="border p-2"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="doku">Doku</option>
        </select>
        <button
          className="bg-teal-500 text-white px-4"
          onClick={createJob}
        >
          Generieren
        </button>
      </div>
      <table className="w-full table-auto border">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2">Prompt</th>
            <th className="text-left p-2">Typ</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Score</th>
            <th className="text-left p-2">Logs</th>
            <th className="text-left p-2">Preview</th>
            <th className="text-left p-2">Branch</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="border p-2">{job.prompt}</td>
              <td className="border p-2">{job.type}</td>
              <td className="border p-2">{job.status}</td>
              <td className="border p-2">{job.score ?? '-'}</td>
              <td className="border p-2 whitespace-pre-wrap">
                {job.logs ? job.logs.join('\n') : '-'}
              </td>
              <td className="border p-2">
                {job.preview_url ? (
                  <a
                    className="bg-teal-500 text-white px-2 py-1 inline-block"
                    href={job.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Preview öffnen
                  </a>
                ) : (
                  '-'
                )}
              </td>
              <td className="border p-2">
                {job.branch_url ? (
                  <a
                    className="text-teal-600"
                    href={job.branch_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Branch ansehen
                  </a>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
