import { useState } from "react";
import { useRouter } from "next/router";
import { Button, Card, Label, TextInput, Alert } from "flowbite-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error("Ungültige Zugangsdaten");
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      router.push("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-400">Domain Warming</h1>
          <p className="text-gray-500 text-sm mt-1">Melde dich an um fortzufahren</p>
        </div>
        <Card className="bg-gray-900 border-gray-800">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-gray-300" >Benutzername</Label>
              <TextInput
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1"
                theme={{
                  field: {
                    input: {
                      base: "block w-full border disabled:cursor-not-allowed disabled:opacity-50",
                      colors: { gray: "bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500" },
                    },
                  },
                }}
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-gray-300" >Passwort</Label>
              <TextInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
                theme={{
                  field: {
                    input: {
                      base: "block w-full border disabled:cursor-not-allowed disabled:opacity-50",
                      colors: { gray: "bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500" },
                    },
                  },
                }}
              />
            </div>
            {error && (
              <Alert color="failure">
                <span className="font-medium">{error}</span>
              </Alert>
            )}
            <Button type="submit" color="blue" disabled={loading} className="w-full">
              {loading ? "Anmelden..." : "Anmelden"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
