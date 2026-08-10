from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4
from zipfile import ZipFile, ZIP_DEFLATED

from app.adapters.files.importers import documents as document_parser
from app.documents import create_document_changeset, parse_document


def test_markdown_parser_keeps_source_read_only_extracts_table_assets_and_proposals(tmp_path: Path) -> None:
    image = tmp_path / "plan.png"
    image.write_bytes(b"image-bytes")
    attachment = tmp_path / "spec.pdf"
    attachment.write_bytes(b"attachment-bytes")
    source = tmp_path / "wiki.md"
    source.write_text(
        """# Camera group
Owner: Team A

| CameraCode | Name |
| --- | --- |
| CAM-001 | Main |

See [[CAM-001]] and [[Main]]\n\n![plan](plan.png) and [spec](spec.pdf)
""",
        encoding="utf-8",
    )
    original = source.read_bytes()
    file_id = uuid4()
    parsed = parse_document(
        source,
        file_id=file_id,
        file_revision=3,
        canonical_entities=[
            {"id": "entity-1", "code": "CAM-001", "name": "Main"},
            {"id": "entity-2", "code": "CAM-002", "name": "Main"},
        ],
    )

    assert source.read_bytes() == original
    assert parsed.format == "markdown"
    assert parsed.source_hash == sha256(original).hexdigest()
    assert [node.kind for node in parsed.nodes] == ["heading", "metadata", "table", "paragraph", "paragraph"]
    assert parsed.tables[0].rows == [{"CameraCode": "CAM-001", "Name": "Main"}]
    assert parsed.mapped_tables[0]["cameras"][0].code == "CAM-001"
    assert {asset.name for asset in parsed.assets} == {"plan.png", "spec.pdf"}
    assert {asset.version for asset in parsed.assets} == {1}
    assert all(asset.locator.file_id == file_id for asset in parsed.assets)
    assert any(proposal.target_entity_id == "entity-1" for proposal in parsed.relationship_proposals)
    ambiguous = next(proposal for proposal in parsed.relationship_proposals if proposal.source_reference == "Main")
    assert ambiguous.target_entity_id is None
    assert ambiguous.candidate_entity_ids == ["entity-1", "entity-2"]
    assert ambiguous.status == "PENDING_CONFIRMATION"
    assert ambiguous.requires_confirmation

    changeset = create_document_changeset(uuid4(), parsed, "import-user")
    assert changeset.status == "PENDING_APPROVAL"
    assert changeset.relationship_proposals == parsed.relationship_proposals


def test_text_parser_accepts_markdown_like_wiki_sections(tmp_path: Path) -> None:
    source = tmp_path / "notes.txt"
    source.write_text("## Section\n- first item\n- second item\n", encoding="utf-8")
    parsed = parse_document(source, file_id=uuid4(), file_revision=1)

    assert parsed.format == "text"
    assert [node.kind for node in parsed.nodes] == ["heading", "list_item", "list_item"]


def test_word_parser_extracts_heading_table_link_image_and_attachment(tmp_path: Path) -> None:
    source = tmp_path / "report.docx"
    document_xml = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Report</w:t></w:r></w:p>
    <w:p><w:hyperlink r:id="rId1"><w:r><w:t>Camera link</w:t></w:r></w:hyperlink><w:r><w:t> [[CAM-001]]</w:t></w:r>
      <w:drawing><a:blip r:embed="rId2"/></w:drawing>
    </w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Code</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>CAM-001</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Main</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:sectPr/>
  </w:body>
</w:document>"""
    rels_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.test/camera" TargetMode="External"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/plan.png"/>
</Relationships>"""
    with ZipFile(source, "w", ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", document_xml)
        archive.writestr("word/_rels/document.xml.rels", rels_xml)
        archive.writestr("word/media/plan.png", b"word-image")
        archive.writestr("word/embeddings/schedule.pdf", b"word-attachment")
    original = source.read_bytes()

    parsed = parse_document(
        source,
        file_id=uuid4(),
        file_revision=2,
        canonical_entities=[{"id": "entity-1", "code": "CAM-001", "name": "Main"}],
    )

    assert source.read_bytes() == original
    assert parsed.format == "word"
    assert any(node.kind == "heading" and node.level == 1 for node in parsed.nodes)
    assert parsed.tables[0].rows == [{"column_1": "CAM-001", "column_2": "Main"}]
    assert any(link["target"].startswith("word/") is False for link in parsed.links)
    assert {asset.name for asset in parsed.assets} == {"plan.png", "schedule.pdf"}
    assert parsed.relationship_proposals[0].target_entity_id == "entity-1"


def test_legacy_word_parser_reads_ole_word_document_stream(tmp_path: Path, monkeypatch) -> None:
    source = tmp_path / "legacy.doc"
    source.write_bytes(b"legacy-word-fixture")

    class FakeStream:
        def read(self) -> bytes:
            return "Legacy heading\rLegacy paragraph".encode("utf-16le")

    class FakeOle:
        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

        def openstream(self, _name):
            return FakeStream()

    monkeypatch.setattr(document_parser.olefile, "OleFileIO", lambda _path: FakeOle())
    parsed = parse_document(source, file_id=uuid4(), file_revision=4)

    assert parsed.format == "word"
    assert [node.text for node in parsed.nodes] == ["Legacy heading", "Legacy paragraph"]
