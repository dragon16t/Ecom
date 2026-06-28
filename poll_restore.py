import time, requests, json, re
BASE = "https://weather-preview-6.preview.emergentagent.com"
HEADERS = {"X-Admin-Token": "celestaglow2024"}

r = requests.post(f"{BASE}/api/admin/catalog/backup/restore-async?force=true", headers=HEADERS, timeout=30)
print("kickoff:", r.status_code, r.text[:250], flush=True)
if r.status_code == 409:
    m = re.search(r"job_id=([0-9a-f]+)", r.text)
    job_id = m.group(1)
else:
    job_id = r.json().get("job_id")
print("job_id:", job_id, flush=True)

t0 = time.time()
last = None
for i in range(120):
    time.sleep(5)
    s = requests.get(f"{BASE}/api/admin/catalog/backup/restore/status?job_id={job_id}", headers=HEADERS, timeout=30)
    if s.status_code != 200:
        print(f"poll {s.status_code}: {s.text[:200]}", flush=True); break
    last = s.json()
    elapsed = round(time.time() - t0, 1)
    print(f"[{elapsed}s] status={last.get('status')} phase={last.get('phase')} elapsed_sec={last.get('elapsed_sec')}", flush=True)
    if last.get("status") in ("done", "error"):
        break

print("\n=== FINAL ===", flush=True)
print(json.dumps(last, indent=2, default=str)[:4000], flush=True)

if last and last.get("status") == "done":
    time.sleep(3)
    s2 = requests.get(f"{BASE}/api/admin/catalog/backup/restore/status?job_id={job_id}", headers=HEADERS, timeout=30)
    print("\ncache poll status:", s2.status_code, s2.json().get("status"), flush=True)
