---
id: tgowk5
title: "[local-file-ingestion-07] Implement Markdown, TXT and Word parsing, assets and relations"
status: todo
priority: high
labels:
  - from-spec
  - spec:local-file-ingestion-and-synchronization
  - spec-date:2026-08-09
  - documents
  - relationships
createdAt: '2026-08-09T10:50:29.540Z'
updatedAt: '2026-08-09T11:25:23.133Z'
timeSpent: 0
spec: specs/2026-08-09/local-file-ingestion-and-synchronization
fulfills:
  - AC-17
  - AC-18
order: 70
---
# [local-file-ingestion-07] Implement Markdown, TXT and Word parsing, assets and relations

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Parse Markdown-like text and Word content including structure, tables, images and attachments; register source assets and create evidence-backed relationship proposals.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Parse Markdown-like TXT/Markdown/Word structure, tables, images and attachments without modifying source originals.
- [ ] #2 Register image/attachment assets with hash/version and source-location links.
- [ ] #3 Create relationship proposals with evidence and require confirmation before canonical apply.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Define a common read-only document model and source-location contract for Markdown-like text, TXT and Word in the server/document boundary; select only the minimum parser dependencies needed for the supported formats.
2. Implement parsing of headings, paragraphs, lists, links, key-value metadata, tables, images and attachments without modifying originals; route extracted tables through the task-02/03 mapping contracts.
3. Register images/attachments as source assets with hash/version and source-location links, preserving the parent document/file version relationship.
4. Implement UUID/code-first and normalized object/context reference resolution; create evidence-backed relationship proposals in ChangeSets and require confirmation before canonical apply.
5. Add Markdown/TXT/Word fixtures with tables, ambiguous references, images and attachments; verify no source mutation, asset hashes/links and proposal evidence. Run parser tests, package checks, Knowns validation and git diff --check.

## Dependencies and scope

- Depends on tasks 01–05 for file versions, mapping and ChangeSet proposal contracts.
- The formal LLW grammar remains Markdown-like as approved; unsupported extensions stay explicit open questions.
- Spec Decision Compliance: D1=pass, D2=pass, D3=pass, D4=pass, D5=pass, D6=pass, D7=pass, D8=pass, D9=pass, D10=pass, D11=pass, D12=pass, D13=pass, D14=pass, D15=pass, D16=pass, D17=pass, D18=pass, D19=pass, D20=pass, D21=pass, D22=pass, D23=pass, D24=pass, D25=pass, D26=pass, D27=pass, D28=pass, D29=pass, D30=pass, D31=pass, D32=pass, D33=pass, D34=pass, D35=pass, D36=pass, D37=pass, D38=pass, D39=pass, D40=pass, D41=pass, D42=pass, D43=pass, D44=pass, D45=pass, D46=pass, D47=pass, D48=pass, D49=pass, D50=pass, D51=pass, D52=pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task created from approved spec; implementation plan and verification will be added before execution.
Full-wave planning pass: plan saved before implementation and baseline commit.
<!-- SECTION:NOTES:END -->

