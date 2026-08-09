CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE entities (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    entity_type TEXT NOT NULL,
    canonical_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by TEXT NOT NULL,
    UNIQUE (project_id, entity_type, canonical_code)
);

CREATE TABLE organize_groups (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (id, project_id)
);

CREATE UNIQUE INDEX organize_groups_project_name_lower
    ON organize_groups (project_id, lower(name));

CREATE TABLE organize_group_parents (
    project_id UUID NOT NULL REFERENCES projects(id),
    child_group_id UUID NOT NULL REFERENCES organize_groups(id) ON DELETE CASCADE,
    parent_group_id UUID NOT NULL REFERENCES organize_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, child_group_id, parent_group_id),
    FOREIGN KEY (child_group_id, project_id)
        REFERENCES organize_groups(id, project_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_group_id, project_id)
        REFERENCES organize_groups(id, project_id) ON DELETE CASCADE,
    CHECK (child_group_id <> parent_group_id)
);

CREATE TABLE organize_tags (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (id, project_id)
);

CREATE UNIQUE INDEX organize_tags_project_name_lower
    ON organize_tags (project_id, lower(name));

CREATE TABLE organize_group_memberships (
    project_id UUID NOT NULL REFERENCES projects(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('ENTITY', 'SOURCE_FILE', 'IMPORT')),
    item_id UUID NOT NULL,
    group_id UUID NOT NULL REFERENCES organize_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (project_id, item_type, item_id, group_id),
    FOREIGN KEY (group_id, project_id)
        REFERENCES organize_groups(id, project_id) ON DELETE CASCADE
);

CREATE TABLE organize_tag_memberships (
    project_id UUID NOT NULL REFERENCES projects(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('ENTITY', 'SOURCE_FILE', 'IMPORT')),
    item_id UUID NOT NULL,
    tag_id UUID NOT NULL REFERENCES organize_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (project_id, item_type, item_id, tag_id),
    FOREIGN KEY (tag_id, project_id)
        REFERENCES organize_tags(id, project_id) ON DELETE CASCADE
);

CREATE TABLE organize_item_lifecycle (
    project_id UUID NOT NULL REFERENCES projects(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('ENTITY', 'SOURCE_FILE', 'IMPORT')),
    item_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DELETED')),
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (project_id, item_type, item_id)
);

CREATE TABLE entity_revisions (
    id UUID PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES entities(id),
    representation TEXT NOT NULL CHECK (representation IN ('DESIGNED', 'AS_BUILT')),
    revision INTEGER NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    geometry geometry(Point, 4326),
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    created_by TEXT NOT NULL,
    changeset_id UUID,
    UNIQUE (entity_id, representation, revision)
);

CREATE UNIQUE INDEX entity_revisions_one_current
    ON entity_revisions (entity_id, representation)
    WHERE valid_to IS NULL;

CREATE TABLE source_files (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    logical_role TEXT NOT NULL,
    authority_mode TEXT NOT NULL,
    parser_profile TEXT NOT NULL,
    writer_profile TEXT NOT NULL
);

CREATE TABLE file_locations (
    file_id UUID NOT NULL REFERENCES source_files(id),
    client_id TEXT NOT NULL,
    absolute_path TEXT NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (file_id, client_id)
);

CREATE TABLE file_versions (
    id UUID PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES source_files(id),
    revision INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    size BIGINT NOT NULL,
    modified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE changesets (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    origin TEXT NOT NULL,
    submitted_by TEXT NOT NULL,
    submitted_at TIMESTAMPTZ,
    status TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE change_items (
    changeset_id UUID NOT NULL REFERENCES changesets(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    representation TEXT NOT NULL,
    base_revision INTEGER NOT NULL,
    patch JSONB NOT NULL,
    change_type TEXT NOT NULL,
    PRIMARY KEY (changeset_id, entity_id, representation)
);

CREATE TABLE outbox_events (
    event_id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    aggregate_version INTEGER NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id),
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ
);

CREATE TABLE contractors (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    UNIQUE (project_id, code)
);

CREATE TABLE work_packages (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    contractor_id UUID NOT NULL REFERENCES contractors(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    UNIQUE (project_id, code)
);

CREATE TABLE work_package_entities (
    work_package_id UUID NOT NULL REFERENCES work_packages(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    PRIMARY KEY (work_package_id, entity_id)
);

CREATE TABLE field_packages (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    work_package_id UUID NOT NULL REFERENCES work_packages(id),
    status TEXT NOT NULL
);

CREATE TABLE observations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    field_package_id UUID NOT NULL REFERENCES field_packages(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    base_revision INTEGER NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    operator_id TEXT NOT NULL,
    gps JSONB,
    form_data JSONB NOT NULL,
    status TEXT NOT NULL,
    changeset_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE
);

CREATE TABLE file_write_jobs (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    file_id UUID NOT NULL REFERENCES source_files(id),
    expected_file_revision INTEGER NOT NULL,
    entity_revision UUID NOT NULL,
    status TEXT NOT NULL
);
