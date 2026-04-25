# Trends Date Filter + Insight Sentence — Design Spec

**Date:** 2026-04-25
**Roadmap item:** 5 — Basic trends + insight sentence

---

## Summary

Add a custom date range picker to the History page trend chart and a backend-generated insight sentence that summarises the selected period's glucose trajectory and most recent risk category.

---

## Scope

**In scope:**
- `database_service.py` — add `start_date`/`end_date` to `get_trend_data()`; add `get_trend_insight()` method
- `app.py` — extend `GET /api/trends` params; add `GET /api/trends/insight` endpoint
- `api.ts` — update `getTrends()` signature; add `getInsight()`
- `types/index.ts` — add `TrendInsight` interface
- `History.tsx` — replace `trendDays` with `dateRange`; add date inputs + quick-select pills; parallel fetch; insight banner

**Out of scope:** chart appearance, type filter, pagination, PDF, all other pages.

---

## Backend

### `database_service.get_trend_data()` changes

Add optional `start_date: str | None` and `end_date: str | None` parameters. When provided they take precedence over `days` and add a `created_at BETWEEN ? AND ?` clause. Both strings are ISO 8601 date strings (`YYYY-MM-DD`); the query uses `DATE(created_at)` for comparison.

### New `database_service.get_trend_insight(start_date, end_date, test_type)`

Queries the same window as `get_trend_data()`. Returns:

```json
{
  "success": true,
  "insight": {
    "sentence": "Your FBS fell by 12 mg/dL over the selected period, and your most recent risk assessment was Moderate.",
    "first_value": 148.0,
    "last_value": 136.0,
    "delta": -12.0,
    "average": 141.5,
    "count": 6,
    "direction": "down",
    "most_recent_risk": "Moderate"
  }
}
```

**Direction thresholds:** `|delta| < 5 mg/dL` → `stable`; negative → `down`; positive → `up`.

**Sentence template:**
- If `count < 2`: no sentence (endpoint returns `insight: null`).
- Direction words: `up` → `"rose"`, `down` → `"fell"`, `stable` → `"stayed stable"`.
- Risk clause appended only if `most_recent_risk` is non-null.
- Template: `"Your {label} {direction_word} by {|delta|:.0f} mg/dL over the selected period{risk_clause}."`

### New endpoint `GET /api/trends/insight`

Query params: `start_date`, `end_date`, `test_type` (all optional, same as `/api/trends`).

Response: `{ success, insight }` where `insight` is the object above or `null` if fewer than 2 data points.

### Extended `GET /api/trends`

Accepts `start_date` and `end_date` in addition to existing `days`. When `start_date`/`end_date` are present, `days` is ignored.

---

## Frontend

### `types/index.ts`

```ts
export interface TrendInsight {
  sentence: string;
  first_value: number;
  last_value: number;
  delta: number;
  average: number;
  count: number;
  direction: 'up' | 'down' | 'stable';
  most_recent_risk: string | null;
}
```

### `api.ts`

- `getTrends({ start_date, end_date, test_type? })` — replaces `days` param with date range strings.
- `getInsight({ start_date, end_date, test_type? })` → `GET /api/trends/insight`.

### `History.tsx` state changes

| Before | After |
|--------|-------|
| `trendDays: number` (30) | `dateRange: { start: string; end: string }` (default: today − 30d to today) |
| — | `insight: TrendInsight \| null` |
| — | `insightLoading: boolean` |
| — | `activePreset: 7 \| 30 \| 90 \| null` (tracks which pill is active) |

### Date range controls (inside trend chart header)

Replace the `7d / 30d / 90d` buttons with:
- Two `<input type="date">` fields (Start / End), max = today.
- Three pill buttons `7d / 30d / 90d` that set both date inputs and set `activePreset`. Manual edit of either input clears `activePreset` (sets to `null`).

### Parallel fetch + race condition prevention

`fetchTrends` and `fetchInsight` fire together with `Promise.all`. A `fetchId` ref increments on each call; the result is only applied if the ref matches when the response arrives (prevents stale updates from slow responses).

### Insight banner

Rendered inside the trend chart card, below the chart, above the legend. Visible only when `insight !== null && insight.count >= 2`. Shows a loading skeleton while `insightLoading` is true. Styled as a soft indigo banner with a `Sparkles` icon.

---

## Error handling

- If `/api/trends/insight` fails or returns `insight: null`, set `insight` to null and hide banner silently.
- Invalid date range (start > end): disable the fetch and show a small validation message next to the inputs.
- Backend: if `start_date`/`end_date` cannot be parsed, fall back to `days=30`.

---

## Files changed

| File | Change |
|------|--------|
| `backend/services/database_service.py` | Add `start_date`/`end_date` to `get_trend_data()`; add `get_trend_insight()` |
| `backend/app.py` | Extend `/api/trends`; add `/api/trends/insight` |
| `frontend/src/services/api.ts` | Update `getTrends()`; add `getInsight()` |
| `frontend/src/types/index.ts` | Add `TrendInsight` interface |
| `frontend/src/pages/History.tsx` | Date range state, controls, parallel fetch, insight banner |
