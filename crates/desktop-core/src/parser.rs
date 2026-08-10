use calamine::{open_workbook_auto, Data, Reader};
use csv::ReaderBuilder;
use encoding_rs::WINDOWS_1252;
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
    Xls,
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
            "xls" => Self::Xls,
            "csv" => Self::Csv,
            "txt" => Self::Txt,
            "md" | "markdown" => Self::Markdown,
            "doc" | "docx" => Self::Word,
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
    #[serde(default)]
    pub skip_rows: Vec<usize>,
    #[serde(default)]
    pub field_types: BTreeMap<String, String>,
    #[serde(default)]
    pub delimiter: Option<String>,
    #[serde(default)]
    pub encoding: Option<String>,
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
            required_fields: matches!(format, FileFormat::Xlsx | FileFormat::Xls | FileFormat::Csv)
                .then(|| vec!["code".to_owned()])
                .unwrap_or_default(),
            aliases,
            field_types: BTreeMap::new(),
            skip_rows: Vec::new(),
            delimiter: None,
            encoding: None,
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
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub source_id: Option<String>,
    #[serde(default)]
    pub source_hash: Option<String>,
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
    pub identity: String,
    pub fields: BTreeMap<String, Value>,
    pub unmapped: BTreeMap<String, Value>,
    pub raw: BTreeMap<String, Value>,
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

    let (rows, read_issues) = match read_rows(
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

    let (records, mut report) = normalize_rows(rows, &profile, request);
    for issue in read_issues {
        if matches!(issue.severity, ParseIssueSeverity::Warning) {
            report.warning_count += 1;
        }
        report.issues.push(issue);
    }
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
) -> Result<(Vec<SourceRow>, Vec<ParseIssue>), String> {
    match format {
        FileFormat::Xlsx | FileFormat::Xls => read_xlsx(path, profile, file_id, file_revision),
        FileFormat::Csv => read_csv(path, profile, file_id, file_revision),
        FileFormat::Txt | FileFormat::Markdown => read_text(path, format, file_id, file_revision),
        FileFormat::Word => read_word(path, file_id, file_revision),
        FileFormat::Unsupported => Err("Unsupported file format".to_owned()),
    }
}

fn read_xlsx(
    path: &Path,
    profile: &ParserProfile,
    file_id: &str,
    file_revision: u32,
) -> Result<(Vec<SourceRow>, Vec<ParseIssue>), String> {
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
) -> Result<(Vec<SourceRow>, Vec<ParseIssue>), String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let (text, mut issues) = decode_csv(&bytes, profile.encoding.as_deref())?;
    let (delimiter, delimiter_issue) = detect_csv_delimiter(&text, profile.delimiter.as_deref());
    if let Some(issue) = delimiter_issue {
        issues.push(issue);
    }
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .delimiter(delimiter)
        .from_reader(text.as_bytes());
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
    let (rows, table_issues) = rows_from_table(rows, profile, file_id, file_revision, "CSV")?;
    issues.extend(table_issues);
    Ok((rows, issues))
}

fn decode_csv(
    bytes: &[u8],
    requested_encoding: Option<&str>,
) -> Result<(String, Vec<ParseIssue>), String> {
    let mut issues = Vec::new();
    let payload = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    let encoding = requested_encoding.unwrap_or("auto").to_ascii_lowercase();
    let (text, fallback) = match encoding.as_str() {
        "auto" | "utf-8" | "utf8" => match String::from_utf8(payload.to_vec()) {
            Ok(text) => (text, false),
            Err(_) => {
                let (decoded, _, _) = WINDOWS_1252.decode(payload);
                (decoded.into_owned(), true)
            }
        },
        "windows-1252" | "cp1252" | "latin-1" => {
            let (decoded, _, had_errors) = WINDOWS_1252.decode(payload);
            (decoded.into_owned(), had_errors)
        }
        other => return Err(format!("Unsupported CSV encoding: {other}")),
    };
    if fallback {
        issues.push(ParseIssue {
            code: "CSV_ENCODING_FALLBACK".to_owned(),
            message: "CSV was decoded with Windows-1252 fallback; confirm encoding in preview"
                .to_owned(),
            severity: ParseIssueSeverity::Warning,
            row: None,
            line: None,
            column: None,
        });
    }
    Ok((text, issues))
}

fn detect_csv_delimiter(text: &str, requested: Option<&str>) -> (u8, Option<ParseIssue>) {
    if let Some(value) = requested.and_then(|value| value.as_bytes().first().copied()) {
        return (value, None);
    }
    let candidates = [b',', b';', b'\t', b'|'];
    let lines = text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .take(8)
        .collect::<Vec<_>>();
    let mut scores = candidates
        .iter()
        .map(|delimiter| {
            let counts = lines
                .iter()
                .map(|line| {
                    line.as_bytes()
                        .iter()
                        .filter(|byte| *byte == delimiter)
                        .count()
                })
                .filter(|count| *count > 0)
                .collect::<Vec<_>>();
            (*delimiter, counts.iter().sum::<usize>(), counts.len())
        })
        .filter(|(_, score, _)| *score > 0)
        .collect::<Vec<_>>();
    scores.sort_by(|left, right| right.1.cmp(&left.1).then(right.2.cmp(&left.2)));
    let Some((delimiter, score, line_count)) = scores.first().copied() else {
        return (
            b',',
            Some(csv_warning(
                "CSV_DELIMITER_AMBIGUOUS",
                "CSV delimiter could not be detected; preview confirmation is required",
            )),
        );
    };
    let tied = scores
        .iter()
        .filter(|(_, candidate_score, candidate_lines)| {
            *candidate_score == score && *candidate_lines == line_count
        })
        .count()
        > 1;
    let issue = tied.then(|| {
        csv_warning(
            "CSV_DELIMITER_AMBIGUOUS",
            "Multiple CSV delimiters look plausible; preview confirmation is required",
        )
    });
    (delimiter, issue)
}

fn csv_warning(code: &str, message: &str) -> ParseIssue {
    ParseIssue {
        code: code.to_owned(),
        message: message.to_owned(),
        severity: ParseIssueSeverity::Warning,
        row: None,
        line: None,
        column: None,
    }
}

fn rows_from_table(
    rows: Vec<Vec<Value>>,
    profile: &ParserProfile,
    file_id: &str,
    file_revision: u32,
    sheet: &str,
) -> Result<(Vec<SourceRow>, Vec<ParseIssue>), String> {
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
    Ok((result, Vec::new()))
}

fn read_text(
    path: &Path,
    format: &FileFormat,
    file_id: &str,
    file_revision: u32,
) -> Result<(Vec<SourceRow>, Vec<ParseIssue>), String> {
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
    Ok((rows, Vec::new()))
}

fn read_word(
    path: &Path,
    file_id: &str,
    file_revision: u32,
) -> Result<(Vec<SourceRow>, Vec<ParseIssue>), String> {
    if path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("doc"))
    {
        return read_legacy_doc(path, file_id, file_revision);
    }
    read_docx(path, file_id, file_revision).map(|rows| (rows, Vec::new()))
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

fn read_legacy_doc(
    path: &Path,
    file_id: &str,
    file_revision: u32,
) -> Result<(Vec<SourceRow>, Vec<ParseIssue>), String> {
    let mut compound = cfb::open(path).map_err(|error| error.to_string())?;
    let mut stream = compound
        .open_stream("/WordDocument")
        .map_err(|error| error.to_string())?;
    let mut bytes = Vec::new();
    stream
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    let text = legacy_word_text(&bytes);
    if text.trim().is_empty() {
        return Err("Legacy Word document contains no readable text".to_owned());
    }
    let rows = text
        .lines()
        .enumerate()
        .filter_map(|(index, line)| {
            let content = line.trim();
            (!content.is_empty()).then(|| {
                let mut fields = BTreeMap::new();
                fields.insert("content".to_owned(), Value::String(content.to_owned()));
                SourceRow {
                    fields,
                    source: SourceLocation {
                        file_id: file_id.to_owned(),
                        file_revision,
                        sheet: "DOCUMENT".to_owned(),
                        row: None,
                        line: Some(index + 1),
                        column: Some("content".to_owned()),
                    },
                }
            })
        })
        .collect::<Vec<_>>();
    Ok((
        rows,
        vec![csv_warning(
            "LEGACY_WORD_LIMITATION",
            "Legacy .doc text was extracted from the OLE WordDocument stream; confirm tables and embedded assets in preview",
        )],
    ))
}

fn legacy_word_text(bytes: &[u8]) -> String {
    let mut candidates = Vec::new();
    for offset in 0..2 {
        let mut current = String::new();
        let mut start = offset;
        let mut index = offset;
        while index + 1 < bytes.len() {
            let code = u16::from_le_bytes([bytes[index], bytes[index + 1]]);
            if legacy_word_codepoint(code) {
                if current.is_empty() {
                    start = index;
                }
                current.push(char::from_u32(code as u32).unwrap_or(' '));
            } else if current.chars().count() >= 4 {
                candidates.push((current.len(), start, current.replace('\r', "\n")));
                current = String::new();
            } else {
                current.clear();
            }
            index += 2;
        }
        if current.chars().count() >= 4 {
            candidates.push((current.len(), start, current.replace('\r', "\n")));
        }
    }
    let mut current = String::new();
    let mut start = 0;
    for (index, byte) in bytes.iter().copied().enumerate() {
        if legacy_word_byte(byte) {
            if current.is_empty() {
                start = index;
            }
            current.push(byte as char);
        } else if current.chars().count() >= 8 {
            candidates.push((current.len(), start, current.replace('\r', "\n")));
            current = String::new();
        } else {
            current.clear();
        }
    }
    if current.chars().count() >= 8 {
        candidates.push((current.len(), start, current.replace('\r', "\n")));
    }
    candidates.sort_by(|left, right| right.0.cmp(&left.0).then(left.1.cmp(&right.1)));
    candidates
        .first()
        .map(|(_, _, text)| text.clone())
        .unwrap_or_default()
}

fn legacy_word_codepoint(code: u16) -> bool {
    matches!(code, 0x0009 | 0x000A | 0x000D) || (0x0020..=0x0FFF).contains(&code)
}

fn legacy_word_byte(byte: u8) -> bool {
    matches!(byte, 0x09 | 0x0A | 0x0D)
        || (0x20..=0x7E).contains(&byte)
        || (0xA0..=0xFF).contains(&byte)
}

fn normalize_rows(
    rows: Vec<SourceRow>,
    profile: &ParserProfile,
    request: &ParseRequest,
) -> (Vec<NormalizedRecord>, ParseReport) {
    let mut records = Vec::new();
    let mut report = ParseReport::default();
    for row in rows {
        if row
            .source
            .row
            .is_some_and(|row_number| profile.skip_rows.contains(&row_number))
        {
            continue;
        }
        let raw = row.fields.clone();
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
            let canonical = canonical_alias(&key, profile);
            let expected_type = canonical
                .as_ref()
                .and_then(|field| profile.field_types.get(field));
            let (normalized_value, warning_code) = normalize_value(value, expected_type);
            if let Some(code) = warning_code {
                report.warning_count += 1;
                report.issues.push(ParseIssue {
                    code: code.to_owned(),
                    message: "Value was kept in source form because its locale/type is ambiguous"
                        .to_owned(),
                    severity: ParseIssueSeverity::Warning,
                    row: row.source.row,
                    line: row.source.line,
                    column: Some(key.clone()),
                });
            }
            if let Some(canonical) = canonical {
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
            identity: record_identity(request, &row.source, &raw, profile),
            fields,
            unmapped,
            raw,
            source: row.source,
        });
    }
    (records, report)
}

fn record_identity(
    request: &ParseRequest,
    source: &SourceLocation,
    raw: &BTreeMap<String, Value>,
    profile: &ParserProfile,
) -> String {
    let stable_value = ["id", "uuid", "key", "code"]
        .iter()
        .find_map(|canonical| {
            raw.iter().find_map(|(key, value)| {
                (canonical_name(key, profile) == *canonical && !value.is_null())
                    .then(|| value.to_string())
            })
        })
        .map(|value| value.to_owned());
    let namespace = if let Some(stable_value) = stable_value {
        format!(
            "{}|{}|stable|{}",
            request.project_id.as_deref().unwrap_or("project"),
            request.source_id.as_deref().unwrap_or("source"),
            stable_value,
        )
    } else {
        format!(
            "{}|{}|{}|{}|{}|{}",
            request.project_id.as_deref().unwrap_or("project"),
            request.source_id.as_deref().unwrap_or("source"),
            request.file_id,
            request.file_revision,
            request.source_hash.as_deref().unwrap_or("hash"),
            serde_json::to_string(source).unwrap_or_default(),
        )
    };
    format!("record-{}", sha256_bytes(namespace.as_bytes()))
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

fn normalize_value(value: Value, expected_type: Option<&String>) -> (Value, Option<&'static str>) {
    match value {
        Value::String(value) => {
            let trimmed = value.trim();
            if let Some(expected) = expected_type {
                return match expected.as_str() {
                    "text" => (Value::String(trimmed.to_owned()), None),
                    "number" => trimmed
                        .parse::<f64>()
                        .ok()
                        .and_then(Number::from_f64)
                        .map(|number| (Value::Number(number), None))
                        .unwrap_or_else(|| {
                            (
                                Value::String(trimmed.to_owned()),
                                Some("INVALID_TYPED_VALUE"),
                            )
                        }),
                    "boolean" => match trimmed.to_ascii_lowercase().as_str() {
                        "true" | "yes" | "y" => (Value::Bool(true), None),
                        "false" | "no" | "n" => (Value::Bool(false), None),
                        _ => (
                            Value::String(trimmed.to_owned()),
                            Some("INVALID_TYPED_VALUE"),
                        ),
                    },
                    "date" => (Value::String(trimmed.to_owned()), None),
                    _ => (
                        Value::String(trimmed.to_owned()),
                        Some("INVALID_TYPED_VALUE"),
                    ),
                };
            }
            match trimmed.to_ascii_lowercase().as_str() {
                "true" | "yes" | "y" => (Value::Bool(true), None),
                "false" | "no" | "n" => (Value::Bool(false), None),
                _ if ambiguous_scalar(trimmed) => {
                    (Value::String(trimmed.to_owned()), Some("AMBIGUOUS_SCALAR"))
                }
                _ => (Value::String(trimmed.to_owned()), None),
            }
        }
        other => (other, None),
    }
}

fn ambiguous_scalar(value: &str) -> bool {
    let has_digit = value.chars().any(|character| character.is_ascii_digit());
    let has_locale_separator = value.contains(',') || value.contains('/');
    has_digit
        && has_locale_separator
        && value.chars().all(|character| {
            character.is_ascii_digit() || matches!(character, ',' | '/' | '-' | '.' | ':' | ' ')
        })
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
            field_types: BTreeMap::new(),
            skip_rows: Vec::new(),
            delimiter: None,
            encoding: None,
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
            project_id: None,
            source_id: None,
            source_hash: None,
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
        assert_eq!(
            result.records[0].raw.get("Code"),
            Some(&Value::String("CAM-1".to_owned()))
        );
    }

    #[test]
    fn csv_parser_detects_semicolon_and_reports_ambiguous_scalar() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("cameras.csv");
        fs::write(&path, "\u{feff}Code;Name;Amount\nCAM-1;Main;1,23\n").expect("csv");
        let result = parse_file(&ParseRequest {
            path: path.to_string_lossy().into_owned(),
            file_id: "file-1".to_owned(),
            file_revision: 1,
            profiles: vec![csv_profile()],
            project_id: None,
            source_id: None,
            source_hash: None,
        })
        .expect("parse");
        assert_eq!(result.status, ParseStatus::Parsed);
        assert_eq!(result.records.len(), 1);
        assert_eq!(
            result.records[0].unmapped["Amount"],
            Value::String("1,23".to_owned())
        );
        assert!(result
            .report
            .issues
            .iter()
            .any(|issue| issue.code == "AMBIGUOUS_SCALAR"));
    }

    #[test]
    fn record_identity_prefers_stable_source_key_across_revisions() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("cameras.csv");
        fs::write(&path, "Code,Name\nCAM-1,Main\n").expect("csv");
        let request = |revision| ParseRequest {
            path: path.to_string_lossy().into_owned(),
            file_id: "file-1".to_owned(),
            file_revision: revision,
            profiles: vec![csv_profile()],
            project_id: Some("project-1".to_owned()),
            source_id: Some("source-1".to_owned()),
            source_hash: Some("a".repeat(64)),
        };
        let first = parse_file(&request(1)).expect("first parse");
        let second = parse_file(&request(2)).expect("second parse");
        assert_eq!(first.records[0].identity, second.records[0].identity);
        assert!(first.records[0].identity.starts_with("record-"));
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
            project_id: None,
            source_id: None,
            source_hash: None,
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
            project_id: None,
            source_id: None,
            source_hash: None,
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
            project_id: None,
            source_id: None,
            source_hash: None,
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
            project_id: None,
            source_id: None,
            source_hash: None,
        })
        .expect("parse");
        assert_eq!(result.status, ParseStatus::Parsed);
        assert_eq!(
            result.records[0].fields.get("content"),
            Some(&Value::String("Hello".to_owned()))
        );
    }

    #[test]
    fn legacy_doc_parser_extracts_ole_word_document_text() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("notes.doc");
        {
            let mut compound = cfb::create(&path).expect("compound file");
            let mut stream = compound
                .create_stream("/WordDocument")
                .expect("word stream");
            let text = "Legacy heading\rLegacy paragraph";
            let encoded = text
                .encode_utf16()
                .flat_map(u16::to_le_bytes)
                .collect::<Vec<_>>();
            stream.write_all(&encoded).expect("word text");
        }
        let result = parse_file(&ParseRequest {
            path: path.to_string_lossy().into_owned(),
            file_id: "file-1".to_owned(),
            file_revision: 1,
            profiles: vec![],
            project_id: None,
            source_id: None,
            source_hash: None,
        })
        .expect("parse");
        assert_eq!(result.format, FileFormat::Word);
        assert_eq!(result.records.len(), 2);
        assert_eq!(
            result.records[0].fields["content"],
            Value::String("Legacy heading".to_owned())
        );
        assert!(result
            .report
            .issues
            .iter()
            .any(|issue| issue.code == "LEGACY_WORD_LIMITATION"));
    }
}
