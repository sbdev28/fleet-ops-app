# ---------------------------
# api.py
# ---------------------------
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Response
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
import os
import shutil

import fleet_db
from fleet_db import (
    init_db,
    list_assets,
    get_asset,
    create_asset,
    archive_asset,
    restore_asset,
    list_maintenance_tasks,
    upsert_task,
    log_service,
    log_trip,
    list_trip_events,
    list_service_events,
    seed_maintenance_from_template,
    add_document,
    list_documents,
    get_document,
    generate_maintenance_alerts,
    list_alerts,
    resolve_alert,
    calculate_asset_health,
    fleet_health_summary,
    explain_asset_health,
    predict_maintenance_window,
    fleet_maintenance_forecast,
    fleet_ai_brief,
    fleet_dashboard,
    ensure_default_api_key,
    get_api_key_record,
    touch_api_key_last_used,
    list_api_keys,
    create_api_key,
    revoke_api_key,
    set_api_key_scope,
    set_api_key_admin,
    list_audit_logs,
)

try:
    from cryptography.fernet import Fernet
except Exception:
    Fernet = None

DOCS_DIR = "docs_store"
DOC_ENCRYPTION_ENV = "DOC_ENCRYPTION_ENABLED"
DOC_ENCRYPTION_KEY_ENV = "DOC_ENCRYPTION_KEY"
DOC_ENCRYPTED_EXT = ".enc"
DEFAULT_CONTENT_TYPE = "application/octet-stream"
DEFAULT_ASSET_TYPE = "unknown"
DEFAULT_CATEGORY = "General"
VALID_SCOPES = {"read", "write", "admin"}
OPEN_PATHS = {"/v1/health"}
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

app = FastAPI(title="Fleet Ops API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------
# Response helpers
# ---------------------------
def api_response(data=None, meta=None, error=None):
    return {"data": data, "meta": meta or {}, "error": error}


def api_error(status_code: int, code: str, message: str):
    return JSONResponse(
        status_code=status_code,
        content=api_response(
            data=None,
            meta={},
            error={"code": code, "message": message},
        ),
    )


def env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "")
    if raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


DOC_ENCRYPTION_ENABLED = env_flag(DOC_ENCRYPTION_ENV, default=False)
DOC_FERNET = None


def _init_doc_encryption():
    global DOC_FERNET
    if not DOC_ENCRYPTION_ENABLED:
        DOC_FERNET = None
        return
    key = os.getenv(DOC_ENCRYPTION_KEY_ENV)
    if not key:
        raise RuntimeError(
            "Document encryption enabled but DOC_ENCRYPTION_KEY is missing")
    if Fernet is None:
        raise RuntimeError("cryptography is required for document encryption")
    DOC_FERNET = Fernet(key)


# ---------------------------
# STARTUP
# ---------------------------
@app.on_event("startup")
def startup():
    init_db()
    os.makedirs(DOCS_DIR, exist_ok=True)
    _init_doc_encryption()

    print("\n--- Fleet Ops API Startup ---")
    try:
        print("fleet_db module:", fleet_db.__file__)
        print("DB file:", getattr(fleet_db, "DB_FILE", "UNKNOWN"))
    except Exception:
        pass
    print("-----------------------------\n")

    new_key = ensure_default_api_key()
    if new_key:
        print("\n✅ DEFAULT API KEY (SAVE THIS):", new_key, "\n")


# ---------------------------
# Global error handling
# ---------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    status_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
    }
    code = status_map.get(exc.status_code, "ERROR")
    return api_error(exc.status_code, code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return api_error(422, "VALIDATION_ERROR", "Invalid request")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return api_error(500, "INTERNAL_ERROR", "Internal server error")


# ---------------------------
# Lesson 36: Permission ranking helper
# ---------------------------
PERMISSION_MAP = {"read": 1, "write": 2, "admin": 3}


def require_scope(request: Request, required: str):
    rec = getattr(request.state, "api_key_record", None)
    if rec is None:
        api_key = request.headers.get("X-API-Key", "")
        rec = get_api_key_record(api_key)
    if rec is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    scope = rec.get("scope")
    if PERMISSION_MAP.get(scope, 0) < PERMISSION_MAP.get(required, 0):
        raise HTTPException(
            status_code=403, detail=f"Scope '{required}' required")


# ---------------------------
# Lesson 38: Feature-scope guard
# ---------------------------
def require_feature_scope(request: Request, required: str):
    api_key = request.headers.get("X-API-Key", "")
    if not fleet_db.has_scope(api_key, required):
        raise HTTPException(
            status_code=403, detail=f"Scope '{required}' required")


# ---------------------------
# Lesson 33: Admin scope enforcement (keys:* routes)
# ---------------------------
def require_admin_scope(request: Request, required_scope: str) -> bool:
    rec = getattr(request.state, "api_key_record", None)
    if rec is None:
        api_key = request.headers.get("X-API-Key", "")
        rec = get_api_key_record(api_key)
    if rec is None or rec.get("scope") != required_scope:
        raise HTTPException(
            status_code=403, detail=f"Admin scope '{required_scope}' required")
    return True


# ---------------------------
# ✅ Middleware ORDER
# 1) audit_logger
# 2) api_key_auth
# 3) scope_enforcer
# ---------------------------
@app.middleware("http")
async def audit_logger(request: Request, call_next):
    if not request.url.path.startswith("/v1/"):
        return await call_next(request)

    try:
        response: Response = await call_next(request)
        status_code = response.status_code
        success = status_code < 400
        return response
    except Exception:
        status_code = 500
        success = False
        raise
    finally:
        if request.url.path != "/v1/health":
            try:
                rec = getattr(request.state, "api_key_record", None)
                api_key_id = rec.get("id") if rec else None
                scope = rec.get("scope") if rec else None
                fleet_db.write_audit_log(
                    api_key_id=api_key_id,
                    scope=scope,
                    method=request.method,
                    path=request.url.path,
                    status_code=status_code,
                    success=success,
                )
            except Exception:
                pass


@app.middleware("http")
async def api_key_auth(request: Request, call_next):
    if request.url.path in OPEN_PATHS:
        return await call_next(request)

    if not request.url.path.startswith("/v1/"):
        return await call_next(request)

    api_key = request.headers.get("X-API-Key", "")
    rec = get_api_key_record(api_key)
    if rec is None:
        return api_error(401, "UNAUTHORIZED", "Missing or invalid API key")
    request.state.api_key_record = rec
    touch_api_key_last_used(int(rec["id"]))

    return await call_next(request)


@app.middleware("http")
async def scope_enforcer(request: Request, call_next):
    if not request.url.path.startswith("/v1/"):
        return await call_next(request)

    if request.url.path in OPEN_PATHS:
        return await call_next(request)

    # Admin routes are handled by require_admin_scope inside those endpoints
    if request.url.path.startswith("/v1/admin/"):
        return await call_next(request)

    required = "write" if request.method.upper() in WRITE_METHODS else "read"

    try:
        require_scope(request, required)
    except HTTPException as e:
        return api_error(
            e.status_code,
            "FORBIDDEN" if e.status_code == 403 else "UNAUTHORIZED",
            str(e.detail),
        )

    return await call_next(request)


# ---------------------------
# Models
# ---------------------------
class AssetCreate(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(default=DEFAULT_ASSET_TYPE, min_length=1)
    starting_usage: float = Field(ge=0)


class TaskUpsert(BaseModel):
    task: str = Field(min_length=1)
    interval_value: float = Field(gt=0)
    last_done_value: float = Field(ge=0)
    category: str = Field(default=DEFAULT_CATEGORY, min_length=1)


class TaskComplete(BaseModel):
    task: str = Field(min_length=1)


class TripCreate(BaseModel):
    usage_added: float = Field(gt=0)


class AdminCreateKey(BaseModel):
    label: str = Field(default="default", min_length=1)
    is_admin: bool = Field(default=False)
    scope: str = Field(default="read", min_length=1)


class AdminUpdateScope(BaseModel):
    scope: str = Field(min_length=1)


class AdminUpdateAdmin(BaseModel):
    is_admin: bool = Field(default=False)


# ---------------------------
# Helpers
# ---------------------------
def group_tasks(asset: Dict[str, Any], tasks: List[Dict[str, Any]]):
    current = float(asset.get("usage_value", asset.get("engine_hours", 0.0)))
    unit = asset.get("usage_unit") or fleet_db.default_usage_unit(
        asset.get("type", "unknown"))

    grouped: Dict[str, List[Dict[str, Any]]] = {}

    for t in tasks:
        interval = float(t.get("interval_value", 0))
        last_done = float(t.get("last_done_value", 0))
        since_last = current - last_done
        due = since_last >= interval if interval > 0 else False

        cat = t.get("category") or "General"
        grouped.setdefault(cat, []).append(
            {
                "task": t["task"],
                "interval_value": interval,
                "last_done_value": last_done,
                "since_last": since_last,
                "due": due,
                "unit": t.get("unit") or unit,
            }
        )

    for cat in grouped:
        grouped[cat].sort(key=lambda x: x["task"].lower())

    return {"usage_value": current, "usage_unit": unit, "tasks": grouped}


def paginate(items: list, limit: int, offset: int):
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    total = len(items)
    page = items[offset: offset + limit]

    return {
        "items": page,
        "page": {
            "limit": limit,
            "offset": offset,
            "total": total,
            "has_more": (offset + limit) < total,
        },
    }


def safe_basename(filename: str) -> str:
    base = os.path.basename(filename or "")
    return base if base else "uploaded_file"


def ensure_docs_path(stored_path: str) -> str:
    abs_docs = os.path.abspath(DOCS_DIR)
    abs_path = os.path.abspath(stored_path)
    if not abs_path.startswith(abs_docs + os.sep):
        raise HTTPException(status_code=400, detail="Invalid document path")
    return abs_path


# ---------------------------
# Health
# ---------------------------
@app.get("/v1/health")
def health():
    return api_response(data={"status": "ok"})


@app.get("/v1/whoami")
def api_whoami(request: Request):
    rec = getattr(request.state, "api_key_record", None)
    if rec is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_response(
        data={
            "id": rec.get("id"),
            "label": rec.get("label"),
            "scope": rec.get("scope"),
            "is_admin": rec.get("is_admin"),
            "is_active": rec.get("is_active"),
            "created_at": rec.get("created_at"),
            "last_used_at": rec.get("last_used_at"),
        }
    )


@app.get("/v1/fleet/health")
def api_fleet_health():
    return api_response(data=fleet_health_summary())


@app.get("/v1/fleet/ai_brief")
def api_fleet_brief(horizon_hours: int = 50):
    return api_response(data=fleet_ai_brief(horizon_hours=horizon_hours))


# ---------------------------
# Forecast
# ---------------------------
@app.get("/v1/assets/{asset_id}/maintenance/forecast")
def api_maintenance_forecast(asset_id: int, horizon_hours: int = 50):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return api_response(data=predict_maintenance_window(asset_id, horizon_hours=horizon_hours))


@app.get("/v1/fleet/maintenance/forecast")
def api_fleet_maintenance_forecast(horizon_hours: int = 50, limit: int = 10):
    return api_response(data=fleet_maintenance_forecast(horizon_hours=horizon_hours, limit=limit))


# ---------------------------
# Assets
# ---------------------------
@app.get("/v1/assets")
def api_list_assets(include_archived: bool = False, limit: int = 50, offset: int = 0):
    # Feature scope optional gate (only works for admin until you store feature scopes in DB)
    # require_feature_scope(request, "assets:read")
    assets = list_assets(active_only=not include_archived)
    page = paginate(assets, limit=limit, offset=offset)
    return api_response(data=page["items"], meta=page["page"])


@app.post("/v1/assets")
def api_create_asset(payload: AssetCreate):
    asset_id = create_asset(payload.name, payload.type, payload.starting_usage)
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=500, detail="Failed to create asset")

    seed_maintenance_from_template(
        asset_id, payload.type, set_last_done_to_current=True)
    return api_response(data=asset)


@app.get("/v1/assets/{asset_id}")
def api_get_asset(asset_id: int):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return api_response(data=asset)


@app.post("/v1/assets/{asset_id}/archive")
def api_archive_asset(asset_id: int):
    ok = archive_asset(asset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Asset not found")
    return api_response(data={"status": "archived", "asset_id": asset_id})


@app.post("/v1/assets/{asset_id}/restore")
def api_restore_asset(asset_id: int):
    ok = restore_asset(asset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Asset not found")
    return api_response(data={"status": "restored", "asset_id": asset_id})


# ---------------------------
# Maintenance
# ---------------------------
@app.get("/v1/assets/{asset_id}/maintenance")
def api_list_maintenance(asset_id: int):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    tasks = list_maintenance_tasks(asset_id)
    return api_response(data=group_tasks(asset, tasks))


@app.post("/v1/assets/{asset_id}/maintenance")
def api_upsert_task(asset_id: int, payload: TaskUpsert):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if int(asset.get("is_active", 1)) != 1:
        raise HTTPException(status_code=409, detail="Asset is archived")

    unit = asset.get("usage_unit") or fleet_db.default_usage_unit(
        asset.get("type", "unknown"))

    upsert_task(
        asset_id,
        payload.task,
        payload.interval_value,
        payload.last_done_value,
        payload.category,
        unit
    )

    return api_response(
        data={
            "status": "saved",
            "asset_id": asset_id,
            "task": payload.task
        }
    )


@app.post("/v1/assets/{asset_id}/maintenance/complete")
def api_complete_task(asset_id: int, payload: TaskComplete):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if int(asset.get("is_active", 1)) != 1:
        raise HTTPException(status_code=409, detail="Asset is archived")

    ok = log_service(asset_id, payload.task)
    if not ok:
        raise HTTPException(status_code=404, detail="Task not found for asset")

    return api_response(data={"status": "completed", "asset_id": asset_id, "task": payload.task})


@app.post("/v1/assets/{asset_id}/maintenance/seed")
def api_seed_maintenance(asset_id: int):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if int(asset.get("is_active", 1)) != 1:
        raise HTTPException(status_code=409, detail="Asset is archived")

    out = seed_maintenance_from_template(asset_id, asset.get(
        "type", "unknown"), set_last_done_to_current=True)
    if not out.get("ok"):
        raise HTTPException(status_code=400, detail=out.get("error", "Failed"))
    return api_response(data=out)


@app.get("/v1/assets/{asset_id}/service")
def api_service_history(asset_id: int, limit: int = 50, offset: int = 0):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    services = list_service_events(asset_id)
    page = paginate(services, limit=limit, offset=offset)
    return api_response(data=page["items"], meta=page["page"])


# ---------------------------
# Trips
# ---------------------------
@app.post("/v1/assets/{asset_id}/trips")
def api_log_trip(asset_id: int, payload: TripCreate):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if int(asset.get("is_active", 1)) != 1:
        raise HTTPException(status_code=409, detail="Asset is archived")

    ok = log_trip(asset_id, payload.usage_added)
    if ok is False:
        raise HTTPException(status_code=400, detail="Trip not logged")

    return api_response(data={"status": "logged", "asset_id": asset_id, "usage_added": payload.usage_added})


@app.get("/v1/assets/{asset_id}/trips")
def api_trip_history(asset_id: int, limit: int = 50, offset: int = 0):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    trips = list_trip_events(asset_id)
    page = paginate(trips, limit=limit, offset=offset)
    return api_response(data=page["items"], meta=page["page"])


# ---------------------------
# Health endpoints
# ---------------------------
@app.get("/v1/assets/{asset_id}/health")
def api_asset_health(asset_id: int):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return api_response(data=calculate_asset_health(asset_id))


@app.get("/v1/assets/{asset_id}/health/explain")
def api_asset_health_explain(asset_id: int, top_n: int = 5):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return api_response(data=explain_asset_health(asset_id, top_n=top_n))


# ---------------------------
# Documents
# ---------------------------
@app.get("/v1/documents")
def api_list_documents(limit: int = 50, offset: int = 0):
    docs = list_documents()
    page = paginate(docs, limit=limit, offset=offset)
    return api_response(data=page["items"], meta=page["page"])


@app.post("/v1/documents")
def api_upload_document(
    title: str = Form(...),
    file: UploadFile = File(...),
):
    os.makedirs(DOCS_DIR, exist_ok=True)

    original_filename = safe_basename(file.filename)
    content_type = file.content_type or DEFAULT_CONTENT_TYPE
    stored_filename = (
        f"{original_filename}{DOC_ENCRYPTED_EXT}"
        if DOC_ENCRYPTION_ENABLED else original_filename
    )
    dest_path = os.path.join(DOCS_DIR, stored_filename)

    if os.path.exists(dest_path):
        base, ext = os.path.splitext(stored_filename)
        i = 2
        while os.path.exists(os.path.join(DOCS_DIR, f"{base}_{i}{ext}")):
            i += 1
        dest_path = os.path.join(DOCS_DIR, f"{base}_{i}{ext}")

    if DOC_ENCRYPTION_ENABLED:
        data = file.file.read()
        encrypted = DOC_FERNET.encrypt(data)
        with open(dest_path, "wb") as f:
            f.write(encrypted)
        is_encrypted = True
    else:
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        is_encrypted = False

    add_document(
        title=title,
        filename=os.path.basename(dest_path),
        stored_path=dest_path,
        is_encrypted=is_encrypted,
        original_filename=original_filename,
        content_type=content_type,
    )
    return api_response(
        data={
            "status": "stored",
            "title": title,
            "filename": os.path.basename(dest_path),
            "is_encrypted": is_encrypted,
        }
    )


@app.get("/v1/documents/{doc_id}/download")
def api_download_document(doc_id: int):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    stored_path = ensure_docs_path(doc["stored_path"])
    content_type = doc.get("content_type") or DEFAULT_CONTENT_TYPE
    filename = doc.get("original_filename") or doc.get(
        "filename") or "download"

    with open(stored_path, "rb") as f:
        data = f.read()

    if int(doc.get("is_encrypted", 0)) == 1:
        if DOC_FERNET is None:
            raise HTTPException(
                status_code=500, detail="Document encryption not configured")
        data = DOC_FERNET.decrypt(data)

    response = Response(content=data, media_type=content_type)
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# ---------------------------
# Admin
# ---------------------------
@app.get("/v1/admin/api-keys")
def api_admin_list_keys(request: Request, include_inactive: bool = False):
    require_admin_scope(request, "admin")
    return api_response(data=list_api_keys(include_inactive=include_inactive))


@app.post("/v1/admin/api-keys")
def api_admin_create_key(request: Request, payload: AdminCreateKey):
    require_admin_scope(request, "admin")
    scope = payload.scope.strip().lower()
    if scope not in VALID_SCOPES:
        raise HTTPException(status_code=400, detail="Invalid scope")
    if scope == "admin" and not payload.is_admin:
        raise HTTPException(
            status_code=400, detail="Admin scope requires is_admin=true")
    try:
        raw_key = create_api_key(
            label=payload.label,
            is_admin=payload.is_admin,
            scope=scope,
        )
    except ValueError as exc:
        msg = str(exc)
        status = 409 if "Only one active admin" in msg else 400
        raise HTTPException(status_code=status, detail=msg)
    return api_response(
        data={
            "api_key": raw_key,
            "label": payload.label,
            "scope": "admin" if payload.is_admin else scope,
            "is_admin": payload.is_admin,
        }
    )


@app.post("/v1/admin/api-keys/{key_id}/revoke")
def api_admin_revoke_key(request: Request, key_id: int):
    require_admin_scope(request, "admin")
    ok = revoke_api_key(key_id)
    if not ok:
        raise HTTPException(status_code=404, detail="API key not found")
    return api_response(data={"status": "revoked", "id": key_id})


@app.post("/v1/admin/api-keys/{key_id}/scope")
def api_admin_update_scope(request: Request, key_id: int, payload: AdminUpdateScope):
    require_admin_scope(request, "admin")
    scope = payload.scope.strip().lower()
    if scope not in {"read", "write"}:
        raise HTTPException(
            status_code=400, detail="Scope must be read or write")
    ok, reason = set_api_key_scope(key_id, scope)
    if not ok and reason == "not_found":
        raise HTTPException(status_code=404, detail="API key not found")
    if not ok and reason == "conflict":
        raise HTTPException(
            status_code=409, detail="Cannot change scope for admin key")
    return api_response(data={"status": "updated", "id": key_id, "scope": scope})


@app.post("/v1/admin/api-keys/{key_id}/admin")
def api_admin_update_admin(request: Request, key_id: int, payload: AdminUpdateAdmin):
    require_admin_scope(request, "admin")
    ok, reason = set_api_key_admin(key_id, payload.is_admin)
    if not ok and reason == "not_found":
        raise HTTPException(status_code=404, detail="API key not found")
    if not ok and reason == "conflict":
        raise HTTPException(
            status_code=409, detail="Only one active admin key is allowed")
    return api_response(data={"status": "updated", "id": key_id, "is_admin": payload.is_admin})


@app.get("/v1/admin/audit-logs")
def api_admin_audit_logs(request: Request, limit: int = 50, offset: int = 0):
    require_admin_scope(request, "admin")
    out = list_audit_logs(limit=limit, offset=offset)
    return api_response(data=out["items"], meta=out["page"])


@app.get("/v1/admin/diagnostics")
def api_admin_diagnostics(request: Request):
    require_admin_scope(request, "admin")
    return api_response(
        data={
            "doc_encryption_enabled": DOC_ENCRYPTION_ENABLED,
            "docs_dir": DOCS_DIR,
        }
    )


# ---------------------------
# Alerts
# ---------------------------
@app.get("/v1/alerts")
def api_list_alerts(include_resolved: bool = False, asset_id: Optional[int] = None):
    return api_response(data=list_alerts(asset_id=asset_id, include_resolved=include_resolved))


@app.post("/v1/assets/{asset_id}/alerts/generate")
def api_generate_alerts(asset_id: int):
    asset = get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if int(asset.get("is_active", 1)) != 1:
        raise HTTPException(status_code=409, detail="Asset is archived")
    generate_maintenance_alerts(asset_id)
    return api_response(data={"status": "generated", "asset_id": asset_id})


@app.post("/v1/alerts/{alert_id}/resolve")
def api_resolve_alert(alert_id: int):
    ok = resolve_alert(alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found")
    return api_response(data={"status": "resolved", "alert_id": alert_id})


# ---------------------------
# Dashboard
# ---------------------------
@app.get("/v1/fleet/dashboard")
def api_fleet_dashboard(limit_assets: int = 5, limit_tasks: int = 10):
    return api_response(data=fleet_dashboard(limit_assets=limit_assets, limit_tasks=limit_tasks))
