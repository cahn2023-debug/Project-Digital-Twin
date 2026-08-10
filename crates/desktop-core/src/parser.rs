use calamine::{open_workbook_auto, Data, Reader};
use csv::ReaderBuilder;
use quick_xml::events::Event;
use quick_xml::Reader as XmlReader;
use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{Cursor, Read};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FileFormat {
    Xlsx,
    Csv,
    Txt,
    Markdown,
    Word,
    Unsupported,
}

impl FileFormat {
    fn from_path(path: &Path) -> Self {
        match path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str()
        {
            "xlsx" | "xlsm" => Self::Xlsx,
            "csv" => Self::Csv,
            "txt" => Self::Txt,
            "md" | "markdown" => Self::Markdown,
            "docx" => Self::Word,
            _ => Self::Unsupported,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParserProfile {
    pub profile_id: String,
    pub version: u32,
    pub format: Option<FileFormat>,
    pub sheet: Option<String>,
    pub header_row: usize,
    pub data_start_row: usize,
    pub required_fields: Vec<String>,
    pub aliases: BTreeMap<String, Vec<String>>,
}

impl ParserProfile {
    fn built_in(format: &FileFormat) -> Self {
        let mut aliases = BTreeMap::new();
        aliases.insert(
            "code".to_owned(),
            vec![
                "code".to_owned(),
                "camera code".to_owned(),
                "camera_id".to_owned(),
                "camera id".to_owned(),
                "mã camera".to_owned(),
            ],
        );
        aliases.insert(
            "name".to_owned(),
            vec![
                "name".to_owned(),
                "camera name".to_owned(),
                "tên camera".to_owned(),
            ],
        );
        Self {
            profile_id: match format {
                FileFormat::Word | FileFormat::Markdown | FileFormat::Txt => {
                    "document-default".to_owned()
                }
                _ => "camera-default".to_owned(),
            },
            version: 1,
            format: Some(format.clone()),
            sheet: matches!(format, FileFormat::Xlsx).then(|| "CAMERA".to_owned()),
            header_row: 1,
            data_start_row: 2,
            required_fields: matches!(format, FileFormat::Xlsx | FileFormat::Csv)
                .then(|| vec!["code".to_owned()])
                .unwrap_or_default(),
            aliases,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParseRequest {
    pub path: String,
    pub file_id: String,
    pub file_revision: u32,
    #[serde(default)]
    pub profiles: Vec<ParserProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SourceLocation {
    pub file_id: String,
    pub file_revision: u32,
    pub sheet: String,
    pub row: Option<usize>,
    pub line: Option<usize>,
    pub column: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NormalizedRecord {
    pub fields: BTreeMap<String, Value>,
    pub unmapped: BTreeMap<String, Value>,
    pub source: SourceLocation,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ParseIssueSeverity {
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParseIssue {
    pub code: String,
    pub message: String,
    pub severity: ParseIssueSeverity,
    pub row: Option<usize>,
    pub line: Option<usize>,
    pub column: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct ParseReport {
    pub valid_records: usize,
    pub invalid_records: usize,
    pub warning_count: usize,
    pub issues: Vec<ParseIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ParseStatus {
    Parsed,
    Partial,
    RawFallback,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DesktopParseResult {
    pub file_id: String,
    pub file_revision: u32,
    pub path: String,
    pub sha256: String,
    pub parsed_at: u64,
    pub format: FileFormat,
    pub status: ParseStatus,
    pub profile_id: Option<String>,
    pub profile_version: Option<u32>,
    pub parser_version: String,
    pub records: Vec<NormalizedRecord>,
    pub report: ParseReport,
    pub fallback_reason: Option<String>,
}

#[derive(Debug, Clone)]
struct SourceRow {
    fields: BTreeMap<String, Value>,
    source: SourceLocation,
}

pub fn parse_file(request: &ParseRequest) -> Result<DesktopParseResult, String> {
    let path = Path::new(&request.path);
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let format = FileFormat::from_path(path);
    let sha256 = sha256_bytes(&bytes);
    let base = |status: ParseStatus,
                profile: Option<&ParserProfile>,
                report: ParseReport,
                reason: Option<String>,
                records: Vec<NormalizedRecord>| DesktopParseResult {
        file_id: request.file_id.clone(),
        file_revision: request.file_revision,
        path: request.path.clone(),
        sha256: sha256.clone(),
        parsed_at: now_unix_seconds(),
        format: format.clone(),
        status,
        profile_id: profile.map(|value| value.profile_id.clone()),
        profile_version: profile.map(|value| value.version),
        parser_version: "desktop-parser-v1".to_owned(),
        records,
        report,
        fallback_reason: reason,
    };

    if format == FileFormat::Unsupported {
        return Ok(base(
            ParseStatus::RawFallback,
            None,
            issue_report(
                "UNSUPPORTED_FORMAT",
                "No desktop parser is registered for this file format",
                ParseIssueSeverity::Error,
                None,
                None,
                None,
            ),
            Some("unsupported file format".to_owned()),
            Vec::new(),
        ));
    }

    let profile = match resolve_profile(&format, &request.profiles) {
        Ok(profile) => profile,
        Err(reason) => {
            return Ok(base(
                ParseStatus::RawFallback,
                None,
                issue_report(
                    "PROFILE_NOT_UNIQUE",
                    &reason,
                    ParseIssueSeverity::Error,
                    None,
                    None,
                    None,
                ),
                Some(reason),
                Vec::new(),
            ))
        }
    };

    let rows = match read_rows(
        path,
        &format,
        &profile,
        &request.file_id,
        request.file_revision,
    ) {
        Ok(rows) => rows,
        Err(error) => {
            return Ok(base(
                ParseStatus::RawFallback,
                Some(&profile),
                issue_report(
                    "PARSER_FAILED",
                    &error,
                    ParseIssueSeverity::Error,
                    None,
                    None,
                    None,
                ),
                Some(error),
                Vec::new(),
            ))
        }
    };

    let (records, mut report) = normalize_rows(rows, &profile);
    let status = if report.valid_records == 0 && report.invalid_records > 0 {
        ParseStatus::RawFallback
    } else if report.invalid_records > 0 {
        ParseStatus::Partial
    } else {
        ParseStatus::Parsed
    };
    let fallback_reason = matches!(status, ParseStatus::RawFallback)
        .then(|| "no valid normalized records".to_owned());
    if fallback_reason.is_some() {
        report.issues.push(ParseIssue {
            code: "NO_VALID_RECORDS".to_owned(),
            message: "No valid normalized records were produced".to_owned(),
            severity: ParseIssueSeverity::Error,
            row: None,
            line: None,
            column: None,
        });
    }
    Ok(base(
        status,
        Some(&profile),
        report,
        fallback_reason,
        records,
    ))
}

fn resolve_profile(
    format: &FileFormat,
    profiles: &[ParserProfile],
) -> Result<ParserProfile, String> {
    if profiles.is_empty() {
        return Ok(ParserProfile::built_in(format));
    }
    let matching: Vec<ParserProfile> = profiles
        .iter()
        .filter(|profile| profile.format.as_ref().is_none_or(|value| value == format))
        .cloned()
        .collect();
    match matching.as_slice() {
        [profile] => Ok(profile.clone()),
        [] => Err("No source profile matches the detected file format".to_owned()),
        _ => Err("Multiple source profiles match the detected file format".to_owned()),
    }
}

fn read_rows(
    path: &Path,
    format: &FileFormat,
    profile: &ParserProfile,
    file_id: &str,
    file_revision: u32,
) -> Result<Vec<SourceRow>, String> {
    match format {
        FileFormat::Xlsx => read_xlsx(path, profile, file_id, file_revision),
        FileFormat::Csv => read_csv(path, profile, file_id, file_revision),
        FileFormat::Txt | FileFormat::Markdown => read_text(path, format, file_id, file_revision),
        FileFormat::Word => read_docx(path, file_id, file_revision),
        FileFormat::Unsupported => Err("Unsupported file format".to_owned()),
    }
}

fn read_xlsx(
    path: &Path,
    profile: &ParserProfile,
    file_id: &str,
    file_revision: u32,
) -> Result<Vec<SourceRow>, String> {
    let mut workbook = open_workbook_auto(path).map_err(|error| error.to_string())?;
    let sheet = profile
        .sheet
        .clone()
        .or_else(|| workbook.sheet_names().first().cloned())
        .ok_or_else(|| "Workbook has no visible sheets".to_owned())?;
    let range = workbook
        .worksheet_range(&sheet)
        .map_err(|error| error.to_string())?;
    let rows: Vec<Vec<Value>> = range
        .rows()
        .map(|row| row.iter().map(cell_value).collect())
        .collect();
    rows_from_table(rows, profile, file_id, file_revision, &sheet)
}

fn read_csv(
    path: &Path,
    profile: &ParserProfile,
    file_id: &str,
    file_revision: u32,
) -> Result<Vec<SourceRow>, String> {
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .from_path(path)
        .map_err(|error| error.to_string())?;
    let rows = reader
        .records()
        .map(|record| {
            record
                .map(|row| {
                    row.iter()
                        .map(|value| Value::String(value.to_owned()))
                        .collect::<Vec<_>>()
                })
                .map_err(|error| error.to_string())
        })
        .collect::<Result<Vec<_>, _>>()?;
    rows_from_table(rows, profile, file_id, file_revision, "CSV")
}

fn rows_from_table(
    rows: Vec<Vec<Value>>,
    profile: &ParserProfile,
    file_id: &str,
    file_revision: u32,
    sheet: &str,
) -> Result<Vec<SourceRow>, String> {
    let header_index = profile.header_row.saturating_sub(1);
    let data_index = profile.data_start_row.saturating_sub(1);
    let headers = rows
        .get(header_index)
        .ok_or_else(|| "Input has no header row".to_owned())?
        .iter()
        .enumerate()
        .map(|(index, value)| {
            let name = value.as_str().unwrap_or_default().trim();
            if name.is_empty() {
                format!("column_{}", index + 1)
            } else {
                name.to_owned()
            }
        })
        .collect::<Vec<_>>();
    let mut result = Vec::new();
    for (index, row) in rows.iter().enumerate().skip(data_index) {
        let fields = headers
            .iter()
            .enumerate()
            .filter_map(|(column, header)| {
                row.get(column).map(|value| (header.clone(), value.clone()))
            })
            .filter(|(_, value)| !value.is_null() && value != &Value::String(String::new()))
            .collect::<BTreeMap<_, _>>();
        if fields.is_empty() {
            continue;
        }
        result.push(SourceRow {
            fields,
            source: SourceLocation {
                file_id: file_id.to_owned(),
                file_revision,
                sheet: sheet.to_owned(),
                row: Some(index + 1),
                line: None,
                column: None,
            },
        });
    }
    Ok(result)
}

fn read_text(
    path: &Path,
    format: &FileFormat,
    file_id: &str,
    file_revision: u32,
) -> Result<Vec<SourceRow>, String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut section = String::new();
    let mut rows = Vec::new();
    for (index, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if *format == FileFormat::Markdown && trimmed.starts_with('#') {
            section = trimmed.trim_start_matches('#').trim().to_owned();
        }
        let mut fields = BTreeMap::new();
        if !section.is_empty() {
            fields.insert("section".to_owned(), Value::String(section.clone()));
        }
        fields.insert("content".to_owned(), Value::String(trimmed.to_owned()));
        rows.push(SourceRow {
            fields,
            source: SourceLocation {
                file_id: file_id.to_owned(),
                file_revision,
                sheet: "DOCUMENT".to_owned(),
                row: None,
                line: Some(index + 1),
                column: Some("content".to_owned()),
            },
        });
    }
    Ok(rows)
}

fn read_docx(path: &Path, file_id: &str, file_revision: u32) -> Result<Vec<SourceRow>, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut document = archive
        .by_name("word/document.xml")
        .map_err(|error| error.to_string())?;
    let mut xml = Vec::new();
    document
        .read_to_end(&mut xml)
        .map_err(|error| error.to_string())?;

    let mut reader = XmlReader::from_reader(Cursor::new(xml));
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    let mut in_paragraph = false;
    let mut paragraph = String::new();
    let mut rows = Vec::new();
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(event)) if event.name().as_ref() == b"w:p" => {
                in_paragraph = true;
                paragraph.clear();
            }
            Ok(Event::Text(event)) if in_paragraph => {
                paragraph.push_str(&event.unescape().map_err(|error| error.to_string())?);
            }
            Ok(Event::End(event)) if event.name().as_ref() == b"w:p" => {
                let content = paragraph.trim();
                if !content.is_empty() {
                    let mut fields = BTreeMap::new();
                    fields.insert("content".to_owned(), Value::String(content.to_owned()));
                    rows.push(SourceRow {
                        fields,
                        source: SourceLocation {
                            file_id: file_id.to_owned(),
                            file_revision,
                            sheet: "DOCUMENT".to_owned(),
                            row: None,
                            line: Some(rows.len() + 1),
                            column: Some("content".to_owned()),
                        },
                    });
                }
                in_paragraph = false;
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(error.to_string()),
            _ => {}
        }
        buffer.clear();
    }
    Ok(rows)
}

fn normalize_rows(
    rows: Vec<SourceRow>,
    profile: &ParserProfile,
) -> (Vec<NormalizedRecord>, ParseReport) {
    let mut records = Vec::new();
    let mut report = ParseReport::default();
    for row in rows {
        let mut fields = BTreeMap::new();
        let mut unmapped = BTreeMap::new();
        let mut missing = Vec::new();
        for required in &profile.required_fields {
            if !row
                .fields
                .keys()
                .any(|key| canonical_name(key, profile) == *required)
            {
                missing.push(required.clone());
            }
        }
        if !missing.is_empty() {
            report.invalid_records += 1;
            for required in missing {
                report.issues.push(ParseIssue {
                    code: "MISSING_REQUIRED_FIELD".to_owned(),
                    message: format!("Required field '{required}' is missing"),
                    severity: ParseIssueSeverity::Error,
                    row: row.source.row,
                    line: row.source.line,
                    column: Some(required),
                });
            }
            continue;
        }
        for (key, value) in row.fields {
            let normalized_value = normalize_value(value);
            if let Some(canonical) = canonical_alias(&key, profile) {
                fields.insert(canonical, normalized_value);
            } else if profile.aliases.is_empty()
                || matches!(
                    profile.format,
                    Some(FileFormat::Word | FileFormat::Markdown | FileFormat::Txt)
                )
            {
                fields.insert(key, normalized_value);
            } else {
                unmapped.insert(key.clone(), normalized_value);
                report.warning_count += 1;
                report.issues.push(ParseIssue {
                    code: "UNMAPPED_FIELD".to_owned(),
                    message: "Field has no source-profile mapping".to_owned(),
                    severity: ParseIssueSeverity::Warning,
                    row: row.source.row,
                    line: row.source.line,
                    column: Some(key),
                });
            }
        }
        report.valid_records += 1;
        records.push(NormalizedRecord {
            fields,
            unmapped,
            source: row.source,
        });
    }
    (records, report)
}

fn canonical_name(key: &str, profile: &ParserProfile) -> String {
    canonical_alias(key, profile).unwrap_or_else(|| key.trim().to_ascii_lowercase())
}

fn canonical_alias(key: &str, profile: &ParserProfile) -> Option<String> {
    let normalized = key.trim().to_ascii_lowercase();
    profile.aliases.iter().find_map(|(canonical, aliases)| {
        aliases
            .iter()
            .any(|alias| alias.trim().to_ascii_lowercase() == normalized)
            .then(|| canonical.clone())
    })
}

fn normalize_value(value: Value) -> Value {
    match value {
        Value::String(value) => {
            let trimmed = value.trim();
            match trimmed.to_ascii_lowercase().as_str() {
                "true" => Value::Bool(true),
                "false" => Value::Bool(false),
                _ => Value::String(trimmed.to_owned()),
            }
        }
        other => other,
    }
}

fn cell_value(value: &Data) -> Value {
    match value {
        Data::Empty => Value::Null,
        Data::String(value) => Value::String(value.clone()),
        Data::Float(value) => Number::from_f64(*value)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        Data::Int(value) => Value::Number((*value).into()),
        Data::Bool(value) => Value::Bool(*value),
        Data::DateTime(value) => Value::String(value.to_string()),
        Data::DateTimeIso(value) | Data::DurationIso(value) => Value::String(value.clone()),
        Data::Error(value) => Value::String(format!("{value:?}")),
    }
}

fn sha256_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn issue_report(
    code: &str,
    message: &str,
    severity: ParseIssueSeverity,
    row: Option<usize>,
    line: Option<usize>,
    column: Option<String>,
) -> ParseReport {
    ParseReport {
        invalid_records: usize::from(matches!(severity, ParseIssueSeverity::Error)),
        warning_count: usize::from(matches!(severity, ParseIssueSeverity::Warning)),
        issues: vec![ParseIssue {
            code: code.to_owned(),
            message: message.to_owned(),
            severity,
            row,
            line,
            column,
        }],
        ..ParseReport::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn csv_profile() -> ParserProfile {
        let mut aliases = BTreeMap::new();
        aliases.insert("code".to_owned(), vec!["Code".to_owned()]);
        aliases.insert("name".to_owned(), vec!["Name".to_owned()]);
        ParserProfile {
            profile_id: "camera-csv".to_owned(),
            version: 1,
            format: Some(FileFormat::Csv),
            sheet: None,
            header_row: 1,
            data_start_row: 2,
            required_fields: vec!["code".to_owned()],
            aliases,
        }
    }

    #[test]
    fn csv_parser_keeps_valid_rows_and_located_unmapped_values() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("cameras.csv");
        fs::write(&path, "Code,Name,Extra\nCAM-1,Main,keep\n,Missing,drop\n").expect("csv");
        let result = parse_file(&ParseRequest {
            path: path.to_string_lossy().into_owned(),
            file_id: "file-1".to_owned(),
            file_revision: 1,
            profiles: vec![csv_profile()],
        })
        .expect("parse");
        assert_eq!(result.status, ParseStatus::Partial);
        assert_eq!(result.records.len(), 1);
        assert_eq!(
            result.records[0].fields.get("code"),
            Some(&Value::String("CAM-1".to_owned()))
        );
        assert_eq!(
            result.records[0].unmapped.get("Extra"),
            Some(&Value::String("keep".to_owned()))
        );
        assert_eq!(result.records[0].source.row, Some(2));
        assert!(result
            .report
            .issues
            .iter()
            .any(|issue| issue.code == "MISSING_REQUIRED_FIELD"));
    }

    #[test]
    fn multiple_profiles_return_raw_fallback_without_records() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("cameras.csv");
        fs::write(&path, "Code\nCAM-1\n").expect("csv");
        let profile = csv_profile();
        let result = parse_file(&ParseRequest {
            path: path.to_string_lossy().into_owned(),
            file_id: "file-1".to_owned(),
            file_revision: 1,
            profiles: vec![
                profile.clone(),
                ParserProfile {
                    profile_id: "other".to_owned(),
                    ..profile
                },
            ],
        })
        .expect("parse");
        assert_eq!(result.status, ParseStatus::RawFallback);
        assert!(result.records.is_empty());
        assert_eq!(result.report.issues[0].code, "PROFILE_NOT_UNIQUE");
    }

    #[test]
    fn markdown_parser_preserves_section_and_line_provenance() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("notes.md");
        fs::write(&path, "# Cameras\nCAM-1 is online\n").expect("markdown");
        let result = parse_file(&ParseRequest {
            path: path.to_string_lossy().into_owned(),
            file_id: "file-1".to_owned(),
            file_revision: 1,
            profiles: vec![],
        })
        .expect("parse");
        assert_eq!(result.status, ParseStatus::Parsed);
        assert_eq!(result.records[1].source.line, Some(2));
        assert_eq!(
            result.records[1].fields.get("section"),
            Some(&Value::String("Cameras".to_owned()))
        );
    }

    #[test]
    fn xlsx_parser_reads_the_builtin_camera_profile() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("cameras.xlsx");
        let file = File::create(&path).expect("xlsx");
        let mut archive = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        let entries = [
            (
                "[Content_Types].xml",
                "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>",
            ),
            (
                "_rels/.rels",
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>",
            ),
            (
                "xl/workbook.xml",
                "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"CAMERA\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>",
            ),
            (
                "xl/_rels/workbook.xml.rels",
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>",
            ),
            (
                "xl/worksheets/sheet1.xml",
                "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData><row r=\"1\"><c r=\"A1\" t=\"inlineStr\"><is><t>Code</t></is></c><c r=\"B1\" t=\"inlineStr\"><is><t>Name</t></is></c></row><row r=\"2\"><c r=\"A2\" t=\"inlineStr\"><is><t>CAM-1</t></is></c><c r=\"B2\" t=\"inlineStr\"><is><t>Main</t></is></c></row></sheetData></worksheet>",
            ),
        ];
        for (name, content) in entries {
            archive.start_file(name, options).expect("entry");
            archive.write_all(content.as_bytes()).expect("xml");
        }
        archive.finish().expect("finish");
        let result = parse_file(&ParseRequest {
            path: path.to_string_lossy().into_owned(),
            file_id: "file-1".to_owned(),
            file_revision: 1,
            profiles: vec![],
        })
        .expect("parse");
        assert_eq!(result.status, ParseStatus::Parsed);
        assert_eq!(result.records.len(), 1);
        assert_eq!(
            result.records[0].fields.get("code"),
            Some(&Value::String("CAM-1".to_owned()))
        );
        assert!(result.parsed_at > 0);
    }

    #[test]
    fn docx_parser_extracts_paragraphs() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("notes.docx");
        let file = File::create(&path).expect("docx");
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file(
                "word/document.xml",
                zip::write::SimpleFileOptions::default(),
            )
            .expect("entry");
        archive
            .write_all(b"<w:document xmlns:w=\"urn\"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>")
            .expect("xml");
        archive.finish().expect("finish");
        let result = parse_file(&ParseRequest {
            path: path.to_string_lossy().into_owned(),
            file_id: "file-1".to_owned(),
            file_revision: 1,
            profiles: vec![],
        })
        .expect("parse");
        assert_eq!(result.status, ParseStatus::Parsed);
        assert_eq!(
            result.records[0].fields.get("content"),
            Some(&Value::String("Hello".to_owned()))
        );
    }
}
