import type { OrganizeItemRef, OrganizeLifecycleStatus, ProjectId } from "./core";

export interface OrganizeGroup {
  id: string;
  projectId: ProjectId;
  name: string;
  parentIds: string[];
  status: OrganizeLifecycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizeTag {
  id: string;
  projectId: ProjectId;
  name: string;
  createdAt: string;
}

export interface OrganizeGroupMembership {
  projectId: ProjectId;
  item: OrganizeItemRef;
  groupId: string;
  createdAt: string;
}

export interface OrganizeTagMembership {
  projectId: ProjectId;
  item: OrganizeItemRef;
  tagId: string;
  createdAt: string;
}

export interface OrganizeItemLifecycle {
  projectId: ProjectId;
  item: OrganizeItemRef;
  status: OrganizeLifecycleStatus;
  updatedAt: string;
}
