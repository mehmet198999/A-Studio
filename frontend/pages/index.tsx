import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

interface Stats {
  total_domains: number;
  total_domain_emails: number;
  total_warming_accounts: number;
  active_campaigns: number;
  emails_sent_today: number;
  emails_opened_today: number;
  emails_replied_today: number;
  open_rate: number;
  reply_rate: number;
}

interface DailyPoint {
  date: string;
  sent: number;
  opened: number;
  replied: number;
  errors: number;
}

interface BlacklistResult {
  name: string;
  listed: boolean;
  detail: string | null;
}

interface DnsRecord {
  record: string;
  found: boolean;
  value: string | null;
}

interface DomainRep {
  domain: string;
  mx: DnsRecord;
  spf: DnsRecord;
  dkim: DnsRecord;
  dmarc: DnsRecord;
  blacklists: BlacklistResult[];
  score: number;
  score_label: string;
}

interface Domain {
  id: number;
  name: string;
}

// ── Mini bar chart (pure SVG, no deps) ───────────────────────────────────────
function BarChart({ data }: { data: DailyPoint[] }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map((d) => d.sent), 1);
  const W = 600;
  const H = 120;
  const pad = { left: 30, right: 10, top: 10, bottom: 24 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = Math.max(2, chartW / data.length - 3);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + chartH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#374151" strokeWidth={0.5} />
            {frac > 0 && (
              <text x={pad.left - 3} y={y + 3} fontSize={8} fill="#6B7280" textAnchor="end">
                {Math.round(maxVal * frac)}
              </text>
            )}
          </g>
        );
      })}

      {data.map((d, i) => {
        const x = pad.left + (i / data.length) * chartW + 1;
        const sentH = (d.sent / maxVal) * chartH;
        const openH = (d.opened / maxVal) * chartH;
        const repH = (d.replied / maxVal) * chartH;
        const errH = (d.errors / maxVal) * chartH;

        return (
          <g key={i}>
            {/* Sent bar (blue) */}
            <rect
              x={x}
              y={pad.top + chartH - sentH}
              width={barW}
              height={sentH}
              fill="#3B82F6"
              opacity={0.7}
              rx={1}
            />
            {/* Opened bar (yellow, overlay) */}
            <rect
              x={x}
              y={pad.top + chartH - openH}
              width={barW * 0.6}
              height={openH}
              fill="#F59E0B"
              opacity={0.85}
              rx={1}
            />
            {/* Replied bar (green, overlay) */}
            <rect
              x={x + barW * 0.4}
              y={pad.top + chartH - repH}
              width={barW * 0.6}
              height={repH}
              fill="#10B981"
              opacity={0.85}
              rx={1}
            />
            {/* Error marker */}
            {d.errors > 0 && (
              <rect
                x={x}
                y={pad.top}
                width={barW}
                height={errH}
                fill="#EF4444"
                opacity={0.5}
                rx={1}
              />
            )}
            {/* X-axis label */}
            {i % Math.ceil(data.length / 7) === 0 && (
              <text
                x={x + barW / 2}
                y={H - 4}
                fontSize={8}
                fill="#9CA3AF"
                textAnchor="middle"
              >
                {d.date}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Donut chart for rates ─────────────────────────────────────────────────────
function DonutChart({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <svg width={80} height={80} viewBox="0 0 80 80">
        <circle cx={40} cy={40} r={r} fill="none" stroke="#1F2937" strokeWidth={10} />
        <circle
          cx={40}
          cy={40}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
        />
        <text x={40} y={44} textAnchor="middle" fontSize={13} fontWeight="bold" fill="white">
          {value}%
        </text>
      </svg>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

// ── Score gauge ───────────────────────────────────────────────────────────────
function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex flex-col items-center">
      <svg width={70} height={42} viewBox="0 0 70 42">
        <path d="M 5 40 A 30 30 0 0 1 65 40" fill="none" stroke="#1F2937" strokeWidth={8} strokeLinecap="round" />
        <path
          d="M 5 40 A 30 30 0 0 1 65 40"
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 94} 94`}
        />
        <text x={35} y={35} textAnchor="middle" fontSize={12} fontWeight="bold" fill="white">
          {score}
        </text>
      </svg>
      <p className="text-xs font-medium mt-0.5" style={{ color }}>{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [reps, setReps] = useState<Record<number, DomainRep>>({});
  const [loadingRep, setLoadingRep] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [sRes, dRes, domRes] = await Promise.all([
        fetch(`${API}/dashboard/stats`, { headers: authHeader() }),
        fetch(`${API}/dashboard/daily-stats?days=14`, { headers: authHeader() }),
        fetch(`${API}/domains`, { headers: authHeader() }),
      ]);
      if (sRes.status === 401) { router.push("/login"); return; }
      setStats(await sRes.json());
      setDaily(await dRes.json());
      setDomains(await domRes.json());
    } finally {
      setLoading(false);
    }
  };

  const checkReputation = async (domain: Domain) => {
    setLoadingRep(domain.id);
    try {
      const res = await fetch(`${API}/domains/${domain.id}/reputation`, { headers: authHeader() });
      const data = await res.json();
      setReps((prev) => ({ ...prev, [domain.id]: data }));
    } finally {
      setLoadingRep(null);
    }
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64 text-gray-500">Lade Dashboard...</div>
    </Layout>
  );

  const totalSent = daily.reduce((a, d) => a + d.sent, 0);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <button onClick={fetchAll} className="text-xs text-gray-500 hover:text-gray-300">
          Aktualisieren
        </button>
      </div>

      {/* ── Top stat cards ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Domains" value={stats.total_domains} color="blue" />
          <StatCard label="Domain-E-Mails" value={stats.total_domain_emails} color="purple" />
          <StatCard label="Warming-Accounts" value={stats.total_warming_accounts} color="yellow" />
          <StatCard label="Aktive Kampagnen" value={stats.active_campaigns} color="green" />
        </div>
      )}

      {/* ── Today's activity + rates ── */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Heute</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Gesendet</span>
                <span className="text-blue-400 font-bold text-lg">{stats.emails_sent_today}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Geöffnet</span>
                <span className="text-yellow-400 font-bold text-lg">{stats.emails_opened_today}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Beantwortet</span>
                <span className="text-green-400 font-bold text-lg">{stats.emails_replied_today}</span>
              </div>
              <div className="pt-2 border-t border-gray-800 text-xs text-gray-500">
                Gesamt (14 Tage): {totalSent} E-Mails
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col items-center justify-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Öffnungsrate</p>
            <DonutChart value={stats.open_rate} color="#F59E0B" label={`${stats.open_rate}% geöffnet`} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col items-center justify-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Antwortrate</p>
            <DonutChart value={stats.reply_rate} color="#10B981" label={`${stats.reply_rate}% beantwortet`} />
          </div>
        </div>
      )}

      {/* ── Bar chart ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">E-Mails der letzten 14 Tage</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Gesendet</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> Geöffnet</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Beantwortet</span>
          </div>
        </div>
        {daily.length > 0 ? (
          <BarChart data={daily} />
        ) : (
          <div className="flex items-center justify-center h-24 text-gray-600 text-sm">
            Noch keine Daten – Kampagne starten um zu beginnen
          </div>
        )}
      </div>

      {/* ── Domain Reputation ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="font-semibold text-sm mb-4">Domain-Reputation (kostenlose DNS-Checks)</h2>
        {domains.length === 0 ? (
          <p className="text-gray-500 text-sm">Noch keine Domains vorhanden.</p>
        ) : (
          <div className="space-y-4">
            {domains.map((domain) => {
              const rep = reps[domain.id];
              return (
                <div key={domain.id} className="border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{domain.name}</span>
                      {rep && <ScoreGauge score={rep.score} label={rep.score_label} />}
                    </div>
                    <button
                      onClick={() => checkReputation(domain)}
                      disabled={loadingRep === domain.id}
                      className="text-xs bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      {loadingRep === domain.id ? "Prüfe..." : rep ? "Erneut prüfen" : "Reputation prüfen"}
                    </button>
                  </div>

                  {rep && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* DNS records */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">DNS-Einträge</p>
                        <div className="space-y-1.5">
                          {[rep.mx, rep.spf, rep.dkim, rep.dmarc].map((rec) => (
                            <div key={rec.record} className="flex items-start gap-2">
                              <span className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                                rec.found ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"
                              }`}>
                                {rec.found ? "✓" : "✗"}
                              </span>
                              <div>
                                <span className="text-xs font-medium text-gray-300">{rec.record}</span>
                                {rec.value && (
                                  <p className="text-xs text-gray-600 font-mono truncate max-w-xs">{rec.value}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Blacklists */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                          Blacklists ({rep.blacklists.filter(b => b.listed).length} gelistet)
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          {rep.blacklists.map((bl) => (
                            <div
                              key={bl.name}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                                bl.listed
                                  ? "bg-red-900/40 text-red-300"
                                  : "bg-gray-800/60 text-gray-500"
                              }`}
                            >
                              <span>{bl.listed ? "⚠" : "✓"}</span>
                              <span className="truncate">{bl.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
