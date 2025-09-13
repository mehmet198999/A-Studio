import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Link,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [stack, setStack] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState("frontend");
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
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchProjects(token);
    fetchJobs(token);
  }, [router]);

  const addProject = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${API_URL}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, repo, stack }),
    });
    if (res.ok) {
      setName("");
      setRepo("");
      setStack("");
      fetchProjects(token);
    }
  };

  const createJob = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${API_URL}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt, type }),
    });
    if (res.ok) {
      setPrompt("");
      setType("frontend");
      fetchJobs(token);
    }
  };

  return (
    <Box p={8}>
      <Heading mb={4}>Projekte</Heading>
      <Flex gap={2} mb={4} flexWrap="wrap">
        <Input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Repo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
        <Input
          placeholder="Stack"
          value={stack}
          onChange={(e) => setStack(e.target.value)}
        />
        <Button colorScheme="teal" onClick={addProject}>
          Projekt anlegen
        </Button>
      </Flex>
      <Table variant="simple" mb={8}>
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Repo</Th>
            <Th>Stack</Th>
          </Tr>
        </Thead>
        <Tbody>
          {projects.map((p) => (
            <Tr key={p.name}>
              <Td>{p.name}</Td>
              <Td>{p.repo}</Td>
              <Td>{p.stack}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Heading mb={4}>Jobs</Heading>
      <Flex gap={2} mb={4} flexWrap="wrap">
        <Input
          placeholder="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Select
          width="auto"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="doku">Doku</option>
        </Select>
        <Button colorScheme="teal" onClick={createJob}>
          Generieren
        </Button>
      </Flex>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Prompt</Th>
            <Th>Typ</Th>
            <Th>Status</Th>
            <Th>Score</Th>
            <Th>Logs</Th>
            <Th>Preview</Th>
            <Th>Branch</Th>
          </Tr>
        </Thead>
        <Tbody>
          {jobs.map((job) => (
            <Tr key={job.id}>
              <Td>{job.prompt}</Td>
              <Td>{job.type}</Td>
              <Td>{job.status}</Td>
              <Td>{job.score ?? "-"}</Td>
              <Td>{job.logs ? job.logs.join("\n") : "-"}</Td>
              <Td>
                {job.preview_url ? (
                  <Button
                    as="a"
                    href={job.preview_url}
                    colorScheme="teal"
                    size="sm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Preview öffnen
                  </Button>
                ) : (
                  "-"
                )}
              </Td>
              <Td>
                {job.branch_url ? (
                  <Link href={job.branch_url} color="teal.500" isExternal>
                    Branch ansehen
                  </Link>
                ) : (
                  "-"
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}
