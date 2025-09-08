import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { Product } from '../hooks/useProducts';

// Extendemos Product para incluir cantidad
interface CartItem extends Product {
  quantity: number; // Cuántos productos del mismo tipo
}

// Estado del carrito
interface CartState {
  items: CartItem[]; // Productos en el carrito
  total: number;     // Precio total
  itemCount: number; // Cantidad total de productos
}

// Acciones que puede hacer el carrito
type CartAction =
  | { type: 'ADD_TO_CART'; payload: Product } // Agregar producto
  | { type: 'REMOVE_FROM_CART'; payload: string } // Eliminar por ID
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } } // Cambiar cantidad
  | { type: 'CLEAR_CART' } // Vaciar carrito
  | { type: 'LOAD_CART'; payload: CartState }; // Cargar carrito desde localStorage

// Clave para localStorage
const CART_STORAGE_KEY = 'veterinary_cart';

// Funciones para localStorage
const saveCartToStorage = (cartState: CartState) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState));
  } catch (error) {
    console.error('Error guardando carrito en localStorage:', error);
  }
};

const loadCartFromStorage = (): CartState | null => {
  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      // Validar que tenga la estructura correcta
      if (parsedCart.items && Array.isArray(parsedCart.items)) {
        return parsedCart;
      }
    }
  } catch (error) {
    console.error('Error cargando carrito desde localStorage:', error);
  }
  return null;
};

// Crear el contexto con funciones auxiliares
interface CartContextType {
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addToCart: (product: Product) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Reducer: función que maneja los cambios del estado
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      let newItems: CartItem[];

      if (existingItem) {
        newItems = state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        newItems = [...state.items, { ...action.payload, quantity: 1 }];
      }

      return {
        ...state,
        items: newItems,
        total: newItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        itemCount: newItems.reduce((sum, item) => sum + item.quantity, 0),
      };
    }

    case 'REMOVE_FROM_CART': {
      const newItems = state.items.filter(item => item.id !== action.payload);
      return {
        ...state,
        items: newItems,
        total: newItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        itemCount: newItems.reduce((sum, item) => sum + item.quantity, 0),
      };
    }

    case 'UPDATE_QUANTITY': {
      const newItems = state.items
        .map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(0, action.payload.quantity) }
            : item
        )
        .filter(item => item.quantity > 0);

      return {
        ...state,
        items: newItems,
        total: newItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        itemCount: newItems.reduce((sum, item) => sum + item.quantity, 0),
      };
    }

    case 'CLEAR_CART':
      return { items: [], total: 0, itemCount: 0 };

    case 'LOAD_CART':
      return action.payload;

    default:
      return state;
  }
};

// Estado inicial
const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
};

// Proveedor del contexto (envuelve toda la app) CON PERSISTENCIA
export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Cargar carrito al montar el componente
  useEffect(() => {
    const savedCart = loadCartFromStorage();
    if (savedCart && savedCart.items.length > 0) {
      dispatch({ type: 'LOAD_CART', payload: savedCart });
    }
  }, []);

  // Guardar carrito cada vez que cambie el estado
  useEffect(() => {
    if (state.items.length > 0 || state.total > 0) {
      saveCartToStorage(state);
    } else {
      // Si el carrito está vacío, limpiar localStorage
      try {
        localStorage.removeItem(CART_STORAGE_KEY);
      } catch (error) {
        console.error('Error limpiando localStorage:', error);
      }
    }
  }, [state]);

  // Funciones auxiliares para facilitar el uso
  const addToCart = (product: Product) => {
    dispatch({ type: 'ADD_TO_CART', payload: product });
  };

  const removeFromCart = (id: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: id });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
    }
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const value: CartContextType = {
    state,
    dispatch,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

// Hook personalizado para usar el carrito
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de CartProvider');
  }
  return context;
};

// Hook para obtener el número de items (útil para el badge del header)
export const useCartItemCount = (): number => {
  const { state } = useCart();
  return state.itemCount;
};

// Hook para verificar si un producto está en el carrito
export const useIsInCart = (productId: string): boolean => {
  const { state } = useCart();
  return state.items.some(item => item.id === productId);
};

// Hook para obtener la cantidad de un producto específico
export const useProductQuantity = (productId: string): number => {
  const { state } = useCart();
  const item = state.items.find(item => item.id === productId);
  return item ? item.quantity : 0;
};

// Exportar tipos
export type { CartItem };