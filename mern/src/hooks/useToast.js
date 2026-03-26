import { useCallback } from 'react';

export function useToast() {
  const showToast = useCallback((msg, type = 'info') => {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el?.remove(), 2400);
  }, []);

  return { showToast };
}
