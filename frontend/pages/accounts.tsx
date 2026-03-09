import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}` };
}

interface Account {
  id: number;
  email: string;
  provider: string;
  auth_type: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  active: boolean;
  created_at: string;
}

const PROVIDER_DEFAULTS: Record<string, { smtp_host: string; smtp_port: number; imap_host: string; imap_port: number }> = {
  outlook: { smtp_host: "smtp-mail.outlook.com", smtp_port: 587, imap_host: "imap-mail.outlook.com", imap_port: 993 },
  gmail: { smtp_host: "smtp.gmail.com", smtp_port: 587, imap_host: "imap.gmail.com", imap_port: 993 },
  firstmail: { smtp_host: "smtp.firstmail.ltd", smtp_port: 587, imap_host: "imap.firstmail.ltd", imap_port: 993 },
  custom: { smtp_host: "", smtp_port: 587, imap_host: "", imap_port: 993 },
};

const defaultForm = {
  email: "",
  password: "",
  provider: "outlook",
  auth_type: "password",
  oauth2_access_token: "",
  oauth2_refresh_token: "",
  oauth2_client_id: "",
  oauth2_client_secret: "",
};

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ ...defaultForm });
  const [showForm, setShowForm] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, any>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchAccounts();
  }, [filter]);

  const fetchAccounts = async () => {
    const params = filter !== "all" ? `?provider=${filter}` : "";
    const res = await fetch(`${API}/accounts${params}`, { headers: authHeader() });
    if (res.status === 401) { router.push("/login"); return; }
    setAccounts(await res.json());
  };

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: any = { ...form };
      if (form.auth_type !== "oauth2") {
        delete body.oauth2_access_token;
        delete body.oauth2_refresh_token;
        delete body.oauth2_client_id;
        delete body.oauth2_client_secret;
      }
      const res = await fetch(`${API}/accounts`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setForm({ ...defaultForm });
      setShowForm(false);
      fetchAccounts();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id: number) => {
    if (!confirm("Account wirklich löschen?")) return;
    await fetch(`${API}/accounts/${id}`, { method: "DELETE", headers: authHeader() });
    fetchAccounts();
  };

  const toggleActive = async (account: Account) => {
    await fetch(`${API}/accounts/${account.id}`, {
      method: "PUT",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ active: !account.active }),
    });
    fetchAccounts();
  };

  const testConnection = async (id: number) => {
    setTestingId(id);
    try {
      const res = await fetch(`${API}/accounts/${id}/test`, {
        method: "POST",
        headers: authHeader(),
      });
      const data = await res.json();
      setTestResult((prev) => ({ ...prev, [id]: data }));
    } finally {
      setTestingId(null);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API}/accounts/import`, {
        method: "POST",
        headers: authHeader(),
        body: formData,
      });
      const data = await res.json();
      setImportResult(data);
      fetchAccounts();
    } finally {
      setCsvImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const providerBadge: Record<string, string> = {
    outlook: "bg-blue-900/40 text-blue-300",
    gmail: "bg-red-900/40 text-red-300",
    firstmail: "bg-green-900/40 text-green-300",
    custom: "bg-gray-800 text-gray-400",
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Warming-Accounts ({accounts.length})</h1>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={csvImporting}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded transition-colors"
          >
            {csvImporting ? "Importiere..." : "CSV importieren"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded transition-colors"
          >
            + Account hinzufügen
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 p-3 rounded text-sm ${importResult.errors.length > 0 ? "bg-yellow-900/20 border border-yellow-700" : "bg-green-900/20 border border-green-700"}`}>
          <p>{importResult.created} Accounts importiert.</p>
          {importResult.errors.map((err, i) => (
            <p key={i} className="text-red-400 text-xs">{err}</p>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={addAccount} className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6 space-y-3">
          <h2 className="font-semibold text-sm mb-2">Neuer Account</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400">E-Mail</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Anbieter</label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="outlook">Outlook / Hotmail</option>
                <option value="gmail">Gmail</option>
                <option value="firstmail">Firstmail</option>
                <option value="custom">Eigener Server</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Auth-Methode</label>
              <select
                value={form.auth_type}
                onChange={(e) => setForm({ ...form, auth_type: e.target.value })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="password">Passwort</option>
                <option value="app_password">App-Passwort</option>
                <option value="oauth2">OAuth2</option>
              </select>
            </div>

            {form.auth_type !== "oauth2" && (
              <div>
                <label className="text-xs text-gray-400">
                  {form.auth_type === "app_password" ? "App-Passwort" : "Passwort"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {form.auth_type === "oauth2" && (
              <>
                <div>
                  <label className="text-xs text-gray-400">Client ID</label>
                  <input
                    type="text"
                    value={form.oauth2_client_id}
                    onChange={(e) => setForm({ ...form, oauth2_client_id: e.target.value })}
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Client Secret</label>
                  <input
                    type="password"
                    value={form.oauth2_client_secret}
                    onChange={(e) => setForm({ ...form, oauth2_client_secret: e.target.value })}
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Refresh Token</label>
                  <input
                    type="text"
                    value={form.oauth2_refresh_token}
                    onChange={(e) => setForm({ ...form, oauth2_refresh_token: e.target.value })}
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400">Access Token (initial)</label>
                  <input
                    type="text"
                    value={form.oauth2_access_token}
                    onChange={(e) => setForm({ ...form, oauth2_access_token: e.target.value })}
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm">
              Speichern
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-200 px-4 py-1.5 rounded text-sm">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* CSV hint */}
      <div className="bg-gray-900/50 border border-gray-800 rounded p-3 mb-4 text-xs text-gray-500">
        CSV-Format: <code className="text-gray-400">email,password,provider,auth_type</code> — Provider: outlook, gmail, firstmail · Auth: password, app_password, oauth2
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["all", "outlook", "gmail", "firstmail"].map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              filter === p ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {p === "all" ? "Alle" : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">E-Mail</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Anbieter</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Auth</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Keine Accounts</td></tr>
            ) : (
              accounts.map((acc) => (
                <tr key={acc.id} className="border-t border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-2 font-mono text-xs">{acc.email}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${providerBadge[acc.provider] || "bg-gray-800 text-gray-400"}`}>
                      {acc.provider}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{acc.auth_type}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleActive(acc)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        acc.active
                          ? "bg-green-900/40 text-green-400 hover:bg-red-900/40 hover:text-red-400"
                          : "bg-gray-800 text-gray-500 hover:bg-green-900/40 hover:text-green-400"
                      }`}
                    >
                      {acc.active ? "Aktiv" : "Inaktiv"}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => testConnection(acc.id)}
                        disabled={testingId === acc.id}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      >
                        {testingId === acc.id ? "Teste..." : "Testen"}
                      </button>
                      {testResult[acc.id] && (
                        <span className={`text-xs ${testResult[acc.id].smtp && testResult[acc.id].imap ? "text-green-400" : "text-red-400"}`}>
                          SMTP:{testResult[acc.id].smtp ? "✓" : "✗"} IMAP:{testResult[acc.id].imap ? "✓" : "✗"}
                        </span>
                      )}
                      <button
                        onClick={() => deleteAccount(acc.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
