import { useEffect, useMemo, useState, type ReactNode } from "react";
import { requestJson } from "../../shared/api";
import { Button, Icon, PageHeader, Panel, StatusBadge } from "../../shared/ui";
import type { Tone } from "../../shared/types";

type OrganizeItemType = "ENTITY" | "SOURCE_FILE" | "IMPORT";
type OrganizeLifecycle = "ACTIVE" | "ARCHIVED" | "DELETED";

type OrganizeApiGroup = {
  id: string;
  project_id: string;
  name: string;
  parent_ids: string[];
  status: OrganizeLifecycle;
  created_at: string;
  updated_at: string;
};

type OrganizeApiTag = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
};

type OrganizeApiItem = {
  type: OrganizeItemType;
  id: string;
  name: string;
  code: string | null;
  status: OrganizeLifecycle;
  group_ids: string[];
  tag_ids: string[];
  metadata: Record<string, unknown>;
  source: Record<string, unknown> | null;
  source_file_id: string | null;
  file_revision: number | null;
  source_path: string | null;
  import_status: string | null;
};

type OrganizeSnapshot = {
  groups: OrganizeApiGroup[];
  tags: OrganizeApiTag[];
  items: OrganizeApiItem[];
};

const emptyOrganizeSnapshot: OrganizeSnapshot = { groups: [], tags: [], items: [] };

function organizeItemKey(item: Pick<OrganizeApiItem, "type" | "id">) {
  return `${item.type}:${item.id}`;
}

function organizeTypeLabel(type: OrganizeItemType) {
  return type === "ENTITY" ? "Object" : type === "SOURCE_FILE" ? "Source file" : "Import";
}

function organizeStatusTone(status: OrganizeLifecycle): Tone {
  return status === "ACTIVE" ? "success" : status === "ARCHIVED" ? "warning" : "danger";
}

function formatOrganizeValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function OrganizeView({ onAction, onAddDataSource, onCreateProject, projectId }: { onAction: (message: string) => void; onAddDataSource?: () => void; onCreateProject?: () => void; projectId: string | null }) {
  const [snapshot, setSnapshot] = useState<OrganizeSnapshot>(emptyOrganizeSnapshot);
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState<OrganizeItemType | "ALL">("ALL");
  const [status, setStatus] = useState<OrganizeLifecycle | "ALL">("ACTIVE");
  const [groupFilterId, setGroupFilterId] = useState("");
  const [tagFilterId, setTagFilterId] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupParentId, setNewGroupParentId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [membershipGroupId, setMembershipGroupId] = useState("");
  const [membershipTagId, setMembershipTagId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionResults, setActionResults] = useState<Record<string, "success" | "error">>({});
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setSnapshot(emptyOrganizeSnapshot);
      setLoading(false);
      setError("");
      return () => { cancelled = true; };
    }

    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (itemType !== "ALL") params.set("item_type", itemType);
    if (status !== "ALL") params.set("status", status);
    if (groupFilterId) params.set("group_id", groupFilterId);
    if (tagFilterId) params.set("tag_id", tagFilterId);
    const suffix = params.toString() ? `?${params.toString()}` : "";

    setLoading(true);
    setError("");
    requestJson<OrganizeSnapshot>(`/api/v1/projects/${projectId}/organize${suffix}`)
      .then((nextSnapshot) => { if (!cancelled) setSnapshot(nextSnapshot); })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Unable to load Organize data"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [groupFilterId, itemType, projectId, query, reloadToken, status, tagFilterId]);

  const selectedItems = useMemo(
    () => snapshot.items.filter((item) => selectedKeys.includes(organizeItemKey(item))),
    [selectedKeys, snapshot.items],
  );
  const selectedItem = snapshot.items.find((item) => organizeItemKey(item) === selectedKey) ?? selectedItems[0] ?? null;
  const selectedType = selectedItems.length > 0 && selectedItems.every((item) => item.type === selectedItems[0].type) ? selectedItems[0].type : null;
  const allVisibleSelected = snapshot.items.length > 0 && snapshot.items.every((item) => selectedKeys.includes(organizeItemKey(item)));
  const groupsById = useMemo(() => new Map(snapshot.groups.map((group) => [group.id, group])), [snapshot.groups]);
  const tagsById = useMemo(() => new Map(snapshot.tags.map((tag) => [tag.id, tag])), [snapshot.tags]);
  const childrenByParent = useMemo(() => {
    const children = new Map<string, OrganizeApiGroup[]>();
    for (const group of snapshot.groups) {
      for (const parentId of group.parent_ids) children.set(parentId, [...(children.get(parentId) ?? []), group]);
    }
    for (const value of children.values()) value.sort((left, right) => left.name.localeCompare(right.name));
    return children;
  }, [snapshot.groups]);
  const rootGroups = useMemo(
    () => snapshot.groups.filter((group) => group.parent_ids.every((parentId) => !groupsById.has(parentId))).sort((left, right) => left.name.localeCompare(right.name)),
    [groupsById, snapshot.groups],
  );

  useEffect(() => {
    setSelectedKeys((current) => current.filter((key) => snapshot.items.some((item) => organizeItemKey(item) === key)));
    if (selectedKey && !snapshot.items.some((item) => organizeItemKey(item) === selectedKey)) setSelectedKey("");
  }, [selectedKey, snapshot.items]);

  const toggleSelection = (item: OrganizeApiItem) => {
    const key = organizeItemKey(item);
    setSelectedKey(key);
    setSelectedKeys((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  };

  const selectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedKeys([]);
      setSelectedKey("");
      return;
    }
    setSelectedKeys(snapshot.items.map(organizeItemKey));
    if (snapshot.items[0]) setSelectedKey(organizeItemKey(snapshot.items[0]));
  };

  const runMutation = async (itemIds: string[], itemTypeForMutation: OrganizeItemType, body: Record<string, unknown>, successMessage: string) => {
    if (!projectId || itemIds.length === 0) return;
    setBusy(true);
    setError("");
    setActionMessage("");
    const keys = selectedItems.filter((item) => itemIds.includes(item.id)).map(organizeItemKey);
    const endpoint = body.operation === "lifecycle" ? "lifecycle" : "memberships";
    try {
      await requestJson<OrganizeSnapshot>(`/api/v1/projects/${projectId}/organize/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({ item_type: itemTypeForMutation, item_ids: itemIds, ...body }),
      });
      setActionResults((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, "success" as const])) }));
      setActionMessage(successMessage);
      setReloadToken((value) => value + 1);
      onAction(successMessage);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Organize action failed";
      setActionResults((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, "error" as const])) }));
      setActionMessage(message);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const applyMembership = (operation: "add" | "remove") => {
    if (!selectedType) {
      setActionMessage(selectedItems.length > 1 ? "Select items of one type for a bulk action." : "Select at least one item.");
      return;
    }
    if (!membershipGroupId && !membershipTagId) {
      setActionMessage("Choose a group or tag first.");
      return;
    }
    void runMutation(selectedItems.map((item) => item.id), selectedType, {
      operation,
      group_ids: membershipGroupId ? [membershipGroupId] : [],
      tag_ids: membershipTagId ? [membershipTagId] : [],
    }, `${selectedItems.length} ${selectedItems.length === 1 ? "item" : "items"} ${operation === "add" ? "classified" : "unlinked"}`);
  };

  const updateLifecycle = (nextStatus: "ACTIVE" | "ARCHIVED") => {
    if (!selectedType) {
      setActionMessage(selectedItems.length > 1 ? "Select items of one type for a bulk action." : "Select at least one item.");
      return;
    }
    void runMutation(selectedItems.map((item) => item.id), selectedType, { status: nextStatus, operation: "lifecycle" }, `${selectedItems.length} ${selectedItems.length === 1 ? "item" : "items"} ${nextStatus === "ARCHIVED" ? "archived" : "restored"}`);
  };

  const createGroup = async () => {
    if (!projectId || !newGroupName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await requestJson<OrganizeApiGroup>(`/api/v1/projects/${projectId}/organize/groups`, { method: "POST", body: JSON.stringify({ name: newGroupName.trim(), parent_ids: newGroupParentId ? [newGroupParentId] : [] }) });
      setNewGroupName("");
      setActionMessage("Group created");
      setReloadToken((value) => value + 1);
      onAction("Group created");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create group");
    } finally {
      setBusy(false);
    }
  };

  const createTag = async () => {
    if (!projectId || !newTagName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await requestJson<OrganizeApiTag>(`/api/v1/projects/${projectId}/organize/tags`, { method: "POST", body: JSON.stringify({ name: newTagName.trim() }) });
      setNewTagName("");
      setActionMessage("Tag created");
      setReloadToken((value) => value + 1);
      onAction("Tag created");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create tag");
    } finally {
      setBusy(false);
    }
  };

  const deleteSelectedGroup = async () => {
    if (!projectId || !groupFilterId || !window.confirm("Delete this group and keep its data?")) return;
    setBusy(true);
    setError("");
    try {
      await requestJson<{ group_id: string; status: string }>(`/api/v1/projects/${projectId}/organize/groups/${groupFilterId}`, { method: "DELETE" });
      setGroupFilterId("");
      setNewGroupParentId("");
      setActionMessage("Group deleted; items were kept");
      setReloadToken((value) => value + 1);
      onAction("Group deleted; items were kept");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete group");
    } finally {
      setBusy(false);
    }
  };

  const renderGroup = (group: OrganizeApiGroup, path: string[]): ReactNode => {
    const nextPath = [...path, group.id];
    const children = (childrenByParent.get(group.id) ?? []).filter((child) => !nextPath.includes(child.id));
    const count = snapshot.items.filter((item) => item.group_ids.includes(group.id)).length;
    return <li key={`${group.id}-${path.join("/")}`} role="treeitem" aria-selected={groupFilterId === group.id}>
      <div className="organize-tree-row"><button className={"organize-tree-button" + (groupFilterId === group.id ? " active" : "")} type="button" aria-pressed={groupFilterId === group.id} onClick={() => setGroupFilterId(groupFilterId === group.id ? "" : group.id)}><Icon name="chevron" size={12} /><span>{group.name}</span><small>{count}</small></button></div>
      {children.length > 0 ? <ul role="group">{children.map((child) => renderGroup(child, nextPath))}</ul> : null}
    </li>;
  };

  return <div className="page">
    <PageHeader status={loading ? "Loading" : `${snapshot.items.length} items`} subtitle="Classify canonical objects, source files and imports with project-scoped groups, tags and reversible lifecycle actions." title="ORGANIZE" tone={error ? "danger" : "info"} actions={<Button onClick={() => setReloadToken((value) => value + 1)}><Icon name="refresh" size={14} />Refresh</Button>} />
    {error ? <div className="organize-alert" role="alert">{error}</div> : null}
    {actionMessage ? <div className="organize-result" role="status">{actionMessage}</div> : null}
    {!projectId ? <div className="organize-empty" role="status"><div>Create or select an active project to organize data.</div>{onCreateProject ? <Button primary onClick={onCreateProject}><Icon name="plus" size={13} />Create project</Button> : null}</div> : null}
    {projectId ? <div className="grid-12 organize-layout">
      <Panel className="col-3" title="Groups" subtitle="Multi-parent tree"><div className="panel-body organize-tree-panel">
        <div className="organize-create-row"><input className="filter-input" value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="New group name" aria-label="New group name" /><select className="select" value={newGroupParentId} onChange={(event) => setNewGroupParentId(event.target.value)} aria-label="Parent group"><option value="">Root group</option>{snapshot.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select><Button primary onClick={() => void createGroup()}>Add group</Button></div>
        {groupFilterId ? <div className="organize-tree-actions"><Button onClick={() => void deleteSelectedGroup()}>Delete group</Button><button className="text-button" type="button" onClick={() => setGroupFilterId("")}>Clear selection</button></div> : null}
        <ul className="organize-tree" role="tree" aria-label="Organize groups">{rootGroups.map((group) => renderGroup(group, []))}</ul>
        {snapshot.groups.length === 0 ? <div className="organize-muted">No groups yet.</div> : null}
        <div className="organize-tag-create"><label htmlFor="organize-new-tag">Tags</label><div className="organize-create-row"><input id="organize-new-tag" className="filter-input" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="New tag" aria-label="New tag name" /><Button onClick={() => void createTag()}>Add tag</Button></div></div>
        <div className="organize-tag-list" aria-label="Project tags">{snapshot.tags.map((tag) => <button className={"organize-tag-chip" + (tagFilterId === tag.id ? " active" : "")} type="button" key={tag.id} aria-pressed={tagFilterId === tag.id} onClick={() => setTagFilterId(tagFilterId === tag.id ? "" : tag.id)}>{tag.name}</button>)}{snapshot.tags.length === 0 ? <span className="organize-muted">No tags yet.</span> : null}</div>
      </div></Panel>

      <Panel className="col-5" title="Unified data" subtitle="Objects, source files and imports"><div className="panel-body organize-list-panel">
        <div className="organize-filter-grid"><label className="organize-field"><span>Search</span><input className="filter-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, code, source..." aria-label="Search Organize data" /></label><label className="organize-field"><span>Type</span><select className="select" value={itemType} onChange={(event) => setItemType(event.target.value as OrganizeItemType | "ALL")} aria-label="Filter item type"><option value="ALL">All types</option><option value="ENTITY">Objects</option><option value="SOURCE_FILE">Source files</option><option value="IMPORT">Imports</option></select></label><label className="organize-field"><span>Lifecycle</span><select className="select" value={status} onChange={(event) => setStatus(event.target.value as OrganizeLifecycle | "ALL")} aria-label="Filter lifecycle"><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option><option value="DELETED">Trash</option><option value="ALL">All statuses</option></select></label></div>
        <div className="organize-selection-bar"><label><input checked={allVisibleSelected} onChange={selectAllVisible} type="checkbox" aria-label="Select all visible items" /> Select all</label><span>{selectedItems.length} selected</span>{selectedType ? <StatusBadge tone="info">{organizeTypeLabel(selectedType)}</StatusBadge> : selectedItems.length > 1 ? <StatusBadge tone="warning">Mixed types</StatusBadge> : null}</div>
        {loading ? <div className="organize-empty">Loading Organize data...</div> : null}
        {!loading && snapshot.items.length === 0 ? <div className="organize-empty"><div>No data yet. Add a source folder to start organizing.</div>{onAddDataSource ? <Button primary onClick={onAddDataSource}><Icon name="plus" size={13} />Add data source</Button> : null}</div> : null}
        {!loading && snapshot.items.length > 0 ? <div className="organize-item-list" role="list" aria-label="Unified Organize items">{snapshot.items.map((item) => { const key = organizeItemKey(item); const result = actionResults[key]; return <div className={"organize-item-row" + (selectedKey === key ? " selected" : "")} key={key} role="listitem"><input checked={selectedKeys.includes(key)} onChange={() => toggleSelection(item)} type="checkbox" aria-label={`Select ${item.name}`} /><button className="organize-item-main" type="button" onClick={() => { setSelectedKey(key); setSelectedKeys((current) => current.includes(key) ? current : [...current, key]); }}><span className="organize-item-title"><strong>{item.name}</strong>{item.code ? <span className="mono">{item.code}</span> : null}</span><span className="organize-item-meta">{organizeTypeLabel(item.type)} {item.source_path ? `• ${item.source_path}` : "• No source path"}</span></button><StatusBadge tone={organizeStatusTone(item.status)}>{item.status}</StatusBadge>{result ? <span className={"organize-action-result " + result}>{result === "success" ? "Updated" : "Error"}</span> : null}</div>; })}</div> : null}
      </div></Panel>

      <Panel className="col-4" title="Details & actions" subtitle={selectedItem ? organizeTypeLabel(selectedItem.type) : "Select an item"}><div className="panel-body organize-detail-panel">
        {selectedItems.length > 0 ? <><div className="organize-action-grid"><select className="select" value={membershipGroupId} onChange={(event) => setMembershipGroupId(event.target.value)} aria-label="Group membership action"><option value="">Choose group</option>{snapshot.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select><select className="select" value={membershipTagId} onChange={(event) => setMembershipTagId(event.target.value)} aria-label="Tag membership action"><option value="">Choose tag</option>{snapshot.tags.map((tag) => <option value={tag.id} key={tag.id}>{tag.name}</option>)}</select><Button primary onClick={() => applyMembership("add")}>Assign</Button><Button onClick={() => applyMembership("remove")}>Unlink</Button><Button onClick={() => updateLifecycle("ARCHIVED")}>Archive</Button><Button onClick={() => updateLifecycle("ACTIVE")}>Restore</Button></div>{selectedItems.length > 1 && !selectedType ? <div className="organize-action-note">Bulk actions require items of the same type.</div> : null}</> : <div className="organize-empty">Select one or more items to manage groups, tags or lifecycle.</div>}
        {selectedItem ? <><div className="organize-detail-head"><div><div className="panel-title">{selectedItem.name}</div><div className="meta-line">{selectedItem.code ?? selectedItem.id}</div></div><StatusBadge tone={organizeStatusTone(selectedItem.status)}>{selectedItem.status}</StatusBadge></div><dl className="organize-properties"><div><dt>Type</dt><dd>{organizeTypeLabel(selectedItem.type)}</dd></div><div><dt>Source</dt><dd>{selectedItem.source_path ?? "Not linked"}</dd></div><div><dt>Revision</dt><dd>{selectedItem.file_revision ?? "—"}</dd></div><div><dt>Groups</dt><dd>{selectedItem.group_ids.map((id) => groupsById.get(id)?.name ?? id).join(", ") || "None"}</dd></div><div><dt>Tags</dt><dd>{selectedItem.tag_ids.map((id) => tagsById.get(id)?.name ?? id).join(", ") || "None"}</dd></div></dl><div className="organize-metadata"><div className="subsection-title">Metadata</div>{Object.entries(selectedItem.metadata).slice(0, 8).map(([key, value]) => <div className="organize-metadata-row" key={key}><span>{key}</span><strong>{formatOrganizeValue(value)}</strong></div>)}</div></> : null}
        {busy ? <div className="organize-muted" role="status">Saving...</div> : null}
      </div></Panel>
    </div> : null}
  </div>;
}


