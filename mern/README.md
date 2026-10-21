# 🎨 Shades & Strokes 2.0 — MERN Frontend

> React 18 + Vite frontend for the Shades & Strokes fine art eCommerce platform.
> Connects to the existing Node.js + Express + MySQL backend.

---

## Project Structure

```
frontend/
├── index.html
├── vite.config.js          ← proxies /api → backend:5000
├── package.json
└── src/
    ├── main.jsx            ← React entry point
    ├── App.jsx             ← Router + context providers
    │
    ├── styles/
    │   └── global.css      ← All luxury CSS variables + shared styles
    │
    ├── context/
    │   ├── AuthContext.jsx  ← Login state, user, JWT
    │   └── CartContext.jsx  ← Cart + wishlist badge counts
    │
    ├── hooks/
    │   ├── useToast.js      ← showToast(msg, type)
    │   └── useReveal.js     ← Scroll-triggered fade-in
    │
    ├── services/
    │   └── api.js           ← All API calls (AuthAPI, ProductsAPI, etc.)
    │
    ├── components/
    │   ├── common/
    │   │   ├── Cursor.jsx       ← Custom gold cursor
    │   │   ├── Particles.jsx    ← Gold floating particles
    │   │   └── ProductCard.jsx  ← Reusable artwork card
    │   └── layout/
    │       ├── Navbar.jsx       ← Top nav with search, badges, auth
    │       └── Layout.jsx       ← Wraps all pages: Navbar + Cursor + Particles
    │
    └── pages/
        ├── Home.jsx          ← Landing page
        ├── Shop.jsx          ← Gallery grid with filters + search
        ├── ProductDetail.jsx ← Single artwork view
        ├── Login.jsx         ← Login + Register (tabbed)
        └── OtherPages.jsx    ← Cart, Wishlist, Orders, Profile, Admin
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- Backend running on port 5000 (`cd backend && npm run dev`)

### Install & run

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

Vite automatically proxies all `/api` requests to `http://localhost:5000` — no CORS issues.

### Production build

```bash
npm run build
# Output: frontend/dist/
```

Then the backend serves the built React app directly (see `server.js` production block).

---

## Routes

| Path            | Page            | Auth required |
|-----------------|-----------------|---------------|
| `/`             | Home / Landing  | No            |
| `/shop`         | Gallery         | No            |
| `/product/:id`  | Product Detail  | No            |
| `/login`        | Login / Register| No            |
| `/cart`         | Cart            | Yes           |
| `/wishlist`     | Wishlist        | Yes           |
| `/orders`       | Order History   | Yes           |
| `/profile`      | User Profile    | Yes           |
| `/admin`        | Admin Dashboard | Admin only    |

---

## Key Design Decisions

### AuthContext
Wraps the entire app. Exposes `user`, `login()`, `register()`, `logout()`, `updateUser()`, `isAdmin`.
JWT token stored in `localStorage`. Expired tokens auto-redirect to `/login`.

### CartContext
Manages cart + wishlist badge counts shown in the navbar.
Calls `refreshCounts()` after any cart/wishlist mutation.

### api.js service layer
All backend calls go through `apiFetch()` which:
- Attaches `Authorization: Bearer <token>` automatically
- Handles 401 → auto logout
- Throws `Error` with backend message for easy catch in components

### ProductCard
Fully reusable — used on Home, Shop, and anywhere a product grid appears.
Handles add-to-cart and add-to-wishlist with logged-in / guest branching.

### Fallback data
Every page that fetches from the API has a `.catch()` fallback with hardcoded data so the UI always renders even when the backend is offline.

---

## Backend integration

The Express backend provides authentication, products, carts, wishlists, orders,
admin management, artist-owned inventory, image uploads, and the public artist
directory. Existing databases should run `npm run db:migrate` from `backend/`
to add the current order-return statuses.
