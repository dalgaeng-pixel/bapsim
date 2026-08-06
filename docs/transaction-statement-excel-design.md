# Transaction Statement Excel Design

## Understanding Summary

- Create a customer-submission Excel workbook from the existing transaction-statement data.
- Keep the current operations-facing monthly settlement Excel export unchanged.
- Match the existing A4 portrait transaction-statement print layout.
- Export one selected settlement account per workbook.
- Lay out one delivery location full width, two locations vertically, and three or four locations in a 2x2 grid.
- Make quantities and the normal unit price editable, with formulas recalculating row amounts, location subtotals, and the monthly total.
- Pre-fill statement remarks from administrator daily-delivery correction reasons while allowing statement-specific edits or removal.

## Assumptions

- Administrators are the only users who can generate the workbook.
- Existing transaction-statement calculations remain the source of truth.
- Normal rows reference one editable account unit-price cell.
- Special-price rows preserve their recorded direct prices and show the special-price note in remarks.
- The workbook uses A4 portrait, narrow margins, a defined print area, and fit-to-one-page settings.
- Printer drivers can still introduce small physical margin differences.
- The expected scale is one month and no more than four delivery locations per selected settlement account.
- No database migration or new persisted personal information is required.
- A saved statement remark, including an intentionally saved empty value, overrides the automatic correction reason.

## Decision Log

1. Use a dedicated Excel workbook library loaded only when the export button is pressed.
   - Considered extending the handcrafted OOXML writer and filling static template files.
   - Chosen because merged cells, borders, formulas, print settings, and variable layouts are more reliable and maintainable.
2. Replace only the transaction-statement Excel output.
   - The existing monthly settlement Excel remains an operations report.
3. Mirror the current print layout.
   - One location uses full width, two are stacked, and three to four use a 2x2 grid on one A4 page.
4. Use formulas for editable values.
   - Normal quantity and unit-price edits recalculate amounts and totals.
   - Recorded special prices remain explicit exceptions.
5. Use daily-delivery correction reasons as the initial statement remarks.
   - If lunch and dinner reasons match, show the reason once.
   - If they differ, label and join them as `Lunch: ... / Dinner: ...`.
   - A statement-specific edit takes precedence; clearing and saving the field intentionally suppresses the automatic text.

## Final Design

- Add a transaction-statement-specific workbook generator.
- Dynamically load the workbook library from the existing Excel button handler.
- Render recipient and supplier information, VAT-inclusive total, location tables, monthly totals, and bank details.
- Use the visible columns `Date | Lunch | Dinner | Amount | Remarks` for each location table.
- Store the normal unit price in an editable header cell and reference it from normal amount formulas.
- Use saved special prices for special-price rows and retain their explanatory remarks.
- Pre-fill each location/date remarks cell from settlement-included administrator correction reasons.
- Preserve explicit statement remarks as overrides, including an empty override used to remove an unnecessary automatic reason.
- Add formulas for daily amounts, location subtotals, and the monthly grand total.
- Configure A4 portrait, narrow margins, fit-to-page, print area, repeated visual borders, wrapped remarks, and Korean-compatible fonts.
- Download the workbook using the selected account name and month in the filename.

## Verification

- Verify one, two, three, and four-location layouts in Excel print preview.
- Verify lunch-only, dinner-only, and combined-meal formulas.
- Verify mixed normal and special prices.
- Verify wrapped long remarks do not leave the print area.
- Verify matching correction reasons are deduplicated, differing lunch/dinner reasons are labeled, and edited or cleared statement remarks remain authoritative.
- Verify manual quantity and normal unit-price edits recalculate subtotals and the grand total.
- Verify an empty month still produces a valid form.
- Run type checking and a production build, and confirm the existing monthly export is unchanged.
