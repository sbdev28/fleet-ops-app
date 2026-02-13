import csv
import os
import shutil

from fleet_db import (
    init_db,
    list_assets_with_index,
    list_assets,
    upsert_asset,
    upsert_task,
    log_trip,
    list_trip_events,
    list_maintenance_tasks,
    log_service,
    list_service_events,
    add_document,
    list_documents_with_paths,
    archive_asset,   # ✅ changed from delete to archive
)

ASSET_TYPES = {"yacht", "center_console", "jet_ski",
               "helicopter", "car", "jet"}  # ✅ added jet
DOCS_DIR = "docs_store"
DOC_ENCRYPTION_ENV = "DOC_ENCRYPTION_ENABLED"
DOC_ENCRYPTION_KEY_ENV = "DOC_ENCRYPTION_KEY"
DOC_ENCRYPTED_EXT = ".enc"
DEFAULT_CONTENT_TYPE = "application/octet-stream"

try:
    from cryptography.fernet import Fernet
except Exception:
    Fernet = None


def env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "")
    if raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


DOC_ENCRYPTION_ENABLED = env_flag(DOC_ENCRYPTION_ENV, default=False)
DOC_FERNET = None
if DOC_ENCRYPTION_ENABLED:
    key = os.getenv(DOC_ENCRYPTION_KEY_ENV)
    if not key:
        raise RuntimeError("Document encryption enabled but DOC_ENCRYPTION_KEY is missing")
    if Fernet is None:
        raise RuntimeError("cryptography is required for document encryption")
    DOC_FERNET = Fernet(key)


# ---------------- Helpers ----------------
def normalize_asset_type(asset_type: str) -> str:
    asset_type = asset_type.strip().lower()
    alias = {
        "jetski": "jet_ski",
        "jet ski": "jet_ski",
        "center console": "center_console",
        "centerconsole": "center_console",
    }
    return alias.get(asset_type, asset_type)


def print_tabs():
    print("\n=== Fleet Ops (SQLite) ===")
    print("1) Trips")
    print("2) Fleet")
    print("3) Documentation")
    print("4) Exit")


def choose_asset(include_archived: bool = False):
    assets = list_assets_with_index(active_only=not include_archived)
    if not assets:
        print("❌ No assets in DB. Add one first.")
        return None

    print("\nAssets:")
    for i, a in enumerate(assets):
        status = "" if int(a.get("is_active", 1)) == 1 else " (ARCHIVED)"
        print(
            f"{i} - {a['name']} [{a['type']}] | {float(a['engine_hours']):.1f} hrs{status}")

    choice = input("Select asset number: ").strip()
    try:
        idx = int(choice)
        return assets[idx]
    except (ValueError, IndexError):
        print("❌ Invalid selection.")
        return None


def refresh_asset(asset_id: int):
    for a in list_assets_with_index(active_only=False):
        if int(a["id"]) == int(asset_id):
            return a
    return None


def compute_due_from_tasks(asset, tasks):
    current = float(asset["engine_hours"])
    due = []
    for t in tasks:
        interval = float(t["interval_hours"])
        last_done = float(t["last_done_hours"])
        since_last = current - last_done
        if since_last >= interval:
            due.append({
                "task": t["task"],
                "category": t.get("category", "General"),
                "interval_hours": interval,
                "since_last": since_last,
            })
    due.sort(key=lambda x: (x["category"], -
             (x["since_last"] - x["interval_hours"])))
    return due


# ---------------- Maintenance Templates (with categories) ----------------
def maintenance_template(asset_type: str):
    if asset_type == "jet":
        # 7+ meaningful insights for jets
        return [
            {"task": "Preflight Inspection", "interval_hours": 10,
                "last_done_hours": 0.0, "category": "Inspection"},
            {"task": "A-Check (basic systems)", "interval_hours": 50,
             "last_done_hours": 0.0, "category": "Inspection"},
            {"task": "Engine Oil Service", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Engine"},
            {"task": "Hydraulic System Check", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Systems"},
            {"task": "Avionics / NAV Database Update", "interval_hours": 60,
                "last_done_hours": 0.0, "category": "Avionics"},
            {"task": "Landing Gear Inspection", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Airframe"},
            {"task": "Fuel System Inspection", "interval_hours": 150,
                "last_done_hours": 0.0, "category": "Fuel"},
            {"task": "Cabin Safety Equipment Check", "interval_hours": 50,
                "last_done_hours": 0.0, "category": "Safety"},
        ]

    if asset_type == "yacht":
        return [
            {"task": "Engine Oil & Filter", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Engine"},
            {"task": "Fuel Filters (Primary/Secondary)", "interval_hours": 150,
             "last_done_hours": 0.0, "category": "Fuel"},
            {"task": "Raw Water Impeller", "interval_hours": 200,
                "last_done_hours": 0.0, "category": "Cooling"},
            {"task": "Cooling System Check (hoses/clamps)", "interval_hours": 100,
             "last_done_hours": 0.0, "category": "Cooling"},
            {"task": "Generator Service", "interval_hours": 150,
                "last_done_hours": 0.0, "category": "Engine"},
            {"task": "Hull Inspection (blisters/damage)", "interval_hours": 100,
             "last_done_hours": 0.0, "category": "Hull"},
            {"task": "Through-Hull & Seacock Inspection", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Safety"},
            {"task": "Zincs/Anodes Inspect & Replace", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Hull"},
            {"task": "Bilge Pump & Float Switch Test", "interval_hours": 50,
                "last_done_hours": 0.0, "category": "Safety"},
            {"task": "Teak Deck Soft Wash", "interval_hours": 25,
                "last_done_hours": 0.0, "category": "Exterior"},
            {"task": "Teak Condition Check (caulk/wear)", "interval_hours": 50,
             "last_done_hours": 0.0, "category": "Exterior"},
            {"task": "Exterior Wash & Wax", "interval_hours": 50,
                "last_done_hours": 0.0, "category": "Exterior"},
            {"task": "Stainless Corrosion Check", "interval_hours": 75,
                "last_done_hours": 0.0, "category": "Exterior"},
            {"task": "Battery/Electrical Load Test", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Electrical"},
        ]

    if asset_type == "center_console":
        return [
            {"task": "Engine Oil & Filter", "interval_hours": 80,
                "last_done_hours": 0.0, "category": "Engine"},
            {"task": "Lower Unit Gear Oil", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Drive"},
            {"task": "Fuel/Water Separator", "interval_hours": 120,
                "last_done_hours": 0.0, "category": "Fuel"},
            {"task": "Prop & Shaft Inspection", "interval_hours": 60,
                "last_done_hours": 0.0, "category": "Drive"},
            {"task": "Steering System Check (hydraulic)", "interval_hours": 75,
             "last_done_hours": 0.0, "category": "Safety"},
            {"task": "Hull Inspection (cracks/impact)", "interval_hours": 75,
             "last_done_hours": 0.0, "category": "Hull"},
            {"task": "Deck Hardware Tightness Check", "interval_hours": 75,
                "last_done_hours": 0.0, "category": "Exterior"},
            {"task": "T-Top/Console Fastener Inspection", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Exterior"},
            {"task": "Exterior Wash & Protectant", "interval_hours": 40,
                "last_done_hours": 0.0, "category": "Exterior"},
            {"task": "Teak/SeaDeck Condition Check", "interval_hours": 75,
                "last_done_hours": 0.0, "category": "Exterior"},
            {"task": "Saltwater Flush & Corrosion Inspection",
                "interval_hours": 25, "last_done_hours": 0.0, "category": "Exterior"},
            {"task": "Battery & Charging System Test", "interval_hours": 80,
                "last_done_hours": 0.0, "category": "Electrical"},
        ]

    if asset_type == "jet_ski":
        return [
            {"task": "Engine Oil & Filter", "interval_hours": 50,
                "last_done_hours": 0.0, "category": "Engine"},
            {"task": "Spark Plugs", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Engine"},
            {"task": "Jet Pump/Impeller Inspection", "interval_hours": 60,
                "last_done_hours": 0.0, "category": "Drive"},
            {"task": "Wear Ring Check", "interval_hours": 60,
                "last_done_hours": 0.0, "category": "Drive"},
            {"task": "Cooling Flush (post-salt)", "interval_hours": 15,
             "last_done_hours": 0.0, "category": "Cooling"},
            {"task": "Battery/Terminals Clean", "interval_hours": 40,
                "last_done_hours": 0.0, "category": "Electrical"},
            {"task": "Hull/Intake Grate Inspection", "interval_hours": 50,
                "last_done_hours": 0.0, "category": "Hull"},
            {"task": "Fuel Lines/Clamps Inspection", "interval_hours": 75,
                "last_done_hours": 0.0, "category": "Fuel"},
        ]

    if asset_type == "helicopter":
        return [
            {"task": "Preflight/Daily Inspection", "interval_hours": 10,
                "last_done_hours": 0.0, "category": "Inspection"},
            {"task": "25-hr Airframe Check", "interval_hours": 25,
                "last_done_hours": 0.0, "category": "Inspection"},
            {"task": "50-hr Inspection", "interval_hours": 50,
                "last_done_hours": 0.0, "category": "Inspection"},
            {"task": "100-hr Inspection", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Inspection"},
            {"task": "Rotor Track & Balance", "interval_hours": 25,
                "last_done_hours": 0.0, "category": "Transmission/Rotors"},
            {"task": "Transmission/Gearbox Inspection", "interval_hours": 50,
                "last_done_hours": 0.0, "category": "Transmission/Rotors"},
            {"task": "Engine Oil Service", "interval_hours": 50,
                "last_done_hours": 0.0, "category": "Engine"},
            {"task": "Avionics/Electrical Systems Check", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Flight Systems"},
        ]

    if asset_type == "car":
        return [
            {"task": "Engine Oil & Filter", "interval_hours": 75,
                "last_done_hours": 0.0, "category": "Engine"},
            {"task": "Tire Rotation", "interval_hours": 100,
                "last_done_hours": 0.0, "category": "Safety"},
            {"task": "Brake Inspection (pads/rotors/fluid)", "interval_hours": 150,
             "last_done_hours": 0.0, "category": "Safety"},
            {"task": "Air/Cabin Filters", "interval_hours": 150,
                "last_done_hours": 0.0, "category": "Engine"},
            {"task": "Coolant Hoses/Level Check", "interval_hours": 120,
                "last_done_hours": 0.0, "category": "Cooling"},
            {"task": "Battery/Charging Test", "interval_hours": 200,
                "last_done_hours": 0.0, "category": "Electrical"},
            {"task": "Transmission Fluid Inspection", "interval_hours": 300,
                "last_done_hours": 0.0, "category": "Drive"},
            {"task": "Suspension/Alignment Check", "interval_hours": 250,
                "last_done_hours": 0.0, "category": "Safety"},
        ]

    return [
        {"task": "General Inspection", "interval_hours": 100,
            "last_done_hours": 0.0, "category": "General"},
        {"task": "Safety Check", "interval_hours": 50,
            "last_done_hours": 0.0, "category": "Safety"},
        {"task": "Electrical Check", "interval_hours": 100,
            "last_done_hours": 0.0, "category": "Electrical"},
        {"task": "Fluids & Leaks Check", "interval_hours": 50,
            "last_done_hours": 0.0, "category": "Engine"},
        {"task": "Hardware/Fasteners Check", "interval_hours": 100,
            "last_done_hours": 0.0, "category": "Exterior"},
        {"task": "Filter Check", "interval_hours": 150,
            "last_done_hours": 0.0, "category": "Engine"},
        {"task": "Lubrication Check", "interval_hours": 100,
            "last_done_hours": 0.0, "category": "Engine"},
    ]


def ensure_template_tasks(asset):
    for t in maintenance_template(asset["type"]):
        upsert_task(
            asset["id"],
            t["task"],
            float(t["interval_hours"]),
            float(t["last_done_hours"]),
            t["category"],
        )


# ---------------- Trips Tab ----------------
def print_trips_menu():
    print("\n--- Trips ---")
    print("1) Log trip")
    print("2) View trips (history)")
    print("3) Back")


def trips_log_trip():
    asset = choose_asset()
    if asset is None:
        return

    try:
        hrs = float(input("Trip hours: "))
        if hrs <= 0:
            raise ValueError
    except ValueError:
        print("❌ Trip hours must be a positive number.")
        return

    ok = log_trip(asset["id"], hrs)
    if not ok:
        print("❌ Failed to log trip. Asset may be inactive.")
        return

    asset = refresh_asset(asset["id"]) or asset
    tasks = list_maintenance_tasks(asset["id"])
    due = compute_due_from_tasks(asset, tasks)

    print(f"✅ Logged {hrs:.1f} hrs for {asset['name']}")
    if due:
        print("⚠️ Maintenance due:")
        current_cat = None
        for d in due:
            if d["category"] != current_cat:
                current_cat = d["category"]
                print(f"\n[{current_cat}]")
            print(
                f"- {d['task']}: {d['since_last']:.1f} since last (interval {d['interval_hours']:.0f})")
    else:
        print("✅ No maintenance due")


def trips_view_trips():
    # allow viewing archived history if desired
    asset = choose_asset(include_archived=True)
    if asset is None:
        return

    events = list_trip_events(asset["id"])
    if not events:
        print("No trips recorded yet.")
        return

    print(f"\nTrip history for {asset['name']}:")
    for e in events[:25]:
        print(f"- {float(e['hours_added']):.1f} hrs @ {e['created_at']}")


def trips_tab():
    while True:
        print_trips_menu()
        choice = input("Select option: ").strip()
        if choice == "1":
            trips_log_trip()
        elif choice == "2":
            trips_view_trips()
        elif choice == "3":
            break
        else:
            print("❌ Invalid selection.")


# ---------------- Fleet Tab ----------------
def print_fleet_menu():
    print("\n--- Fleet ---")
    print("1) View fleet status")
    print("2) Add new asset")
    print("3) View asset detail")
    print("4) Maintenance (by asset)")
    print("5) Archive asset (keep data)")  # ✅ changed behavior/label
    print("6) Back")


def fleet_view_status():
    assets = list_assets_with_index(active_only=True)
    if not assets:
        print("No assets yet.")
        return
    print("\nFleet status:")
    for i, a in enumerate(assets):
        print(
            f"{i} - {a['name']} [{a['type']}] | {float(a['engine_hours']):.1f} hrs")


def fleet_add_asset():
    print("\nAdd New Asset")
    name = input("Asset name: ").strip()
    if not name:
        print("❌ Name cannot be empty.")
        return

    print("\nChoose asset type:")
    for t in sorted(ASSET_TYPES):
        print("-", t)

    asset_type = normalize_asset_type(input("Asset type: "))
    if asset_type not in ASSET_TYPES:
        print("❌ Invalid asset type.")
        return

    try:
        starting_hours = float(input("Starting hours: "))
        if starting_hours < 0:
            raise ValueError
    except ValueError:
        print("❌ Starting hours must be 0 or greater.")
        return

    asset_id = upsert_asset(name, asset_type, starting_hours)
    asset = {"id": asset_id, "type": asset_type}
    ensure_template_tasks(asset)

    print(f"✅ Added {name} [{asset_type}] with {starting_hours:.1f} hrs.")


def fleet_view_asset_detail():
    # allow viewing archived detail if desired
    asset = choose_asset(include_archived=True)
    if asset is None:
        return

    ensure_template_tasks(asset)

    tasks = list_maintenance_tasks(asset["id"])
    due = compute_due_from_tasks(asset, tasks)

    archived = " (ARCHIVED)" if int(asset.get("is_active", 1)) == 0 else ""
    print(f"\nAsset detail: {asset['name']} [{asset['type']}] {archived}")
    print(f"Engine hours: {float(asset['engine_hours']):.1f}")

    if due:
        print("\nMaintenance due (grouped):")
        current_cat = None
        for d in due:
            if d["category"] != current_cat:
                current_cat = d["category"]
                print(f"\n[{current_cat}]")
            print(
                f"- {d['task']}: {d['since_last']:.1f} since last (interval {d['interval_hours']:.0f})")
    else:
        print("No maintenance due.")


def fleet_archive_asset():
    asset = choose_asset(include_archived=False)
    if asset is None:
        return

    print("\n⚠️ ARCHIVE ASSET CONFIRMATION")
    print(f"Asset: {asset['name']} [{asset['type']}]")
    print("This will HIDE the asset from the fleet list, but KEEP ALL DATA:")
    print("- maintenance tasks")
    print("- trip history")
    print("- service history")
    confirm = input("Type ARCHIVE to confirm: ").strip()

    if confirm != "ARCHIVE":
        print("Cancelled.")
        return

    ok = archive_asset(asset["id"])
    if ok:
        print("✅ Asset archived (data kept).")
    else:
        print("❌ Archive failed (asset not found).")


# ---------------- Maintenance Sub-Tab ----------------
def print_maintenance_menu():
    print("\n--- Maintenance ---")
    print("1) View all tasks (grouped)")
    print("2) View due tasks (grouped)")
    print("3) Add maintenance task")
    print("4) Complete maintenance task")
    print("5) View service history")
    print("6) Sync template tasks (adds missing)")
    print("7) Back")


def maintenance_view_all(asset):
    tasks = list_maintenance_tasks(asset["id"])
    if not tasks:
        print("No maintenance tasks found.")
        return

    current = float(asset["engine_hours"])
    tasks_sorted = sorted(tasks, key=lambda t: (
        t.get("category", "General"), t["task"].lower()))

    print(f"\nAll tasks for {asset['name']} (hrs: {current:.1f})")
    current_cat = None
    for t in tasks_sorted:
        cat = t.get("category", "General")
        if cat != current_cat:
            current_cat = cat
            print(f"\n[{current_cat}]")

        interval = float(t["interval_hours"])
        last_done = float(t["last_done_hours"])
        since_last = current - last_done
        remaining = interval - since_last
        print(f"- {t['task']} | interval {interval:.0f} | last {last_done:.1f} | since {since_last:.1f} | remaining {remaining:.1f}")


def maintenance_view_due(asset):
    tasks = list_maintenance_tasks(asset["id"])
    due = compute_due_from_tasks(asset, tasks)
    if not due:
        print("✅ No maintenance due")
        return

    print(
        f"\n⚠️ Due for {asset['name']} (hrs: {float(asset['engine_hours']):.1f})")
    current_cat = None
    for d in due:
        if d["category"] != current_cat:
            current_cat = d["category"]
            print(f"\n[{current_cat}]")
        print(
            f"- {d['task']}: {d['since_last']:.1f} since last (interval {d['interval_hours']:.0f})")


def maintenance_add_task(asset):
    print(f"\nAdd maintenance task for {asset['name']}")

    category = input(
        "Category (Engine/Hull/Exterior/etc): ").strip() or "General"
    task = input("Task name: ").strip()
    if not task:
        print("❌ Task name cannot be empty.")
        return

    try:
        interval = float(input("Interval hours: "))
        if interval <= 0:
            raise ValueError
    except ValueError:
        print("❌ Interval must be a positive number.")
        return

    try:
        last_done_raw = input("Last done hours (Enter for 0): ").strip()
        last_done = float(last_done_raw) if last_done_raw else 0.0
        if last_done < 0:
            raise ValueError
    except ValueError:
        print("❌ Last done hours must be 0 or greater.")
        return

    upsert_task(asset["id"], task, interval, last_done, category)
    print(
        f"✅ Saved: [{category}] {task} (interval {interval:.0f}, last done {last_done:.1f})")


def maintenance_complete_task(asset):
    tasks = list_maintenance_tasks(asset["id"])
    due = compute_due_from_tasks(asset, tasks)
    if not due:
        print("✅ No maintenance due to complete.")
        return

    print("\nDue tasks:")
    for i, d in enumerate(due):
        print(
            f"{i} - [{d['category']}] {d['task']} (since last: {d['since_last']:.1f} hrs)")

    choice = input("Select task number to mark completed: ").strip()
    try:
        idx = int(choice)
        task_name = due[idx]["task"]
    except (ValueError, IndexError):
        print("❌ Invalid selection.")
        return

    ok = log_service(asset["id"], task_name)
    if ok:
        print(f"✅ Marked completed: {task_name}")
    else:
        print("❌ Could not mark task completed.")


def maintenance_view_service_history(asset):
    events = list_service_events(asset["id"])
    if not events:
        print("No service history.")
        return

    print(f"\nService history for {asset['name']}:")
    for e in events[:25]:
        print(
            f"- {e['task']} @ {float(e['service_hours']):.1f} hrs on {e['created_at']}")


def maintenance_tab():
    asset = choose_asset(include_archived=True)
    if asset is None:
        return

    while True:
        asset = refresh_asset(asset["id"]) or asset

        print_maintenance_menu()
        choice = input("Select option: ").strip()

        if choice == "1":
            maintenance_view_all(asset)
        elif choice == "2":
            maintenance_view_due(asset)
        elif choice == "3":
            maintenance_add_task(asset)
        elif choice == "4":
            maintenance_complete_task(asset)
        elif choice == "5":
            maintenance_view_service_history(asset)
        elif choice == "6":
            ensure_template_tasks(asset)
            print("✅ Synced template tasks (added missing + updated intervals).")
        elif choice == "7":
            break
        else:
            print("❌ Invalid selection.")


def fleet_tab():
    while True:
        print_fleet_menu()
        choice = input("Select option: ").strip()
        if choice == "1":
            fleet_view_status()
        elif choice == "2":
            fleet_add_asset()
        elif choice == "3":
            fleet_view_asset_detail()
        elif choice == "4":
            maintenance_tab()
        elif choice == "5":
            fleet_archive_asset()  # ✅ archive instead of delete
        elif choice == "6":
            break
        else:
            print("❌ Invalid selection.")


# ---------------- Documentation Tab ----------------
def print_docs_menu():
    print("\n--- Documentation ---")
    print("1) Store a file")
    print("2) View stored files")
    print("3) Export fleet report (CSV)")
    print("4) Back")


def docs_store_file():
    os.makedirs(DOCS_DIR, exist_ok=True)

    src = input(
        "Path to file to store (drag-drop path works): ").strip().strip('"')
    if not src or not os.path.exists(src):
        print("❌ File not found.")
        return

    title = input("Title/label for this file: ").strip()
    if not title:
        title = os.path.basename(src)

    original_filename = os.path.basename(src)
    stored_filename = (
        f"{original_filename}{DOC_ENCRYPTED_EXT}"
        if DOC_ENCRYPTION_ENABLED else original_filename
    )
    dest = os.path.join(DOCS_DIR, stored_filename)

    if os.path.exists(dest):
        base, ext = os.path.splitext(stored_filename)
        i = 2
        while os.path.exists(os.path.join(DOCS_DIR, f"{base}_{i}{ext}")):
            i += 1
        dest = os.path.join(DOCS_DIR, f"{base}_{i}{ext}")

    if DOC_ENCRYPTION_ENABLED:
        with open(src, "rb") as f:
            data = f.read()
        encrypted = DOC_FERNET.encrypt(data)
        with open(dest, "wb") as f:
            f.write(encrypted)
        is_encrypted = True
    else:
        shutil.copy2(src, dest)
        is_encrypted = False

    add_document(
        title,
        os.path.basename(dest),
        dest,
        is_encrypted,
        original_filename,
        DEFAULT_CONTENT_TYPE,
    )

    print(f"✅ Stored: {os.path.basename(dest)}")
    print(f"Location: {dest}")


def docs_view_files():
    docs = list_documents_with_paths()
    if not docs:
        print("No stored files yet.")
        return

    print("\nStored files:")
    for d in docs[:50]:
        print(f"- {d['title']} | {d['filename']} | {d['created_at']}")
        print(f"  {d['stored_path']}")


def docs_export_fleet_report(filename="fleet_summary.csv"):
    assets = list_assets_with_index(active_only=True)
    with open(filename, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Asset Name", "Type", "Engine Hours",
                        "Maintenance Due (count)"])

        for a in assets:
            tasks = list_maintenance_tasks(a["id"])
            due = compute_due_from_tasks(a, tasks)
            writer.writerow([
                a["name"],
                a["type"],
                f"{float(a['engine_hours']):.1f}",
                str(len(due)),
            ])

    print(f"📄 Exported report: {filename}")


def documentation_tab():
    while True:
        print_docs_menu()
        choice = input("Select option: ").strip()
        if choice == "1":
            docs_store_file()
        elif choice == "2":
            docs_view_files()
        elif choice == "3":
            docs_export_fleet_report()
        elif choice == "4":
            break
        else:
            print("❌ Invalid selection.")


# ---------------- Main ----------------
def main():
    init_db()
    print("Fleet Ops initialized.")

    # Sync templates for ALL assets (including archived) so data stays consistent
    for a in list_assets(active_only=False):
        ensure_template_tasks(a)

    while True:
        print_tabs()
        choice = input("Select tab: ").strip()
        if choice == "1":
            trips_tab()
        elif choice == "2":
            fleet_tab()
        elif choice == "3":
            documentation_tab()
        elif choice == "4":
            print("Exiting.")
            break
        else:
            print("❌ Invalid selection.")


if __name__ == "__main__":
    main()
