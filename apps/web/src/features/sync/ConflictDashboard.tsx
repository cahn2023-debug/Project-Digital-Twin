import { useEffect, useState } from "react";
import { fetchStagedConflicts, resolveStagedConflict, StagedConflictItem } from "./api";
import { Button, PageHeader, Panel, StatusBadge } from "../../shared/ui";

export function ConflictDashboard({ onAction }: { onAction: (msg: string) => void }) {
  const [conflicts, setConflicts] = useState<StagedConflictItem[]>([]);
  const [_loading, setLoading] = useState<boolean>(false);
  const [selectedConflict, setSelectedConflict] = useState<StagedConflictItem | null>(null);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const data = await fetchStagedConflicts();
      setConflicts(data.conflicts || []);
      if (data.conflicts && data.conflicts.length > 0 && !selectedConflict) {
        setSelectedConflict(data.conflicts[0]);
      }
    } catch (err: any) {
      onAction(`Conflict load notice: ${err.message || "Server offline or empty"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  const handleResolve = async (chosenClientId?: string) => {
    if (!selectedConflict) return;
    try {
      await resolveStagedConflict(selectedConflict.conflict_id, {
        chosen_client_id: chosenClientId,
        resolved_by: "Admin",
      });
      onAction(`Phê duyệt giải quyết xung đột [${selectedConflict.conflict_id}] thành công`);
      loadConflicts();
      setSelectedConflict(null);
    } catch (err: any) {
      onAction(`Lỗi khi giải quyết xung đột: ${err.message}`);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="CONFLICT RESOLUTION DASHBOARD"
        subtitle="Đối chiếu dữ liệu biến đổi từ các Desktop Client và xử lý hợp nhất (Field-level Staging)."
        status="Field-level Merge"
        tone="warning"
        actions={
          <Button primary onClick={loadConflicts}>
            Làm mới danh sách
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <Panel title="Danh sách xung đột (Staged Conflicts)" subtitle={`${conflicts.length} bản ghi đang chờ xử lý`}>
          <div className="panel-body flush table-wrap">
            {conflicts.length === 0 ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#888" }}>
                Không có xung đột dữ liệu nào cần xử lý. Tất cả dữ liệu đã được tự động hợp nhất (Auto-Merged).
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Conflict ID</th>
                    <th>Entity Type</th>
                    <th>Client ID</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map((c) => (
                    <tr
                      key={c.conflict_id}
                      style={{
                        background: selectedConflict?.conflict_id === c.conflict_id ? "#f0f4f9" : "transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedConflict(c)}
                    >
                      <td className="mono">{c.conflict_id}</td>
                      <td>
                        {c.entity_type}:{c.entity_id}
                      </td>
                      <td className="mono">{c.client_id.slice(0, 16)}...</td>
                      <td>
                        <StatusBadge tone={c.status === "RESOLVED" ? "success" : "warning"}>
                          {c.status}
                        </StatusBadge>
                      </td>
                      <td>
                        <Button onClick={() => setSelectedConflict(c)}>Chi tiết</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel
          title="Đối chiếu Side-by-Side"
          subtitle={
            selectedConflict
              ? `Bản ghi: ${selectedConflict.entity_type} (${selectedConflict.entity_id})`
              : "Chọn 1 bản ghi để so sánh"
          }
        >
          <div className="panel-body">
            {selectedConflict ? (
              <div>
                <div style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#555" }}>
                  <p>
                    <strong>Mutation ID:</strong> {selectedConflict.mutation_id}
                  </p>
                  <p>
                    <strong>Nguồn Client:</strong> {selectedConflict.client_id} (User: {selectedConflict.user_id})
                  </p>
                  <p>
                    <strong>Workspace:</strong> {selectedConflict.workspace_id}
                  </p>
                </div>

                <h4 style={{ marginBottom: "0.5rem" }}>Các trường dữ liệu xung đột:</h4>
                <table className="data-table" style={{ width: "100%", marginBottom: "1.5rem" }}>
                  <thead>
                    <tr>
                      <th>Tên trường (Field)</th>
                      <th>Giá trị Server</th>
                      <th>Giá trị Client</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(selectedConflict.conflicting_fields).map((field) => (
                      <tr key={field}>
                        <td>
                          <strong>{field}</strong>
                        </td>
                        <td style={{ color: "#d9534f" }}>
                          {JSON.stringify(selectedConflict.server_fields[field])}
                        </td>
                        <td style={{ color: "#0275d8" }}>
                          {JSON.stringify(selectedConflict.conflicting_fields[field])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {selectedConflict.status !== "RESOLVED" && (
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <Button primary onClick={() => handleResolve(selectedConflict.client_id)}>
                      Chấp nhận bản ghi Client ({selectedConflict.client_id.slice(0, 10)})
                    </Button>
                    <Button onClick={() => handleResolve(undefined)}>
                      Giữ nguyên bản ghi Server
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
                Chọn một bản ghi xung đột từ danh sách bên trái để đối chiếu dữ liệu.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
