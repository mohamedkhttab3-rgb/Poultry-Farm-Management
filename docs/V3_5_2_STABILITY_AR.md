# V3.5.2 — Stability & Financial Truth

- Current Live has one centralized calculation: placement - cumulative dead - cumulative cull - sales to the selected date.
- Report, cycle, house performance and dashboard consume the same live breakdown.
- Actual sales revenue is always read from the sales/harvest ledger; it is not manually entered in finance.
- Finance records store a transparent snapshot of actual sales, total revenue, total cost and profit/loss for reporting/audit, while the sales ledger remains authoritative.
- Project currency is the single currency source; transaction rows are normalized to it when the currency is changed.
- Existing transactions are not converted by an invented exchange rate.
