from __future__ import annotations

import hashlib
import mimetypes
import posixpath
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import unquote, urlparse
from uuid import UUID, uuid4
from xml.etree import ElementTree

import olefile


@dataclass(frozen=True)
class DocumentLocator:
    file_id: UUID
    file_revision: int
    source_path: str
    line: int | None = None
    column: int | None = None
    part: str | None = None


@dataclass(frozen=True)
class DocumentNode:
    kind: str
    text: str
    locator: DocumentLocator
    level: int | None = None
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class DocumentTable:
    headers: list[str]
    rows: list[dict[str, Any]]
    locator: DocumentLocator


@dataclass(frozen=True)
class DocumentAsset:
    id: UUID
    file_id: UUID
    file_revision: int
    name: str
    media_type: str
    sha256: str
    size: int
    version: int
    locator: DocumentLocator
    source_path: str
    embedded: bool


@dataclass(frozen=True)
class RelationshipProposal:
    id: UUID
    source_reference: str
    relationship_type: str
    target_entity_id: str | None
    candidate_entity_ids: list[str]
    confidence: float
    status: str
    requires_confirmation: bool
    evidence: list[dict[str, Any]]


@dataclass(frozen=True)
class DocumentParseResult:
    file_id: UUID
    file_revision: int
    format: str
    source_hash: str
    nodes: list[DocumentNode]
    tables: list[DocumentTable]
    links: list[dict[str, Any]]
    assets: list[DocumentAsset]
    references: list[dict[str, Any]]
    relationship_proposals: list[RelationshipProposal]
    mapped_tables: list[dict[str, Any]] = field(default_factory=list)


@dataclass(frozen=True)
class DocumentChangeSet:
    id: UUID
    project_id: UUID
    file_id: UUID
    file_revision: int
    source_hash: str
    status: str
    submitted_by: str
    raw_nodes: list[DocumentNode]
    tables: list[DocumentTable]
    assets: list[DocumentAsset]
    relationship_proposals: list[RelationshipProposal]


_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_LIST = re.compile(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+?)\s*$")
_LINK = re.compile(r"(?<!!)(?:\[([^\]]+)\])\(([^)]+)\)")
_IMAGE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_WIKI_REFERENCE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
_UUID = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b")
_TABLE_SEPARATOR = re.compile(r"^:?-{3,}:?$")
_WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def _locator(file_id: UUID, revision: int, path: Path, line: int | None, part: str | None = None) -> DocumentLocator:
    return DocumentLocator(file_id, revision, str(path), line=line, part=part)


def _split_table_line(line: str) -> list[str]:
    stripped = line.strip()
    if "|" in stripped:
        stripped = stripped.strip("|")
        return [cell.strip() for cell in stripped.split("|")]
    return [cell.strip() for cell in stripped.split("\t")]


def _is_table_separator(line: str) -> bool:
    cells = _split_table_line(line)
    return len(cells) > 0 and all(_TABLE_SEPARATOR.fullmatch(cell) for cell in cells)


def _normalized(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def _asset_from_bytes(
    *,
    file_id: UUID,
    revision: int,
    name: str,
    data: bytes,
    locator: DocumentLocator,
    source_path: str,
    embedded: bool,
) -> DocumentAsset:
    return DocumentAsset(
        id=uuid4(),
        file_id=file_id,
        file_revision=revision,
        name=name,
        media_type=mimetypes.guess_type(name)[0] or "application/octet-stream",
        sha256=hashlib.sha256(data).hexdigest(),
        size=len(data),
        version=1,
        locator=locator,
        source_path=source_path,
        embedded=embedded,
    )


def _linked_asset(
    target: str,
    *,
    file_id: UUID,
    revision: int,
    source_path: Path,
    locator: DocumentLocator,
    embedded: bool = False,
) -> DocumentAsset | None:
    parsed = urlparse(target)
    if parsed.scheme in {"http", "https", "mailto"}:
        return None
    candidate = (source_path.parent / unquote(parsed.path)).resolve()
    if not candidate.is_file():
        return None
    data = candidate.read_bytes()
    return _asset_from_bytes(
        file_id=file_id,
        revision=revision,
        name=candidate.name,
        data=data,
        locator=locator,
        source_path=str(candidate),
        embedded=embedded,
    )


def _extract_references(text: str, locator: DocumentLocator) -> list[dict[str, Any]]:
    references: list[dict[str, Any]] = []
    for match in _WIKI_REFERENCE.finditer(text):
        references.append({
            "reference": match.group(1).strip(),
            "label": (match.group(2) or match.group(1)).strip(),
            "locator": locator,
        })
    for match in _UUID.finditer(text):
        if not any(item["reference"] == match.group(0) for item in references):
            references.append({"reference": match.group(0), "label": match.group(0), "locator": locator})
    return references


def _parse_markdown_like(
    path: Path,
    file_id: UUID,
    file_revision: int,
    text: str,
) -> tuple[list[DocumentNode], list[DocumentTable], list[dict[str, Any]], list[DocumentAsset], list[dict[str, Any]]]:
    nodes: list[DocumentNode] = []
    tables: list[DocumentTable] = []
    links: list[dict[str, Any]] = []
    assets: list[DocumentAsset] = []
    references: list[dict[str, Any]] = []
    lines = text.splitlines()
    index = 0
    while index < len(lines):
        line_number = index + 1
        line = lines[index]
        location = _locator(file_id, file_revision, path, line_number)
        if not line.strip():
            index += 1
            continue
        heading = _HEADING.match(line)
        if heading:
            nodes.append(DocumentNode("heading", heading.group(2), location, len(heading.group(1))))
        elif index + 1 < len(lines) and _is_table_separator(lines[index + 1]):
            headers = _split_table_line(line)
            row_index = index + 2
            rows: list[dict[str, Any]] = []
            while row_index < len(lines) and lines[row_index].strip() and ("|" in lines[row_index] or "\t" in lines[row_index]):
                values = _split_table_line(lines[row_index])
                rows.append({header: values[position] if position < len(values) else None for position, header in enumerate(headers)})
                row_index += 1
            table = DocumentTable(headers, rows, location)
            tables.append(table)
            nodes.append(DocumentNode("table", line, location, attributes={"headers": headers, "row_count": len(rows)}))
            index = row_index - 1
        else:
            list_item = _LIST.match(line)
            if list_item:
                nodes.append(DocumentNode("list_item", list_item.group(1), location))
            else:
                metadata = re.match(r"^([A-Za-z][\w -]{0,80}):\s*(.+)$", line)
                kind = "metadata" if metadata else "paragraph"
                attributes = {"key": metadata.group(1).strip()} if metadata else {}
                nodes.append(DocumentNode(kind, metadata.group(2) if metadata else line.strip(), location, attributes=attributes))
        for image in _IMAGE.finditer(line):
            asset = _linked_asset(image.group(2), file_id=file_id, revision=file_revision, source_path=path, locator=location)
            if asset is not None:
                assets.append(asset)
        for link in _LINK.finditer(line):
            links.append({"label": link.group(1), "target": link.group(2), "locator": location})
            asset = _linked_asset(link.group(2), file_id=file_id, revision=file_revision, source_path=path, locator=location)
            if asset is not None and asset.media_type not in {"text/markdown", "text/plain"}:
                assets.append(asset)
        references.extend(_extract_references(line, location))
        index += 1
    return nodes, tables, links, assets, references


def _word_text(element: ElementTree.Element) -> str:
    return "".join(element.itertext()).strip()


def _word_relationships(archive: zipfile.ZipFile) -> dict[str, str]:
    try:
        root = ElementTree.fromstring(archive.read("word/_rels/document.xml.rels"))
    except KeyError:
        return {}
    relationships: dict[str, str] = {}
    for relation in root.findall(f"{{{_PACKAGE_REL_NS}}}Relationship"):
        target = relation.attrib.get("Target", "")
        if urlparse(target).scheme:
            resolved_target = target
        else:
            resolved_target = posixpath.normpath(posixpath.join("word", target))
        relationships[relation.attrib.get("Id", "")] = resolved_target
    return relationships


def _parse_word(
    path: Path,
    file_id: UUID,
    file_revision: int,
) -> tuple[list[DocumentNode], list[DocumentTable], list[dict[str, Any]], list[DocumentAsset], list[dict[str, Any]]]:
    nodes: list[DocumentNode] = []
    tables: list[DocumentTable] = []
    links: list[dict[str, Any]] = []
    assets: list[DocumentAsset] = []
    references: list[dict[str, Any]] = []
    with zipfile.ZipFile(path) as archive:
        root = ElementTree.fromstring(archive.read("word/document.xml"))
        relationships = _word_relationships(archive)
        body = root.find(f"{{{_WORD_NS}}}body")
        if body is None:
            return nodes, tables, links, assets, references
        paragraph_number = 0
        for child in list(body):
            location = _locator(file_id, file_revision, path, paragraph_number or 1, "word/document.xml")
            if child.tag == f"{{{_WORD_NS}}}p":
                paragraph_number += 1
                location = _locator(file_id, file_revision, path, paragraph_number, "word/document.xml")
                text = _word_text(child)
                if not text:
                    continue
                style = child.find(f"./{{{_WORD_NS}}}pPr/{{{_WORD_NS}}}pStyle")
                style_name = style.attrib.get(f"{{{_WORD_NS}}}val", "") if style is not None else ""
                heading = re.fullmatch(r"Heading([1-6])", style_name, flags=re.IGNORECASE)
                kind = "heading" if heading else "paragraph"
                nodes.append(DocumentNode(kind, text, location, int(heading.group(1)) if heading else None))
                for hyperlink in child.iter(f"{{{_WORD_NS}}}hyperlink"):
                    relationship_id = hyperlink.attrib.get(f"{{{_REL_NS}}}id")
                    if relationship_id and relationship_id in relationships:
                        links.append({"label": _word_text(hyperlink), "target": relationships[relationship_id], "locator": location})
                for blip in child.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}blip"):
                    relationship_id = blip.attrib.get(f"{{{_REL_NS}}}embed")
                    target = relationships.get(relationship_id or "")
                    if target and target in archive.namelist():
                        data = archive.read(target)
                        assets.append(_asset_from_bytes(
                            file_id=file_id,
                            revision=file_revision,
                            name=Path(target).name,
                            data=data,
                            locator=location,
                            source_path=f"{path}!/{target}",
                            embedded=True,
                        ))
                references.extend(_extract_references(text, location))
            elif child.tag == f"{{{_WORD_NS}}}tbl":
                rows: list[dict[str, Any]] = []
                for row in child.findall(f"{{{_WORD_NS}}}tr"):
                    cells = [_word_text(cell) for cell in row.findall(f"{{{_WORD_NS}}}tc")]
                    if cells:
                        rows.append({f"column_{position + 1}": value for position, value in enumerate(cells)})
                if rows:
                    headers = list(rows[0])
                    tables.append(DocumentTable(headers, rows[1:] or rows, location))
                    nodes.append(DocumentNode("table", " ".join(rows[0].values()), location, attributes={"headers": headers, "row_count": len(rows)}))
        for name in archive.namelist():
            if name.startswith("word/embeddings/") and not any(asset.source_path.endswith(name) for asset in assets):
                data = archive.read(name)
                assets.append(_asset_from_bytes(
                    file_id=file_id,
                    revision=file_revision,
                    name=Path(name).name,
                    data=data,
                    locator=_locator(file_id, file_revision, path, None, name),
                    source_path=f"{path}!/{name}",
                    embedded=True,
                ))
    return nodes, tables, links, assets, references


def _legacy_word_text(path: Path) -> str:
    try:
        with olefile.OleFileIO(path) as compound:
            stream = compound.openstream(["WordDocument"]).read()
    except (OSError, olefile.OleFileError) as exc:
        raise ValueError(f"Unable to read legacy Word document: {exc}") from exc

    candidates: list[tuple[int, int, str]] = []
    for offset in (0, 1):
        current: list[str] = []
        start = offset
        index = offset
        while index + 1 < len(stream):
            code = int.from_bytes(stream[index:index + 2], "little")
            if code in {9, 10, 13} or 0x20 <= code <= 0x0FFF:
                if not current:
                    start = index
                current.append(chr(code))
            elif len(current) >= 4:
                candidates.append((len(current), start, "".join(current).replace("\r", "\n")))
                current = []
            else:
                current = []
            index += 2
        if len(current) >= 4:
            candidates.append((len(current), start, "".join(current).replace("\r", "\n")))

    current = []
    start = 0
    for index, byte in enumerate(stream):
        if byte in {9, 10, 13} or 0x20 <= byte <= 0x7E or 0xA0 <= byte <= 0xFF:
            if not current:
                start = index
            current.append(chr(byte))
        elif len(current) >= 8:
            candidates.append((len(current), start, "".join(current).replace("\r", "\n")))
            current = []
        else:
            current = []
    if len(current) >= 8:
        candidates.append((len(current), start, "".join(current).replace("\r", "\n")))

    candidates.sort(key=lambda item: (-item[0], item[1]))
    return candidates[0][2] if candidates else ""


def _parse_legacy_word(
    path: Path,
    file_id: UUID,
    file_revision: int,
) -> tuple[list[DocumentNode], list[DocumentTable], list[dict[str, Any]], list[DocumentAsset], list[dict[str, Any]]]:
    text = _legacy_word_text(path)
    nodes = [
        DocumentNode(
            kind="paragraph",
            text=line.strip(),
            locator=_locator(file_id, file_revision, path, index + 1, "WordDocument"),
        )
        for index, line in enumerate(text.splitlines())
        if line.strip()
    ]
    if not nodes:
        raise ValueError("Legacy Word document contains no readable text")
    return nodes, [], [], [], []


def _propose_relationships(
    references: Iterable[dict[str, Any]],
    canonical_entities: Iterable[Mapping[str, Any]],
) -> list[RelationshipProposal]:
    entities = list(canonical_entities)
    proposals: list[RelationshipProposal] = []
    for reference in references:
        value = str(reference["reference"]).strip()
        normalized = _normalized(value)
        exact: list[Mapping[str, Any]] = []
        for entity in entities:
            entity_id = entity.get("id") or entity.get("entity_id") or entity.get("uuid")
            code = entity.get("code") or entity.get("key")
            name = entity.get("name")
            if entity_id is not None and _normalized(entity_id) == normalized:
                exact.append(entity)
            elif code is not None and _normalized(code) == normalized:
                exact.append(entity)
        if not exact:
            exact = [entity for entity in entities if _normalized(entity.get("name")) == normalized]
        candidate_ids = [str(entity.get("id") or entity.get("entity_id") or entity.get("uuid")) for entity in exact]
        target = candidate_ids[0] if len(candidate_ids) == 1 else None
        confidence = 1.0 if len(candidate_ids) == 1 else (0.5 if candidate_ids else 0.0)
        proposals.append(RelationshipProposal(
            id=uuid4(),
            source_reference=value,
            relationship_type="REFERENCES",
            target_entity_id=target,
            candidate_entity_ids=candidate_ids,
            confidence=confidence,
            status="PENDING_CONFIRMATION",
            requires_confirmation=True,
            evidence=[{"locator": reference["locator"], "excerpt": reference.get("label", value)}],
        ))
    return proposals


def parse_document(
    path: str | Path,
    *,
    file_id: UUID,
    file_revision: int,
    canonical_entities: Iterable[Mapping[str, Any]] = (),
) -> DocumentParseResult:
    source_path = Path(path)
    raw = source_path.read_bytes()
    source_hash = hashlib.sha256(raw).hexdigest()
    suffix = source_path.suffix.casefold()
    if suffix in {".md", ".markdown", ".txt"}:
        text = raw.decode("utf-8-sig")
        parsed = _parse_markdown_like(source_path, file_id, file_revision, text)
        format_name = "markdown" if suffix != ".txt" else "text"
    elif suffix in {".doc", ".docx"}:
        parsed = _parse_legacy_word(source_path, file_id, file_revision) if suffix == ".doc" else _parse_word(source_path, file_id, file_revision)
        format_name = "word"
    else:
        raise ValueError(f"Unsupported document extension: {source_path.suffix}")
    nodes, tables, links, assets, references = parsed
    parsed = DocumentParseResult(
        file_id=file_id,
        file_revision=file_revision,
        format=format_name,
        source_hash=source_hash,
        nodes=nodes,
        tables=tables,
        links=links,
        assets=assets,
        references=references,
        relationship_proposals=_propose_relationships(references, canonical_entities),
    )
    return DocumentParseResult(
        **{**parsed.__dict__, "mapped_tables": map_document_tables(parsed)},
    )


def map_document_tables(parsed: DocumentParseResult) -> list[dict[str, Any]]:
    """Run recognizable document tables through the existing row-mapping contract."""
    from .excel import CameraWorkbookProfile, parse_camera_rows

    camera_headers = {
        _normalized(alias)
        for alias in CameraWorkbookProfile.aliases["code"]
    }
    mapped: list[dict[str, Any]] = []
    for index, table in enumerate(parsed.tables):
        if not any(_normalized(header) in camera_headers for header in table.headers):
            continue
        cameras, issues = parse_camera_rows(
            table.rows,
            file_id=parsed.file_id,
            file_revision=parsed.file_revision,
            sheet=f"DOCUMENT_TABLE_{index + 1}",
            row_start=table.locator.line or 1,
        )
        mapped.append({
            "table_index": index,
            "headers": table.headers,
            "cameras": cameras,
            "issues": issues,
        })
    return mapped


def create_document_changeset(
    project_id: UUID,
    parsed: DocumentParseResult,
    submitted_by: str,
) -> DocumentChangeSet:
    return DocumentChangeSet(
        id=uuid4(),
        project_id=project_id,
        file_id=parsed.file_id,
        file_revision=parsed.file_revision,
        source_hash=parsed.source_hash,
        status="PENDING_APPROVAL",
        submitted_by=submitted_by,
        raw_nodes=parsed.nodes,
        tables=parsed.tables,
        assets=parsed.assets,
        relationship_proposals=parsed.relationship_proposals,
    )
