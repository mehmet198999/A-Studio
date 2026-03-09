import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

interface Log {
  id: number;
  campaign_id: number;
  warming_account_id: number;
  domain_email_id: number;
  subject: string;
  status: string;
  sent_at: string;
  created_at: string;
}

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    const fetchData = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          fetch(`${API}/dashboard/stats`, { headers: authHeader() }),
          fetch(`${API}/logs?limit=10`, { headers: authHeader() }),
        ]);
        if (statsRes.status === 401) { router.push("/login"); return; }
        setStats(await statsRes.json());
        setLogs(await logsRes.json());
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const statusColor: Record<string, string> = {
    sent: "bg-blue-900 text-blue-300",
    received: "bg-purple-900 text-purple-300",
    opened: "bg-yellow-900 text-yellow-300",
    replied: "bg-green-900 text-green-300",
    error: "bg-red-900 text-red-300",
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Lade Dashboard...</div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Domains" value={stats.total_domains} color="blue" />
            <StatCard label="Domain-E-Mails" value={stats.total_domain_emails} color="purple" />
            <StatCard label="Warming-Accounts" value={stats.total_warming_accounts} color="yellow" />
            <StatCard label="Aktive Kampagnen" value={stats.active_campaigns} color="green" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Gesendet heute"
              value={stats.emails_sent_today}
              color="blue"
            />
            <StatCard
              label="Öffnungsrate"
              value={`${stats.open_rate}%`}
              sub={`${stats.emails_opened_today} geöffnet`}
              color="green"
            />
            <StatCard
              label="Antwortrate"
              value={`${stats.reply_rate}%`}
              sub={`${stats.emails_replied_today} beantwortet`}
              color="yellow"
            />
          </div>
        </>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold text-sm">Letzte Aktivitäten</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Betreff</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Kampagne</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Zeit</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Noch keine Aktivitäten
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-2 text-gray-300 max-w-xs truncate">{log.subject || "-"}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[log.status] || "bg-gray-800 text-gray-400"}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400">#{log.campaign_id}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(log.created_at).toLocaleString("de-DE")}
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
