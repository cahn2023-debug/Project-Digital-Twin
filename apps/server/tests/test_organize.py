from uuid import UUID, uuid4

import pytest

from app.domain import OrganizeConflictError
from app.main import store


def setup_function() -> None:
    store.projects.clear()
    store.project_roots.clear()
    store.organize_groups.clear()
    store.organize_tags.clear()
    store.organize_group_parents.clear()
    store.organize_group_memberships.clear()
    store.organize_tag_memberships.clear()
    store.organize_item_lifecycle.clear()
    store.writeback_plans.clear()
    store.file_locks.clear()


def create_project(tmp_path, name: str) -> UUID:
    root = tmp_path / name.lower()
    root.mkdir()
    return store.create_project(name, str(root)).id


def test_groups_support_nested_multi_parent_links_and_reject_cycles(tmp_path) -> None:
    project_id = create_project(tmp_path, "organize")
    root = store.create_organize_group(project_id, "Infrastructure")
    camera_group = store.create_organize_group(project_id, "Cameras", [root.id])
    network_group = store.create_organize_group(project_id, "Network", [root.id])
    leaf = store.create_organize_group(project_id, "Field", [camera_group.id, network_group.id])

    assert set(leaf.parent_ids) == {camera_group.id, network_group.id}

    with pytest.raises(OrganizeConflictError, match="cycle"):
        store.move_organize_group(project_id, root.id, [leaf.id])


def test_bulk_memberships_tags_and_group_delete_preserve_items(tmp_path) -> None:
    project_id = create_project(tmp_path, "bulk")
    first_item = uuid4()
    second_item = uuid4()
    primary = store.create_organize_group(project_id, "Primary")
    secondary = store.create_organize_group(project_id, "Secondary")
    tag = store.create_organize_tag(project_id, "priority")

    memberships = store.assign_organize_groups(
        project_id,
        "ENTITY",
        [first_item, second_item],
        [primary.id, secondary.id],
    )
    tagged = store.assign_organize_tags(project_id, "ENTITY", [first_item, second_item], [tag.id])

    assert len(memberships) == 4
    assert len(tagged) == 2

    store.delete_organize_group(project_id, secondary.id)

    remaining = store.list_organize_group_memberships(project_id, "ENTITY")
    assert {(membership.item_id, membership.group_id) for membership in remaining} == {
        (first_item, primary.id),
        (second_item, primary.id),
    }
    assert len(store.list_organize_tag_memberships(project_id, "ENTITY")) == 2
    created_at = store.list_organize_tag_memberships(project_id, "ENTITY")[0].created_at
    store.remove_organize_tags(project_id, "ENTITY", [first_item], [tag.id])
    assert len(store.list_organize_tag_memberships(project_id, "ENTITY")) == 1
    assert store.list_organize_tag_memberships(project_id, "ENTITY")[0].created_at == created_at


def test_lifecycle_restore_keeps_memberships_and_rejects_cross_project_groups(tmp_path) -> None:
    project_id = create_project(tmp_path, "lifecycle")
    other_project_id = create_project(tmp_path, "other")
    item_id = uuid4()
    group = store.create_organize_group(project_id, "Cameras")
    other_group = store.create_organize_group(other_project_id, "Other")
    store.assign_organize_groups(project_id, "SOURCE_FILE", [item_id], [group.id])

    with pytest.raises(OrganizeConflictError, match="another project"):
        store.assign_organize_groups(project_id, "SOURCE_FILE", [item_id], [other_group.id])

    deleted = store.set_organize_item_status(project_id, "SOURCE_FILE", [item_id], "DELETED")
    assert deleted[0].status == "DELETED"
    restored = store.restore_organize_items(project_id, "SOURCE_FILE", [item_id])
    assert restored[0].status == "ACTIVE"
    assert len(store.list_organize_group_memberships(project_id, "SOURCE_FILE", {item_id})) == 1
