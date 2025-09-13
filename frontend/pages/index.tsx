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

interface Job {
  id: string;
  prompt: string;
  type: string;
  status: string;
  score?: number;
  preview_url?: string;
  branch_url?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
#<<<<<<< codex/add-fastapi-dependency-for-token-check
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [stack, setStack] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetch("http://localhost:8000/projects", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [router]);

  const addProject = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("http://localhost:8000/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, repo, stack }),
=======
  const [jobs, setJobs] = useState<Job[]>([]);
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState("frontend");

  const fetchJobs = () => {
    fetch(`${API_URL}/jobs`)
      .then((res) => res.json())
      .then(setJobs)
      .catch(() => setJobs([]));
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const createJob = async () => {
    const res = await fetch(`${API_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, type }),
#>>>>>>> main
    });
    if (res.ok) {
      setPrompt("");
      setType("frontend");
      fetchJobs();
    }
  };

  return (
    <Box p={8}>
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
              <Td>
                {job.preview_url ? (
                  <Link href={job.preview_url} color="teal.500" isExternal>
                    Preview
                  </Link>
                ) : (
                  "-"
                )}
              </Td>
              <Td>
                {job.branch_url ? (
                  <Link href={job.branch_url} color="teal.500" isExternal>
                    Branch
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

