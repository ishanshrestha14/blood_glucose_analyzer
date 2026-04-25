# Trends Date Filter + Insight Sentence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom date range picker to the History page trend chart and a backend-generated insight sentence summarising glucose trajectory and most recent risk category.

**Architecture:** Extend `database_service.get_trend_data()` with date params; add `get_trend_insight()` method and a new `/api/trends/insight` endpoint; update the frontend API layer and `History.tsx` to replace the `trendDays` preset-only control with date inputs + quick pills, firing both fetches in parallel.

**Tech Stack:** Python/Flask/SQLite (backend), React 19/TypeScript/Tailwind (frontend), Recharts (existing chart — untouched).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/services/database_service.py` | Modify | Add `start_date`/`end_date` to `get_trend_data()`; add `get_trend_insight()` |
| `backend/app.py` | Modify | Extend `/api/trends`; add `/api/trends/insight` |
| `frontend/src/types/index.ts` | Modify | Add `TrendInsight`, `InsightResponse` interfaces |
| `frontend/src/services/api.ts` | Modify | Update `getTrends()` params; add `getInsight()` |
| `frontend/src/pages/History.tsx` | Modify | Date range state + controls; parallel fetch; insight banner |

---

## Task 1: Extend `get_trend_data()` with date range params

**Files:**
- Modify: `backend/services/database_service.py`

- [ ] **Step 1: Add `start_date` and `end_date` params to `get_trend_data()`**

Replace the existing signature and WHERE clause logic:

```python
def get_trend_data(
    self,
    test_type: Optional[str] = None,
    days: int = 30,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Get glucose values over time for trend charts.

    If start_date and end_date are provided they take precedence over days.
    Dates are ISO 8601 strings (YYYY-MM-DD).
    """
    conn = self._get_connection()
    try:
        where_clauses = ["glucose_value IS NOT NULL"]
        params: List[Any] = []

        if test_type:
            where_clauses.append("test_type = ?")
            params.append(test_type)

        if start_date and end_date:
            where_clauses.append("DATE(created_at) BETWEEN ? AND ?")
            params.extend([start_date, end_date])
        elif days > 0:
            where_clauses.append("created_at >= datetime('now', ?)")
            params.append(f'-{days} days')

        where = "WHERE " + " AND ".join(where_clauses)

        rows = conn.execute(
            f"""
            SELECT created_at as date, glucose_value as value,
                   test_type, classification
            FROM analyses
            {where}
            ORDER BY created_at ASC
            """,
            params,
        ).fetchall()

        data_points = [dict(row) for row in rows]

        return {
            'success': True,
            'data_points': data_points,
            'count': len(data_points),
        }
    finally:
        conn.close()
```

- [ ] **Step 2: Verify manually with Python**

```bash
cd backend && source venv/bin/activate
python3 -c "
from services.database_service import get_database_service
db = get_database_service()
# Days fallback still works
r1 = db.get_trend_data(days=30)
print('days fallback:', r1['success'], r1['count'], 'points')
# Date range (open range = all records)
r2 = db.get_trend_data(start_date='2020-01-01', end_date='2030-01-01')
print('date range:', r2['success'], r2['count'], 'points')
"
```

Expected: both print `success: True`.

---

## Task 2: Add `get_trend_insight()` to database service

**Files:**
- Modify: `backend/services/database_service.py`

- [ ] **Step 1: Add the method and helper constants inside `DatabaseService`**

Add after `get_trend_data()`:

```python
_TEST_TYPE_LABELS: Dict[str, str] = {
    'fasting': 'FBS',
    'hba1c': 'HbA1c',
    'ppbs': 'PPBS',
    'rbs': 'RBS',
    'ogtt': 'OGTT',
}

def get_trend_insight(
    self,
    test_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Compute a plain-English insight sentence for the selected date window."""
    trend = self.get_trend_data(
        test_type=test_type,
        start_date=start_date,
        end_date=end_date,
    )
    if not trend['success'] or trend['count'] < 2:
        return {'success': True, 'insight': None}

    points = trend['data_points']
    first_value = float(points[0]['value'])
    last_value  = float(points[-1]['value'])
    delta = last_value - first_value
    average = sum(float(p['value']) for p in points) / len(points)

    if abs(delta) < 5:
        direction = 'stable'
    elif delta > 0:
        direction = 'up'
    else:
        direction = 'down'

    # Most recent risk category in the same window
    most_recent_risk = self._get_most_recent_risk(start_date, end_date)

    label = self._TEST_TYPE_LABELS.get(test_type or '', 'glucose')
    direction_words = {'up': 'rose', 'down': 'fell', 'stable': 'stayed stable'}
    direction_word = direction_words[direction]

    if direction == 'stable':
        sentence = f"Your {label} stayed stable over the selected period"
    else:
        sentence = (
            f"Your {label} {direction_word} by {abs(delta):.0f} mg/dL"
            f" over the selected period"
        )
    if most_recent_risk:
        sentence += f", and your most recent risk assessment was {most_recent_risk}"
    sentence += "."

    return {
        'success': True,
        'insight': {
            'sentence':          sentence,
            'first_value':       round(first_value, 1),
            'last_value':        round(last_value, 1),
            'delta':             round(delta, 1),
            'average':           round(average, 1),
            'count':             trend['count'],
            'direction':         direction,
            'most_recent_risk':  most_recent_risk,
        },
    }

def _get_most_recent_risk(
    self,
    start_date: Optional[str],
    end_date: Optional[str],
) -> Optional[str]:
    """Return the most recent non-null risk_category in the date window."""
    conn = self._get_connection()
    try:
        where_clauses = ["risk_category IS NOT NULL"]
        params: List[Any] = []
        if start_date and end_date:
            where_clauses.append("DATE(created_at) BETWEEN ? AND ?")
            params.extend([start_date, end_date])
        where = "WHERE " + " AND ".join(where_clauses)
        row = conn.execute(
            f"SELECT risk_category FROM analyses {where} ORDER BY created_at DESC LIMIT 1",
            params,
        ).fetchone()
        return row['risk_category'] if row else None
    finally:
        conn.close()
```

Note: `_TEST_TYPE_LABELS` is a class-level dict. Place it directly inside the `DatabaseService` class body (not inside `__init__`).

- [ ] **Step 2: Verify manually**

```bash
python3 -c "
from services.database_service import get_database_service
db = get_database_service()
r = db.get_trend_insight(start_date='2020-01-01', end_date='2030-01-01')
print('success:', r['success'])
print('insight:', r['insight'])
"
```

Expected: `success: True`, insight is either `None` (no data) or a dict with `sentence`, `delta`, `direction`, etc.

- [ ] **Step 3: Commit**

```bash
git add backend/services/database_service.py
git commit -m "feat: add start_date/end_date to get_trend_data, add get_trend_insight"
```

---

## Task 3: Extend `/api/trends` and add `/api/trends/insight` in app.py

**Files:**
- Modify: `backend/app.py`

- [ ] **Step 1: Add `start_date`/`end_date` params to the existing `get_trends` route**

Find the existing `get_trends` function (around line 1370). Replace its body:

```python
@app.route('/api/trends', methods=['GET'])
def get_trends():
    """Get glucose trend data
    ---
    tags:
      - History
    summary: Get trend data for charts
    description: Returns glucose values over time. Use start_date/end_date for a custom range, or days for a relative lookback.
    parameters:
      - name: days
        in: query
        type: integer
        default: 30
        description: Number of days to look back (ignored when start_date and end_date are provided)
      - name: start_date
        in: query
        type: string
        description: Start date (YYYY-MM-DD)
      - name: end_date
        in: query
        type: string
        description: End date (YYYY-MM-DD)
      - name: test_type
        in: query
        type: string
        enum: [fasting, hba1c, ppbs, rbs, ogtt]
        description: Filter by test type
    responses:
      200:
        description: Trend data points
        schema:
          type: object
          properties:
            success:
              type: boolean
            data_points:
              type: array
              items:
                type: object
            count:
              type: integer
      500:
        description: Server error
    """
    try:
        days       = request.args.get('days', 30, type=int)
        start_date = request.args.get('start_date', None)
        end_date   = request.args.get('end_date', None)
        test_type  = request.args.get('test_type', None)

        db = get_database_service()
        result = db.get_trend_data(
            test_type=test_type,
            days=days,
            start_date=start_date,
            end_date=end_date,
        )
        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Get trends error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 2: Add the `/api/trends/insight` endpoint**

Insert immediately after the `get_trends` function:

```python
@app.route('/api/trends/insight', methods=['GET'])
def get_trend_insight():
    """Get insight sentence for the selected trend window
    ---
    tags:
      - History
    summary: Generate plain-English insight for glucose trend
    description: Returns a sentence describing glucose trajectory and most recent risk category for the selected period.
    parameters:
      - name: start_date
        in: query
        type: string
        description: Start date (YYYY-MM-DD)
      - name: end_date
        in: query
        type: string
        description: End date (YYYY-MM-DD)
      - name: test_type
        in: query
        type: string
        enum: [fasting, hba1c, ppbs, rbs, ogtt]
    responses:
      200:
        description: Insight result
        schema:
          type: object
          properties:
            success:
              type: boolean
            insight:
              type: object
              nullable: true
              description: null when fewer than 2 data points exist
      500:
        description: Server error
    """
    try:
        start_date = request.args.get('start_date', None)
        end_date   = request.args.get('end_date', None)
        test_type  = request.args.get('test_type', None)

        db = get_database_service()
        result = db.get_trend_insight(
            test_type=test_type,
            start_date=start_date,
            end_date=end_date,
        )
        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Get trend insight error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 3: Verify both endpoints with curl (Flask must be running)**

```bash
# Extend existing trends endpoint
curl -s "http://localhost:5000/api/trends?start_date=2020-01-01&end_date=2030-01-01" | python3 -m json.tool | grep -E "success|count"

# New insight endpoint
curl -s "http://localhost:5000/api/trends/insight?start_date=2020-01-01&end_date=2030-01-01" | python3 -m json.tool
```

Expected: both return `"success": true`. Insight is `null` or an object with `sentence`.

- [ ] **Step 4: Commit**

```bash
git add backend/app.py
git commit -m "feat: extend /api/trends with date params, add /api/trends/insight endpoint"
```

---

## Task 4: Add TypeScript types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add `TrendInsight` and `InsightResponse` interfaces**

Find the `TrendResponse` interface (around line 415) and add immediately after it:

```typescript
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

export interface InsightResponse {
  success: boolean;
  insight: TrendInsight | null;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Analyze.tsx"
```

Expected: no output (no new errors).

---

## Task 5: Update API service

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add `InsightResponse` to imports at the top of `api.ts`**

Find the existing types import line (e.g. `import type { ..., TrendResponse } from '../types';`) and add `InsightResponse`:

```typescript
import type {
  // ... existing imports ...
  TrendResponse,
  InsightResponse,
} from '../types';
```

- [ ] **Step 2: Replace `getTrends()` and add `getInsight()`**

Replace the existing `getTrends` function with the date-range version, and add `getInsight` after it:

```typescript
export async function getTrends(params: {
  start_date: string;
  end_date: string;
  test_type?: string;
}): Promise<ApiResponse<TrendResponse>> {
  try {
    const response = await apiClient.get<TrendResponse>('/api/trends', { params });
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<TrendResponse>(error);
  }
}

export async function getInsight(params: {
  start_date: string;
  end_date: string;
  test_type?: string;
}): Promise<ApiResponse<InsightResponse>> {
  try {
    const response = await apiClient.get<InsightResponse>('/api/trends/insight', { params });
    return { success: true, data: response.data };
  } catch (error) {
    return handleApiError<InsightResponse>(error);
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v "Analyze.tsx"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/api.ts
git commit -m "feat: add TrendInsight type, update getTrends params, add getInsight"
```

---

## Task 6: Update History.tsx — state + date controls

**Files:**
- Modify: `frontend/src/pages/History.tsx`

- [ ] **Step 1: Update imports**

Add `getInsight` to the existing import from `api.ts`, add `useRef` to the React import, and add `TrendInsight` to the types import:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { getHistory, deleteAnalysis, getTrends, getInsight } from '../services/api';
import type { AnalysisHistoryItem, TrendDataPoint, TrendInsight } from '../types';
```

Also add `Sparkles` to the lucide-react import:

```typescript
import {
  Clock, Trash2, Activity, Shield, Scan, FlaskConical,
  ChevronLeft, ChevronRight, FileDown, Filter, BarChart3, Inbox, Sparkles,
} from 'lucide-react';
```

- [ ] **Step 2: Add `defaultDateRange` helper and replace state declarations**

Add the helper function before the `History` component, then replace `trendDays` with the new state inside the component:

```typescript
// Place before the History component
function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}
```

Inside the `History` component, replace:
```typescript
const [trendDays, setTrendDays] = useState(30);
```
with:
```typescript
const [dateRange, setDateRange] = useState<{ start: string; end: string }>(defaultDateRange);
const [activePreset, setActivePreset] = useState<7 | 30 | 90 | null>(30);
const [insight, setInsight] = useState<TrendInsight | null>(null);
const [insightLoading, setInsightLoading] = useState(false);
const fetchIdRef = useRef(0);
```

- [ ] **Step 3: Replace `fetchTrends` with a parallel `fetchTrendsAndInsight`**

Remove the old `fetchTrends` and `useEffect` for trends. Add:

```typescript
const fetchTrendsAndInsight = useCallback(async () => {
  if (dateRange.start > dateRange.end) return;

  const id = ++fetchIdRef.current;
  setInsightLoading(true);

  const [trendsRes, insightRes] = await Promise.all([
    getTrends({ start_date: dateRange.start, end_date: dateRange.end }),
    getInsight({ start_date: dateRange.start, end_date: dateRange.end }),
  ]);

  if (id !== fetchIdRef.current) return; // discard stale response

  if (trendsRes.success && trendsRes.data) {
    setTrendData(trendsRes.data.data_points);
  }
  setInsight(
    insightRes.success && insightRes.data?.insight
      ? insightRes.data.insight
      : null
  );
  setInsightLoading(false);
}, [dateRange]);

useEffect(() => {
  fetchTrendsAndInsight();
}, [fetchTrendsAndInsight]);
```

Also update `handleDelete` to call `fetchTrendsAndInsight()` instead of `fetchTrends()`:

```typescript
const handleDelete = async (id: string) => {
  setDeletingId(id);
  const res = await deleteAnalysis(id);
  if (res.success) {
    fetchHistory();
    fetchTrendsAndInsight();
  }
  setDeletingId(null);
};
```

- [ ] **Step 4: Add a `setPreset` helper**

```typescript
const today = new Date();
const fmt = (d: Date) => d.toISOString().split('T')[0];

const setPreset = (days: 7 | 30 | 90) => {
  const end = fmt(today);
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  setDateRange({ start: fmt(start), end });
  setActivePreset(days);
};
```

---

## Task 7: Update History.tsx — trend chart header (date controls)

**Files:**
- Modify: `frontend/src/pages/History.tsx`

- [ ] **Step 1: Replace the 7d/30d/90d buttons block in the trend chart header**

Find the existing buttons block inside the trend chart card header:

```tsx
<div className="flex gap-1.5">
  {[7, 30, 90].map((d) => (
    <button
      key={d}
      onClick={() => setTrendDays(d)}
      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
        trendDays === d
          ? 'bg-white text-indigo-700'
          : 'bg-white/10 text-white/80 hover:bg-white/20'
      }`}
    >
      {d}d
    </button>
  ))}
</div>
```

Replace it with:

```tsx
<div className="flex flex-wrap items-center gap-2">
  {/* Quick-select pills */}
  <div className="flex gap-1">
    {([7, 30, 90] as const).map((d) => (
      <button
        key={d}
        onClick={() => setPreset(d)}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
          activePreset === d
            ? 'bg-white text-indigo-700'
            : 'bg-white/10 text-white/80 hover:bg-white/20'
        }`}
      >
        {d}d
      </button>
    ))}
  </div>
  {/* Date inputs */}
  <div className="flex items-center gap-1.5">
    <input
      type="date"
      value={dateRange.start}
      max={dateRange.end}
      onChange={(e) => {
        setDateRange((r) => ({ ...r, start: e.target.value }));
        setActivePreset(null);
      }}
      className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/40 [color-scheme:dark]"
    />
    <span className="text-white/50 text-xs">–</span>
    <input
      type="date"
      value={dateRange.end}
      min={dateRange.start}
      max={fmt(today)}
      onChange={(e) => {
        setDateRange((r) => ({ ...r, end: e.target.value }));
        setActivePreset(null);
      }}
      className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/40 [color-scheme:dark]"
    />
  </div>
</div>
```

Note: `fmt` and `today` are defined in Task 6 Step 4. Place them at the top of the component body (before the JSX return), not inside a callback.

---

## Task 8: Update History.tsx — insight banner

**Files:**
- Modify: `frontend/src/pages/History.tsx`

- [ ] **Step 1: Add insight banner below the chart, above the legend**

Find the `</div>` that closes the `<div className="h-64">` chart container, then the legend `<div className="flex items-center justify-center gap-6 mt-3 ...">`. Insert the banner between them:

```tsx
{/* Insight banner */}
{insightLoading ? (
  <div className="mt-4 h-10 rounded-xl bg-indigo-50 animate-pulse" />
) : insight && insight.count >= 2 ? (
  <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
    <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
    <p className="text-sm text-indigo-800 leading-relaxed">{insight.sentence}</p>
  </div>
) : null}
```

- [ ] **Step 2: Add date range validation message**

If `dateRange.start > dateRange.end`, show a warning instead of the chart. Find the `{chartData.length > 0 && (` condition wrapping the trend card, and add a validation guard inside the chart body (just above the `<div className="h-64">`):

```tsx
{dateRange.start > dateRange.end && (
  <p className="text-sm text-rose-500 mb-4">
    Start date must be before end date.
  </p>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "Analyze.tsx"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/History.tsx
git commit -m "feat: add date range picker + insight sentence banner to History page"
```

---

## Task 9: End-to-end verification

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate && python3 app.py

# Terminal 2 — frontend
cd frontend && npm run dev
```

- [ ] **Step 2: Verify golden path**

1. Open `http://localhost:5173/history`
2. If history is empty, save a risk prediction from the Analyze page first
3. The trend chart header should show three pill buttons (`7d`, `30d`, `90d`) and two date inputs
4. Clicking `7d` updates both inputs and highlights the pill
5. Manually editing a date input clears the active pill highlight
6. Setting start > end shows the validation warning
7. With ≥2 data points, the insight banner appears below the chart with a sentence
8. With 0–1 data points, no banner appears
9. Deleting a record refreshes both the history list and the chart/insight

- [ ] **Step 3: Verify insight API directly**

```bash
# Replace dates with actual dates from your DB
curl -s "http://localhost:5000/api/trends/insight?start_date=2025-01-01&end_date=2027-01-01" | python3 -m json.tool
```

Expected:
```json
{
  "success": true,
  "insight": {
    "sentence": "Your glucose ...",
    "count": 3,
    "direction": "up",
    ...
  }
}
```
