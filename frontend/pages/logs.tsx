import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}` };
}

interface Log {
  id: number;
  campaign_id: number;
  warming_account_id: number;
  domain_email_id: number;
  subject: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  created_at: string;
}

const statusBadge: Record<string, string> = {
  sent: "bg-blue-900/50 text-blue-300",
  received: "bg-purple-900/50 text-purple-300",
  opened: "bg-yellow-900/50 text-yellow-300",
  replied: "bg-green-900/50 text-green-300",
  error: "bg-red-900/50 text-red-300",
};

export default function LogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchLogs();
  }, [statusFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, statusFilter]);

  const fetchLogs = async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("limit", "200");

    const res = await fetch(`${API}/logs?${params}`, { headers: authHeader() });
    if (res.status === 401) { router.push("/login"); return; }
    setLogs(await res.json());
    setLoading(false);
  };

  const fmt = (dt: string | null) =>
    dt ? new Date(dt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

  const counts = logs.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Logs ({logs.length})</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-blue-500"
            />
            Auto-Refresh (10s)
          </label>
          <button onClick={fetchLogs} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded">
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {["sent", "opened", "replied", "error"].map((s) => (
          <div key={s} className={`px-3 py-1.5 rounded text-xs font-medium ${statusBadge[s] || "bg-gray-800 text-gray-400"}`}>
            {s}: {counts[s] || 0}
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["all", "sent", "received", "opened", "replied", "error"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {s === "all" ? "Alle" : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Lade Logs...</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">ID</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Betreff</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Kampagne</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Gesendet</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Geöffnet</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Beantwortet</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    Keine Logs gefunden
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-2 text-gray-500 text-xs">#{log.id}</td>
                    <td className="px-4 py-2 max-w-xs">
                      <p className="truncate text-gray-300">{log.subject || "-"}</p>
                      {log.error_message && (
                        <p className="text-red-400 text-xs truncate">{log.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[log.status] || "bg-gray-800 text-gray-400"}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">#{log.campaign_id}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{fmt(log.sent_at)}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{fmt(log.opened_at)}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{fmt(log.replied_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
