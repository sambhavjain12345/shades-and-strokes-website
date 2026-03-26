import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CartAPI, WishlistAPI } from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cartCount,  setCartCount]  = useState(0);
  const [wishCount,  setWishCount]  = useState(0);

  const refreshCounts = useCallback(async () => {
    if (user) {
      try {
        const [cart, wish] = await Promise.all([CartAPI.get(), WishlistAPI.get()]);
        setCartCount(cart.items.reduce((s, i) => s + i.quantity, 0));
        setWishCount(wish.items.length);
      } catch (_) {}
    } else {
      const local = JSON.parse(localStorage.getItem('ss_cart') || '[]');
      const wish  = JSON.parse(localStorage.getItem('ss_wish')  || '[]');
      setCartCount(local.reduce((s, i) => s + (i.qty || 1), 0));
      setWishCount(wish.length);
    }
  }, [user]);

  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  return (
    <CartContext.Provider value={{ cartCount, wishCount, refreshCounts }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
