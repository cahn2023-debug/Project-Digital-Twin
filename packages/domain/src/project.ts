import type { ProjectId, ProjectStatus } from "./core";

export interface Project {
  id: ProjectId;
  code: string;
  name: string;
  rootPath: string;
  status: ProjectStatus;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
