from uuid import uuid4

import pytest

from app.mapping import (
    FieldMapping,
    IdentityRecord,
    SchemaField,
    apply_transform,
    identity_candidates,
    infer_data_type,
    map_record,
)


def test_mapping_infers_types_applies_rules_and_keeps_unmapped_raw() -> None:
    fields = {
        "name": SchemaField("name", "Name", "text", required=True),
        "count": SchemaField("count", "Count", "number"),
    }
    record = map_record(
        {"Name": "  Main  ", "Count": "2", "Note": "keep"},
        fields,
        [
            FieldMapping("Name", "name", ({"kind": "trim"},)),
            FieldMapping("Count", "count", ()),
        ],
        object_type="Camera",
        row=4,
    )

    assert record.fields == {"name": "Main", "count": 2.0}
    assert record.unmapped == {"Note": "keep"}
    assert record.raw["Note"] == "keep"
    assert not record.issues


def test_mapping_reports_required_and_invalid_values() -> None:
    fields = {"active": SchemaField("active", "Active", "boolean", required=True)}
    record = map_record(
        {"Active": "maybe"},
        fields,
        [FieldMapping("Active", "active")],
        object_type="Camera",
        row=8,
    )
    assert record.fields == {}
    assert [issue.code for issue in record.issues] == ["INVALID_FIELD_VALUE"]

    missing = map_record(
        {},
        fields,
        [FieldMapping("Active", "active")],
        object_type="Camera",
        row=9,
    )
    assert [issue.code for issue in missing.issues] == ["MISSING_REQUIRED_FIELD"]


def test_identity_candidates_require_confirmation_and_rank_context() -> None:
    entity_id = uuid4()
    candidates = identity_candidates(
        IdentityRecord(entity_id=uuid4(), object_type="Camera", name=" Main ", parent_context="NG-01", latitude=1, longitude=2),
        [
            IdentityRecord(entity_id=entity_id, object_type="Camera", name="Main", parent_context="NG-01", latitude=1, longitude=2),
            IdentityRecord(entity_id=uuid4(), object_type="Camera", name="Main", parent_context="NG-02"),
        ],
    )
    assert candidates[0].entity_id == entity_id
    assert candidates[0].score == 4
    assert candidates[0].requires_confirmation


def test_transform_rules_are_deterministic_and_reject_unknown_rules() -> None:
    assert apply_transform(" a-1 ", [{"kind": "trim"}, {"kind": "upper"}, {"kind": "replace", "old": "-", "new": "/"}]) == "A/1"
    assert infer_data_type([1, 2.5]) == "number"
    with pytest.raises(ValueError, match="Unsupported mapping transform"):
        apply_transform("value", [{"kind": "execute"}])
