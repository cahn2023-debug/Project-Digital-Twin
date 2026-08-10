import { useMemo, useState } from "react";
type AuditRow = {
  time: string;
  actor: string;
  operation: string;
  source: string;
  status: string;
  change: string;
};

const auditRows: AuditRow[] = [];

import { Button, Icon, PageHeader, Panel, StatusBadge } from "../../shared/ui";

export function AuditView({ onAction }: { onAction: (message: string) => void }) {
  const [status, setStatus] = useState("all");
  const [actor, setActor] = useState("all");
  const filteredRows = useMemo(
    () => auditRows.filter((row) => (status === "all" || row.status === status) && (actor === "all" || row.actor === actor)),
    [actor, status],
  );
  return (
    <div className="page">
      <PageHeader
        status="Append-only"
        subtitle="Project-scoped lifecycle events with correlation chain and field before/after values."
        title="AUDIT TRAIL"
        tone="success"
        actions={<><Button onClick={() => onAction("Audit CSV export queued")}>Export CSV</Button><Button primary onClick={() => onAction("Audit filters refreshed")}>Refresh</Button></>}
      />
      <Panel title="Audit search" subtitle="Project lifecycle & operation activity logs">
        <div className="panel-body">
          <div className="filter-row">
            <input className="filter-input" placeholder="Project / file / object / ChangeSet" aria-label="Search audit" />
            <select className="select" value={actor} onChange={(event) => setActor(event.target.value)} aria-label="Filter actor">
              <option value="all">All actors</option>
            </select>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status">
              <option value="all">All statuses</option>
              <option value="APPLIED">APPLIED</option>
              <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
              <option value="CONFLICT">CONFLICT</option>
            </select>
          </div>
        </div>
        <div className="panel-body flush table-wrap">
          {filteredRows.length === 0 ? (
            <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "#888", fontSize: "0.9rem" }}>
              Chưa có nhật ký audit nào trong project. Mọi thao tác tạo/sửa dữ liệu sẽ được ghi nhận append-only tại đây.
            </div>
          ) : (
            <table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Operation</th><th>Source locator</th><th>Field before {"->"} after</th><th>Status</th></tr></thead><tbody>
              {filteredRows.map((row) => <tr key={row.time + row.operation}><td className="mono">{row.time}</td><td>{row.actor}</td><td className="mono">{row.operation}</td><td>{row.source}</td><td>{row.change}</td><td><StatusBadge tone={row.status === "CONFLICT" ? "danger" : row.status === "APPLIED" ? "success" : "warning"}>{row.status}</StatusBadge></td></tr>)}
            </tbody></table>
          )}
        </div>
      </Panel>
    </div>
  );
}

