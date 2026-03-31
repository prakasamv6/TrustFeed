# TrustFeed — AI Content Transparency & Bias Simulation Platform

> **⚠ BIAS SIMULATOR — NOT A REAL PROVENANCE JUDGE**
>
> This is a local research prototype that simulates regional bias among
> content-provenance agents, adds a non-biased baseline agent, deducts
> bias-driven selection effects from final results, and displays all
> analytics in an interactive Angular dashboard.

## Overview

TrustFeed started as a proof-of-concept social-media mock-up for AI-content
transparency.  It has been extended into a **bias simulation sandbox** with:

| Capability | Detail |
|---|---|
| 6 scoring agents | 5 regional (Africa, Asia, Europe, Americas, Oceania) + 1 non-bias baseline |
| Debiasing math | biasDelta, debiasedAdjustedScore, deductedBiasAmount, amplification index, region-dominance, favoritism flag |
| Dashboard | KPI cards, agent-comparison table, modality breakdown, 7-day trends, bias-flagged posts, JSON/CSV export |
| Content types | Text · Image · Video |
| Mock mode | Deterministic fake scores so no LLM or GPU is needed locally |
| FastAPI backend | Endpoint-compatible with the Angular frontend (`/analyze`, `/analysis/{id}`, `/dashboard/*`, `/reports/{id}`) |

Every screen prominently displays:  
**BIAS SIMULATOR — NOT A REAL PROVENANCE JUDGE**

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 and npm
- **Python** ≥ 3.10

### 1. Angular Frontend

```bash
cd AugmentedDoing
npm install
ng serve            # http://localhost:4200
```

### 2. Python Backend

```bash
cd AugmentedDoing/backend
pip install -r requirements.txt
uvicorn app:app --reload   # http://localhost:8000
```

The frontend runs in **mock mode** by default (no backend needed).  
Set `mockMode: false` in `src/app/services/environment.ts` to connect to the
live FastAPI backend.

### 3. Run Backend Tests

```bash
cd AugmentedDoing/backend
python -m unittest tests.test_scoring -v
```

---

## Project Structure

```
AugmentedDoing/
├── src/app/
│   ├── components/
│   │   ├── header/               # Nav, filters (8 types), disclaimer banner
│   │   ├── feed/                 # 3-column layout, 7 sort options
│   │   ├── create-post/          # Text/image/video, analysis toggles
│   │   ├── post-card/            # Bias results, favoritism banner, modals
│   │   ├── bias-dashboard/       # Full analytics dashboard page
│   │   ├── bias-details-modal/   # Per-post deep-dive modal
│   │   ├── analysis-status/      # Status badge (pending/running/done/failed)
│   │   ├── report-export/        # Download per-post report (JSON)
│   │   └── content-review/       # Original review page
│   ├── models/
│   │   ├── post.model.ts         # Post, BiasResult, ContentType, SortMode
│   │   ├── analysis.model.ts     # BiasRegion, AgentName, AgentScore, etc.
│   │   └── dashboard.model.ts    # DashboardSummary, AgentStats, Trends
│   ├── services/
│   │   ├── post.service.ts       # Signal-based state, 8 filters, 7 sorts
│   │   ├── analysis.service.ts   # /analyze + mock fallback
│   │   ├── dashboard.service.ts  # /dashboard/* + mock fallback
│   │   ├── content-review.service.ts
│   │   └── environment.ts        # { apiBase, mockMode }
│   └── utils/
│       └── score-utils.ts        # Pure debiasing math functions
│
├── backend/
│   ├── app.py                    # FastAPI entry (CORS, 6 endpoints)
│   ├── config/
│   │   ├── default.yaml          # Thresholds, mock_mode, CORS origins
│   │   ├── regions.yaml          # 5 regions + baseline definition
│   │   └── models.yaml           # Pipeline / LLM config
│   ├── agents/
│   │   ├── base_agent.py         # ABC + mock hash helper
│   │   ├── africa_bias_agent.py
│   │   ├── asia_bias_agent.py
│   │   ├── europe_bias_agent.py
│   │   ├── americas_bias_agent.py
│   │   ├── oceania_bias_agent.py
│   │   └── nonbias_baseline_agent.py
│   ├── pipelines/
│   │   ├── text_pipeline.py
│   │   ├── image_pipeline.py
│   │   └── video_pipeline.py
│   ├── scoring/
│   │   ├── aggregation.py        # raw biased score (weighted avg)
│   │   ├── bias_deduction.py     # All debiasing formulas
│   │   └── explainability.py     # Human-readable explanations
│   ├── reports/
│   │   └── report_builder.py     # JSON report generator
│   ├── storage/
│   │   └── repository.py         # Thread-safe in-memory store
│   ├── tests/
│   │   └── test_scoring.py       # 12 unit tests
│   └── requirements.txt
└── README.md
```

---

## Debiasing Formulas

| Metric | Formula |
|---|---|
| `rawBiasedScore` | `bias_strength × avg(regional_scores) + (1 - bias_strength) × 0.5` |
| `baselineScore` | NonBiasBaselineAgent `.score` |
| `biasDelta` | `|rawBiasedScore − baselineScore|` |
| `debiasedAdjustedScore` | `baselineScore + clamp(rawBiasedScore − baselineScore, ±residual_max)` |
| `deductedBiasAmount` | `rawBiasedScore − debiasedAdjustedScore` |
| `biasAmplificationIndex` | `rawBiasedScore / baselineScore` |
| `disagreementRate` | `pstdev(all 6 agent scores)` |
| `regionDominanceScore` | `max(regional) − mean(regional)` |
| `favoritismFlag` | `regionDominanceScore > 0.60` |

**Default thresholds:** `bias_strength = 0.85`, `residual_adjustment_max = 0.05`,
`bias_warning_threshold = 0.20`, `region_dominance_threshold = 0.60`.

---

## API Endpoints (Backend)

| Method | Path | Description |
|---|---|---|
| `POST` | `/analyze` | Run 6-agent analysis on a post |
| `GET` | `/analysis/{postId}` | Retrieve stored analysis |
| `GET` | `/reports/{postId}` | Download JSON report |
| `GET` | `/dashboard/summary` | Aggregate KPIs |
| `GET` | `/dashboard/agent-stats` | Per-agent statistics |
| `GET` | `/dashboard/trends` | 7-day trend data |
| `GET` | `/health` | Health check + mock-mode flag |

---

## Angular Routes

| Path | Component | Purpose |
|---|---|---|
| `/` | `FeedComponent` | Main feed with posts, sorting, filtering |
| `/review` | `ContentReviewComponent` | Community content review |
| `/dashboard` | `BiasDashboardComponent` | Bias analytics dashboard |

---

## Technology Stack

- **Angular 17.3** — standalone components, Signals, SCSS
- **Python 3.10+** — FastAPI, Pydantic, PyYAML
- **No database** — all in-memory (both frontend and backend)
- **No GPU required** — mock mode uses deterministic SHA-256 hashing

---

## Ethics Note

This project is a **research simulation** for studying how regional biases
in AI content-provenance scoring might affect downstream trust decisions.
It does **not** make real provenance judgments. The simulated agents produce
deterministic mock scores; no actual LLM or classifier is invoked in mock mode.

---

## License

Educational / proof-of-concept. Not for production use.
