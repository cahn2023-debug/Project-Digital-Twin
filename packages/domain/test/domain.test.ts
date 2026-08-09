import { strict as assert } from "node:assert";
import test from "node:test";
import type { Camera, EntityRevision } from "../src/index.js";

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
