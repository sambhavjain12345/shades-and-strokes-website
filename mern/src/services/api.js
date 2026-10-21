const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export function readStoredJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export function readStoredArray(key) {
  const value = readStoredJSON(key, []);
  return Array.isArray(value) ? value : [];
}

// ── Core fetch ────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('ss_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: res.statusText || 'The server returned an invalid response' };
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('ss_token');
      localStorage.removeItem('ss_user');
      // A failed sign-in is an expected form error. Only force navigation when
      // an existing session has actually expired.
      if (token && !endpoint.startsWith('/auth/login')) {
        window.location.assign('/login');
      }
    }
    throw new Error(data.message || `API error ${res.status}`);
  }
  return data;
}

// ── Auth ──────────────────────────────────────────────────────
export const AuthAPI = {
  getGoogleConfig:   ()    => apiFetch('/auth/google/config'),
  async login(email, password) {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('ss_token', data.token);
    localStorage.setItem('ss_user', JSON.stringify(data.user));
    return data;
  },
  async register(name, email, password) {
    const data = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    localStorage.setItem('ss_token', data.token);
    localStorage.setItem('ss_user', JSON.stringify(data.user));
    return data;
  },
  async googleLogin(credential) {
    const data = await apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
    localStorage.setItem('ss_token', data.token);
    localStorage.setItem('ss_user', JSON.stringify(data.user));
    return data;
  },
  getMe:            ()    => apiFetch('/auth/me'),
  updateProfile:    (b)   => apiFetch('/auth/update-profile', { method: 'PUT', body: JSON.stringify(b) }),
  changePassword:   (b)   => apiFetch('/auth/change-password', { method: 'PUT', body: JSON.stringify(b) }),
  logout() {
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_user');
  },
};

// ── Products ──────────────────────────────────────────────────
export const ProductsAPI = {
  getAll(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/products${q ? '?' + q : ''}`);
  },
  getOne:       (id)      => apiFetch(`/products/${id}`),
  getCategories:()        => apiFetch('/products/categories'),
  addReview:    (id, b)   => apiFetch(`/products/${id}/reviews`, { method: 'POST', body: JSON.stringify(b) }),
  reviewEligibility:(id)  => apiFetch(`/products/${id}/review-eligibility`),
  create:       (b)       => apiFetch('/products', { method: 'POST', body: JSON.stringify(b) }),
  update:       (id, b)   => apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  remove:       (id)      => apiFetch(`/products/${id}`, { method: 'DELETE' }),
};

// ── Cart ──────────────────────────────────────────────────────
export const CartAPI = {
  get:          ()            => apiFetch('/cart'),
  add:          (pid, qty=1) => apiFetch('/cart', { method: 'POST', body: JSON.stringify({ product_id: pid, quantity: qty }) }),
  update:       (id, qty)    => apiFetch(`/cart/${id}`, { method: 'PUT', body: JSON.stringify({ quantity: qty }) }),
  remove:       (id)         => apiFetch(`/cart/${id}`, { method: 'DELETE' }),
  clear:        ()            => apiFetch('/cart', { method: 'DELETE' }),
};

// ── Wishlist ──────────────────────────────────────────────────
export const WishlistAPI = {
  get:          ()    => apiFetch('/wishlist'),
  add:          (pid) => apiFetch('/wishlist', { method: 'POST', body: JSON.stringify({ product_id: pid }) }),
  remove:       (pid) => apiFetch(`/wishlist/${pid}`, { method: 'DELETE' }),
  check:        (pid) => apiFetch(`/wishlist/check/${pid}`),
};

// ── Orders ────────────────────────────────────────────────────
export const OrdersAPI = {
  getAll(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/orders${q ? '?' + q : ''}`);
  },
  getOne:        (id)               => apiFetch(`/orders/${id}`),
  startPayment:  (b)                => apiFetch('/orders/payment/start', { method:'POST', body:JSON.stringify(b) }),
  verifyPayment: (cashfree_order_id) => apiFetch('/orders/payment/verify', { method:'POST', body:JSON.stringify({cashfree_order_id}) }),
  updateStatus:  (id, status, desc) => apiFetch(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, description: desc }) }),
  cancel:        (id)               => apiFetch(`/orders/${id}`, { method: 'DELETE' }),
  requestReturn: (id, reason)       => apiFetch(`/orders/${id}/return`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

// ── Admin ─────────────────────────────────────────────────────
export const AdminAPI = {
  getStats:       ()         => apiFetch('/admin/stats'),
  getUsers:       (p={})     => apiFetch(`/admin/users?${new URLSearchParams(p)}`),
  updateUser:     (id, b)    => apiFetch(`/admin/users/${id}`, { method:'PUT', body:JSON.stringify(b) }),
  getOrders:      (p={})     => apiFetch(`/admin/orders?${new URLSearchParams(p)}`),

  // Products
  getProducts:    (p={})     => apiFetch(`/admin/products?${new URLSearchParams(p)}`),
  createProduct:  (b)        => apiFetch('/admin/products', { method:'POST', body:JSON.stringify(b) }),
  updateProduct:  (id, b)    => apiFetch(`/admin/products/${id}`, { method:'PUT', body:JSON.stringify(b) }),
  deleteProduct:  (id)       => apiFetch(`/admin/products/${id}`, { method:'DELETE' }),
  restoreProduct: (id)       => apiFetch(`/admin/products/${id}/restore`, { method:'PUT' }),

  // Artists
  getArtists:     (p={})     => apiFetch(`/admin/artists?${new URLSearchParams(p)}`),
  createArtist:   (b)        => apiFetch('/admin/artists', { method:'POST', body:JSON.stringify(b) }),
  updateArtist:   (id, b)    => apiFetch(`/admin/artists/${id}`, { method:'PUT', body:JSON.stringify(b) }),
  deleteArtist:   (id)       => apiFetch(`/admin/artists/${id}`, { method:'DELETE' }),

  // Categories
  getCategories:  ()         => apiFetch('/admin/categories'),
  getAllUsers:     ()         => apiFetch('/admin/users/all'),
};

// ── Artist Portal API ─────────────────────────────────────────
export const ArtistAPI = {
  getPublic:     ()       => apiFetch('/artist'),
  getMe:         ()       => apiFetch('/artist/me'),
  getStats:      ()       => apiFetch('/artist/stats'),
  getArtworks:   (p={})   => apiFetch(`/artist/artworks?${new URLSearchParams(p)}`),
  createArtwork: (b)      => apiFetch('/artist/artworks', { method:'POST', body:JSON.stringify(b) }),
  updateArtwork: (id, b)  => apiFetch(`/artist/artworks/${id}`, { method:'PUT', body:JSON.stringify(b) }),
  deleteArtwork: (id)     => apiFetch(`/artist/artworks/${id}`, { method:'DELETE' }),
  getSales:      (p={})   => apiFetch(`/artist/sales?${new URLSearchParams(p)}`),
};

export const AuctionsAPI = {
  getActive:  ()           => apiFetch('/auctions'),
  getWon:     ()           => apiFetch('/auctions/won'),
  getProduct: (productId)  => apiFetch(`/auctions/product/${productId}`),
  holdDeposit:(id)         => apiFetch(`/auctions/${id}/deposit`, { method:'POST' }),
  verifyDeposit:(id)       => apiFetch(`/auctions/${id}/deposit/verify`, { method:'POST' }),
  placeBid:   (id, amount) => apiFetch(`/auctions/${id}/bids`, { method:'POST', body:JSON.stringify({ amount }) }),
  startPayment:(id, body)   => apiFetch(`/auctions/${id}/payment/start`, { method:'POST', body:JSON.stringify(body) }),
  verifyPayment:(id, cashfree_order_id) => apiFetch(`/auctions/${id}/payment/verify`, { method:'POST', body:JSON.stringify({cashfree_order_id}) }),
  decline:    (id)         => apiFetch(`/auctions/${id}/decline`, { method:'POST' }),
};

// ── Helpers ───────────────────────────────────────────────────
export const getBgClass = (id) => `bg${((id - 1) % 9) + 1}`;

export const getProductImageStyle = (product) => {
  if (product?.image_url) {
    return {
      backgroundImage: `url(${product.image_url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {};
};
