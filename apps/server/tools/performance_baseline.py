from __future__ import annotations

import argparse
import json
import time
from tempfile import TemporaryDirectory
from uuid import uuid4

from app.domain import Camera, CameraStore


def benchmark(size: int) -> dict[str, float | int]:
    with TemporaryDirectory() as directory:
        store = CameraStore()
        project = store.create_project(f"benchmark-{size}", directory)
        started = time.perf_counter()
        for index in range(size):
            store.import_camera(
                project.id,
                Camera(
                    entity_id=uuid4(),
                    project_id=project.id,
                    code=f"CAM-{index:06d}",
                    name=f"Camera {index}",
                    properties={"benchmark": True},
                ),
                "benchmark",
            )
        elapsed = time.perf_counter() - started
        snapshot_started = time.perf_counter()
        store.organize_snapshot(project.id)
        snapshot_elapsed = time.perf_counter() - snapshot_started
    return {
        "records": size,
        "import_seconds": round(elapsed, 6),
        "import_records_per_second": round(size / elapsed, 3) if elapsed else 0,
        "snapshot_seconds": round(snapshot_elapsed, 6),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure current Camera domain baseline.")
    parser.add_argument("--sizes", nargs="+", type=int, default=[1000, 10000, 50000])
    args = parser.parse_args()
    print(json.dumps([benchmark(size) for size in args.sizes], indent=2))


if __name__ == "__main__":
    main()
