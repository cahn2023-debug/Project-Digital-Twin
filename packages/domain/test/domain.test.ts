import { strict as assert } from "node:assert";
import test from "node:test";
import type {
  Camera,
  EntityRevision,
  OrganizeGroup,
  OrganizeGroupMembership,
  OrganizeItemLifecycle,
  OrganizeTag,
  OrganizeTagMembership
} from "../src/index.js";

test("domain contracts keep identity separate from revision state", () => {
  const camera: Camera = {
    entityId: "camera-1",
    projectId: "project-1",
    code: "CAM-001",
    name: null,
    intersectionId: null,
    manufacturer: null,
    model: null,
    ipAddress: null,
    status: "ACTIVE",
    properties: {}
  };
  const revision: EntityRevision = {
    id: "revision-1",
    entityId: camera.entityId,
    representation: "DESIGNED",
    revision: 1,
    data: { status: camera.status },
    geometry: null,
    createdAt: new Date().toISOString(),
    createdBy: "test",
    changesetId: null
  };

  assert.equal(revision.entityId, camera.entityId);
  assert.notEqual(revision.id, camera.entityId);
});

test("organize contracts represent multi-group classification and lifecycle", () => {
  const group: OrganizeGroup = {
    id: "group-1",
    projectId: "project-1",
    name: "Infrastructure",
    parentIds: ["group-root"],
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const tag: OrganizeTag = {
    id: "tag-1",
    projectId: group.projectId,
    name: "priority",
    createdAt: group.createdAt
  };
  const item = { type: "ENTITY" as const, id: "camera-1" };
  const groupMembership: OrganizeGroupMembership = {
    projectId: group.projectId,
    item,
    groupId: group.id,
    createdAt: group.createdAt
  };
  const tagMembership: OrganizeTagMembership = {
    projectId: group.projectId,
    item,
    tagId: tag.id,
    createdAt: group.createdAt
  };
  const lifecycle: OrganizeItemLifecycle = {
    projectId: group.projectId,
    item,
    status: "DELETED",
    updatedAt: group.updatedAt
  };

  assert.equal(groupMembership.item.id, item.id);
  assert.equal(tagMembership.tagId, tag.id);
  assert.equal(lifecycle.status, "DELETED");
});
