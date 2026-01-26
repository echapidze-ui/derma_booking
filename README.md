# Medical Facility Booking — Separated Files

This is your monolithic page split into clean files.

## File structure
```
medical-booking/
├─ index.html        # Markup only; links to styles.css and app.js
├─ styles.css        # All CSS extracted from the original <style> blocks
└─ app.js            # All JavaScript logic (plus small stubs for customer flows)
```

> Note: I removed the unrelated Cloudflare challenge snippet that was appended to the original HTML. Everything else is preserved. I also renamed the duplicate `id="customerBookingForm"` (section and form collided). The form is now `id="customerBookingFormEl"` to avoid conflicts.

## How files relate

- `index.html`
  - Loads external SDKs you were already using: `/_sdk/data_sdk.js` and `/_sdk/element_sdk.js`.
  - Loads Tailwind from CDN (as in your original).
  - Links `styles.css` for styles and `app.js` for functionality.
  - Declares all UI sections: Public view, Customer Auth, Customer Dashboard, Customer Booking, Admin pages, and the Promo popup.
- `styles.css`
  - Contains **all** styling from your original `<style>` blocks, unchanged.
- `app.js`
  - Initializes the SDKs (if available) and wires events.
  - Implements booking flow (public view) exactly as before.
  - Admin dashboard list, status updates, and delete.
  - **Small stubs** so the buttons in Customer flows don’t throw errors:
    - `showCustomerAuth`, `switchAuthTab`, `showCustomerDashboard`, `showBookingForm`, `customerLogout`.
    - `updateCustomerTimeSlots`, `renderCustomerBookings` (minimal implementations).
  - If the SDK is **not** available, the app falls back to in‑memory arrays so you can still demo the UI.

## Minimal dependency diagram

```
index.html
 ├─ links → styles.css
 ├─ scripts → /_sdk/data_sdk.js, /_sdk/element_sdk.js, tailwind
 └─ scripts → app.js
       ├─ uses window.dataSdk (create, update, delete, init)  ← optional
       ├─ uses window.elementSdk (init, setConfig)            ← optional
       ├─ manipulates DOM sections (#publicView, #adminDashboard, ...)
       └─ updates UI lists (time slots, bookings, stats)
```

## Run locally

Open `index.html` directly in a browser. For full functionality, serve the folder with a small static server so relative paths and SDKs behave consistently:

```bash
# from the folder above 'medical-booking'
python3 -m http.server 8000
# then visit http://localhost:8000/medical-booking/
```

If your environment provides `/_sdk/data_sdk.js` and `/_sdk/element_sdk.js`, leave those paths as-is. Otherwise, the app will still run in demo mode without persistence.
