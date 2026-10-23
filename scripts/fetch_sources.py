#!/usr/bin/env python3
"""抓取 sources.yaml 的來源，存成文字快照，只輸出「有變動」的項目（不使用 AI，不需付費）。

python scripts/fetch_sources.py            # 抓取並更新 state/hashes.json
輸出：
  state/snapshots/<key>.txt   最新文字快照
  state/changes.json          這次有變動的項目清單（供 extract_with_claude.py 使用）
"""
import hashlib
import io
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path

import requests
import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "state"
SNAP = STATE / "snapshots"
HASHES = STATE / "hashes.json"
CHANGES = STATE / "changes.json"
UA = {"User-Agent": "youth-policy-guide-bot/1.0 (+civic project; contact in repo README)"}

SNAP.mkdir(parents=True, exist_ok=True)


def key_for(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:16]


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        t.decompose()
    text = soup.get_text("\n")
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def pdf_to_text(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((p.extract_text() or "") for p in reader.pages)


PDFDIR = STATE / "pdf"  # 原始 PDF 只留在執行環境，不提交到儲存庫（見 .gitignore）


def fetch(url: str, key: str = ""):
    """回傳 (文字, PDF 路徑或 None)。PDF 會另存一份，讓判讀步驟可以把原檔交給 Claude（掃描檔也讀得到）。"""
    r = requests.get(url, headers=UA, timeout=60)
    r.raise_for_status()
    ctype = r.headers.get("content-type", "")
    if "pdf" in ctype or urllib.parse.unquote(url).lower().endswith(".pdf"):
        PDFDIR.mkdir(parents=True, exist_ok=True)
        path = PDFDIR / f"{key or key_for(url)}.pdf"
        path.write_bytes(r.content)
        text = pdf_to_text(r.content)
        # 掃描檔抽不到文字時，用檔案雜湊判斷是否有變動
        if len(text.strip()) < 200:
            text = "[掃描檔] sha256=" + hashlib.sha256(r.content).hexdigest()
        return text, str(path.relative_to(ROOT))
    r.encoding = r.apparent_encoding or "utf-8"
    return html_to_text(r.text), None


def discover_bulletins(cfg: dict):
    """自動找出中選會選舉公報網站上本屆直轄市長、縣市長的公報 PDF。

    公報網站的目錄格式（以 111 年為例）：
      https://bulletin.cec.gov.tw/?dir=01選舉公報/04縣市長/111年/01紙本公報
    目錄頁內的 PDF 是直接連結，例如：
      https://bulletin.cec.gov.tw/01選舉公報/04縣市長/111年/01紙本公報/新竹市市長.pdf
    本屆資料夾出現前，這個函式會回傳空清單，下次排程再試。
    """
    b = cfg.get("bulletin", {}) or {}
    year = str(b.get("year", "115"))
    found = []
    for office in b.get("offices", ["03直轄市長", "04縣市長"]):
        d = f"01選舉公報/{office}/{year}年/01紙本公報"
        url = "https://bulletin.cec.gov.tw/?dir=" + urllib.parse.quote(d, safe="")
        try:
            r = requests.get(url, headers=UA, timeout=30)
            r.raise_for_status()
        except Exception as e:  # noqa: BLE001
            print(f"公報目錄尚未開放或無法連線 {d}: {e}", file=sys.stderr)
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = urllib.parse.urljoin(url, a["href"])
            name = urllib.parse.unquote(href.rsplit("/", 1)[-1])
            if not name.lower().endswith(".pdf"):
                continue
            if not re.search(r"(市長|縣長)", name) or re.search(r"罷免|鄉鎮|原住民", name):
                continue
            county = name[:3]
            found.append({"county": county, "name": name, "url": href})
        time.sleep(1.5)
    print(f"自動找到公報 PDF：{len(found)} 份", file=sys.stderr)
    return found


def fetch_rss(url: str, limit: int):
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.content, "xml")
    items = []
    for it in soup.find_all("item")[:limit]:
        items.append({
            "title": it.title.get_text(strip=True) if it.title else "",
            "link": it.link.get_text(strip=True) if it.link else "",
            "date": it.pubDate.get_text(strip=True) if it.pubDate else "",
        })
    return items


def main():
    cfg = yaml.safe_load(open(Path(__file__).with_name("sources.yaml"), encoding="utf-8"))
    old = json.loads(HASHES.read_text("utf-8")) if HASHES.exists() else {}
    new, changes = dict(old), []

    targets = []  # (kind, meta, url)
    bl = cfg.get("bulletin", {}) or {}
    pdfs = list(bl.get("pdfs", []) or [])  # 手動補充的網址（自動找不到時使用）
    if bl.get("discover", True):
        known = {p["url"] for p in pdfs}
        pdfs += [p for p in discover_bulletins(cfg) if p["url"] not in known]
    for p in pdfs:
        targets.append(("bulletin", {"county": p.get("county"), "level": "A"}, p["url"]))
    for c in cfg.get("candidates", []) or []:
        for u in c.get("pages", []):
            targets.append(("official", {"id": c["id"], "name": c["name"], "level": c.get("level", "A")}, u))

    for kind, meta, url in targets:
        k = key_for(url)
        try:
            text, pdf = fetch(url, k)
        except Exception as e:  # noqa: BLE001
            print(f"略過 {url}: {e}", file=sys.stderr)
            continue
        h = hashlib.sha256(text.encode()).hexdigest()
        if old.get(k) != h:
            (SNAP / f"{k}.txt").write_text(text, "utf-8")
            changes.append({"kind": kind, "url": url, "snapshot": f"state/snapshots/{k}.txt", "pdf": pdf, **meta})
        new[k] = h
        time.sleep(1.5)  # 對來源網站友善

    rss = cfg.get("news_rss") or {}
    seen_key = "rss_seen"
    seen = set(old.get(seen_key, []))
    fresh = []
    for q in rss.get("queries", []):
        url = rss["template"].format(query=urllib.parse.quote(q))
        try:
            for it in fetch_rss(url, rss.get("max_items", 40)):
                if it["link"] and it["link"] not in seen:
                    fresh.append({**it, "query": q})
                    seen.add(it["link"])
        except Exception as e:  # noqa: BLE001
            print(f"RSS 失敗 {q}: {e}", file=sys.stderr)
    new[seen_key] = sorted(seen)[-3000:]
    if fresh:
        changes.append({"kind": "news", "items": fresh, "level": "C"})

    baseline = not any(k for k in old if k != "rss_seen")
    (STATE / "run.json").write_text(json.dumps({"baseline": baseline}), "utf-8")
    HASHES.write_text(json.dumps(new, ensure_ascii=False, indent=1), "utf-8")
    CHANGES.write_text(json.dumps(changes, ensure_ascii=False, indent=1), "utf-8")
    print(f"有變動的來源：{sum(1 for c in changes if c['kind'] != 'news')}；新新聞：{len(fresh)}")


if __name__ == "__main__":
    main()
