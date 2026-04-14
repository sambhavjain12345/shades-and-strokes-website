const API_BASE = '/api';

// ── Core fetch ────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('ss_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('ss_token');
      localStorage.removeItem('ss_user');
      window.location.href = '/login';
      return;
    }
    throw new Error(data.message || `API error ${res.status}`);
  }
  return data;
}

// ── Auth ──────────────────────────────────────────────────────
export const AuthAPI = {
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
  place:         (b)                => apiFetch('/orders', { method: 'POST', body: JSON.stringify(b) }),
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
  getMe:         ()       => apiFetch('/artist/me'),
  getStats:      ()       => apiFetch('/artist/stats'),
  getArtworks:   (p={})   => apiFetch(`/artist/artworks?${new URLSearchParams(p)}`),
  createArtwork: (b)      => apiFetch('/artist/artworks', { method:'POST', body:JSON.stringify(b) }),
  updateArtwork: (id, b)  => apiFetch(`/artist/artworks/${id}`, { method:'PUT', body:JSON.stringify(b) }),
  deleteArtwork: (id)     => apiFetch(`/artist/artworks/${id}`, { method:'DELETE' }),
  getSales:      (p={})   => apiFetch(`/artist/sales?${new URLSearchParams(p)}`),
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
