from fleet_db import init_db, list_assets, get_due_maintenance

init_db()

assets = list_assets()
print("Assets")
for a in assets:
    print(a)

print("\nMaintenance Due check:")
for a in assets:
    due = get_due_maintenance(a["id"])
    print(a["name"], "due:", [d["task"] for d in due] or "None")
