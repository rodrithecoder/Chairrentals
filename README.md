# 🪑 Chair Booking Manager

A simple web app to manage chair reservations across 4 months, with inventory tracking, cost calculation, and delivery/pickup support.

## Running on Replit

### Step 1 — Create a new Repl
1. Go to [replit.com](https://replit.com) and sign in
2. Click **+ Create Repl**
3. Choose template: **React (Vite)**
4. Name it `chair-booking` → click **Create Repl**

### Step 2 — Upload the files
Replace the default files with the ones from this folder:
- Delete everything in the Repl's file panel
- Upload or paste:
  - `package.json`
  - `vite.config.js`
  - `index.html`
  - `src/main.jsx`
  - `src/App.jsx`

### Step 3 — Install & Run
In the Replit Shell tab, run:
```
npm install
npm run dev
```

### Step 4 — Make it public
1. Click **Deploy** in the top bar (or use the Webview panel)
2. Replit gives you a public URL like `https://chair-booking.yourname.repl.co`
3. Share that URL with anyone who needs access

## Data Storage
Bookings are saved in the browser's `localStorage` — they persist across page refreshes on the same device/browser. If you need multi-device sync in the future, the next step would be connecting a database like [Supabase](https://supabase.com).

## Features
- ✅ Register bookings with customer name, date, chair count
- ✅ Pickup or delivery (with address + delivery fee)
- ✅ Manual % discount with live cost preview
- ✅ Inventory guard — prevents overbooking (max 80 chairs/day)
- ✅ 4-month calendar with capacity color coding
- ✅ Bookings list with revenue summary
