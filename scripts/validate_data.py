#!/usr/bin/env python3
"""檢查 site/data/*.json 是否符合評分規則。CI 與本機都可執行：python scripts/validate_data.py

規則：
- 已評分 + 未評分 = 候選人總數（EXPECTED_TOTAL，登記截止後由中選會名單確認）
- 每個面向 0–4 的整數
- 證據標籤：【隱含】最高 3 分；【延續】且未寫規模最高 2 分（以 ev 文字含「未說明規模」或「未列」判斷，人工複核）
- 至少一個面向 ≥ 1（有青年相關政見，含方向宣示）才能放進排名
- 有分數的面向必須有證據文字；有證據文字的面向必須有分數
- 每位候選人至少一個來源連結，且為 https
"""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "site" / "data"
DIMS = ["emp", "edu", "house", "health", "partic", "family", "incl", "global", "climate"]
EXPECTED_TOTAL = 81
TAG = re.compile(r"【(直接|隱含|延續)】")

errors, warns = [], []


def load(name):
    with open(DATA / name, encoding="utf-8") as f:
        return json.load(f)


cands = load("candidates.json")
unscored = load("unscored.json")
dims = load("dimensions.json")
weights = load("weights.json")
meta = load("meta.json")

if [d["key"] for d in sorted(dims, key=lambda d: d["order"])] != DIMS:
    errors.append("dimensions.json 的面向與 DIMS 不一致")

total = len(cands) + len(unscored)
if total != EXPECTED_TOTAL:
    errors.append(f"候選人總數 {total}，預期 {EXPECTED_TOTAL}")

ids = set()
names = set()
for c in cands:
    who = f"{c.get('county')} {c.get('name')}"
    if c["id"] in ids:
        errors.append(f"{who}: id 重複 {c['id']}")
    ids.add(c["id"])
    names.add((c["county"], c["name"]))
    scores = []
    for k in DIMS:
        s = c.get(k)
        ev = c.get(f"ev_{k}", "") or ""
        if not isinstance(s, int) or not 0 <= s <= 4:
            errors.append(f"{who}: {k} 分數 {s!r} 不是 0–4 整數")
            continue
        scores.append(s)
        tags = set(TAG.findall(ev))
        if s > 0 and not ev.strip():
            errors.append(f"{who}: {k}={s} 但沒有證據文字")
        if s == 0 and ev.strip():
            warns.append(f"{who}: {k}=0 但有證據文字，請確認")
        if s > 0 and not tags:
            errors.append(f"{who}: {k} 證據缺少【直接】/【隱含】/【延續】標籤")
        if s == 4 and "直接" not in tags:
            errors.append(f"{who}: {k}=4 但沒有【直接】措施（隱含最高 3）")
        if tags == {"延續"} and s > 2 and not re.search(r"\d|全體|全面|所有", ev):
            errors.append(f"{who}: {k}={s} 只有【延續】且未說明對象、金額或數量（最高 2）")
        elif tags == {"延續"} and s > 2:
            warns.append(f"{who}: {k}={s} 只靠【延續】得 3 分，請人工確認規模描述")
    if scores and max(scores) < 1:
        errors.append(f"{who}: 所有面向都是 0，應移到 unscored.json")
    srcs = [c.get(f"src{i}_url") for i in range(1, 7) if c.get(f"src{i}_url")]
    if not srcs:
        errors.append(f"{who}: 沒有來源連結")
    for u in srcs:
        if not u.startswith("https://"):
            warns.append(f"{who}: 來源不是 https：{u}")
    if c.get("completeness") not in {"A", "B", "C"}:
        errors.append(f"{who}: completeness 應為 A/B/C")

for u in unscored:
    key = (u["county"], u["name"])
    if key in names:
        errors.append(f"{u['county']} {u['name']}: 同時出現在已評分與未評分")
    if not u.get("note"):
        warns.append(f"{u['county']} {u['name']}: 未評分但沒有說明")

for w in weights:
    vals = [w.get(f"w_{k}") for k in DIMS]
    if any(not isinstance(v, (int, float)) or v < 1 for v in vals):
        errors.append(f"weights {w.get('focus')}: 權重需為 ≥1 的數字")

if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", meta.get("updated", "")):
    errors.append("meta.updated 格式應為 YYYY-MM-DD")

for w in warns:
    print("警告:", w)
for e in errors:
    print("錯誤:", e)
print(f"已評分 {len(cands)}、未評分 {len(unscored)}、合計 {total}；錯誤 {len(errors)}、警告 {len(warns)}")
sys.exit(1 if errors else 0)
