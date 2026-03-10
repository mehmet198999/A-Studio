import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

interface DomainEmail {
  id: number;
  domain_id: number;
  email: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  auth_type: string;
}

interface Domain {
  id: number;
  name: string;
  emails: DomainEmail[];
  created_at: string;
}

const defaultEmail = {
  email: "",
  password: "",
  smtp_host: "",
  smtp_port: 587,
  imap_host: "",
  imap_port: 993,
  auth_type: "password",
};

export default function DomainsPage() {
  const router = useRouter();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [newEmail, setNewEmail] = useState({ ...defaultEmail });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    const res = await fetch(`${API}/domains`, { headers: authHeader() });
    if (res.status === 401) { router.push("/login"); return; }
    setDomains(await res.json());
  };

  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newDomain.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/domains`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ name: newDomain.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setNewDomain("");
      fetchDomains();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteDomain = async (id: number) => {
    if (!confirm("Domain wirklich löschen?")) return;
    await fetch(`${API}/domains/${id}`, { method: "DELETE", headers: authHeader() });
    if (selectedDomain?.id === id) setSelectedDomain(null);
    fetchDomains();
  };

  const addEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomain) return;
    setError("");
    setLoading(true);
    try {
      const body = { ...newEmail };
      const res = await fetch(`${API}/domains/${selectedDomain.id}/emails`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setNewEmail({ ...defaultEmail });
      setShowEmailForm(false);
      fetchDomains();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmail = async (domainId: number, emailId: number) => {
    await fetch(`${API}/domains/${domainId}/emails/${emailId}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    fetchDomains();
  };

  const refreshSelected = (updated: Domain[]) => {
    if (selectedDomain) {
      const found = updated.find((d) => d.id === selectedDomain.id);
      if (found) setSelectedDomain(found);
    }
  };

  useEffect(() => { refreshSelected(domains); }, [domains]);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-6">Domains verwalten</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Domain list */}
        <div>
          <form onSubmit={addDomain} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="beispiel.de"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm transition-colors"
            >
              + Domain
            </button>
          </form>
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

          <div className="space-y-2">
            {domains.map((domain) => (
              <div
                key={domain.id}
                onClick={() => setSelectedDomain(domain)}
                className={`bg-gray-900 border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedDomain?.id === domain.id
                    ? "border-blue-500"
                    : "border-gray-800 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{domain.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {domain.emails.length} E-Mail-Adresse{domain.emails.length !== 1 ? "n" : ""}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteDomain(domain.id); }}
                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-900/20"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
            {domains.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">Noch keine Domains</p>
            )}
          </div>
        </div>

        {/* Right: Email addresses */}
        <div>
          {selectedDomain ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">E-Mails für {selectedDomain.name}</h2>
                <button
                  onClick={() => setShowEmailForm(!showEmailForm)}
                  className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
                >
                  + E-Mail hinzufügen
                </button>
              </div>

              {showEmailForm && (
                <form onSubmit={addEmail} className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400">E-Mail</label>
                      <input
                        type="email"
                        required
                        value={newEmail.email}
                        onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
                        className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Passwort / App-Passwort</label>
                      <input
                        type="password"
                        value={newEmail.password}
                        onChange={(e) => setNewEmail({ ...newEmail, password: e.target.value })}
                        className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">SMTP-Host</label>
                      <input
                        type="text"
                        required
                        value={newEmail.smtp_host}
                        onChange={(e) => setNewEmail({ ...newEmail, smtp_host: e.target.value })}
                        className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">SMTP-Port</label>
                      <input
                        type="number"
                        value={newEmail.smtp_port}
                        onChange={(e) => setNewEmail({ ...newEmail, smtp_port: Number(e.target.value) })}
                        className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">IMAP-Host</label>
                      <input
                        type="text"
                        required
                        value={newEmail.imap_host}
                        onChange={(e) => setNewEmail({ ...newEmail, imap_host: e.target.value })}
                        className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">IMAP-Port</label>
                      <input
                        type="number"
                        value={newEmail.imap_port}
                        onChange={(e) => setNewEmail({ ...newEmail, imap_port: Number(e.target.value) })}
                        className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm">
                      Speichern
                    </button>
                    <button type="button" onClick={() => setShowEmailForm(false)} className="text-gray-400 hover:text-gray-200 px-4 py-1.5 rounded text-sm">
                      Abbrechen
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {selectedDomain.emails.map((em) => (
                  <div key={em.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{em.email}</p>
                      <p className="text-xs text-gray-500">
                        SMTP: {em.smtp_host}:{em.smtp_port} · IMAP: {em.imap_host}:{em.imap_port}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteEmail(selectedDomain.id, em.id)}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-900/20"
                    >
                      Löschen
                    </button>
                  </div>
                ))}
                {selectedDomain.emails.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-6">Noch keine E-Mail-Adressen</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Domain auswählen um E-Mails zu verwalten
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
