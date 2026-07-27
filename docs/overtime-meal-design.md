# Overtime Meal Registration Design

## Scope

- A customer contact records only today's overtime dinner headcount for its assigned delivery location.
- A saved zero is meaningful: it confirms there is no overtime meal requirement and sends an administrator notification.
- Weekends and configured dinner holidays default to zero and do not accept customer input.
- Customers can re-save the same date to correct the number.

## Data Model

overtime_meal_entries has one row per client_id and order_date.

- quantity is a non-negative additional dinner count.
- It is intentionally separate from daily_meal_orders, preserving normal meal changes and administrator delivery corrections.
- The client contact action is restricted by its existing contact-access-group membership.

## Calculation

- Only dinner/석식 meal rows receive the additional quantity.
- Delivery pages, delivery Excel, monthly settlement, and transaction statements use the calculated dinner total.
- Normal customer meal inputs retain their original value; the overtime menu remains the only place that edits the additional count.

## Notifications

- Every new or corrected entry, including zero, adds an unread administrator notification.
- Existing server-side push delivery sends the same notification to subscribed administrator devices.
- The administrator's Important Changes view lists overtime entries for the selected date.

## Decision Log

- Chosen: dedicated overtime table rather than adding the count to normal dinner orders.
- Reason: it keeps recurring defaults, customer meal changes, delivery corrections, and overtime additions distinguishable while still producing one delivery and settlement total.