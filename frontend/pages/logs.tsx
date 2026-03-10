import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { Badge, Button, Card, Spinner, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "flowbite-react";

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

const statusColor: Record<string, "blue" | "purple" | "warning" | "success" | "failure" | "gray"> = {
  sent: "blue",
  received: "purple",
  opened: "warning",
  replied: "success",
  error: "failure",
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
    dt ? new Date(dt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–";

  const counts = logs.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold">Logs <span className="text-sm font-normal text-gray-500">({logs.length})</span></h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 accent-blue-500" />
            Auto (10s)
          </label>
          <Button color="gray" size="xs" onClick={fetchLogs}>
            
          </Button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {["sent", "opened", "replied", "error"].map((s) => (
          <Badge key={s} color={statusColor[s] ?? "gray"}>
            {s}: {counts[s] || 0}
          </Badge>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {["all", "sent", "received", "opened", "replied", "error"].map((s) => (
          <Button key={s} size="xs" color={statusFilter === s ? "blue" : "gray"} onClick={() => setStatusFilter(s)}>
            {s === "all" ? "Alle" : s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3 text-gray-500">
          <Spinner size="md" /> Lade Logs...
        </div>
      ) : logs.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800 shadow-none">
          <div className="text-center py-12 text-gray-500">Keine Logs gefunden</div>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-2">
            {logs.map((log) => (
              <Card key={log.id} className="bg-gray-900 border-gray-800 shadow-none">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <Badge color={statusColor[log.status] ?? "gray"} size="xs">{log.status}</Badge>
                  <span className="text-xs text-gray-600">#{log.id} · Kamp. #{log.campaign_id}</span>
                </div>
                <p className="text-sm text-gray-300 truncate">{log.subject || "–"}</p>
                {log.error_message && <p className="text-red-400 text-xs mt-1 line-clamp-2">{log.error_message}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  {log.sent_at && <span>↑ {fmt(log.sent_at)}</span>}
                  {log.opened_at && <span>👁 {fmt(log.opened_at)}</span>}
                  {log.replied_at && <span>↩ {fmt(log.replied_at)}</span>}
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <TableHead className="bg-gray-800/50">
                <TableHeadCell className="text-gray-400">ID</TableHeadCell>
                <TableHeadCell className="text-gray-400">Betreff</TableHeadCell>
                <TableHeadCell className="text-gray-400">Status</TableHeadCell>
                <TableHeadCell className="text-gray-400">Kampagne</TableHeadCell>
                <TableHeadCell className="text-gray-400">Gesendet</TableHeadCell>
                <TableHeadCell className="text-gray-400">Geöffnet</TableHeadCell>
                <TableHeadCell className="text-gray-400">Beantwortet</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y divide-gray-800">
                {logs.map((log) => (
                  <TableRow key={log.id} className="bg-gray-900 hover:bg-gray-800/30">
                    <TableCell className="text-gray-500 text-xs">#{log.id}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-gray-300 text-sm">{log.subject || "–"}</p>
                      {log.error_message && <p className="text-red-400 text-xs truncate">{log.error_message}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge color={statusColor[log.status] ?? "gray"} size="xs">{log.status}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-400 text-xs">#{log.campaign_id}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{fmt(log.sent_at)}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{fmt(log.opened_at)}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{fmt(log.replied_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Layout>
  );
}
