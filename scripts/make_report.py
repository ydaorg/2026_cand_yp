#!/usr/bin/env python3
"""把 fetch_sources.py 找到的變動整理成一則 GitHub 通知（Issue）的內文。不使用 AI，不需付費。

輸出：
  state/report.md     通知內文
  GITHUB_OUTPUT       has_changes=true/false（給 GitHub Actions 判斷要不要開通知）
"""
import difflib
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "state"
MAX_BODY = 60000  # GitHub Issue 內文上限約 65536 字元


def git_old(path: str) -> str:
    """取上一版（已提交）的快照，用來比較這次新增了哪些文字。"""
    try:
        return subprocess.run(["git", "show", f"HEAD:{path}"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError:
        return ""


def added_lines(old: str, new: str, limit: int = 30):
    out = []
    for line in difflib.unified_diff(old.splitlines(), new.splitlines(), lineterm="", n=0):
        if line.startswith("+") and not line.startswith("+++"):
            t = line[1:].strip()
            if t:
                out.append(t)
    return out[:limit], max(0, len(out) - limit)


def open_reports():
    """列出志工送來、尚未處理的「政見回報」。"""
    try:
        res = subprocess.run(["gh", "issue", "list", "--label", "政見回報", "--state", "open", "--limit", "50",
                              "--json", "number,title,url"], cwd=ROOT, capture_output=True, text=True, check=True)
        return json.loads(res.stdout or "[]")
    except Exception:  # noqa: BLE001
        return []


def main():
    changes = json.loads((STATE / "changes.json").read_text("utf-8")) if (STATE / "changes.json").exists() else []
    run = json.loads((STATE / "run.json").read_text("utf-8")) if (STATE / "run.json").exists() else {}
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    reports = open_reports()

    bulletins = [c for c in changes if c["kind"] == "bulletin"]
    officials = [c for c in changes if c["kind"] == "official"]
    news = next((c["items"] for c in changes if c["kind"] == "news"), [])

    if run.get("baseline"):
        # 第一次執行：只建立比對基準，不開通知
        has = False
        body = "第一次執行：已建立比對基準，下次起有變動才會通知。"
    else:
        has = bool(bulletins or officials or news or reports)
        md = ["這是自動產生的每週來源檢查，**資料還沒有被修改**。請依最下方的步驟交給 Claude 判讀更新。", ""]
        md.append(f"- 選舉公報：{len(bulletins)} 份新增或變動")
        md.append(f"- 候選人官方政見網站：{len(officials)} 頁有變動")
        md.append(f"- 新聞線索：{len(news)} 則")
        md.append(f"- 尚未處理的志工回報：{len(reports)} 則")
        md.append("")
        if bulletins:
            md += ["## 選舉公報（最優先）", ""]
            for b in bulletins:
                scan = "（掃描檔）" if (ROOT / b["snapshot"]).read_text("utf-8").startswith("[掃描檔]") else ""
                md.append(f"- {b.get('county') or ''} [{b['url'].rsplit('/', 1)[-1]}]({b['url']}){scan}")
            md.append("")
        if officials:
            md += ["## 候選人官方政見網站", ""]
            for o in officials:
                new = (ROOT / o["snapshot"]).read_text("utf-8")
                lines, more = added_lines(git_old(o["snapshot"]), new)
                md.append(f"### {o.get('name', '')}｜{o['url']}")
                md += [f"> {t}" for t in lines] or ["> （文字有變動，但沒有新增段落）"]
                if more:
                    md.append(f"> ……另有 {more} 行，請開原網頁查看")
                md.append("")
        if reports:
            md += ["## 志工回報", ""] + [f"- #{r['number']} [{r['title']}]({r['url']})" for r in reports] + [""]
        if news:
            md += ["## 新聞線索（只當線索，計分前請找候選人原始發布）", ""]
            md += [f"- [{n['title']}]({n['link']})｜{n.get('date', '')}" for n in news[:40]]
            if len(news) > 40:
                md.append(f"- ……另有 {len(news) - 40} 則")
            md.append("")
        md += [
            "## 下一步：交給 Claude 判讀",
            "",
            "1. 開一個新的 Claude 對話（確認已連接 GitHub）。",
            "2. 貼上下面這段話：",
            "",
            "```",
            f"請幫我更新 GitHub 儲存庫 {repo} 的青年政見資料：",
            "依照儲存庫裡 UPDATING.md 的規則，處理這則通知列出的變動：",
            "（把這則通知的網址貼在這裡）",
            "改好後跑資料檢查，再開一個 Pull Request 給我審核。",
            "```",
            "",
            "3. 審核 Pull Request，確認後合併，網站就會自動更新；再把這則通知關閉。",
        ]
        body = "\n".join(md)
        if len(body) > MAX_BODY:
            body = body[:MAX_BODY] + "\n\n……內容過長已截斷，完整變動請看 state/snapshots。"

    (STATE / "report.md").write_text(body, "utf-8")
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"has_changes={'true' if has else 'false'}\n")
    print(body[:2000])


if __name__ == "__main__":
    main()
