# UI Polish — Design Spec

**Date:** 2026-04-26
**Roadmap item:** 6 — Mobile responsiveness audit, skeleton loaders, better empty/error states
**Approach:** Option A — inline edits to existing files, no new components

---

## Scope

Four targeted changes across three files:

| # | Change | File(s) |
|---|--------|---------|
| 1 | History skeleton rows | `frontend/src/pages/History.tsx` |
| 2 | Trend chart empty state | `frontend/src/pages/History.tsx` |
| 3 | Mobile padding fixes | `frontend/src/pages/Analyze.tsx`, `frontend/src/components/FileUpload.tsx` |
| 4 | Retry action on error | `frontend/src/pages/Analyze.tsx` |

---

## 1. History Skeleton Rows

**Problem:** During history table load, a bare centered spinner is shown. Users have no sense of the content shape that's loading.

**Solution:** Replace the spinner block entirely with 5 skeleton rows using the existing `.skeleton` CSS class (shimmer animation already defined in `index.css`).

**Row structure** (mirrors live rows):
- Left: `w-9 h-9` square skeleton (badge placeholder)
- Middle: two stacked skeleton lines — `h-4 w-32` and `h-3 w-48 mt-1`
- Right: two `w-8 h-8` square skeletons (action button placeholders)

**Padding/spacing:** `p-4 gap-4` — identical to live rows so layout does not shift on load completion.

**Trigger:** `loading === true` state (existing).

---

## 2. Trend Chart Empty State

**Problem:** When `chartData.length === 0`, the entire trend chart card is hidden. Users don't know it exists or that they need more data.

**Solution:** Always render the card. When `chartData.length === 0`, replace the chart area (`h-64`) with a centered empty state. The date range controls and header remain visible so the user can try adjusting the range.

**Empty state contents:**
- Icon: `BarChart3` (already imported), `w-10 h-10 text-slate-300`
- Heading: "No glucose data" — `font-semibold text-slate-600`
- Sub-line: "Analyses with glucose values will appear here." — `text-sm text-slate-400`
- Spacing: `p-12` centered column — matches History table empty state

**Insight banner and legend:** hidden when `chartData.length === 0` (no data to describe).

---

## 3. Mobile Padding Fixes

**Problem:** Two components use fixed large padding that squeezes content on small screens.

**Changes:**

| Location | Before | After |
|----------|--------|-------|
| `FileUpload.tsx` — drop zone `div` | `p-10` | `p-6 sm:p-10` |
| `Analyze.tsx` — main content card `div` | `p-8` | `p-4 sm:p-8` |

No other layout changes. No other components affected.

---

## 4. Retry Action on Error States

**Problem:** The error card in `Analyze.tsx` only offers a "Dismiss" button. Users must manually re-select their file or re-fill the form to retry.

**Solution:** Store the last submitted action as a `useRef<(() => void) | null>` called `lastActionRef`. At the start of each handler (`handleFileAnalysis`, `handleManualAnalysis`, `handleRiskPrediction`), set `lastActionRef.current` to a closure that re-runs that specific call with the same arguments.

**Retry button:**
- Label: "Try again"
- Icon: `RotateCcw` from lucide-react
- Style: `bg-indigo-100 text-indigo-700 hover:bg-indigo-200` — same shape as the Dismiss button
- Action: calls `lastActionRef.current?.()` then clears the error
- Placement: to the left of "Dismiss" in the error card's button row

**Edge case:** If `lastActionRef.current` is null (error before any submission — e.g., file validation), the retry button is not rendered.

---

## Out of Scope

- No new component files
- No changes to `index.css`
- No changes to `About.tsx`, `Home.tsx`, `Header.tsx`, `Footer.tsx`
- No changes to backend or API layer
