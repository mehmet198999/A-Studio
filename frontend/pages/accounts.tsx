import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import {
  Alert, Badge, Button, Card, Checkbox, Label,
  Modal, ModalBody, ModalHeader,
  Select, Spinner, Textarea,
  Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow,
  TextInput,
} from "flowbite-react";

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

const providerColor: Record<string, "blue" | "red" | "green" | "gray"> = {
  outlook: "blue",
  gmail: "red",
  firstmail: "green",
  custom: "gray",
};

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [csvImporting, setCsvImporting] = useState(false);
  const [autoOAuth2, setAutoOAuth2] = useState(true);
  const [importResult, setImportResult] = useState<any>(null);
  const [bulkOAuth2Running, setBulkOAuth2Running] = useState(false);
  const [bulkOAuth2Result, setBulkOAuth2Result] = useState<any>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, any>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAcc, setNewAcc] = useState({ email: "", password: "", provider: "outlook" });
  const [addError, setAddError] = useState("");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchSmtpHost, setBatchSmtpHost] = useState("");
  const [batchSmtpPort, setBatchSmtpPort] = useState("587");
  const [batchImapHost, setBatchImapHost] = useState("");
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [showCsvInfo, setShowCsvInfo] = useState(false);
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

  // filtered + searched
  const filtered = accounts.filter((a) => {
    const matchProvider = filter === "all" || a.provider === filter;
    const matchSearch = !search || a.email.toLowerCase().includes(search.toLowerCase());
    return matchProvider && matchSearch;
  });

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
    try {
      const res = await fetch(`${API}/accounts/${id}/fetch-oauth2`, { method: "POST", headers: authHeader() });
      const data = await res.json();
      if (data.status === "ok") { alert(`OAuth2 Token für ${data.email} erfolgreich!`); fetchAccounts(); }
      else alert(`Fehler: ${data.detail || JSON.stringify(data)}`);
    } catch (e: any) { alert(`Verbindungsfehler: ${e.message}`); }
  };

  const handleBatchImport = async () => {
    const entries = batchText.trim().split(/[\s\n]+/).filter(Boolean);
    const hasCustomSmtp = batchSmtpHost.trim() !== "";
    const headers = hasCustomSmtp
      ? "email,password,smtp_host,smtp_port,imap_host,imap_port"
      : "email,password";
    const lines = entries.map((entry) => {
      const idx = entry.indexOf(":");
      if (idx === -1) return null;
      const email = entry.slice(0, idx);
      const password = entry.slice(idx + 1);
      if (hasCustomSmtp) {
        const imapHost = batchImapHost.trim() || batchSmtpHost.trim().replace(/^smtp\./, "imap.");
        return `${email},${password},${batchSmtpHost.trim()},${batchSmtpPort.trim()},${imapHost},993`;
      }
      return `${email},${password}`;
    }).filter(Boolean);
    if (lines.length === 0) return;
    const csv = headers + "\n" + lines.join("\n");
    const file = new File([csv], "batch.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", file);
    setBatchImporting(true);
    setBatchResult(null);
    try {
      const res = await fetch(`${API}/accounts/import?auto_oauth2=${autoOAuth2}`, {
        method: "POST", headers: authHeader(), body: formData,
      });
      const data = await res.json();
      setBatchResult(data);
      fetchAccounts();
    } finally { setBatchImporting(false); }
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
      setShowAddModal(false);
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold">Warming-Accounts
          <span className="ml-2 text-sm font-normal text-gray-500">({accounts.length})</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button color="gray" size="sm" onClick={() => setShowAddModal(true)}>
             Einzeln hinzufügen
          </Button>
          <Button color="purple" size="sm" onClick={() => { setShowBatchModal(true); setBatchResult(null); setBatchText(""); }}>
            Batch hinzufügen
          </Button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
          <Button color="blue" size="sm" onClick={() => fileRef.current?.click()} disabled={csvImporting}>
            {csvImporting ? <><Spinner size="xs" className="mr-1.5" /> Importiere...</> : <> CSV Import</>}
          </Button>
          <Button color="gray" size="sm" onClick={() => setShowCsvInfo(!showCsvInfo)}>
            CSV-Format
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
        {[
          { label: "Outlook", count: outlookTotal, color: "blue" as const },
          { label: "Gmail", count: gmailTotal, color: "red" as const },
          { label: "Firstmail", count: firstmailTotal, color: "green" as const },
          { label: "OAuth2", count: oauth2Count, color: "yellow" as const },
          { label: "Aktiv", count: activeCount, color: "green" as const },
        ].map((s) => (
          <Card key={s.label} className="bg-gray-900 border-gray-800 shadow-none text-center p-3">
            <p className={`text-2xl font-bold ${
              s.color === "blue" ? "text-blue-400" :
              s.color === "red" ? "text-red-400" :
              s.color === "green" ? "text-green-400" :
              s.color === "yellow" ? "text-yellow-400" : "text-gray-400"
            }`}>{s.count}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* CSV info box (collapsible) */}
      {showCsvInfo && (
        <Card className="bg-gray-900/60 border-gray-800 shadow-none mb-4">
          <p className="text-xs font-semibold text-gray-300 mb-1">CSV-Format (nur 2 Spalten nötig):</p>
          <code className="text-xs text-green-400 bg-gray-800 px-2 py-1 rounded block mb-3">email,password</code>
          <div className="space-y-1 text-xs text-gray-500 mb-3">
            <p><span className="text-blue-400 font-medium">Outlook/Hotmail</span> → Provider auto erkannt, OAuth2-Token wird automatisch geholt</p>
            <p><span className="text-red-400 font-medium">Gmail</span> → Passwort = 16-stelliges App-Passwort (Google Konto → Sicherheit → App-Passwörter)</p>
            <p><span className="text-green-400 font-medium">Firstmail</span> → Normales Passwort, SMTP Port 465 SSL</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={autoOAuth2} onChange={(e) => setAutoOAuth2(e.target.checked)} />
            <span className="text-sm text-gray-300">Outlook → OAuth2 automatisch beim Import</span>
          </label>
        </Card>
      )}

      {/* Import result */}
      {importResult && (
        <Alert color={importResult.errors?.length > 0 ? "warning" : "success"} className="mb-4">
          <div className="flex flex-wrap gap-4">
            <span className="font-bold">{importResult.created} importiert</span>
            {importResult.oauth2_tokens_fetched > 0 && <span>{importResult.oauth2_tokens_fetched}x OAuth2 aktiviert</span>}
            {importResult.errors?.length > 0 && <span>{importResult.errors.length} Fehler</span>}
          </div>
          {importResult.errors?.slice(0, 5).map((e: string, i: number) => <p key={i} className="text-xs mt-1">{e}</p>)}
        </Alert>
      )}

      {/* Bulk OAuth2 */}
      <Card className="bg-blue-900/20 border-blue-800 shadow-none mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-300">Outlook OAuth2 Batch-Umwandlung</p>
            <p className="text-xs text-gray-400 mt-0.5">Alle Outlook-Accounts mit gespeichertem Passwort → OAuth2-Token automatisch holen</p>
          </div>
          <Button color="blue" size="sm" onClick={runBulkOAuth2} disabled={bulkOAuth2Running}>
            {bulkOAuth2Running ? <><Spinner size="xs" className="mr-1.5" /> Läuft...</> : "Batch starten"}
          </Button>
        </div>
        {bulkOAuth2Result && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
            {bulkOAuth2Result.results?.map((r: any, i: number) => (
              <div key={i} className={`flex items-center gap-2 text-xs ${r.status === "ok" ? "text-green-400" : "text-red-400"}`}>
                <span>{r.status === "ok" ? "✓" : "✗"}</span>
                <span className="truncate font-mono">{r.email}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <TextInput
          placeholder="E-Mail suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
          theme={{ field: { input: { base: "block w-full border disabled:cursor-not-allowed disabled:opacity-50", colors: { gray: "bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500" } } } }}
        />
        <div className="flex gap-1.5 overflow-x-auto">
          {["all", "outlook", "gmail", "firstmail"].map((p) => (
            <Button key={p} size="xs" color={filter === p ? "blue" : "gray"} onClick={() => setFilter(p)} className="flex-shrink-0">
              {p === "all" ? `Alle (${accounts.length})` : `${p.charAt(0).toUpperCase() + p.slice(1)} (${accounts.filter(a => a.provider === p).length})`}
            </Button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-800 rounded-lg px-4 py-2.5 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-blue-300 font-semibold">{selected.size} ausgewählt</span>
          <Button size="xs" color="success" onClick={() => bulkToggle(true)}>Aktivieren</Button>
          <Button size="xs" color="warning" onClick={() => bulkToggle(false)}>Deaktivieren</Button>
          <Button size="xs" color="failure" onClick={bulkDelete}> Löschen</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-200">✕ Aufheben</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800 shadow-none">
          <div className="text-center py-8 text-gray-500">
            <p className="mb-1">{search ? `Keine Accounts für "${search}"` : "Keine Accounts"}</p>
            <p className="text-xs">CSV importieren oder einzeln hinzufügen</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            <div className="flex items-center gap-2 px-1 mb-1">
              <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} />
              <span className="text-xs text-gray-500">Alle auswählen ({filtered.length})</span>
            </div>
            {filtered.map((acc) => (
              <Card key={acc.id}
                className={`bg-gray-900 shadow-none transition-colors ${selected.has(acc.id) ? "border-blue-600" : "border-gray-800"}`}>
                <div className="flex items-start gap-3">
                  <Checkbox checked={selected.has(acc.id)} onChange={() => toggleSelect(acc.id)} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-gray-200 truncate">{acc.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge color={providerColor[acc.provider] ?? "gray"} size="xs">{acc.provider}</Badge>
                      <Badge color={acc.auth_type === "oauth2" ? "success" : acc.auth_type === "app_password" ? "warning" : "gray"} size="xs">
                        {acc.auth_type === "oauth2" ? "OAuth2 ✓" : acc.auth_type === "app_password" ? "App-PW" : "Passwort"}
                      </Badge>
                      <Badge color={acc.active ? "success" : "gray"} size="xs">{acc.active ? "Aktiv" : "Inaktiv"}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Button size="xs" color="gray" onClick={() => testConnection(acc.id)} disabled={testingId === acc.id}>
                        {testingId === acc.id ? <Spinner size="xs" /> : "Verbindung testen"}
                      </Button>
                      {testResult[acc.id] && (
                        <span className={`text-xs ${testResult[acc.id].smtp && testResult[acc.id].imap ? "text-green-400" : "text-red-400"}`}>
                          SMTP:{testResult[acc.id].smtp ? "✓" : "✗"} IMAP:{testResult[acc.id].imap ? "✓" : "✗"}
                        </span>
                      )}
                      {acc.provider === "outlook" && acc.auth_type !== "oauth2" && (
                        <Button size="xs" color="warning" onClick={() => fetchSingleOAuth2(acc.id)}>→ OAuth2</Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <TableHead className="bg-gray-800/60">
                <TableHeadCell className="w-10 px-3">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} />
                </TableHeadCell>
                <TableHeadCell className="text-gray-400">E-Mail</TableHeadCell>
                <TableHeadCell className="text-gray-400">Anbieter</TableHeadCell>
                <TableHeadCell className="text-gray-400">Auth</TableHeadCell>
                <TableHeadCell className="text-gray-400">Status</TableHeadCell>
                <TableHeadCell className="text-gray-400">Aktionen</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y divide-gray-800">
                {filtered.map((acc) => (
                  <TableRow key={acc.id} className={`bg-gray-900 hover:bg-gray-800/40 ${selected.has(acc.id) ? "bg-blue-900/10" : ""}`}>
                    <TableCell className="px-3">
                      <Checkbox checked={selected.has(acc.id)} onChange={() => toggleSelect(acc.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-300">{acc.email}</TableCell>
                    <TableCell>
                      <Badge color={providerColor[acc.provider] ?? "gray"} size="xs">{acc.provider}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge color={acc.auth_type === "oauth2" ? "success" : acc.auth_type === "app_password" ? "warning" : "gray"} size="xs">
                        {acc.auth_type === "oauth2" ? "OAuth2 ✓" : acc.auth_type === "app_password" ? "App-PW" : "Passwort"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge color={acc.active ? "success" : "gray"} size="xs">{acc.active ? "Aktiv" : "Inaktiv"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="xs" color="gray" onClick={() => testConnection(acc.id)} disabled={testingId === acc.id}>
                          {testingId === acc.id ? <Spinner size="xs" /> : "Test"}
                        </Button>
                        {testResult[acc.id] && (
                          <span className={`text-xs ${testResult[acc.id].smtp && testResult[acc.id].imap ? "text-green-400" : "text-red-400"}`}>
                            S:{testResult[acc.id].smtp ? "✓" : "✗"} I:{testResult[acc.id].imap ? "✓" : "✗"}
                          </span>
                        )}
                        {acc.provider === "outlook" && acc.auth_type !== "oauth2" && (
                          <Button size="xs" color="warning" onClick={() => fetchSingleOAuth2(acc.id)}>→OAuth2</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Batch Import Modal */}
      <Modal show={showBatchModal} onClose={() => setShowBatchModal(false)} size="lg" className="bg-gray-950/80">
        <ModalHeader className="bg-gray-900 border-gray-800 text-gray-100">Batch hinzufügen</ModalHeader>
        <ModalBody className="bg-gray-900 border-gray-800">
          <p className="text-xs text-gray-400 mb-2">
            Format: <code className="text-green-400 bg-gray-800 px-1 rounded">email:passwort</code> — durch Leerzeichen oder Zeilenumbruch getrennt
          </p>
          <Textarea
            rows={7}
            placeholder={"rdainpny@duhastmail.com:aWcfNVjzm1pvg\nlojsexxg@fuhrenmail.com:P7WEUoSC7R5ID\n..."}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            className="font-mono text-xs bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500"
          />
          {/* Custom SMTP/IMAP (optional, für custom domains) */}
          <div className="mt-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
            <p className="text-xs font-semibold text-gray-400 mb-2">SMTP/IMAP Server <span className="font-normal text-gray-500">(optional — nur für Custom-Domains)</span></p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs text-gray-400">SMTP Host</Label>
                <TextInput
                  sizing="sm"
                  placeholder="smtp.firstmail.ltd"
                  value={batchSmtpHost}
                  onChange={(e) => setBatchSmtpHost(e.target.value)}
                  className="mt-0.5"
                  theme={{ field: { input: { base: "block w-full border", colors: { gray: "bg-gray-700 border-gray-600 text-gray-100 focus:border-blue-500 focus:ring-blue-500" } } } }}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400">Port</Label>
                <TextInput
                  sizing="sm"
                  placeholder="465"
                  value={batchSmtpPort}
                  onChange={(e) => setBatchSmtpPort(e.target.value)}
                  className="mt-0.5"
                  theme={{ field: { input: { base: "block w-full border", colors: { gray: "bg-gray-700 border-gray-600 text-gray-100 focus:border-blue-500 focus:ring-blue-500" } } } }}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs text-gray-400">IMAP Host <span className="text-gray-500">(leer = smtp.→imap. auto)</span></Label>
                <TextInput
                  sizing="sm"
                  placeholder="imap.firstmail.ltd"
                  value={batchImapHost}
                  onChange={(e) => setBatchImapHost(e.target.value)}
                  className="mt-0.5"
                  theme={{ field: { input: { base: "block w-full border", colors: { gray: "bg-gray-700 border-gray-600 text-gray-100 focus:border-blue-500 focus:ring-blue-500" } } } }}
                />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-3">
            <Checkbox checked={autoOAuth2} onChange={(e) => setAutoOAuth2(e.target.checked)} />
            <span className="text-sm text-gray-300">Outlook → OAuth2 automatisch</span>
          </label>
          {batchResult && (
            <Alert color={batchResult.errors?.length > 0 ? "warning" : "success"} className="mt-3">
              <span className="font-bold">{batchResult.created} importiert</span>
              {batchResult.oauth2_tokens_fetched > 0 && <span className="ml-3">{batchResult.oauth2_tokens_fetched}x OAuth2</span>}
              {batchResult.errors?.length > 0 && <span className="ml-3">{batchResult.errors.length} Fehler</span>}
              {batchResult.errors?.slice(0, 5).map((e: string, i: number) => <p key={i} className="text-xs mt-1">{e}</p>)}
            </Alert>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button color="gray" onClick={() => setShowBatchModal(false)}>Schließen</Button>
            <Button color="purple" onClick={handleBatchImport} disabled={batchImporting || !batchText.trim()}>
              {batchImporting ? <><Spinner size="xs" className="mr-1.5" /> Importiere...</> : `${batchText.trim().split(/[\s\n]+/).filter(e => e.includes(":")).length} Accounts importieren`}
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Add Account Modal */}
      <Modal show={showAddModal} onClose={() => { setShowAddModal(false); setAddError(""); }}
        className="bg-gray-950/80">
        <ModalHeader className="bg-gray-900 border-gray-800 text-gray-100">Account hinzufügen</ModalHeader>
        <ModalBody className="bg-gray-900 border-gray-800">
          <form onSubmit={addSingle} className="space-y-4">
            <div>
              <Label htmlFor="add-email" className="text-gray-300" >E-Mail</Label>
              <TextInput
                id="add-email"
                type="email"
                required
                placeholder="name@example.com"
                value={newAcc.email}
                onChange={(e) => setNewAcc({ ...newAcc, email: e.target.value })}
                className="mt-1"
                theme={{ field: { input: { base: "block w-full border", colors: { gray: "bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500" } } } }}
              />
            </div>
            <div>
              <Label htmlFor="add-pw" className="text-gray-300" >Passwort / App-Passwort</Label>
              <TextInput
                id="add-pw"
                type="password"
                placeholder="••••••••"
                value={newAcc.password}
                onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
                className="mt-1"
                theme={{ field: { input: { base: "block w-full border", colors: { gray: "bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500" } } } }}
              />
            </div>
            <div>
              <Label htmlFor="add-provider" className="text-gray-300" >Anbieter</Label>
              <Select
                id="add-provider"
                value={newAcc.provider}
                onChange={(e) => setNewAcc({ ...newAcc, provider: e.target.value })}
                className="mt-1"
                theme={{ field: { select: { base: "block w-full border disabled:cursor-not-allowed disabled:opacity-50", colors: { gray: "bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500" } } } }}
              >
                <option value="outlook">Outlook</option>
                <option value="gmail">Gmail</option>
                <option value="firstmail">Firstmail</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            {addError && <Alert color="failure">{addError}</Alert>}
            <div className="flex gap-2 justify-end">
              <Button color="gray" onClick={() => { setShowAddModal(false); setAddError(""); }}>Abbrechen</Button>
              <Button type="submit" color="blue"> Hinzufügen</Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </Layout>
  );
}
