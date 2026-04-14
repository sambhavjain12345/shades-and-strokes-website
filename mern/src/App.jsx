import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Layout from './components/layout/Layout';
import Home             from './pages/Home';
import Shop             from './pages/Shop';
import { ProductDetail } from './pages/ProductDetail';
import Login            from './pages/Login';
import Admin            from './pages/Admin';
import Checkout         from './pages/Checkout';
import ArtistDashboard  from './pages/ArtistDashboard';
import { Cart, Wishlist, Orders, Profile } from './pages/OtherPages';

// Must be inside AuthProvider tree
function Protected({ children, adminOnly = false, artistOnly = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly  && user.role !== 'admin')  return <Navigate to="/" replace />;
  if (artistOnly && user.role !== 'artist') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"            element={<Layout><Home /></Layout>} />
      <Route path="/shop"        element={<Layout><Shop /></Layout>} />
      <Route path="/product/:id" element={<Layout><ProductDetail /></Layout>} />
      <Route path="/login"       element={<Login />} />

      {/* Protected — logged-in users */}
      <Route path="/cart"     element={<Layout><Protected><Cart /></Protected></Layout>} />
      <Route path="/checkout" element={<Layout><Protected><Checkout /></Protected></Layout>} />
      <Route path="/wishlist" element={<Layout><Protected><Wishlist /></Protected></Layout>} />
      <Route path="/orders"   element={<Layout><Protected><Orders /></Protected></Layout>} />
      <Route path="/profile"  element={<Layout><Protected><Profile /></Protected></Layout>} />

      {/* Admin only — no Layout wrapper */}
      <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />

      {/* Artist only — no Layout wrapper */}
      <Route path="/studio" element={<Protected artistOnly><ArtistDashboard /></Protected>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
