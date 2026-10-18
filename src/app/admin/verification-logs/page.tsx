"use client";

import { useEffect, useState } from "react";
import { AdminSearch } from "@/components/admin/admin-search";
import { readJson } from "@/lib/http";
import { matchesSearch } from "@/lib/search";

type Log = {
  id: string;
  method: string;
  outcome: string;
  tokenHint: string;
  serial: string | null;
  regaliaId: string | null;
  memberName: string | null;
  ip: string | null;
  createdAt: string;
};

export default function VerificationLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [totals, setTotals] = useState({ success: 0, unknown: 0, blocked: 0 });
  const [query, setQuery] = useState("");
  const visible = logs.filter((log) =>
    matchesSearch(query, [log.memberName, log.method, log.outcome, log.ip], [log.regaliaId, log.serial, log.tokenHint]),
  );

  async function load() {
    const data = await fetch("/api/admin/verification-logs").then((r) =>
      readJson<{ logs?: Log[]; totals: typeof totals }>(r),
    );
    if (data && Array.isArray(data.logs)) {
      setLogs(data.logs);
      setTotals(data.totals);
    }
  }

  useEffect(() => {
    load();
    const t = window.setInterval(load, 8000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1d2630]">Verification</h1>
      <p className="mt-1 text-sm text-[#5b6b79]">QR and NFC scan log.</p>

      <div className="datta-card mt-6 overflow-hidden">
        <div className="datta-flat is-three">
          <Metric label="Successful" value={totals.success} />
          <Metric label="Unknown tokens" value={totals.unknown} />
          <Metric label="Blocked / revoked" value={totals.blocked} />
        </div>
      </div>

      <AdminSearch
        className="mt-6"
        value={query}
        onChange={setQuery}
        placeholder="Search member, REGALIA ID, card serial, outcome or IP"
        count={`${visible.length} of ${logs.length}`}
      />

      <div className="datta-card mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="datta-thead text-[11px] uppercase tracking-[0.14em]">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Identity</th>
              <th className="px-4 py-3">Serial</th>
              <th className="px-4 py-3">Token</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((log) => (
              <tr key={log.id} className="border-t border-warm-white/10">
                <td className="px-4 py-3 text-warm-white/50">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">{log.method}</td>
                <td className="px-4 py-3 text-champagne">{log.outcome}</td>
                <td className="px-4 py-3">
                  {log.regaliaId || "—"}
                  {log.memberName ? (
                    <span className="block text-xs text-warm-white/40">
                      {log.memberName}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{log.serial || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-warm-white/45">
                  {log.tokenHint}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-warm-white/40">
                  {logs.length
                    ? "No scans match this search."
                    : "No scans yet. Open a member card verification link to generate a log."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="datta-flat-cell">
      <div className="min-w-0">
        <p className="datta-flat-label">{label}</p>
        <p className="datta-flat-value">{value}</p>
      </div>
    </div>
  );
}
