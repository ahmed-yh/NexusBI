# NexusBI (MarketAI) — Project Description

> **Status: demo / early-stage.** This document describes a working prototype, not a production product. Scalability and hardening gaps noted below are largely deliberate simplifications appropriate to this stage — the architecture is built so most of them are straightforward to migrate past when the time comes, not rewrites.

## 1. Overview

NexusBI (internally also called MarketAI) is a web application that lets someone upload a spreadsheet of business data — a CSV, Excel, or JSON file — and get back an AI-generated analysis of it: which columns relate to each other, what those relationships mean, and a full written business-intelligence report, all without writing a query or knowing any statistics. It also turns the data into interactive charts. It's built for people who are new to business analysis (interns, junior analysts, small business owners) rather than for data scientists who'd rather write their own Python. Under the hood it's a React frontend talking to a Flask backend, which in turn calls Google's Gemini AI to do the actual analysis and writing.

## 2. Purpose & Motivation

This started as a personal project and has grown into something with real product potential. The gap it targets: someone junior to business analysis — an intern, a new analyst, a small business owner — often has a spreadsheet of sales, operations, or market data and no idea how to start analyzing it. Traditional BI tools (Excel pivot tables, Tableau, Power BI) assume the user already knows what question to ask and how to build a chart or formula to answer it. NexusBI inverts that: you upload the file, and the tool tells you what's interesting in it — which columns move together, what that might mean for the business, and a written report you could hand to someone else — without requiring the user to already know how to do that analysis themselves.

## 3. How It Works (Technical Summary)

### High-level architecture

```
Browser (React SPA, Netlify)
   │  HTTPS + credentialed session cookie
   ▼
Flask API (Render)
   │
   ├─ DatasetManager        — loads the uploaded file, keeps a raw copy
   ├─ DataPreprocessingAgent — cleans/encodes/scales a working copy
   ├─ MarketAnalysisApp      — calls Gemini for relationships + report
   └─ AnalysisCache          — file-hash-keyed cache of AI results
```

The frontend and backend are deployed separately and talk over a REST API — there's no server-side rendering or shared process. This split exists partly for a mundane deployment reason worth knowing: Netlify's build system auto-installs anything it finds in `requirements.txt` at its build root as if the whole repo were a Python project, so the Flask backend now lives in its own `backend/` subdirectory purely to stay out of Netlify's way; the two hosts are otherwise fully independent.

### Data flow (what actually happens on a click)

1. **Upload** (`POST /upload`) — the file is saved to a temp path, then handed to `DatasetManager`, which picks a loader based on file extension (`pd.read_csv` / `pd.read_excel` / `pd.read_json` — this used to unconditionally use the CSV parser regardless of extension, which crashed on non-CSV files; fixed this session). The raw dataframe is kept as `original_data`.
2. **Automatic preprocessing** — immediately after loading, `DataPreprocessingAgent` runs a fixed pipeline over a working copy (`data`): clean column names → impute missing values (mean for numeric, most-frequent for categorical) → drop outlier rows via the IQR method → label-encode categorical columns → scale numeric columns with `StandardScaler` → derive year/month/day/day-of-week features from any datetime columns. This is not currently user-configurable — it always runs the same way on every upload. The frontend's dataset preview and charts read from `original_data` (the raw values), while the AI analysis and report reads from the preprocessed `data` — so what a user *sees* is their real numbers, but what the AI *reasons over* is the cleaned/scaled version.
3. **Analysis** (`POST /api/analyze`) — `MarketAnalysisApp.analyze_feature_relationships()` builds a prompt describing the dataset's columns and statistics, sends it to Gemini at low temperature (0.2) so the model reliably returns a strict `Feature1 | Feature2 | Type | Description` format the code can parse, then `generate_bi_report()` sends a second prompt — seeded with the relationships just computed, so the report's own "Relationship Analysis" section is grounded in the same data rather than the model re-guessing independently — to produce a full Markdown report at a higher token budget (4096, since the report template has 10+ sections). Both calls are cached to disk keyed by a hash of the uploaded file, so re-analyzing the same file skips the Gemini call entirely.
4. **Visualization** — the same raw-data sample used for the preview table feeds a Recharts-based bar/scatter/bubble chart component with user-selectable axes.

### Per-visitor isolation

Because this is a public demo, more than one visitor can be uploading data at the same time. The backend keeps a Python dict, `sessions`, keyed by a signed session ID stored in a cookie — each visitor gets their own `MarketAnalysisApp` instance and dataset, rather than one global dataset shared by everyone (which is how an earlier version of this worked, and would have let one visitor see or overwrite another's upload). Since Netlify and Render are different domains, this is a cross-site cookie; the backend detects it's running on Render (via Render's own `RENDER=true` environment variable) and switches the cookie to `SameSite=None; Secure` only in that context, since that combination requires HTTPS and would otherwise break local `http://localhost` development.

### Key dependencies and why

| Dependency | Role |
|---|---|
| React + Vite + TypeScript | Frontend SPA and build tooling |
| Tailwind CSS + shadcn/ui + Radix UI | Component styling/primitives — inherited from the bolt.new starter template this was scaffolded from |
| Recharts | Bar/scatter/bubble chart rendering |
| react-markdown + remark-gfm | Renders the AI-generated report as formatted Markdown |
| Flask + flask-cors | Backend REST API and cross-origin/credentialed request handling |
| pandas, numpy, scikit-learn | Data loading and the preprocessing pipeline (imputation, encoding, scaling) |
| google-genai | Official Google SDK for calling Gemini (migrated this session off the now-deprecated `google-generativeai` package) |
| gunicorn | Production WSGI server on Render (the Flask dev server is used only for local development) |

### Notable design decisions

- **AI calls are single-shot, not multi-turn chat.** Both Gemini calls used to go through a `start_chat()`/multi-turn chat wrapper, but every call started a fresh empty history anyway — so this session simplified it to a direct `generate_content()` call per prompt, which also made it easy to override temperature/token limits per call.
- **The dataset preview shows raw values, not what the AI sees.** This was a real bug fixed this session: the preview table was rendering the *preprocessed* (scaled/encoded) data, so a revenue column showed values like `-0.69` instead of an actual dollar figure — meaningless to the beginner audience this tool targets. It now reads from the untouched `original_data` instead.
- **In-memory state, no database.** Session/dataset state lives in a plain Python dict in the Flask process's memory, not in Postgres/Redis/SQLite. At this stage (a demo with light, intermittent traffic on Render's free tier, which itself sleeps and loses in-memory state after idle periods anyway) that's a reasonable trade — it's simple and needs no extra infrastructure. The isolation logic is already centralized behind one function (`get_session_state()`), so swapping the dict for a real session store later is a contained change to one place, not a rewrite of the request handlers.

## 4. Use Cases

**Working today:**
- Upload a CSV, Excel (`.xlsx`/`.xls`), or JSON file of business data.
- Get an automatic data-cleaning pass (missing values filled, outliers removed, categories encoded) with no configuration needed.
- Get an AI-generated list of the most significant relationships between columns in plain language.
- Get a full Markdown business-intelligence report (executive summary, KPIs, feature analysis, relationship analysis, recommendations, methodology notes) generated from the actual data, downloadable as a `.md` file.
- Explore the data visually via bar, scatter, and bubble charts with selectable axes.
- Multiple people can use the public demo at once without interfering with each other's data.
- Toggle dark/light mode.

**Not working / aspirational (present in the code as unfinished stubs, not real features today):**
- "Web Import" — importing data directly from a URL. There's a frontend form (`WebImportForm.tsx`) and an agent function (`webScraperAgent.scrapeUrl`) that calls `/data/web-import`, but no matching backend route exists, and the sidebar entry for it has been removed from the UI. It's dead code today, not a working feature.
- Dataset validation (`datasetManagerAgent.validateDataset`) — same situation: frontend function exists, calls `/api/dataset/validate`, no backend route implements it.
- User-configurable preprocessing — the backend has a separate `/api/preprocess` endpoint that would let preprocessing settings be adjusted, but nothing in the current UI calls it; preprocessing is always the fixed automatic pipeline described above.

## 5. Business / Practical Value

This is demo/early-stage, not a commercial product. There is no monetization built — no pricing page, no usage tiers, no billing integration, nothing in the code or UI that implements a business model. The "early business idea" framing is genuinely early: the value case rests on the target audience described above (BI beginners who need a lower barrier to entry than traditional tools), but nothing beyond the working demo exists yet to validate or monetize that. Any statement about revenue potential, pricing, or market size would be speculation not grounded in anything built — so this document doesn't make one.

## 6. Community & Real-World Impact

No real-world usage, deployment to actual end users, or feedback exists yet beyond this being a working public demo. There's no evidence in the repository of adoption, user testing, or external validation.

*Potential future use case:* if adopted by the intended audience (interns, junior analysts, small business owners), a tool like this could lower the skill floor for getting basic insight out of business data that would otherwise sit unanalyzed in a spreadsheet — but this is speculative and unvalidated, not a claim about current impact.

## 7. Ethical Considerations

- **Reliability / when the AI is wrong.** The relationship analysis and BI report are both generated by an LLM reasoning over summary statistics and a small data sample, not by verified statistical tests. The AI can state a relationship confidently that isn't actually statistically sound, and a beginner user — the exact audience this tool targets — is the least likely to catch that. There's no confidence scoring, no statistical validation of AI-claimed relationships, and no disclaimer in the current UI cautioning that the report is AI-generated and should be checked rather than taken as ground truth.
- **Data privacy.** Uploaded files are processed in-memory/temp storage on the Render backend and sent to Google's Gemini API as part of the analysis prompt (feature descriptions and a small data sample, not the full raw file). Anyone uploading real business or customer data to the public demo is sending that data to a third-party AI provider — worth being explicit about if this is ever used with genuinely sensitive data, since there's no data-handling policy, encryption-at-rest, or retention control implemented beyond what Render/Google provide by default.
- **Misuse potential.** Low — this is a data-analysis tool, not something with a physical-world or safety-critical failure mode. The main risk is over-trusting an AI-generated business report as authoritative.
- **Session isolation.** Each visitor's data is scoped to their own session so one visitor can't see another's upload — this was specifically fixed this session (previously all visitors shared one dataset).

## 8. Current State & Limitations

Everything below is either a deliberate simplification appropriate to a demo at this stage (noted as such, with the migration path when there is one) or a genuine known gap.

| Area | State | Notes |
|---|---|---|
| Core upload → analyze → report → visualize flow | Working | Exercised end-to-end this session against live data and the real Gemini API |
| Multi-visitor session isolation | Working | Per-session in-memory dict; fine at demo scale |
| Persistent storage | **None** — in-memory only | Deliberate for now; data is lost when the backend process restarts or (on Render's free tier) sleeps from inactivity. Migration path: swap the in-memory `sessions` dict for Redis or a database-backed store behind the same `get_session_state()` interface. |
| Automated tests | **None exist** | Verification so far has been manual/live smoke-testing during development, not a test suite. |
| Preprocessing configurability | Fixed pipeline, not user-configurable | An unwired `/api/preprocess` endpoint exists for this but isn't connected to any UI control yet. |
| Web Import / dataset validation | Stubbed, non-functional | Frontend code exists; no backend implementation. Not currently exposed in the UI. |
| Hosting cold starts | Expected | Render's free tier sleeps after ~15 min idle; first request after that takes 30-50s to wake up. Fixable by upgrading the Render plan — no code change required. |
| License | README claims MIT; no `LICENSE` file exists in the repo | Documentation inconsistency, not a functional gap — worth resolving whenever a license is actually chosen. |

## 9. Glossary

- **BI (Business Intelligence)** — analyzing business data to find patterns and inform decisions; this tool's core purpose.
- **Feature** — a column in the dataset (a "feature relationship" is a relationship between two columns).
- **Preprocessing** — automated cleanup of raw data before analysis: filling missing values, removing outliers, converting text categories to numbers, and scaling numeric ranges.
- **IQR outlier removal** — a statistical method that drops rows whose values fall far outside the typical range for a column, based on the interquartile range.
- **StandardScaler / z-score scaling** — rescales a numeric column so its values center around 0 (this is why the raw preview fix mattered: without it, users saw these rescaled numbers instead of their real ones).
- **Label encoding** — converts text categories (e.g. city names) into numbers so they can be used in numeric calculations.
- **Session / session cookie** — a small signed identifier the backend gives a visitor's browser so it can tell that visitor's requests apart from everyone else's, without a login system.
- **CORS / cross-site** — browser security rules governing whether a webpage (here, on Netlify) is allowed to talk to an API on a different domain (here, on Render); relevant because the frontend and backend deliberately live on different hosts.
- **Gemini** — Google's large language model API, used here to generate the relationship analysis and the written BI report.
