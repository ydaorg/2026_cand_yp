# 青年政見圈選指南

用國際組織的青年政策框架與指標，逐項檢視 2026 年縣市長候選人的青年政見。純靜態網站，不需要建置步驟：`site/` 資料夾就是整個網站。

整套流程**不需要額外付費**：Cloudflare Pages 免費方案即可架站；GitHub Actions 對公開儲存庫免費，負責每週檢查來源；判讀與更新資料則在你現有的 Claude 對話中進行。

```
site/                     網站本體（上傳這個資料夾就能上線）
  index.html              網頁
  assets/                 樣式與互動程式（無外部套件）
  data/*.json             候選人分數、面向、權重、框架、更新紀錄
  _headers                Cloudflare 快取設定
scripts/
  sources.yaml            要追蹤的來源清單（官網、公報、新聞關鍵字）
  fetch_sources.py        抓取來源、比對有無變動（不用 AI）
  make_report.py          把變動整理成一則通知（不用 AI）
  validate_data.py        檢查資料是否符合計分規則
  optional_api/           選用：付費 API 全自動判讀（目前未啟用）
.github/
  workflows/detect-changes.yml   每週檢查來源，有變動就開通知
  workflows/deploy-pages.yml     選用：改用 GitHub Pages 時才需要
  ISSUE_TEMPLATE/                志工「政見回報」表單
UPDATING.md               資料更新規則（人與 Claude 共用的同一把尺）
state/                    來源快照與比對紀錄（自動維護，不用手動改）
```

---

## 一、上線（建議用電腦操作）

### 1. 把檔案放上 GitHub（不用打指令）

1. 登入 github.com，右上角「+」→ **New repository**。
   - 名稱例如：`youth-policy-guide`
   - 選 **Public**（公開儲存庫的自動檢查才免費）
   - 不要勾選「Add a README」，按 **Create repository**。
2. 在新儲存庫頁面點 **uploading an existing file**。
3. 把解壓縮後 `youth-policy-guide` 資料夾**裡面的全部內容**拖進去，按 **Commit changes**。
   - 一定要包含 `.github` 資料夾。Mac 的 Finder 預設會隱藏它，按 **Cmd + Shift + .** 就會顯示。
   - 上傳後確認儲存庫首頁看得到 `.github`、`site`、`scripts`、`state` 四個資料夾。

### 2. 用 Cloudflare Pages 上線（推薦，臺灣連線快）

1. 登入 Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，選剛才的儲存庫。
2. 建置設定：
   - Framework preset：**None**
   - Build command：**留空**
   - Build output directory：**`site`**
3. 按 **Save and Deploy**，約一分鐘後得到 `https://<專案名>.pages.dev`。
4. 之後只要 GitHub 上的 `main` 有更新（例如：合併了資料更新），Cloudflare 會自動重新上線。
5. 自訂網域：專案 → **Custom domains** → 輸入網域，依指示設定 DNS。

> 只想先看效果：Pages → **Upload assets**，把 `site` 資料夾直接拖進去也能上線，但這樣不會連動 GitHub 的更新。

<details>
<summary>改用 GitHub Pages（不用 Cloudflare）</summary>

1. 儲存庫 **Settings → Pages**，Source 選 **GitHub Actions**。
2. 編輯 `.github/workflows/deploy-pages.yml`，把 `push:` 那三行前面的「# 」刪掉。
3. 到 **Actions → Deploy to GitHub Pages → Run workflow** 執行一次。
4. 網址為 `https://<帳號>.github.io/<儲存庫名>/`。
</details>

### 3. 開啟每週自動檢查

1. 儲存庫 **Settings → Actions → General → Workflow permissions**：選 **Read and write permissions**，按 Save。
2. **Actions** 分頁 → 左側 **Detect source changes** → **Run workflow** 手動執行一次。
   - 第一次執行只會建立比對基準，不會開通知；之後有變動才會通知。
3. 把儲存庫網址填進 `site/data/meta.json` 的 `"repo"`，頁尾就會出現「原始碼與資料」與回報錯誤的連結。

---

## 二、日常更新：機器找變動，Claude 判讀，你審核

```
每週一 08:17、公報預定上網日 11/25 與 11/26（GitHub 自動、免費）
   │
   ├─ 選舉公報 PDF（自動到中選會公報網站找本屆檔案）
   ├─ 候選人官方政見網站（sources.yaml 列出的網址）
   ├─ 新聞 RSS（只當線索）
   └─ 志工「政見回報」
          │  比對上次的快照，只留下有變動的
          ▼
   開一則通知「來源有變動，待更新」，列出變動內容與連結
          │
          ▼  你：開一個 Claude 對話，貼上通知最下方那段話
   Claude 依 UPDATING.md 判讀、修改資料、跑資料檢查，開 Pull Request
          │
          ▼  你：審核後合併
   Cloudflare 自動重新上線，再關閉通知
```

### 交給 Claude 的方式

1. 第一次使用前，在 Claude 的設定中連接 GitHub，並允許存取這個儲存庫。
2. 收到通知後，開一個新的 Claude 對話，貼上通知最下方的那段話（含通知網址）。
3. Claude 會開一個 Pull Request，內文逐項列出「候選人｜面向｜舊分 → 新分｜依據原文｜來源」。

> 沒有連接 GitHub 也可以：把通知內容複製貼給 Claude，並附上 `site/data/candidates.json` 與 `unscored.json`，請它回傳修改後的檔案，你再上傳覆蓋。

### 審核 Pull Request 時確認

- [ ] 每項變動都附原文，點開來源確實存在
- [ ] 是本次競選承諾，不是任內政績或縣市政府新聞稿
- [ ] 標籤正確：直接／隱含／延續；延續有沒有說明規模
- [ ] 分數符合 0–4 定義，4 分有制度化機制
- [ ] 資料檢查（`validate_data.py`）錯誤 0
- [ ] 合併後關閉對應的通知與「政見回報」

---

## 三、各類來源怎麼涵蓋

### 選舉公報（最重要）

- 中選會預計 **11 月 25 日前**把公報放上選舉公報網站。
- **自動抓取，不用手動填網址。** 程式會到公報網站的固定目錄找本屆檔案：
  `01選舉公報/03直轄市長/115年/01紙本公報` 與 `01選舉公報/04縣市長/115年/01紙本公報`，
  下載各縣市「市長」「縣長」的 PDF（罷免公告與鄉鎮市長會排除）。
- 這個目錄規則是依 2022 年（111 年）公報網站的實際結構寫的。若今年中選會改了目錄，通知會顯示「選舉公報：0 份」，
  這時把 PDF 網址手動填進 `sources.yaml` 的 `bulletin.pdfs`，再手動執行一次檢查。
- 公報提早上網時，可以到 Actions 手動執行，不用等排程。
- 公報是掃描檔時，通知會標示「（掃描檔）」；請 Claude 直接讀 PDF 判讀。

### 候選人官方政見網站

- 在 `sources.yaml` 的 `candidates` 底下新增網址即可。
- 網站若用 JavaScript 動態載入內容，程式可能抓不到文字變動，可改由志工回報或人工定期查看。

### 官方社群（Facebook、Instagram、Threads、YouTube）

- **不要直接爬取。** Meta 的使用條款禁止未經授權的自動抓取，帳號或 IP 可能被封鎖。
- 用內建的「政見回報」表單：在 GitHub Issues 貼上貼文網址與全文，每週檢查時會一起列進通知。
- 中選會的**公辦電視政見發表會**也有影片，適合作為正式來源。

### 新聞

- `news_rss` 用 Google News RSS 追蹤關鍵字，只列在通知裡當線索；計分前要找到候選人的原始發布。

---

## 選用：付費全自動判讀

`scripts/optional_api/extract_with_claude.py` 可以在 GitHub 上直接呼叫 Claude API 判讀並開 Pull Request，省去貼給 Claude 對話這一步。需要另外申請 API 金鑰（console.anthropic.com）並依用量付費，目前流程未啟用。

---

## 授權與聲明

- 本站為公民資訊整理，不代表任何候選人或政黨，也不是投票建議。
- 評分方式由人整理國際指標與評斷標準後，由 AI 協助依據公開資料判讀，不是投票建議；請以選舉公報、公辦政見發表會等官方資訊為主自行判斷。後續若有聯繫候選人競辦，也將再更新相關內容。
- 分數只反映政見的涵蓋面與具體程度，不評估可行性。
- 建議程式碼採 MIT、資料採 CC BY 4.0 授權（請自行加上 LICENSE 檔案）。
