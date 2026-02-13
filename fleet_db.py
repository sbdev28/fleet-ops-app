# ---------------------------
# fleet_db.py (CLEAN: scopes + admin + feature scopes + audit log)
# ---------------------------
import hashlib
import hmac
import secrets
import sqlite3
from typing import Optional, List, Dict, Any, Tuple
DB_FILE = "fleet.db"

# ===========================
# CONSTANTS
# ===========================
DEFAULT_SCOPE = "read"
DEFAULT_LABEL = "default"
ADMIN_SCOPE = "admin"
HASH_ALGORITHM = "sha256"
HASH_ITERATIONS = 200_000
SALT_BYTES = 16

# ===========================
# MIGRATION HELPERS
# ===========================


def _column_exists(conn, table: str, col: str) -> bool:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table});")
    cols = [r[1] for r in cur.fetchall()]
    return col in cols


def _new_salt() -> str:
    return secrets.token_hex(SALT_BYTES)


def _hash_api_key(raw_key: str, salt_hex: str) -> str:
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac(
        HASH_ALGORITHM,
        raw_key.encode("utf-8"),
        salt,
        HASH_ITERATIONS,
    )
    return digest.hex()


def _migrate_api_keys_to_hashed(conn) -> None:
    cur = conn.cursor()
    cur.execute("SELECT id, api_key, api_key_salt FROM api_keys")
    rows = cur.fetchall()
    for row in rows:
        if row["api_key_salt"]:
            continue
        raw_key = str(row["api_key"])
        salt = _new_salt()
        hashed = _hash_api_key(raw_key, salt)
        cur.execute(
            "UPDATE api_keys SET api_key = ?, api_key_salt = ? WHERE id = ?",
            (hashed, salt, int(row["id"])),
        )
    conn.commit()


def _enforce_single_active_admin(conn) -> None:
    cur = conn.cursor()
    cur.execute("""
        SELECT id
        FROM api_keys
        WHERE is_active = 1 AND COALESCE(is_admin, 0) = 1
        ORDER BY id DESC
    """)
    rows = [r["id"] for r in cur.fetchall()]
    if len(rows) <= 1:
        return
    keep_id = rows[0]
    for key_id in rows[1:]:
        cur.execute(
            "UPDATE api_keys SET is_active = 0 WHERE id = ?",
            (int(key_id),),
        )
    conn.commit()


def _dedupe_unresolved_alerts(conn) -> None:
    cur = conn.cursor()
    cur.execute("""
        UPDATE alerts
        SET resolved = 1
        WHERE resolved = 0 AND id NOT IN (
            SELECT MAX(id)
            FROM alerts
            WHERE resolved = 0
            GROUP BY asset_id, task, alert_type
        );
    """)
    conn.commit()

def migrate_db():
    """
    Safe, additive migration.
    Adds new unit-aware columns while keeping legacy columns for compatibility.
    """
    conn = get_conn()
    cur = conn.cursor()

    # ---------- assets: usage_unit + usage_value ----------
    if not _column_exists(conn, "assets", "usage_unit"):
        cur.execute(
            "ALTER TABLE assets ADD COLUMN usage_unit TEXT NOT NULL DEFAULT 'engine_hours';")

    if not _column_exists(conn, "assets", "usage_value"):
        cur.execute(
            "ALTER TABLE assets ADD COLUMN usage_value REAL NOT NULL DEFAULT 0;")

    # Backfill usage_value from legacy engine_hours
    cur.execute("""
        UPDATE assets
        SET usage_value = engine_hours
        WHERE (usage_value IS NULL OR usage_value = 0) AND engine_hours IS NOT NULL;
    """)

    # ---------- maintenance_tasks: interval_value + last_done_value + unit ----------
    if not _column_exists(conn, "maintenance_tasks", "interval_value"):
        cur.execute(
            "ALTER TABLE maintenance_tasks ADD COLUMN interval_value REAL NOT NULL DEFAULT 0;")

    if not _column_exists(conn, "maintenance_tasks", "last_done_value"):
        cur.execute(
            "ALTER TABLE maintenance_tasks ADD COLUMN last_done_value REAL NOT NULL DEFAULT 0;")

    if not _column_exists(conn, "maintenance_tasks", "unit"):
        cur.execute(
            "ALTER TABLE maintenance_tasks ADD COLUMN unit TEXT NOT NULL DEFAULT 'engine_hours';")

    # Backfill from legacy interval_hours/last_done_hours
    cur.execute("""
        UPDATE maintenance_tasks
        SET interval_value = interval_hours
        WHERE (interval_value IS NULL OR interval_value = 0) AND interval_hours IS NOT NULL;
    """)
    cur.execute("""
        UPDATE maintenance_tasks
        SET last_done_value = last_done_hours
        WHERE (last_done_value IS NULL OR last_done_value = 0) AND last_done_hours IS NOT NULL;
    """)

    # ---------- trip_events: usage_added + unit ----------
    if not _column_exists(conn, "trip_events", "usage_added"):
        cur.execute(
            "ALTER TABLE trip_events ADD COLUMN usage_added REAL NOT NULL DEFAULT 0;")

    if not _column_exists(conn, "trip_events", "unit"):
        cur.execute(
            "ALTER TABLE trip_events ADD COLUMN unit TEXT NOT NULL DEFAULT 'engine_hours';")

    # Backfill usage_added from legacy hours_added
    cur.execute("""
        UPDATE trip_events
        SET usage_added = hours_added
        WHERE (usage_added IS NULL OR usage_added = 0) AND hours_added IS NOT NULL;
    """)

    # ---------- service_events: service_value + unit ----------
    if not _column_exists(conn, "service_events", "service_value"):
        cur.execute(
            "ALTER TABLE service_events ADD COLUMN service_value REAL NOT NULL DEFAULT 0;")

    if not _column_exists(conn, "service_events", "unit"):
        cur.execute(
            "ALTER TABLE service_events ADD COLUMN unit TEXT NOT NULL DEFAULT 'engine_hours';")

    # Backfill service_value from legacy service_hours
    cur.execute("""
        UPDATE service_events
        SET service_value = service_hours
        WHERE (service_value IS NULL OR service_value = 0) AND service_hours IS NOT NULL;
    """)

    # ---------- api_keys: salt + last_used_at ----------
    if not _column_exists(conn, "api_keys", "api_key_salt"):
        cur.execute(
            "ALTER TABLE api_keys ADD COLUMN api_key_salt TEXT NOT NULL DEFAULT '';")

    if not _column_exists(conn, "api_keys", "last_used_at"):
        cur.execute(
            "ALTER TABLE api_keys ADD COLUMN last_used_at TEXT;")

    _migrate_api_keys_to_hashed(conn)
    _enforce_single_active_admin(conn)

    # ---------- alerts: task + dedupe ----------
    if not _column_exists(conn, "alerts", "task"):
        cur.execute(
            "ALTER TABLE alerts ADD COLUMN task TEXT;")
    _dedupe_unresolved_alerts(conn)

    # ---------- documents: encryption metadata ----------
    if not _column_exists(conn, "documents", "is_encrypted"):
        cur.execute(
            "ALTER TABLE documents ADD COLUMN is_encrypted INTEGER NOT NULL DEFAULT 0;")
    if not _column_exists(conn, "documents", "original_filename"):
        cur.execute(
            "ALTER TABLE documents ADD COLUMN original_filename TEXT;")
    if not _column_exists(conn, "documents", "content_type"):
        cur.execute(
            "ALTER TABLE documents ADD COLUMN content_type TEXT;")

    # ---------- audit_logs: api_key_id + timestamp ----------
    if not _column_exists(conn, "audit_logs", "api_key_id"):
        cur.execute(
            "ALTER TABLE audit_logs ADD COLUMN api_key_id INTEGER;")
    if not _column_exists(conn, "audit_logs", "timestamp"):
        cur.execute(
            "ALTER TABLE audit_logs ADD COLUMN timestamp TEXT;")
        if _column_exists(conn, "audit_logs", "created_at"):
            cur.execute("""
                UPDATE audit_logs
                SET timestamp = created_at
                WHERE timestamp IS NULL;
            """)
        else:
            cur.execute("""
                UPDATE audit_logs
                SET timestamp = CURRENT_TIMESTAMP
                WHERE timestamp IS NULL;
            """)

    conn.commit()
    conn.close()


# ===========================
# DB CONNECTION
# ===========================


def get_conn():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


# ===========================
# INIT + MIGRATIONS
# ===========================
def init_db():
    conn = get_conn()
    cur = conn.cursor()

    # ---------- Core ----------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'unknown',
            engine_hours REAL NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS maintenance_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER NOT NULL,
            task TEXT NOT NULL,
            interval_hours REAL NOT NULL,
            last_done_hours REAL NOT NULL DEFAULT 0,
            category TEXT NOT NULL DEFAULT 'General',
            UNIQUE(asset_id, task),
            FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS trip_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER NOT NULL,
            hours_added REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS service_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER NOT NULL,
            task TEXT NOT NULL,
            service_hours REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            filename TEXT NOT NULL,
            stored_path TEXT NOT NULL,
            is_encrypted INTEGER NOT NULL DEFAULT 0,
            original_filename TEXT,
            content_type TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER NOT NULL,
            task TEXT,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(asset_id) REFERENCES assets(id)
        );
    """)

    # ---------- API KEYS ----------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key TEXT NOT NULL UNIQUE,
            api_key_salt TEXT NOT NULL,
            label TEXT NOT NULL DEFAULT 'default',
            is_active INTEGER NOT NULL DEFAULT 1,
            is_admin INTEGER NOT NULL DEFAULT 0,
            scope TEXT NOT NULL DEFAULT 'read',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_used_at TEXT
        );
    """)

    # ---------- AUDIT LOG ----------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key_id INTEGER,
            scope TEXT,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            status_code INTEGER NOT NULL,
            success INTEGER NOT NULL DEFAULT 0,
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    """)

    conn.commit()

    # ---------- indexes ----------
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_tasks_asset ON maintenance_tasks(asset_id);")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_trips_asset ON trip_events(asset_id);")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_services_asset ON service_events(asset_id);")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_assets_active ON assets(is_active);")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_alerts_asset ON alerts(asset_id);")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key);")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_api_keys_scope ON api_keys(scope);")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(timestamp);")

    conn.commit()
    conn.close()

    migrate_db()


# ===========================
# USAGE UNIT LOGIC
# ===========================


def default_usage_unit(asset_type: str) -> str:
    t = (asset_type or "unknown").strip().lower()

    if t in {"car", "vehicle"}:
        return "miles"

    if t in {"jet", "aircraft", "plane"}:
        return "flight_hours"

    if t in {"helicopter"}:
        return "flight_hours"

    return "engine_hours"

# ===========================
# ASSETS
# ===========================


def list_assets(active_only: bool = True) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    sql = "SELECT * FROM assets"
    if active_only:
        sql += " WHERE is_active = 1"
    cur.execute(sql)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_asset(asset_id: int) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def create_asset(name: str, asset_type: str, starting_usage: float) -> int:
    unit = default_usage_unit(asset_type)

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO assets (name, type, engine_hours, usage_unit, usage_value, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
    """, (name, asset_type, float(starting_usage), unit, float(starting_usage)))

    conn.commit()
    asset_id = int(cur.lastrowid)
    conn.close()
    return asset_id


def update_asset(asset_id: int, name: str, asset_type: str, usage_value: float) -> bool:
    unit = default_usage_unit(asset_type)

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        UPDATE assets
        SET name = ?,
            type = ?,
            usage_unit = ?,
            usage_value = ?,
            engine_hours = ?
        WHERE id = ?
    """, (name, asset_type, unit, float(usage_value), float(usage_value), int(asset_id)))

    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def archive_asset(asset_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE assets SET is_active = 0 WHERE id = ?", (asset_id,))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def restore_asset(asset_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE assets SET is_active = 1 WHERE id = ?", (asset_id,))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


# ===========================
# MAINTENANCE
# ===========================
def upsert_task(asset_id: int, task: str, interval_value: float, last_done_value: float, category: str, unit: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO maintenance_tasks(asset_id, task, interval_hours, last_done_hours, category, interval_value, last_done_value, unit)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id, task) DO UPDATE SET
            interval_hours = excluded.interval_hours,
            last_done_hours = excluded.last_done_hours,
            category = excluded.category,
            interval_value = excluded.interval_value,
            last_done_value = excluded.last_done_value,
            unit = excluded.unit;
    """, (
        int(asset_id),
        str(task),
        float(interval_value),
        float(last_done_value),
        str(category),
        float(interval_value),
        float(last_done_value),
        str(unit),
    ))
    conn.commit()
    conn.close()


def list_maintenance_tasks(asset_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT task, interval_value, last_done_value, unit, category
        FROM maintenance_tasks
        WHERE asset_id = ?
        ORDER BY category, task
    """, (int(asset_id),))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def log_service(asset_id: int, task: str) -> bool:
    asset = get_asset(asset_id)
    if not asset:
        return False
    if int(asset.get("is_active", 1)) != 1:
        return False

    current = float(asset.get("usage_value", asset.get("engine_hours", 0.0)))
    unit = asset.get("usage_unit") or default_usage_unit(
        asset.get("type", "unknown"))

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        UPDATE maintenance_tasks
        SET last_done_value = ?, last_done_hours = ?
        WHERE asset_id = ? AND task = ?
    """, (current, current, int(asset_id), str(task)))

    if cur.rowcount == 0:
        conn.close()
        return False

    cur.execute("""
        INSERT INTO service_events (asset_id, task, service_hours, service_value, unit)
        VALUES (?, ?, ?, ?, ?)
    """, (int(asset_id), str(task), current, current, str(unit)))

    conn.commit()
    conn.close()
    return True


def list_service_events(asset_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT task, service_value, unit, created_at
        FROM service_events
        WHERE asset_id = ?
        ORDER BY created_at DESC
    """, (int(asset_id),))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


# ===========================
# TRIPS
# ===========================
def log_trip(asset_id: int, usage_added: float) -> bool:
    if float(usage_added) <= 0:
        return False

    asset = get_asset(asset_id)
    if not asset:
        return False

    if int(asset.get("is_active", 1)) != 1:
        return False

    unit = asset.get("usage_unit") or default_usage_unit(
        asset.get("type", "unknown"))

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        UPDATE assets
        SET usage_value = usage_value + ?, engine_hours = engine_hours + ?
        WHERE id = ? AND is_active = 1
    """, (float(usage_added), float(usage_added), int(asset_id)))

    if cur.rowcount == 0:
        conn.close()
        return False

    cur.execute("""
        INSERT INTO trip_events (asset_id, hours_added, usage_added, unit)
        VALUES (?, ?, ?, ?)
    """, (int(asset_id), float(usage_added), float(usage_added), str(unit)))

    conn.commit()
    conn.close()
    return True


def list_trip_events(asset_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT usage_added, unit, created_at
        FROM trip_events
        WHERE asset_id = ?
        ORDER BY created_at DESC
    """, (int(asset_id),))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


# ===========================
# DOCUMENTS
# ===========================
def add_document(title: str, filename: str, stored_path: str, is_encrypted: bool,
                 original_filename: str, content_type: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO documents (title, filename, stored_path, is_encrypted, original_filename, content_type)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (title, filename, stored_path, 1 if is_encrypted else 0, original_filename, content_type))
    conn.commit()
    conn.close()


def list_documents():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, title, filename, is_encrypted, original_filename, content_type, created_at
        FROM documents
        ORDER BY created_at DESC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def list_documents_with_paths():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, title, filename, stored_path, is_encrypted, original_filename, content_type, created_at
        FROM documents
        ORDER BY created_at DESC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_document(doc_id: int) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, title, filename, stored_path, is_encrypted, original_filename, content_type, created_at
        FROM documents
        WHERE id = ?
    """, (int(doc_id),))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


# ===========================
# ALERTS
# ===========================
def generate_maintenance_alerts(asset_id: int):
    asset = get_asset(asset_id)
    if not asset:
        return
    if int(asset.get("is_active", 1)) != 1:
        return

    tasks = list_maintenance_tasks(asset_id)
    current = float(asset.get("usage_value", asset.get("engine_hours", 0.0)))

    conn = get_conn()
    cur = conn.cursor()

    for t in tasks:
        if current - float(t["last_done_value"]) >= float(t["interval_value"]):
            cur.execute("""
                SELECT 1
                FROM alerts
                WHERE asset_id = ? AND task = ? AND alert_type = 'maintenance_due' AND resolved = 0
                LIMIT 1
            """, (asset_id, str(t["task"])))
            exists = cur.fetchone() is not None
            if exists:
                continue
            cur.execute("""
                INSERT INTO alerts (asset_id, task, alert_type, severity, message, resolved)
                VALUES (?, ?, 'maintenance_due', 'CRITICAL', ?, 0)
            """, (asset_id, str(t["task"]), f"{t['task']} overdue"))

    conn.commit()
    conn.close()


def list_alerts(asset_id: Optional[int] = None, include_resolved: bool = False):
    conn = get_conn()
    cur = conn.cursor()
    sql = "SELECT * FROM alerts"
    params: List[Any] = []
    where = []

    if asset_id is not None:
        where.append("asset_id = ?")
        params.append(int(asset_id))

    if not include_resolved:
        where.append("resolved = 0")

    if where:
        sql += " WHERE " + " AND ".join(where)

    sql += " ORDER BY datetime(created_at) DESC, id DESC"
    cur.execute(sql, params)

    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def resolve_alert(alert_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE alerts SET resolved = 1 WHERE id = ?", (alert_id,))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


# ===========================
# HEALTH / AI (simple versions)
# ===========================
def calculate_asset_health(asset_id: int):
    asset = get_asset(asset_id)
    if not asset:
        return {"score": 0, "risk_level": "RED", "overdue_tasks": 0, "warnings": 0}

    tasks = list_maintenance_tasks(asset_id)
    overdue = 0
    warnings = 0
    current = float(asset.get("usage_value", asset.get("engine_hours", 0.0)))

    for t in tasks:
        interval = float(t["interval_value"])
        last_done = float(t["last_done_value"])
        since = current - last_done
        if since >= interval:
            overdue += 1
        elif since >= interval * 0.9:
            warnings += 1

    score = 100 - overdue * 15 - warnings * 5
    score = max(0, min(100, score))
    risk = "GREEN" if score >= 80 else "YELLOW" if score >= 50 else "RED"

    return {"score": score, "risk_level": risk, "overdue_tasks": overdue, "warnings": warnings}


def fleet_health_summary():
    assets = list_assets(True)
    return {"total_active_assets": len(assets)}


def explain_asset_health(asset_id: int, top_n: int = 5):
    return calculate_asset_health(asset_id)


def predict_maintenance_window(asset_id: int, horizon_hours: int = 50):
    return {"asset_id": asset_id, "horizon_hours": horizon_hours, "predicted_due": []}


def fleet_maintenance_forecast(horizon_hours: int = 50, limit: int = 10):
    return {"horizon_hours": horizon_hours, "count": 0, "top": []}


def fleet_ai_brief(horizon_hours: int = 50):
    return {"horizon_hours": horizon_hours, "health_summary": fleet_health_summary()}


def fleet_dashboard(limit_assets: int = 5, limit_tasks: int = 10):
    assets = list_assets(True)
    scored = []
    for a in assets:
        h = calculate_asset_health(int(a["id"]))
        scored.append({
            "id": a["id"],
            "name": a["name"],
            "type": a["type"],
            "engine_hours": a["engine_hours"],
            "score": h["score"],
            "risk_level": h["risk_level"],
            "overdue_tasks": h["overdue_tasks"],
            "warnings": h["warnings"],
        })
    scored.sort(key=lambda x: (
        x["score"], -x["overdue_tasks"], -x["warnings"]))
    return {
        "summary": {"active_assets": len(assets)},
        "top_risky_assets": scored[:int(limit_assets)],
        "top_overdue_tasks": [],
    }


# ===========================
# API KEYS + SCOPES
# ===========================
VALID_SCOPES = {"read", "write", "admin"}


def _normalize_scope(scope: str, is_admin: bool = False) -> str:
    if is_admin:
        return ADMIN_SCOPE
    s = (scope or DEFAULT_SCOPE).strip().lower()
    if s not in VALID_SCOPES:
        raise ValueError("Invalid scope")
    return s


def _active_admin_exists(conn) -> bool:
    cur = conn.cursor()
    cur.execute("""
        SELECT 1
        FROM api_keys
        WHERE is_active = 1 AND COALESCE(is_admin, 0) = 1
        LIMIT 1
    """)
    return cur.fetchone() is not None


def create_api_key(label: str = DEFAULT_LABEL, is_admin: bool = False, scope: str = DEFAULT_SCOPE) -> str:
    key = secrets.token_urlsafe(32)
    scope_norm = _normalize_scope(scope, is_admin=is_admin)
    salt = _new_salt()
    hashed = _hash_api_key(key, salt)

    conn = get_conn()
    cur = conn.cursor()
    if scope_norm == ADMIN_SCOPE and not is_admin:
        conn.close()
        raise ValueError("Admin scope requires is_admin=True")
    if is_admin and _active_admin_exists(conn):
        conn.close()
        raise ValueError("Only one active admin key is allowed")
    cur.execute("""
        INSERT INTO api_keys (api_key, api_key_salt, label, is_active, is_admin, scope)
        VALUES (?, ?, ?, 1, ?, ?)
    """, (hashed, salt, label, 1 if is_admin else 0, scope_norm))
    conn.commit()
    conn.close()
    return key


def ensure_default_api_key() -> str:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM api_keys WHERE is_active = 1 LIMIT 1")
    exists = cur.fetchone() is not None
    conn.close()
    if exists:
        return ""
    return create_api_key(label=DEFAULT_LABEL, is_admin=True, scope=ADMIN_SCOPE)


def get_api_key_record(raw_key: str) -> Optional[Dict[str, Any]]:
    if not raw_key:
        return None
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, api_key, api_key_salt, label, is_active,
               COALESCE(is_admin, 0) AS is_admin,
               COALESCE(scope, CASE WHEN COALESCE(is_admin,0)=1 THEN 'admin' ELSE 'read' END) AS scope,
               created_at, last_used_at
        FROM api_keys
        WHERE is_active = 1
    """)
    rows = cur.fetchall()
    for row in rows:
        salt = row["api_key_salt"] or ""
        if not salt:
            continue
        candidate = _hash_api_key(raw_key, str(salt))
        if hmac.compare_digest(candidate, str(row["api_key"])):
            conn.close()
            return dict(row)
    conn.close()
    return None


def get_api_key_scope(raw_key: str) -> Optional[str]:
    rec = get_api_key_record(raw_key)
    return str(rec["scope"]) if rec else None


def is_valid_api_key(raw_key: str) -> bool:
    return get_api_key_record(raw_key) is not None


def touch_api_key_last_used(key_id: int) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
        (int(key_id),),
    )
    conn.commit()
    conn.close()


def list_api_keys(include_inactive: bool = False) -> List[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    sql = """
        SELECT id,
               label,
               is_active,
               COALESCE(is_admin, 0) AS is_admin,
               COALESCE(scope, CASE WHEN COALESCE(is_admin,0)=1 THEN 'admin' ELSE 'read' END) AS scope,
               created_at,
               last_used_at
        FROM api_keys
    """
    if not include_inactive:
        sql += " WHERE is_active = 1"
    sql += " ORDER BY id DESC"
    cur.execute(sql)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def revoke_api_key(key_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE api_keys SET is_active = 0 WHERE id = ?",
                (int(key_id),))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def set_api_key_admin(key_id: int, is_admin: bool) -> Tuple[bool, str]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, is_admin, is_active FROM api_keys WHERE id = ?", (int(key_id),))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False, "not_found"
    already_admin = int(row["is_admin"] or 0) == 1
    if is_admin:
        if already_admin and int(row["is_active"] or 0) == 1:
            conn.close()
            return True, "ok"
        if _active_admin_exists(conn):
            conn.close()
            return False, "conflict"
        cur.execute(
            "UPDATE api_keys SET is_admin = 1, scope = 'admin' WHERE id = ?", (int(key_id),))
    else:
        cur.execute(
            "UPDATE api_keys SET is_admin = 0 WHERE id = ?", (int(key_id),))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok, "ok" if ok else "not_found"


def set_api_key_scope(key_id: int, scope: str) -> Tuple[bool, str]:
    scope_norm = _normalize_scope(scope, is_admin=False)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, is_admin FROM api_keys WHERE id = ?",
                (int(key_id),))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False, "not_found"
    if int(row["is_admin"] or 0) == 1:
        conn.close()
        return False, "conflict"
    cur.execute("UPDATE api_keys SET scope = ? WHERE id = ?",
                (scope_norm, int(key_id)))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok, "ok" if ok else "not_found"


# ===========================
# LESSON 33: ADMIN + FEATURE SCOPES HELPERS
# ===========================
def is_admin_with_scope(raw_key: str, required_scope: str) -> bool:
    # For Lesson 33 keys:* checks — treat only admin scope as valid admin
    return get_api_key_scope(raw_key) == ADMIN_SCOPE


def has_scope(raw_key: str, required: str) -> bool:
    """
    Feature scope placeholder.
    For now, we allow:
      - admin scope => everything
      - otherwise: feature scopes are NOT stored in DB yet, so return False unless you expand schema later.
    """
    scope = get_api_key_scope(raw_key)
    if scope == "admin":
        return True

    # If you later store feature scopes in DB, implement lookup here.
    return False


# ===========================
# AUDIT LOG WRITER
# ===========================
def write_audit_log(api_key_id: Optional[int], scope: Optional[str], method: str, path: str,
                    status_code: int, success: bool):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO audit_logs (api_key_id, scope, method, path, status_code, success, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    """, (api_key_id, scope or None, method, path, int(status_code), 1 if success else 0))
    conn.commit()
    conn.close()


def list_audit_logs(limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(1) AS total FROM audit_logs")
    total = int(cur.fetchone()["total"])
    cur.execute("""
        SELECT id, api_key_id, scope, method, path, status_code, success, timestamp
        FROM audit_logs
        ORDER BY datetime(timestamp) DESC, id DESC
        LIMIT ? OFFSET ?
    """, (limit, offset))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return {
        "items": rows,
        "page": {
            "limit": limit,
            "offset": offset,
            "total": total,
            "has_more": (offset + limit) < total,
        },
    }


# ===========================
# MAINTENANCE TEMPLATE SEEDING
# ===========================
def maintenance_template(asset_type: str):
    t = (asset_type or "unknown").strip().lower()

    if t in {"yacht", "boat"}:
        return [
            {"task": "Engine Oil Change", "interval_value": 100, "category": "Engine"},
            {"task": "Safety Check", "interval_value": 50, "category": "Safety"},
            {"task": "Hull Inspection", "interval_value": 200,
                "category": "Inspection"},
            {"task": "Bilge Pump Test", "interval_value": 25, "category": "Safety"},
        ]

    if t in {"helicopter"}:
        return [
            {"task": "100-hr Inspection", "interval_value": 100,
                "category": "Inspection"},
            {"task": "Rotor Track & Balance", "interval_value": 25,
                "category": "Transmission/Rotors"},
            {"task": "Transmission/Gearbox Inspection",
                "interval_value": 50, "category": "Transmission/Rotors"},
            {"task": "Engine Oil Service", "interval_value": 50, "category": "Engine"},
            {"task": "Avionics/Electrical Systems Check",
                "interval_value": 100, "category": "Flight Systems"},
        ]

    if t in {"car", "vehicle"}:
        return [
            {"task": "Oil Change", "interval_value": 5000, "category": "Engine"},
            {"task": "Tire Rotation", "interval_value": 6000, "category": "Wheels"},
            {"task": "Brake Inspection", "interval_value": 12000, "category": "Brakes"},
        ]

    return [
        {"task": "General Inspection", "interval_value": 100, "category": "General"},
        {"task": "Safety Check", "interval_value": 50, "category": "Safety"},
    ]


def seed_maintenance_from_template(asset_id: int, asset_type: str, set_last_done_to_current: bool = True):
    asset = get_asset(asset_id)
    if not asset:
        return {"ok": False, "error": "Asset not found"}

    current = float(asset.get("usage_value", asset.get("engine_hours", 0.0)))
    unit = asset.get("usage_unit") or default_usage_unit(
        asset.get("type", "unknown"))

    tasks = maintenance_template(asset_type)

    seeded = 0
    for t in tasks:
        interval_value = float(
            t.get("interval_value", t.get("interval_hours", 0)))
        last_done_value = current if set_last_done_to_current else 0.0

        upsert_task(
            int(asset_id),
            str(t["task"]),
            float(interval_value),
            float(last_done_value),
            str(t.get("category") or "General"),
            str(unit),
        )
        seeded += 1

    return {"ok": True, "seeded": seeded}
