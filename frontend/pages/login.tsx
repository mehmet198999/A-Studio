import { useState } from "react";
import { useRouter } from "next/router";
import { Box, Button, Flex, Heading, Input } from "@chakra-ui/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    const res = await fetch(`${API_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      router.push("/");
    }
  };

  return (
    <Box p={8}>
      <Heading mb={4}>Login</Heading>
      <Flex direction="column" gap={2} maxW="sm">
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button colorScheme="teal" onClick={handleLogin}>
          Login
        </Button>
      </Flex>
    </Box>
  );
}
