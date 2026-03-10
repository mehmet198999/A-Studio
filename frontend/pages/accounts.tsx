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
  active: boolean;
  created_at: string;
}

const providerColors: Record<string, string> = {
  outlook: "bg-blue-900/50 text-blue-300 border border-blue-800",
  gmail: "bg-red-900/50 text-red-300 border border-red-800",
  firstmail: "bg-green-900/50 text-green-300 border border-green-800",
  custom: "bg-gray-800 text-gray-400 border border-gray-700",
};

const authColors: Record<string, string> = {
  oauth2: "text-green-400",
  app_password: "text-yellow-400",
  password: "text-gray-400",
};

function Badge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-center">
      <p className={`text-xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [csvImporting, setCsvImporting] = useState(false);
  const [autoOAuth2, setAutoOAuth2] = useState(true);
  const [importResult, setImportResult] = useState<any>(null);
  const [bulkOAuth2Running, setBulkOAuth2Running] = useState(false);
  const [bulkOAuth2Result, setBulkOAuth2Result] = useState<any>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, any>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAcc, setNewAcc] = useState({ email: "", password: "", provider: "outlook" });
  const [addError, setAddError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchAccounts();
  }, [filter]);

  const fetchAccounts = async () => {
    const p = filter !== "all" ? `?provider=${filter}` : "";
    const res = await fetch(`${API}/accounts${p}`, { headers: authHeader() });
    if (res.status === 401) { router.push("/login"); return; }
    setAccounts(await res.json());
    setSelected(new Set());
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API}/accounts/import?auto_oauth2=${autoOAuth2}`, {
        method: "POST", headers: authHeader(), body: formData,
      });
      setImportResult(await res.json());
      fetchAccounts();
    } finally {
      setCsvImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runBulkOAuth2 = async () => {
    setBulkOAuth2Running(true);
    setBulkOAuth2Result(null);
    try {
      const res = await fetch(`${API}/accounts/bulk-oauth2`, { method: "POST", headers: authHeader() });
      setBulkOAuth2Result(await res.json());
      fetchAccounts();
    } finally { setBulkOAuth2Running(false); }
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const filtered = accounts.filter((a) => filter === "all" || a.provider === filter);

  const selectAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id)));
  };

  const bulkDelete = async () => {
    if (!confirm(`${selected.size} Accounts wirklich löschen?`)) return;
    await fetch(`${API}/accounts/bulk-delete`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify([...selected]),
    });
    fetchAccounts();
  };

  const bulkToggle = async (active: boolean) => {
    await fetch(`${API}/accounts/bulk-toggle?active=${active}`, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify([...selected]),
    });
    fetchAccounts();
  };

  const testConnection = async (id: number) => {
    setTestingId(id);
    try {
      const res = await fetch(`${API}/accounts/${id}/test`, { method: "POST", headers: authHeader() });
      const data = await res.json();
      setTestResult((p) => ({ ...p, [id]: data }));
    } finally { setTestingId(null); }
  };

  const fetchSingleOAuth2 = async (id: number) => {
    const res = await fetch(`${API}/accounts/${id}/fetch-oauth2`, { method: "POST", headers: authHeader() });
    const data = await res.json();
    if (data.status === "ok") { alert(`OAuth2 Token für ${data.email} erfolgreich!`); fetchAccounts(); }
    else alert(`Fehler: ${data.detail || JSON.stringify(data)}`);
  };

  const addSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    try {
      const res = await fetch(`${API}/accounts`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(newAcc),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setNewAcc({ email: "", password: "", provider: "outlook" });
      setShowAddForm(false);
      fetchAccounts();
    } catch (e: any) { setAddError(e.message); }
  };

  const outlookTotal = accounts.filter((a) => a.provider === "outlook").length;
  const gmailTotal = accounts.filter((a) => a.provider === "gmail").length;
  const firstmailTotal = accounts.filter((a) => a.provider === "firstmail").length;
  const oauth2Count = accounts.filter((a) => a.auth_type === "oauth2").length;
  const activeCount = accounts.filter((a) => a.active).length;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Accounts ({accounts.length})</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-2 rounded">
            + Einzeln
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={csvImporting}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-3 py-2 rounded">
            {csvImporting ? "..." : "CSV"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
        <Badge label="Outlook" count={outlookTotal} color="text-blue-400" />
        <Badge label="Gmail" count={gmailTotal} color="text-red-400" />
        <Badge label="Firstmail" count={firstmailTotal} color="text-green-400" />
        <Badge label="OAuth2" count={oauth2Count} color="text-yellow-400" />
        <Badge label="Aktiv" count={activeCount} color="text-green-400" />
      </div>

      {/* CSV Info box */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-gray-300 mb-1">CSV-Format:</p>
        <code className="text-xs text-green-400 bg-gray-800 px-2 py-1 rounded block mb-2">email,password</code>
        <div className="space-y-1 text-xs text-gray-500 mb-3">
          <p><span className="text-blue-400">Outlook</span> → OAuth2-Token automatisch</p>
          <p><span className="text-red-400">Gmail</span> → 16-stelliges App-Passwort</p>
          <p><span className="text-green-400">Firstmail</span> → Normales Passwort (Port 465)</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={autoOAuth2} onChange={(e) => setAutoOAuth2(e.target.checked)}
            className="w-4 h-4 accent-blue-500" />
          <span className="text-sm text-gray-300">Outlook → OAuth2 automatisch</span>
        </label>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`mb-4 p-4 rounded-lg border text-sm ${importResult.errors?.length > 0 ? "bg-yellow-900/20 border-yellow-700" : "bg-green-900/20 border-green-700"}`}>
          <div className="flex flex-wrap gap-4 mb-1">
            <span className="text-green-400 font-bold">{importResult.created} importiert</span>
            {importResult.oauth2_tokens_fetched > 0 && <span className="text-blue-400">{importResult.oauth2_tokens_fetched}x OAuth2</span>}
            {importResult.errors?.length > 0 && <span className="text-red-400">{importResult.errors.length} Fehler</span>}
          </div>
          {importResult.errors?.slice(0, 5).map((e: string, i: number) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
        </div>
      )}

      {/* Single add form */}
      {showAddForm && (
        <form onSubmit={addSingle} className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">E-Mail</label>
              <input type="email" required value={newAcc.email}
                onChange={(e) => setNewAcc({ ...newAcc, email: e.target.value })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Passwort</label>
              <input type="password" value={newAcc.password}
                onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Anbieter</label>
              <select value={newAcc.provider} onChange={(e) => setNewAcc({ ...newAcc, provider: e.target.value })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="outlook">Outlook</option>
                <option value="gmail">Gmail</option>
                <option value="firstmail">Firstmail</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                Hinzufügen
              </button>
            </div>
          </div>
          {addError && <p className="text-red-400 text-xs">{addError}</p>}
        </form>
      )}

      {/* Bulk OAuth2 box */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-300">Outlook OAuth2 Batch</p>
            <p className="text-xs text-gray-400 mt-0.5">Alle Outlook-Accounts → OAuth2-Token automatisch holen</p>
          </div>
          <button onClick={runBulkOAuth2} disabled={bulkOAuth2Running}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded">
            {bulkOAuth2Running ? "Läuft..." : "Batch starten"}
          </button>
        </div>
      </div>

      {bulkOAuth2Result && (
        <div className="mb-4 bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs">
          <p className="font-medium mb-2 text-gray-300">{bulkOAuth2Result.processed} verarbeitet:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
            {bulkOAuth2Result.results?.map((r: any, i: number) => (
              <div key={i} className={`flex items-center gap-2 ${r.status === "ok" ? "text-green-400" : "text-red-400"}`}>
                <span>{r.status === "ok" ? "✓" : "✗"}</span>
                <span className="truncate font-mono text-xs">{r.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        {["all", "outlook", "gmail", "firstmail"].map((p) => (
          <button key={p} onClick={() => setFilter(p)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
              filter === p ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}>
            {p === "all" ? `Alle (${accounts.length})` : `${p.charAt(0).toUpperCase() + p.slice(1)} (${accounts.filter(a => a.provider === p).length})`}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-800 rounded-lg px-4 py-2 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-blue-300 font-medium">{selected.size} ausgewählt</span>
          <button onClick={() => bulkToggle(true)} className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded">Aktivieren</button>
          <button onClick={() => bulkToggle(false)} className="text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1.5 rounded">Deaktivieren</button>
          <button onClick={bulkDelete} className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded">Löschen</button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-200 ml-auto">✕</button>
        </div>
      )}

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center px-1 mb-1">
          <input type="checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={selectAll} className="accent-blue-500 mr-2" />
          <span className="text-xs text-gray-500">Alle auswählen</span>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            <p>Keine Accounts</p>
            <p className="text-xs mt-1">CSV importieren oder einzeln hinzufügen</p>
          </div>
        ) : (
          filtered.map((acc) => (
            <div key={acc.id}
              className={`bg-gray-900 border rounded-lg p-3 ${selected.has(acc.id) ? "border-blue-600" : "border-gray-800"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected.has(acc.id)}
                  onChange={() => toggleSelect(acc.id)} className="accent-blue-500 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-gray-200 truncate">{acc.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${providerColors[acc.provider] || "bg-gray-800 text-gray-400"}`}>
                      {acc.provider}
                    </span>
                    <span className={`text-xs font-medium ${authColors[acc.auth_type] || "text-gray-400"}`}>
                      {acc.auth_type === "oauth2" ? "OAuth2 ✓" : acc.auth_type === "app_password" ? "App-PW" : "Passwort"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${acc.active ? "bg-green-900/40 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                      {acc.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => testConnection(acc.id)} disabled={testingId === acc.id}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 px-3 py-1.5 rounded disabled:opacity-50">
                      {testingId === acc.id ? "Teste…" : "Verbindung testen"}
                    </button>
                    {testResult[acc.id] && (
                      <span className={`text-xs ${testResult[acc.id].smtp && testResult[acc.id].imap ? "text-green-400" : "text-red-400"}`}>
                        SMTP:{testResult[acc.id].smtp ? "✓" : "✗"} IMAP:{testResult[acc.id].imap ? "✓" : "✗"}
                      </span>
                    )}
                    {acc.provider === "outlook" && acc.auth_type !== "oauth2" && (
                      <button onClick={() => fetchSingleOAuth2(acc.id)}
                        className="text-xs bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 px-3 py-1.5 rounded">
                        → OAuth2
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/60">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={selectAll} className="accent-blue-500" />
              </th>
              <th className="text-left px-3 py-2 text-gray-400 font-medium">E-Mail</th>
              <th className="text-left px-3 py-2 text-gray-400 font-medium">Anbieter</th>
              <th className="text-left px-3 py-2 text-gray-400 font-medium">Auth</th>
              <th className="text-left px-3 py-2 text-gray-400 font-medium">Status</th>
              <th className="text-left px-3 py-2 text-gray-400 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <p className="text-gray-500 mb-2">Keine Accounts</p>
                  <p className="text-gray-600 text-xs">CSV-Datei importieren oder einzeln hinzufügen</p>
                </td>
              </tr>
            ) : (
              filtered.map((acc) => (
                <tr key={acc.id} className={`border-t border-gray-800/50 hover:bg-gray-800/20 ${selected.has(acc.id) ? "bg-blue-900/10" : ""}`}>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={selected.has(acc.id)}
                      onChange={() => toggleSelect(acc.id)} className="accent-blue-500" />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-300">{acc.email}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${providerColors[acc.provider] || "bg-gray-800 text-gray-400"}`}>
                      {acc.provider}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-medium ${authColors[acc.auth_type] || "text-gray-400"}`}>
                      {acc.auth_type === "oauth2" ? "OAuth2 ✓" : acc.auth_type === "app_password" ? "App-PW" : "Passwort"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${acc.active ? "bg-green-900/40 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                      {acc.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <button onClick={() => testConnection(acc.id)} disabled={testingId === acc.id}
                        className="text-blue-400 hover:text-blue-300 disabled:opacity-50">
                        {testingId === acc.id ? "…" : "Test"}
                      </button>
                      {testResult[acc.id] && (
                        <span className={testResult[acc.id].smtp && testResult[acc.id].imap ? "text-green-400" : "text-red-400"}>
                          S:{testResult[acc.id].smtp ? "✓" : "✗"} I:{testResult[acc.id].imap ? "✓" : "✗"}
                        </span>
                      )}
                      {acc.provider === "outlook" && acc.auth_type !== "oauth2" && (
                        <button onClick={() => fetchSingleOAuth2(acc.id)} className="text-yellow-400 hover:text-yellow-300">
                          →OAuth2
                        </button>
                      )}
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
