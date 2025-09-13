import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
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

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [stack, setStack] = useState("");

  useEffect(() => {
    fetch("http://localhost:8000/projects")
      .then((res) => res.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  const addProject = async () => {
    const res = await fetch("http://localhost:8000/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, repo, stack }),
    });
    if (res.ok) {
      const project = await res.json();
      setProjects((p) => [...p, project]);
      setName("");
      setRepo("");
      setStack("");
    }
  };

  return (
    <Box p={8}>
      <Heading mb={4}>A-WEB Studio Projects</Heading>
      <Flex gap={2} mb={4} flexWrap="wrap">
        <Input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Repo URL"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
        <Input
          placeholder="Stack"
          value={stack}
          onChange={(e) => setStack(e.target.value)}
        />
        <Button colorScheme="teal" onClick={addProject}>
          Add
        </Button>
      </Flex>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Repo</Th>
            <Th>Stack</Th>
          </Tr>
        </Thead>
        <Tbody>
          {projects.map((p, i) => (
            <Tr key={i}>
              <Td>{p.name}</Td>
              <Td>{p.repo}</Td>
              <Td>{p.stack}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}
