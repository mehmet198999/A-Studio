import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { Alert, Badge, Button, Card, Label, Modal, ModalBody, ModalHeader, Progress, Spinner, TextInput } from "flowbite-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

interface Campaign {
  id: number;
  name: string;
  status: "active" | "paused" | "stopped";
  emails_per_day_start: number;
  emails_per_day_max: number;
  ramp_up_days: number;
  start_delay_days: number;
  current_day: number;
  start_date: string | null;
  created_at: string;
}

const statusColor: Record<string, "success" | "warning" | "gray"> = {
  active: "success",
  paused: "warning",
  stopped: "gray",
};

const statusLabel: Record<string, string> = {
  active: "Aktiv",
  paused: "Pausiert",
  stopped: "Gestoppt",
};

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({
    name: "",
    emails_per_day_start: 5,
    emails_per_day_max: 50,
    ramp_up_days: 30,
    start_delay_days: 0,
  });
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runningNow, setRunningNow] = useState<number | null>(null);
  const [runResult, setRunResult] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    const res = await fetch(`${API}/campaigns`, { headers: authHeader() });
    if (res.status === 401) { router.push("/login"); return; }
    setCampaigns(await res.json());
  };

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/campaigns`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setForm({ name: "", emails_per_day_start: 5, emails_per_day_max: 50, ramp_up_days: 30, start_delay_days: 0 });
      setShowModal(false);
      fetchCampaigns();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const action = async (id: number, act: "start" | "pause" | "stop") => {
    await fetch(`${API}/campaigns/${id}/${act}`, { method: "POST", headers: authHeader() });
    fetchCampaigns();
  };

  const runNow = async (id: number) => {
    setRunningNow(id);
    try {
      const res = await fetch(`${API}/campaigns/${id}/run-now`, { method: "POST", headers: authHeader() });
      const data = await res.json();
      setRunResult((prev) => ({ ...prev, [id]: `${data.enqueued} E-Mails eingeplant` }));
    } finally {
      setRunningNow(null);
    }
  };

  const deleteCampaign = async (id: number) => {
    if (!confirm("Kampagne wirklich löschen?")) return;
    await fetch(`${API}/campaigns/${id}`, { method: "DELETE", headers: authHeader() });
    fetchCampaigns();
  };

  const progressPercent = (c: Campaign) =>
    Math.min(100, Math.round((c.current_day / c.ramp_up_days) * 100));

  const emailsToday = (c: Campaign) => {
    const day = c.current_day;
    if (day >= c.ramp_up_days) return c.emails_per_day_max;
    const ratio = day / c.ramp_up_days;
    return Math.max(1, c.emails_per_day_start + Math.round((c.emails_per_day_max - c.emails_per_day_start) * ratio));
  };

  const inputTheme = { field: { input: { base: "block w-full border", colors: { gray: "bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500" } } } };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Kampagnen</h1>
        <Button color="blue" size="sm" onClick={() => setShowModal(true)}>
           Neue Kampagne
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800 shadow-none">
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Noch keine Kampagnen</p>
            <p className="text-sm mb-4">Erstelle eine Kampagne um das Domain-Warming zu starten</p>
            <Button color="blue" size="sm" onClick={() => setShowModal(true)}>
               Erste Kampagne erstellen
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <Card key={c.id} className="bg-gray-900 border-gray-800 shadow-none">
              {/* Title row */}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base">{c.name}</h3>
                    <Badge color={statusColor[c.status]}>{statusLabel[c.status]}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    Tag {c.current_day}/{c.ramp_up_days + c.start_delay_days} ·{" "}
                    {c.current_day < c.start_delay_days
                      ? `Vorbereitungsphase (${c.start_delay_days - c.current_day} Tage bis Start)`
                      : `Heute ca. ${emailsToday(c)} E-Mails`}
                    {c.start_date && ` · Gestartet: ${new Date(c.start_date).toLocaleDateString("de-DE")}`}
                  </p>
                </div>
                <Button size="xs" color="failure" outline onClick={() => deleteCampaign(c.id)}>
                  
                </Button>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span className="text-yellow-600">Vorbereitung ({c.start_delay_days}T)</span>
                  <span>{progressPercent(c)}% Ramp-up</span>
                  <span>{c.emails_per_day_max}/Tag max</span>
                </div>
                <Progress
                  progress={Math.round((c.current_day / (c.ramp_up_days + c.start_delay_days)) * 100)}
                  color={c.status === "active" ? "blue" : c.status === "paused" ? "yellow" : "gray"}
                  size="sm"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {c.status !== "active" && (
                  <Button size="xs" color="success" onClick={() => action(c.id, "start")}>
                     Starten
                  </Button>
                )}
                {c.status === "active" && (
                  <Button size="xs" color="warning" onClick={() => action(c.id, "pause")}>
                     Pausieren
                  </Button>
                )}
                {c.status !== "stopped" && (
                  <Button size="xs" color="failure" outline onClick={() => action(c.id, "stop")}>
                     Stoppen
                  </Button>
                )}
                <Button size="xs" color="blue" outline onClick={() => runNow(c.id)} disabled={runningNow === c.id}>
                  {runningNow === c.id ? <><Spinner size="xs" className="mr-1" /> Starte...</> : <> Jetzt ausführen</>}
                </Button>
                {runResult[c.id] && (
                  <span className="text-xs text-green-400">{runResult[c.id]}</span>
                )}
                <a href={`/logs?campaign=${c.id}`} className="text-xs text-gray-400 hover:text-gray-200 ml-auto">
                  Logs →
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal show={showModal} onClose={() => { setShowModal(false); setError(""); }} size="lg">
        <ModalHeader className="bg-gray-900 border-gray-800">Neue Kampagne erstellen</ModalHeader>
        <ModalBody className="bg-gray-900 border-gray-800">
          <form onSubmit={createCampaign} className="space-y-4">
            <div>
              <Label htmlFor="camp-name" className="text-gray-300" >Name der Kampagne</Label>
              <TextInput
                id="camp-name"
                required
                placeholder="z.B. Meine Domain Aufwärmung"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
                theme={inputTheme}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-emails" className="text-gray-300" >E-Mails/Tag (Start)</Label>
                <TextInput
                  id="start-emails"
                  type="number"
                  min={1} max={200}
                  value={form.emails_per_day_start}
                  onChange={(e) => setForm({ ...form, emails_per_day_start: Number(e.target.value) })}
                  className="mt-1"
                  theme={inputTheme}
                />
              </div>
              <div>
                <Label htmlFor="max-emails" className="text-gray-300" >E-Mails/Tag (Maximum)</Label>
                <TextInput
                  id="max-emails"
                  type="number"
                  min={1} max={500}
                  value={form.emails_per_day_max}
                  onChange={(e) => setForm({ ...form, emails_per_day_max: Number(e.target.value) })}
                  className="mt-1"
                  theme={inputTheme}
                />
              </div>
              <div>
                <Label htmlFor="ramp-days" className="text-gray-300" >Ramp-up (Tage)</Label>
                <TextInput
                  id="ramp-days"
                  type="number"
                  min={1} max={90}
                  value={form.ramp_up_days}
                  onChange={(e) => setForm({ ...form, ramp_up_days: Number(e.target.value) })}
                  className="mt-1"
                  theme={inputTheme}
                />
              </div>
              <div>
                <Label htmlFor="delay-days" className="text-gray-300" >Wartezeit (Tage)</Label>
                <TextInput
                  id="delay-days"
                  type="number"
                  min={0} max={14}
                  value={form.start_delay_days}
                  onChange={(e) => setForm({ ...form, start_delay_days: Number(e.target.value) })}
                  className="mt-1"
                  theme={inputTheme}
                />
                <p className="text-xs text-gray-600 mt-1">Empfehlung: 3–4 Tage</p>
              </div>
            </div>
            {error && <Alert color="failure">{error}</Alert>}
            <div className="flex gap-2 justify-end">
              <Button color="gray" onClick={() => { setShowModal(false); setError(""); }}>Abbrechen</Button>
              <Button type="submit" color="blue" disabled={loading}>
                {loading ? <><Spinner size="xs" className="mr-1.5" /> Erstelle...</> : <> Erstellen</>}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </Layout>
  );
}
