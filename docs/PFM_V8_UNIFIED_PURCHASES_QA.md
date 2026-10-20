# PFM V8 — Single Purchase Entry (QA branch)

Branch: `feature/pfm-v8-single-purchase-entry`. This is an isolated, **not-yet-approved** feature branch. Installed V8 builds and the base branch remain unchanged until qualified.

## One entry, one invoice
Use the **Purchases → Inventory/Purchases → Expenses** screen for every new purchase. A single invoice has one farm, invoice number, supplier and date, plus multiple item lines. Each line has type, item, quantity, unit or total pricing, discount, VAT inclusion/exclusion, VAT rate and recoverability. Starter/grower/finisher feed is selected explicitly.

The invoice header is **metadata only**; it must not be counted as another expense. Each item writes **once** to its approved existing V4.10 data source:

| Type | Storage and accounting |
| --- | --- |
| Feed, medicine, vaccines, disinfectants, bedding | Create a priced V4.10 stock lot only. Issue/consume through the existing operational screens to charge a house cycle at actual lot cost. |
| Chicks | Distribute the single invoice's costs across the farm's houses sharing the selected reception cycle. Update existing `v410.chicks` and `finance[cycle].chicks` exactly once; free chicks are allocated in whole birds. |
| Rent, diesel, electricity, water, labor, transportation and other direct services | Create exactly one detailed `v410.expenses` record and a matching **same-ID** charge in the existing cycle's `finance.expenses`. The matching entry is an audit/detail view, not a second profit-and-loss charge. |

Existing manual purchase-entry controls are hidden in the UI to avoid parallel paths. Original data, stock balances, returns, actual feed/medicine consumption, financial reports, cycle closure, breeding standards, printing and synchronization are not changed.

## Safety rules
- Prevent duplicate invoices against both V8 document headers and legacy V4.10 purchase lots, chick invoices, chick-cost records and expense detail entries. Duplicate key is farm + normalized supplier + normalized invoice number. If a legacy record has no supplier, the matching invoice number is treated as ambiguous and blocked rather than automatically duplicated.
- Prevent duplicate invoice item lines and two chick lines for the same reception cycle. Never write chick costs on an already charged or financially closed cycle.
- Validate every line and total **before** changing in-memory database. Persist the old V4.10 and finance objects on an exception.
- With a ton purchase, the invoice retains **tons** while the stock lot quantity/unit uses **kilograms**.
- Do not auto-import, delete, overwrite or relabel historical invoices.
- Supabase's existing account-scoped conflict detection remains responsible for concurrent cross-device edits; V8 still requires manual conflict resolution if two offline devices independently enter the same invoice. This feature does NOT claim database-level global uniqueness without online server confirmation.

## Mandatory release checks
1. Run `node tests/test_v8_single_purchase_invoice.cjs` and existing finance/VAT regression suite.
2. Use disposable data on Android and Windows and test the form visually. Verify one feed purchase appears once in stock, then a single quantity issue charges one cycle. Verify medicine, chicks with free birds and VAT-inclusive direct expenses.
3. Re-enter the same invoice and confirm zero records/costs added.
4. Test a 2-device same-user cloud account and offline reconnect; verify no silent merge after conflict.
5. Test iOS using a signed build and physical device. An iOS source build is not equivalent to an IPA or device QA.
6. Review print/PDF, logos, language switching, financial locks and existing V8 functions. Back up data before using a new binary with real farms.

**Do not merge to the approved V8 release until the above device-based tests are complete.**
