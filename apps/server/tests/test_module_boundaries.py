from pathlib import Path

from app.modules.dashboard.router import router as dashboard_router
from app.modules.datacenter.router import router as datacenter_router
from app.modules.design.router import router as design_router
from app.modules.operate.router import router as operate_router
from app.modules.organize.router import router as organize_router
from app.modules.project.router import router as project_router


def route_paths(router) -> set[str]:
    return {route.path for route in router.routes}


def test_feature_routers_own_distinct_surface_paths() -> None:
    assert "/api/v1/projects" in route_paths(project_router)
    assert "/api/v1/projects/{project_id}/cameras/import" in route_paths(datacenter_router)
    assert "/api/v1/projects/{project_id}/cameras/{entity_id}/designed-geometry" in route_paths(design_router)
    assert "/api/v1/projects/{project_id}/observations" in route_paths(operate_router)
    assert "/api/v1/projects/{project_id}/organize" in route_paths(organize_router)
    assert "/api/v1/projects/{project_id}/dashboard" in route_paths(dashboard_router)


def test_compatibility_domain_facade_exports_context_contracts() -> None:
    from app.domain import Camera, OrganizeGroup, Project, RevisionConflict
    from app.modules.datacenter.domain import Camera as DatacenterCamera
    from app.modules.project.domain import Project as ProjectContract

    assert Camera is DatacenterCamera
    assert Project is ProjectContract
    assert OrganizeGroup.__module__.endswith("organize.domain")
    assert issubclass(RevisionConflict, Exception)


def test_main_core_owns_server_composition_without_router_main_imports() -> None:
    from app.main_core.app_factory import create_app
    from app.main_core.dependencies import get_store

    assert create_app is not None
    assert get_store is not None

    router_root = Path(__file__).parents[1] / "app" / "modules"
    for router_path in router_root.glob("*/router.py"):
        source = router_path.read_text(encoding="utf-8")
        assert "from ... import main" not in source
        assert "from ...main import" not in source
