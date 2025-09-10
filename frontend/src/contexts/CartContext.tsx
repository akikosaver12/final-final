import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { Product } from '../hooks/useProducts';

// Extendemos Product para incluir cantidad
interface CartItem extends Product {
  quantity: number;
}

// Estado del carrito
interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

// Acciones que puede hacer el carrito
type CartAction =
  | { type: 'ADD_TO_CART'; payload: Product }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartState }
  | { type: 'LOGOUT_CLEAR' }; // Nueva acción para limpiar al cerrar sesión

// Claves para localStorage
const CART_STORAGE_KEY = 'veterinary_cart';
const USER_SESSION_KEY = 'user_session'; // Para detectar cambios de sesión

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
      if (parsedCart.items && Array.isArray(parsedCart.items)) {
        return parsedCart;
      }
    }
  } catch (error) {
    console.error('Error cargando carrito desde localStorage:', error);
  }
  return null;
};

const clearCartFromStorage = () => {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch (error) {
    console.error('Error limpiando carrito de localStorage:', error);
  }
};

// Funciones para detectar cambios de sesión
const getCurrentUserId = (): string | null => {
  try {
    const userSession = localStorage.getItem(USER_SESSION_KEY);
    return userSession ? JSON.parse(userSession).userId : null;
  } catch (error) {
    return null;
  }
};

const saveCurrentUserId = (userId: string | null) => {
  try {
    if (userId) {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ userId }));
    } else {
      localStorage.removeItem(USER_SESSION_KEY);
    }
  } catch (error) {
    console.error('Error guardando sesión de usuario:', error);
  }
};

// NUEVA FUNCIÓN: Detectar si hay usuario autenticado
const isUserAuthenticated = (): boolean => {
  try {
    // Verifica múltiples fuentes de autenticación
    const userSession = localStorage.getItem(USER_SESSION_KEY);
    const authToken = localStorage.getItem('auth_token'); // Token común
    const accessToken = localStorage.getItem('access_token'); // Otro token común
    const userInfo = localStorage.getItem('user_info'); // Info de usuario
    
    // Si existe cualquiera de estos, considera que hay usuario autenticado
    return !!(userSession || authToken || accessToken || userInfo);
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    return false;
  }
};

// Crear el contexto
interface CartContextType {
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addToCart: (product: Product) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  handleUserLogout: () => void;
  handleUserLogin: (userId: string) => void;
  isAuthenticated: boolean; // Nueva propiedad para saber el estado
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Reducer
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
    case 'LOGOUT_CLEAR':
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

// Proveedor del contexto con detección automática de usuario
export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);

  // NUEVA FUNCIONALIDAD: Verificar autenticación al montar y periódicamente
  useEffect(() => {
    const checkAuthentication = () => {
      const authStatus = isUserAuthenticated();
      setIsAuthenticated(authStatus);
      
      // Si no hay usuario autenticado, limpiar carrito
      if (!authStatus && (state.items.length > 0 || state.total > 0)) {
        dispatch({ type: 'LOGOUT_CLEAR' });
        clearCartFromStorage();
      }
    };

    // Verificar inmediatamente
    checkAuthentication();

    // Verificar cada 5 segundos para detectar cambios de autenticación
    const authCheckInterval = setInterval(checkAuthentication, 5000);

    return () => clearInterval(authCheckInterval);
  }, [state.items.length, state.total]);

  // Cargar carrito al montar el componente (SOLO si hay usuario autenticado)
  useEffect(() => {
    if (isAuthenticated) {
      const savedCart = loadCartFromStorage();
      if (savedCart && savedCart.items.length > 0) {
        dispatch({ type: 'LOAD_CART', payload: savedCart });
      }
    }
  }, [isAuthenticated]);

  // Guardar carrito cada vez que cambie el estado (SOLO si hay usuario autenticado)
  useEffect(() => {
    if (isAuthenticated) {
      if (state.items.length > 0 || state.total > 0) {
        saveCartToStorage(state);
      } else {
        clearCartFromStorage();
      }
    }
  }, [state, isAuthenticated]);

  // Funciones auxiliares con verificación de autenticación
  const addToCart = (product: Product) => {
    if (isAuthenticated) {
      dispatch({ type: 'ADD_TO_CART', payload: product });
    } else {
      console.warn('Usuario no autenticado: no se puede agregar al carrito');
    }
  };

  const removeFromCart = (id: string) => {
    if (isAuthenticated) {
      dispatch({ type: 'REMOVE_FROM_CART', payload: id });
    } else {
      console.warn('Usuario no autenticado: no se puede eliminar del carrito');
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (isAuthenticated) {
      if (quantity <= 0) {
        removeFromCart(id);
      } else {
        dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
      }
    } else {
      console.warn('Usuario no autenticado: no se puede actualizar cantidad');
    }
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
    if (isAuthenticated) {
      clearCartFromStorage();
    }
  };

  // Función para manejar cierre de sesión
  const handleUserLogout = () => {
    dispatch({ type: 'LOGOUT_CLEAR' });
    clearCartFromStorage();
    saveCurrentUserId(null);
    setIsAuthenticated(false);
  };

  // Función para manejar inicio de sesión
  const handleUserLogin = (userId: string) => {
    const previousUserId = getCurrentUserId();
    
    // Si es un usuario diferente, limpiar el carrito
    if (previousUserId && previousUserId !== userId) {
      dispatch({ type: 'LOGOUT_CLEAR' });
      clearCartFromStorage();
    }
    
    saveCurrentUserId(userId);
    setIsAuthenticated(true);
  };

  // Detectar cambios en el localStorage desde otras pestañas/ventanas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Lista de claves que pueden indicar cambios de autenticación
      const authKeys = [
        'user_session', 'session', 'auth_token', 'access_token', 'authToken',
        'token', 'jwt', 'user', 'user_info', 'currentUser', 'loggedIn', 
        'isAuthenticated', 'userId', 'userToken'
      ];
      
      // Si cambió alguna clave de autenticación
      if (authKeys.includes(e.key || '')) {
        console.log(`🔄 Cambio detectado en clave de autenticación: "${e.key}"`);
        
        const newAuthStatus = isUserAuthenticated();
        setIsAuthenticated(newAuthStatus);
        
        // Si se eliminó la sesión (logout desde otra pestaña)
        if (!newAuthStatus) {
          console.log('🧹 Limpiando carrito por cierre de sesión detectado');
          dispatch({ type: 'LOGOUT_CLEAR' });
          clearCartFromStorage();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value: CartContextType = {
    state,
    dispatch,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    handleUserLogout,
    handleUserLogin,
    isAuthenticated,
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

// Hook para obtener el número de items
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

// NUEVO HOOK: Para verificar si el usuario está autenticado
export const useIsAuthenticated = (): boolean => {
  const { isAuthenticated } = useCart();
  return isAuthenticated;
};

// Exportar tipos
export type { CartItem };