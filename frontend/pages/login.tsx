import { useState } from 'react';
import { useRouter } from 'next/router';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    const res = await fetch(`${API_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      router.push('/');
    }
  };

  return (
    <div className="p-8 max-w-sm mx-auto">
      <h1 className="text-2xl mb-4">Login</h1>
      <div className="flex flex-col gap-2">
        <input
          className="border p-2"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="border p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="bg-teal-500 text-white py-2"
          onClick={handleLogin}
        >
          Login
        </button>
      </div>
    </div>
  );
}
