import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { Alert, Button, Card, Label, Modal, ModalBody, ModalHeader, TextInput } from "flowbite-react";

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

const inputTheme = {
  field: {
    input: {
      base: "block w-full border",
      colors: { gray: "bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500" },
    },
  },
};

export default function DomainsPage() {
  const router = useRouter();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [newEmail, setNewEmail] = useState({ ...defaultEmail });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);

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
      const res = await fetch(`${API}/domains/${selectedDomain.id}/emails`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(newEmail),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setNewEmail({ ...defaultEmail });
      setShowEmailModal(false);
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

  useEffect(() => {
    if (selectedDomain) {
      const found = domains.find((d) => d.id === selectedDomain.id);
      if (found) setSelectedDomain(found);
    }
  }, [domains]);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-6">Domains verwalten</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Domain list */}
        <div>
          <form onSubmit={addDomain} className="flex gap-2 mb-4">
            <TextInput
              type="text"
              placeholder="beispiel.de"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="flex-1"
              theme={inputTheme}
            />
            <Button type="submit" color="blue" disabled={loading}>
               Domain
            </Button>
          </form>
          {error && !showEmailModal && <Alert color="failure" className="mb-3">{error}</Alert>}

          <div className="space-y-2">
            {domains.map((domain) => (
              <div
                key={domain.id}
                onClick={() => setSelectedDomain(domain)}
                className={`cursor-pointer rounded-lg p-4 border transition-colors ${
                  selectedDomain?.id === domain.id
                    ? "bg-blue-900/20 border-blue-600"
                    : "bg-gray-900 border-gray-800 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{domain.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {domain.emails.length} E-Mail-Adresse{domain.emails.length !== 1 ? "n" : ""}
                    </p>
                  </div>
                  <Button
                    size="xs"
                    color="failure"
                    outline
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); deleteDomain(domain.id); }}
                  >
                    
                  </Button>
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
                <h2 className="font-semibold">E-Mails für <span className="text-blue-400">{selectedDomain.name}</span></h2>
                <Button size="sm" color="success" onClick={() => { setError(""); setShowEmailModal(true); }}>
                   E-Mail hinzufügen
                </Button>
              </div>

              <div className="space-y-2">
                {selectedDomain.emails.map((em) => (
                  <Card key={em.id} className="bg-gray-900 border-gray-800 shadow-none">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{em.email}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          SMTP: {em.smtp_host}:{em.smtp_port} · IMAP: {em.imap_host}:{em.imap_port}
                        </p>
                      </div>
                      <Button
                        size="xs"
                        color="failure"
                        outline
                        onClick={() => deleteEmail(selectedDomain.id, em.id)}
                        className="flex-shrink-0"
                      >
                        
                      </Button>
                    </div>
                  </Card>
                ))}
                {selectedDomain.emails.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <p>Noch keine E-Mail-Adressen</p>
                    <Button size="sm" color="success" className="mt-3" onClick={() => setShowEmailModal(true)}>
                       Erste E-Mail hinzufügen
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              ← Domain auswählen um E-Mails zu verwalten
            </div>
          )}
        </div>
      </div>

      {/* Add Email Modal */}
      <Modal show={showEmailModal} onClose={() => { setShowEmailModal(false); setError(""); }} size="lg">
        <ModalHeader className="bg-gray-900 border-gray-800">
          E-Mail hinzufügen für {selectedDomain?.name}
        </ModalHeader>
        <ModalBody className="bg-gray-900 border-gray-800">
          <form onSubmit={addEmail} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="em-email" className="text-gray-300" >E-Mail-Adresse</Label>
                <TextInput
                  id="em-email"
                  type="email"
                  required
                  placeholder="info@beispiel.de"
                  value={newEmail.email}
                  onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
                  className="mt-1"
                  theme={inputTheme}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="em-pw" className="text-gray-300" >Passwort / App-Passwort</Label>
                <TextInput
                  id="em-pw"
                  type="password"
                  placeholder="••••••••"
                  value={newEmail.password}
                  onChange={(e) => setNewEmail({ ...newEmail, password: e.target.value })}
                  className="mt-1"
                  theme={inputTheme}
                />
              </div>
              <div>
                <Label htmlFor="em-smtp" className="text-gray-300" >SMTP-Host</Label>
                <TextInput
                  id="em-smtp"
                  required
                  placeholder="smtp.beispiel.de"
                  value={newEmail.smtp_host}
                  onChange={(e) => setNewEmail({ ...newEmail, smtp_host: e.target.value })}
                  className="mt-1"
                  theme={inputTheme}
                />
              </div>
              <div>
                <Label htmlFor="em-smtp-port" className="text-gray-300" >SMTP-Port</Label>
                <TextInput
                  id="em-smtp-port"
                  type="number"
                  value={newEmail.smtp_port}
                  onChange={(e) => setNewEmail({ ...newEmail, smtp_port: Number(e.target.value) })}
                  className="mt-1"
                  theme={inputTheme}
                />
              </div>
              <div>
                <Label htmlFor="em-imap" className="text-gray-300" >IMAP-Host</Label>
                <TextInput
                  id="em-imap"
                  required
                  placeholder="imap.beispiel.de"
                  value={newEmail.imap_host}
                  onChange={(e) => setNewEmail({ ...newEmail, imap_host: e.target.value })}
                  className="mt-1"
                  theme={inputTheme}
                />
              </div>
              <div>
                <Label htmlFor="em-imap-port" className="text-gray-300" >IMAP-Port</Label>
                <TextInput
                  id="em-imap-port"
                  type="number"
                  value={newEmail.imap_port}
                  onChange={(e) => setNewEmail({ ...newEmail, imap_port: Number(e.target.value) })}
                  className="mt-1"
                  theme={inputTheme}
                />
              </div>
            </div>
            {error && <Alert color="failure">{error}</Alert>}
            <div className="flex gap-2 justify-end">
              <Button color="gray" onClick={() => { setShowEmailModal(false); setError(""); }}>Abbrechen</Button>
              <Button type="submit" color="blue" disabled={loading}>
                 Speichern
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </Layout>
  );
}
