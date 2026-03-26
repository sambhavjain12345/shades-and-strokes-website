# 🎨 Shades & Strokes 2.0

> A full-stack eCommerce platform for fine art — paintings, sketches, and sculptures.
> Built with React-ready HTML, Node.js, Express, MySQL, and Docker.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Option A — Docker (Recommended)](#option-a--docker-recommended)
  - [Option B — Manual Setup](#option-b--manual-setup)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Default Credentials](#default-credentials)

---

## Project Structure

```
shades-and-strokes/
│
├── frontend/                        # Static HTML pages
│   ├── shades_and_strokes_landing.html
│   ├── shades_strokes_login.html
│   ├── shop.html
│   ├── product.html
│   ├── cart.html
│   ├── wishlist.html
│   ├── orders.html
│   ├── profile.html
│   └── admin.html
│
└── backend/
    ├── server.js                    # Express entry point
    ├── package.json
    ├── Dockerfile
    ├── docker-compose.yml
    ├── nginx.conf
    ├── .env.example
    │
    ├── config/
    │   ├── db.js                    # MySQL connection pool
    │   └── schema.sql               # All table definitions
    │
    ├── middleware/
    │   ├── auth.js                  # JWT protect / authorize / optionalAuth
    │   ├── error.js                 # Global error handler + asyncHandler
    │   └── validate.js              # express-validator rule sets
    │
    ├── controllers/
    │   ├── authController.js        # register, login, me, updateProfile
    │   ├── productController.js     # CRUD + search + filtering + reviews
    │   ├── cartController.js        # get, add, update, remove, clear
    │   ├── wishlistController.js    # get, add, remove, check
    │   ├── orderController.js       # place, track, status update, cancel
    │   └── adminController.js       # dashboard stats, user management
    │
    ├── routes/
    │   ├── auth.js
    │   ├── products.js
    │   └── index.js                 # cart, wishlist, orders, admin
    │
    └── utils/
        ├── initDB.js                # Create tables from schema.sql
        └── seedDB.js                # Populate with sample data
```

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | HTML5, CSS3 (custom), Vanilla JS    |
| Backend    | Node.js v20, Express v4             |
| Database   | MySQL 8.0                           |
| Auth       | JWT (jsonwebtoken) + bcryptjs       |
| Validation | express-validator                   |
| Security   | helmet, cors, express-rate-limit    |
| Container  | Docker, Docker Compose, Nginx       |
| Dev Tools  | nodemon, morgan                     |

---

## Getting Started

### Prerequisites

- [Node.js ≥ 18](https://nodejs.org/)
- [MySQL 8.0](https://dev.mysql.com/) — OR —
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

### Option A — Docker (Recommended)

The entire stack (MySQL + Express API + Nginx serving frontend) runs with one command.

```bash
# 1. Clone / download the project
cd shades-and-strokes

# 2. Copy env file and edit values
cp backend/.env.example backend/.env

# 3. Place all frontend HTML files in a /frontend folder
#    (same directory as docker-compose.yml)

# 4. Start everything
docker compose -f backend/docker-compose.yml up --build

# App is now live at:
#   Frontend  →  http://localhost
#   API       →  http://localhost/api
#   API direct → http://localhost:5000/api
```

To seed sample data:
```bash
docker exec -it ss_api node utils/seedDB.js
```

---

### Option B — Manual Setup

#### 1. MySQL

```sql
-- In MySQL shell:
CREATE DATABASE shades_strokes;
```

```bash
mysql -u root -p shades_strokes < backend/config/schema.sql
```

#### 2. Backend

```bash
cd backend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, etc.

# Seed sample data
npm run db:seed

# Start development server (hot reload)
npm run dev

# OR production
npm start
```

API will be available at `http://localhost:5000`

#### 3. Frontend

Open any of the HTML files directly in a browser, or serve them with a simple static server:

```bash
# From the project root
npx serve frontend/
# → http://localhost:3000
```

---

## API Reference

**Base URL:** `http://localhost:5000/api`

All protected routes require: `Authorization: Bearer <token>`

### Auth

| Method | Endpoint                    | Auth     | Description          |
|--------|-----------------------------|----------|----------------------|
| POST   | `/auth/register`            | Public   | Create account       |
| POST   | `/auth/login`               | Public   | Login, get JWT       |
| GET    | `/auth/me`                  | 🔒 Any   | Get current user     |
| PUT    | `/auth/update-profile`      | 🔒 Any   | Update name/phone    |
| PUT    | `/auth/change-password`     | 🔒 Any   | Change password      |

### Products

| Method | Endpoint                    | Auth           | Description               |
|--------|-----------------------------|----------------|---------------------------|
| GET    | `/products`                 | Public         | List with filters + search|
| GET    | `/products/:id`             | Public         | Single artwork + reviews  |
| GET    | `/products/categories`      | Public         | All categories            |
| POST   | `/products`                 | 🔒 Admin/Artist| Create artwork            |
| PUT    | `/products/:id`             | 🔒 Admin/Artist| Update artwork            |
| DELETE | `/products/:id`             | 🔒 Admin       | Soft-delete artwork       |
| POST   | `/products/:id/reviews`     | 🔒 Collector   | Post a review             |

**Query params for GET `/products`:**

| Param       | Example            | Description                        |
|-------------|--------------------|------------------------------------|
| `category`  | `paintings`        | Filter by category slug            |
| `artist_id` | `1`                | Filter by artist                   |
| `featured`  | `true`             | Featured only                      |
| `search`    | `cerulean`         | Search title, medium, artist name  |
| `sort`      | `price_asc`        | `price_asc`, `price_desc`, `newest`|
| `min_price` | `10000`            | Price range filter                 |
| `max_price` | `50000`            | Price range filter                 |
| `page`      | `2`                | Pagination                         |
| `limit`     | `12`               | Items per page (default 12)        |

### Cart

| Method | Endpoint       | Auth       | Description         |
|--------|----------------|------------|---------------------|
| GET    | `/cart`        | 🔒 Any     | Get cart items      |
| POST   | `/cart`        | 🔒 Any     | Add item            |
| PUT    | `/cart/:id`    | 🔒 Any     | Update quantity     |
| DELETE | `/cart/:id`    | 🔒 Any     | Remove item         |
| DELETE | `/cart`        | 🔒 Any     | Clear entire cart   |

### Wishlist

| Method | Endpoint                          | Auth   | Description            |
|--------|-----------------------------------|--------|------------------------|
| GET    | `/wishlist`                       | 🔒 Any | Get wishlist           |
| POST   | `/wishlist`                       | 🔒 Any | Add artwork            |
| DELETE | `/wishlist/:productId`            | 🔒 Any | Remove artwork         |
| GET    | `/wishlist/check/:productId`      | 🔒 Any | Check if wishlisted    |

### Orders

| Method | Endpoint                   | Auth        | Description              |
|--------|----------------------------|-------------|--------------------------|
| GET    | `/orders`                  | 🔒 Any      | My orders (admin: all)   |
| GET    | `/orders/:id`              | 🔒 Any      | Order detail + timeline  |
| POST   | `/orders`                  | 🔒 Any      | Place order from cart    |
| PUT    | `/orders/:id/status`       | 🔒 Admin    | Update order status      |
| DELETE | `/orders/:id`              | 🔒 Any      | Cancel order             |

**Order statuses:** `pending` → `confirmed` → `packaging` → `shipped` → `delivered`

### Admin

| Method | Endpoint              | Auth      | Description                  |
|--------|-----------------------|-----------|------------------------------|
| GET    | `/admin/stats`        | 🔒 Admin  | Dashboard stats + charts     |
| GET    | `/admin/users`        | 🔒 Admin  | All users with filters       |
| PUT    | `/admin/users/:id`    | 🔒 Admin  | Update user role/status      |
| GET    | `/admin/orders`       | 🔒 Admin  | All orders with filters      |

---

## Database Schema

```
users          → id, name, email, password_hash, role, phone, address
artists        → id, user_id, name, bio, location, avatar_url
categories     → id, name, slug
products       → id, title, slug, description, artist_id, category_id,
                 medium, dimensions, year, price, stock, is_featured, tag
wishlists      → id, user_id, product_id
cart_items     → id, user_id, product_id, quantity
orders         → id, order_number, user_id, status, total_amount, shipping_*
order_items    → id, order_id, product_id, quantity, unit_price
order_timeline → id, order_id, status, description, created_at
reviews        → id, product_id, user_id, rating, comment
```

---

## Environment Variables

| Variable        | Default              | Required | Description              |
|-----------------|----------------------|----------|--------------------------|
| `PORT`          | `5000`               | No       | Express server port      |
| `NODE_ENV`      | `development`        | No       | Environment mode         |
| `DB_HOST`       | `localhost`          | Yes      | MySQL host               |
| `DB_PORT`       | `3306`               | No       | MySQL port               |
| `DB_USER`       | `root`               | Yes      | MySQL user               |
| `DB_PASSWORD`   | —                    | Yes      | MySQL password           |
| `DB_NAME`       | `shades_strokes`     | Yes      | Database name            |
| `JWT_SECRET`    | —                    | Yes      | JWT signing secret       |
| `JWT_EXPIRES_IN`| `7d`                 | No       | Token expiry             |
| `CLIENT_URL`    | `http://localhost:3000` | No    | CORS allowed origin      |

---

## Default Credentials

After running `npm run db:seed`:

| Role      | Email                          | Password   |
|-----------|--------------------------------|------------|
| Admin     | admin@shadesstrokes.com        | admin123   |
| Collector | rohan@example.com              | test123    |
| Collector | priya@example.com              | test123    |
| Collector | aditi@example.com              | test123    |

> ⚠️ Change all passwords before deploying to production.

---

## Sample API Requests

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"test1234"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rohan@example.com","password":"test123"}'

# Get featured products
curl "http://localhost:5000/api/products?featured=true&limit=6"

# Search artworks
curl "http://localhost:5000/api/products?search=amber&sort=price_asc"

# Add to cart (requires token)
curl -X POST http://localhost:5000/api/cart \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":1}'

# Place order (requires token)
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"product_id":1,"quantity":1}],
    "shipping_name": "Rohan Kapoor",
    "shipping_addr": "14 Marine Drive, Mumbai",
    "shipping_phone": "+91 98765 43210"
  }'

# Admin: get dashboard stats
curl http://localhost:5000/api/admin/stats \
  -H "Authorization: Bearer <admin_token>"
```

---

*Shades & Strokes 2.0 — Built with craft, shipped with care.*
