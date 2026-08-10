import { useMemo, useState } from "react";
type AuditRow = {
  time: string;
  actor: string;
  operation: string;
  source: string;
  status: string;
  change: string;
};

const auditRows: AuditRow[] = [
  { time: "12:18:42", actor: "approver-1", operation: "FileImportApplied", source: "Camera.xlsx / CAMERA / 18", status: "APPLIED", change: "name: Base -> Main" },
  { time: "12:18:39", actor: "importer-1", operation: "FileImportSubmitted", source: "Camera.xlsx / CAMERA / 18", status: "PENDING_APPROVAL", change: "1 row + Raw" },
  { time: "12:16:04", actor: "software", operation: "FileWriteApplied", source: "Camera.xlsx / version 4", status: "APPLIED", change: "Status: DESIGNED -> AS_BUILT" },
  { time: "12:11:07", actor: "viewer-1", operation: "FileImportConflict", source: "Progress.xlsx / Sheet2 / 42", status: "CONFLICT", change: "name: base/server/local" },
];



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
      <Panel title="Audit search" subtitle="Project 269 - detection to import to approval to write-back">
        <div className="panel-body">
          <div className="filter-row">
            <input className="filter-input" placeholder="Project / file / object / ChangeSet" aria-label="Search audit" />
            <select className="select" value={actor} onChange={(event) => setActor(event.target.value)} aria-label="Filter actor">
              <option value="all">All actors</option><option value="approver-1">approver-1</option><option value="importer-1">importer-1</option><option value="software">software</option><option value="viewer-1">viewer-1</option>
            </select>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status">
              <option value="all">All statuses</option><option value="APPLIED">APPLIED</option><option value="PENDING_APPROVAL">PENDING_APPROVAL</option><option value="CONFLICT">CONFLICT</option>
            </select>
          </div>
        </div>
        <div className="panel-body flush table-wrap">
          <table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Operation</th><th>Source locator</th><th>Field before {"->"} after</th><th>Status</th></tr></thead><tbody>
            {filteredRows.map((row) => <tr key={row.time + row.operation}><td className="mono">{row.time}</td><td>{row.actor}</td><td className="mono">{row.operation}</td><td>{row.source}</td><td>{row.change}</td><td><StatusBadge tone={row.status === "CONFLICT" ? "danger" : row.status === "APPLIED" ? "success" : "warning"}>{row.status}</StatusBadge></td></tr>)}
          </tbody></table>
        </div>
      </Panel>
    </div>
  );
}

