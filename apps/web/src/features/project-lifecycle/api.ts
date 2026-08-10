import type { Project, ProjectStatus } from "@project/domain";

export type ApiProject = {
  id: string;
  code: string;
  name: string;
  root_path: string;
  status: ProjectStatus;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

export function toProject(project: ApiProject): Project {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    rootPath: project.root_path,
    status: project.status,
    schemaVersion: project.schema_version,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}
