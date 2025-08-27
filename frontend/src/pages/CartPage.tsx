import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';

const CartPage: React.FC = () => {
  const { state: cartState, dispatch } = useCart();

  // Asegura que el id sea string para cumplir con CartAction
  const updateQuantity = (id: string | number, quantity: number) => {
    const stringId = String(id);
    if (quantity <= 0) {
      removeItem(stringId);
      return;
    }
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: stringId, quantity } });
  };

  const removeItem = (id: string | number) => {
    const stringId = String(id);
    dispatch({ type: 'REMOVE_FROM_CART', payload: stringId });
  };

  const clearCart = () => {
    if (window.confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
      dispatch({ type: 'CLEAR_CART' });
    }
  };

  // CARRITO VACÍO
  if (cartState.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-md mx-auto text-center">
            {/* ILUSTRACIÓN VACÍO */}
            <div className="relative mb-8">
              <div className="w-32 h-32 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center shadow-xl">
                <div className="text-6xl text-gray-400">🛒</div>
              </div>
              {/* Elementos flotantes */}
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-lime-400 rounded-full flex items-center justify-center animate-bounce">
                <span className="text-lg">💨</span>
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Tu carrito está vacío
            </h1>
            <p className="text-gray-600 mb-8 leading-relaxed">
              ¡No te preocupes! Tenemos productos increíbles esperándote. 
              Explora nuestra colección y encuentra algo que te encante.
            </p>
            
            {/* BOTONES */}
            <div className="space-y-4">
              <Link 
                to="/products" 
                className="block w-full bg-lime-400 hover:bg-lime-500 text-black font-bold py-4 px-6 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                🛍️ Explorar Productos
              </Link>
              <Link 
                to="/" 
                className="block w-full bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-semibold py-4 px-6 rounded-2xl transition-all duration-200"
              >
                🏠 Volver al Inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CARRITO CON PRODUCTOS
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        
        {/* HEADER DE LA PÁGINA */}
        <div className="mb-12">
          {/* BREADCRUMB */}
          <nav className="mb-6">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Link to="/" className="hover:text-gray-700 transition-colors">Inicio</Link>
              <span>›</span>
              <span className="text-gray-900 font-medium">Carrito de Compras</span>
            </div>
          </nav>
          
          {/* TÍTULO Y ACCIONES */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                🛒 Tu Carrito
              </h1>
              <p className="text-gray-600">
                {cartState.itemCount} {cartState.itemCount === 1 ? 'producto' : 'productos'} en tu carrito
              </p>
            </div>
            
            <button
              onClick={clearCart}
              className="flex items-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 border border-red-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Vaciar Carrito</span>
            </button>
          </div>
        </div>
        
        {/* CONTENIDO PRINCIPAL */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* COLUMNA IZQUIERDA: PRODUCTOS */}
          <div className="xl:col-span-2 space-y-6">
            {cartState.items.map(item => (
              <div key={item.id} className="group bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 p-6">
                <div className="flex flex-col sm:flex-row gap-6">
                  
                  {/* IMAGEN DEL PRODUCTO */}
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl overflow-hidden">
                      <img 
                        src={item.image || 'https://via.placeholder.com/128?text=Producto'} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/128?text=Producto';
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* INFORMACIÓN DEL PRODUCTO */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                          {item.name}
                        </h3>
                        
                        {/* DETALLES */}
                        <div className="flex flex-wrap gap-3 mb-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {item.category}
                          </span>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
                            ✓ Disponible
                          </span>
                        </div>
                        
                        {/* PRECIO */}
                        <div className="flex items-baseline space-x-2 mb-4">
                          <span className="text-2xl font-bold text-gray-900">
                            ${item.price.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500 line-through">
                            ${(item.price * 1.2).toLocaleString()}
                          </span>
                          <span className="text-sm font-medium text-red-500">
                            -20%
                          </span>
                        </div>
                      </div>
                      
                      {/* CONTROLES */}
                      <div className="flex flex-col items-end space-y-4">
                        {/* CANTIDAD */}
                        <div className="flex items-center space-x-3 bg-gray-50 rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            −
                          </button>
                          <span className="w-12 text-center font-bold text-lg text-gray-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200 font-bold"
                          >
                            +
                          </button>
                        </div>
                        
                        {/* SUBTOTAL */}
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Subtotal</p>
                          <p className="text-xl font-bold text-gray-900">
                            ${(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                        
                        {/* BOTÓN ELIMINAR */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="flex items-center space-x-2 text-red-500 hover:text-red-700 font-medium transition-colors duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-sm">Eliminar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* COLUMNA DERECHA: RESUMEN */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-3xl shadow-lg p-8 sticky top-24">
              
              {/* HEADER DEL RESUMEN */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  📋 Resumen del Pedido
                </h2>
                <p className="text-gray-600">
                  Revisa tu orden antes de proceder
                </p>
              </div>
              
              {/* DETALLES DEL PEDIDO */}
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Productos ({cartState.itemCount})</span>
                  <span className="font-semibold text-gray-900">
                    ${cartState.total.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Envío</span>
                  <div className="text-right">
                    <span className="font-semibold text-green-600">GRATIS</span>
                    <p className="text-xs text-gray-500">En compras +$100</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Descuentos</span>
                  <span className="font-semibold text-green-600">
                    -${(cartState.total * 0.1).toLocaleString()}
                  </span>
                </div>
                
                <hr className="border-gray-200" />
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-xl font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${(cartState.total * 0.9).toLocaleString()}
                  </span>
                </div>
              </div>
              
              {/* CUPÓN DE DESCUENTO */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código de descuento
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ingresa tu código"
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-lime-400 focus:border-transparent transition-all duration-200 outline-none"
                  />
                  <button className="bg-gray-900 text-white px-4 py-3 rounded-xl hover:bg-gray-800 transition-all duration-200 font-medium">
                    Aplicar
                  </button>
                </div>
              </div>
              
              {/* BOTONES DE ACCIÓN */}
              <div className="space-y-4">
                <button className="w-full bg-lime-400 hover:bg-lime-500 text-black font-bold py-4 px-6 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>💳 Proceder al Pago</span>
                </button>
                
                <Link 
                  to="/products"
                  className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 px-6 rounded-2xl transition-all duration-200"
                >
                  🛍️ Seguir Comprando
                </Link>
              </div>
              
              {/* GARANTÍAS */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="space-y-3">
                  {[
                    { icon: '🔒', text: 'Pago 100% seguro' },
                    { icon: '🚚', text: 'Envío gratis en 24-48h' },
                    { icon: '↩️', text: 'Devoluciones fáciles' }
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center space-x-3">
                      <span className="text-lg">{icon}</span>
                      <span className="text-sm text-gray-600">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;