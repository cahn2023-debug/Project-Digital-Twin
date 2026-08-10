from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Iterable, Mapping
from uuid import UUID, uuid4

from ....domain import SourceLocator, normalize_text


DataType = str


@dataclass(frozen=True)
class SchemaField:
    id: str
    name: str
    data_type: DataType
    group: str | None = None
    unit: str | None = None
    required: bool = False


@dataclass(frozen=True)
class FieldMapping:
    source_column: str
    field_id: str
    rules: tuple[Mapping[str, Any], ...] = ()


@dataclass(frozen=True)
class MappingIssue:
    code: str
    message: str
    row: int
    field_id: str | None = None
    source_column: str | None = None


@dataclass
class MappedRecord:
    entity_id: UUID
    object_type: str
    fields: dict[str, Any]
    raw: dict[str, Any]
    unmapped: dict[str, Any]
    issues: list[MappingIssue] = field(default_factory=list)
    source: SourceLocator | None = None


@dataclass(frozen=True)
class IdentityRecord:
    entity_id: UUID
    object_type: str
    name: str | None
    parent_context: str | None = None
    latitude: float | None = None
    longitude: float | None = None


@dataclass(frozen=True)
class IdentityCandidate:
    entity_id: UUID
    score: int
    reasons: tuple[str, ...]
    requires_confirmation: bool = True


def infer_data_type(values: Iterable[Any]) -> DataType:
    present = [value for value in values if value is not None and value != ""]
    if not present:
        return "text"
    if all(isinstance(value, bool) for value in present):
        return "boolean"
    if all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in present):
        return "number"
    if all(isinstance(value, (date, datetime)) for value in present):
        return "date"
    if all(str(value).strip().casefold() in {"true", "false", "yes", "no", "y", "n"} for value in present):
        return "boolean"
    try:
        for value in present:
            float(str(value).strip())
        return "number"
    except (TypeError, ValueError):
        return "text"


def infer_schema_field(name: str, values: Iterable[Any], *, group: str | None = None) -> SchemaField:
    return SchemaField(id=str(uuid4()), name=name, data_type=infer_data_type(values), group=group)


def apply_transform(value: Any, rules: Iterable[Mapping[str, Any]]) -> Any:
    result = value
    for rule in rules:
        kind = rule.get("kind")
        if kind == "trim" and result is not None:
            result = str(result).strip()
        elif kind == "upper" and result is not None:
            result = str(result).upper()
        elif kind == "lower" and result is not None:
            result = str(result).lower()
        elif kind == "replace" and result is not None:
            result = str(result).replace(str(rule.get("old", "")), str(rule.get("new", "")))
        elif kind == "regex_replace" and result is not None:
            result = re.sub(str(rule.get("pattern", "")), str(rule.get("replacement", "")), str(result))
        elif kind == "split" and result is not None:
            parts = str(result).split(str(rule.get("delimiter", ",")))
            result = parts[int(rule.get("index", 0))].strip()
        elif kind == "coalesce" and (result is None or result == ""):
            result = rule.get("value")
        else:
            if kind not in {None, "trim", "upper", "lower", "replace", "regex_replace", "split", "coalesce"}:
                raise ValueError(f"Unsupported mapping transform: {kind}")
    return result


def _convert(value: Any, data_type: DataType) -> Any:
    if value is None or value == "":
        return None
    if data_type == "text":
        return normalize_text(value)
    if data_type == "number":
        return float(value)
    if data_type == "boolean":
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().casefold()
        if normalized in {"true", "yes", "y"}:
            return True
        if normalized in {"false", "no", "n"}:
            return False
        raise ValueError("Invalid boolean")
    if data_type == "date":
        if isinstance(value, (date, datetime)):
            return value.isoformat()
        return datetime.fromisoformat(str(value).strip()).date().isoformat()
    return value


def map_record(
    raw: Mapping[str, Any],
    fields: Mapping[str, SchemaField],
    mappings: Iterable[FieldMapping],
    *,
    object_type: str,
    row: int,
    source: SourceLocator | None = None,
    object_type_column: str | None = None,
    object_type_values: Mapping[str, str] | None = None,
) -> MappedRecord:
    resolved_type = object_type
    if object_type_column and raw.get(object_type_column) is not None:
        resolved_type = (object_type_values or {}).get(str(raw[object_type_column]), str(raw[object_type_column]))

    mapped_columns: set[str] = set()
    mapped: dict[str, Any] = {}
    issues: list[MappingIssue] = []
    for mapping in mappings:
        field = fields[mapping.field_id]
        mapped_columns.add(mapping.source_column)
        value = apply_transform(raw.get(mapping.source_column), mapping.rules)
        if value is None or value == "":
            if field.required:
                issues.append(
                    MappingIssue(
                        "MISSING_REQUIRED_FIELD",
                        f"Field {field.name} is required",
                        row,
                        field.id,
                        mapping.source_column,
                    )
                )
            mapped[field.id] = None
            continue
        try:
            mapped[field.id] = _convert(value, field.data_type)
        except (TypeError, ValueError) as exc:
            issues.append(MappingIssue("INVALID_FIELD_VALUE", str(exc), row, field.id, mapping.source_column))

    return MappedRecord(
        entity_id=uuid4(),
        object_type=resolved_type,
        fields=mapped,
        raw=dict(raw),
        unmapped={key: value for key, value in raw.items() if key not in mapped_columns},
        issues=issues,
        source=source,
    )


def identity_candidates(record: IdentityRecord, existing: Iterable[IdentityRecord]) -> list[IdentityCandidate]:
    candidates: list[IdentityCandidate] = []
    normalized_name = normalize_text(record.name)
    for other in existing:
        if other.object_type != record.object_type or normalized_name != normalize_text(other.name):
            continue
        score = 2
        reasons = ["object_type", "normalized_name"]
        if record.parent_context and record.parent_context == other.parent_context:
            score += 1
            reasons.append("parent_context")
        if (
            record.latitude is not None
            and record.longitude is not None
            and record.latitude == other.latitude
            and record.longitude == other.longitude
        ):
            score += 1
            reasons.append("location")
        candidates.append(IdentityCandidate(other.entity_id, score, tuple(reasons)))
    return sorted(candidates, key=lambda candidate: (-candidate.score, str(candidate.entity_id)))
