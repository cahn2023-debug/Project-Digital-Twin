from uuid import uuid4

from app.importer import parse_camera_rows


def test_camera_import_normalizes_values_and_retains_provenance() -> None:
    file_id = uuid4()
    cameras, issues = parse_camera_rows(
        [{
            "CameraCode": " CAM-001 ",
            "Name": " Main Camera ",
            "IP Address": "192.168.001.010",
            "Latitude": "13.7563",
            "Longitude": "100.5018",
        }],
        file_id=file_id,
        file_revision=7,
    )

    assert not issues
    assert cameras[0].code == "CAM-001"
    assert cameras[0].ip_address == "192.168.1.10"
    assert cameras[0].source is not None
    assert cameras[0].source.file_id == file_id
    assert cameras[0].source.file_revision == 7
    assert cameras[0].source.row == 2


def test_camera_import_reports_duplicate_and_invalid_rows() -> None:
    cameras, issues = parse_camera_rows([
        {"CameraCode": "CAM-001", "IP": "not-an-ip"},
        {"CameraCode": "CAM-001", "IP": "10.0.0.1"},
        {"Name": "missing code"},
    ])

    assert not cameras
    assert {issue.code for issue in issues} == {"INVALID_VALUE", "DUPLICATE_CAMERA_CODE", "MISSING_CAMERA_CODE"}
