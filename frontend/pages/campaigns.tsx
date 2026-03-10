import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

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

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({
    name: "",
    emails_per_day_start: 5,
    emails_per_day_max: 50,
    ramp_up_days: 30,
    start_delay_days: 3,
  });
  const [showForm, setShowForm] = useState(false);
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
      setForm({ name: "", emails_per_day_start: 5, emails_per_day_max: 50, ramp_up_days: 30 });
      setShowForm(false);
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

  const statusBadge: Record<string, string> = {
    active: "bg-green-900/50 text-green-300 border border-green-700",
    paused: "bg-yellow-900/50 text-yellow-300 border border-yellow-700",
    stopped: "bg-gray-800 text-gray-400 border border-gray-700",
  };

  const progressPercent = (c: Campaign) =>
    Math.min(100, Math.round((c.current_day / c.ramp_up_days) * 100));

  const emailsToday = (c: Campaign) => {
    const day = c.current_day;
    if (day >= c.ramp_up_days) return c.emails_per_day_max;
    const ratio = day / c.ramp_up_days;
    return Math.max(1, c.emails_per_day_start + Math.round((c.emails_per_day_max - c.emails_per_day_start) * ratio));
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Kampagnen</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded transition-colors"
        >
          + Neue Kampagne
        </button>
      </div>

      {showForm && (
        <form onSubmit={createCampaign} className="bg-gray-900 border border-gray-700 rounded-lg p-5 mb-6">
          <h2 className="font-semibold mb-4">Neue Kampagne erstellen</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="col-span-2 md:col-span-4">
              <label className="text-xs text-gray-400">Name der Kampagne</label>
              <input
                type="text"
                required
                placeholder="z.B. Meine Domain Aufwärmung"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">E-Mails/Tag (Start)</label>
              <input
                type="number"
                min={1}
                max={200}
                value={form.emails_per_day_start}
                onChange={(e) => setForm({ ...form, emails_per_day_start: Number(e.target.value) })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">E-Mails/Tag (Maximum)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={form.emails_per_day_max}
                onChange={(e) => setForm({ ...form, emails_per_day_max: Number(e.target.value) })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Ramp-up (Tage)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={form.ramp_up_days}
                onChange={(e) => setForm({ ...form, ramp_up_days: Number(e.target.value) })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Wartezeit (Tage)</label>
              <input
                type="number"
                min={0}
                max={14}
                value={form.start_delay_days}
                onChange={(e) => setForm({ ...form, start_delay_days: Number(e.target.value) })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">Tage vor erstem Send (Empfehlung: 3–4)</p>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm">
              Kampagne erstellen
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-200 px-4 py-2 rounded text-sm">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Noch keine Kampagnen</p>
            <p className="text-sm">Erstellen Sie eine Kampagne um das Domain-Warming zu starten</p>
          </div>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-base">{c.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[c.status]}`}>
                      {c.status === "active" ? "Aktiv" : c.status === "paused" ? "Pausiert" : "Gestoppt"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Tag {c.current_day}/{c.ramp_up_days + c.start_delay_days} · {
                      c.current_day < c.start_delay_days
                        ? `Vorbereitungsphase (${c.start_delay_days - c.current_day} Tage bis Start)`
                        : `Heute ca. ${emailsToday(c)} E-Mails`
                    }
                    {c.start_date && ` · Gestartet: ${new Date(c.start_date).toLocaleDateString("de-DE")}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteCampaign(c.id)}
                  className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                >
                  Löschen
                </button>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span className="text-yellow-600">Vorbereitung ({c.start_delay_days}T)</span>
                  <span>{progressPercent(c)}% Ramp-up</span>
                  <span>{c.emails_per_day_max} E-Mails/Tag</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                  {/* Delay phase indicator */}
                  <div
                    className="h-full bg-yellow-700 rounded-l-full"
                    style={{ width: `${(c.start_delay_days / (c.start_delay_days + c.ramp_up_days)) * 100}%` }}
                  />
                  {/* Ramp-up progress */}
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${progressPercent(c) * (c.ramp_up_days / (c.start_delay_days + c.ramp_up_days))}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {c.status !== "active" && (
                  <button
                    onClick={() => action(c.id, "start")}
                    className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
                  >
                    Starten
                  </button>
                )}
                {c.status === "active" && (
                  <button
                    onClick={() => action(c.id, "pause")}
                    className="bg-yellow-700 hover:bg-yellow-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
                  >
                    Pausieren
                  </button>
                )}
                {c.status !== "stopped" && (
                  <button
                    onClick={() => action(c.id, "stop")}
                    className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded transition-colors"
                  >
                    Stoppen
                  </button>
                )}
                <button
                  onClick={() => runNow(c.id)}
                  disabled={runningNow === c.id}
                  className="bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded transition-colors"
                >
                  {runningNow === c.id ? "Starte..." : "Jetzt ausführen"}
                </button>
                {runResult[c.id] && (
                  <span className="text-xs text-green-400">{runResult[c.id]}</span>
                )}
                <a
                  href={`/logs?campaign=${c.id}`}
                  className="text-xs text-gray-400 hover:text-gray-200 ml-2"
                >
                  Logs anzeigen →
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
