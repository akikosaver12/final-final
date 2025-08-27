import React from 'react';
import { Product } from '../../hooks/useProducts';
import { useCart } from '../../contexts/CartContext';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { dispatch } = useCart();

  const handleAddToCart = () => {
    dispatch({ type: 'ADD_TO_CART', payload: product });
    
    // Efecto visual más sutil
    const button = document.getElementById(`add-btn-${product.id}`);
    if (button) {
      button.classList.add('animate-pulse');
      setTimeout(() => button.classList.remove('animate-pulse'), 600);
    }
  };

  return (
    <div className="group bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden transform hover:-translate-y-2 border border-gray-100">
      
      {/* IMAGEN DEL PRODUCTO */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        <img 
  src={product.image || 'https://via.placeholder.com/400?text=Producto'} 
  alt={product.name}
/>
        
        {/* OVERLAY CON EFECTOS */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        
        {/* BADGE DE CATEGORÍA */}
        <div className="absolute top-4 left-4">
          <span className="bg-white/90 backdrop-blur-sm text-gray-700 px-3 py-1 rounded-full text-sm font-medium shadow-lg">
            {product.category}
          </span>
        </div>
        
        {/* BOTÓN DE FAVORITO */}
        <button className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110">
          <svg className="w-5 h-5 text-gray-600 hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>
      
      {/* INFORMACIÓN DEL PRODUCTO */}
      <div className="p-6">
        
        {/* NOMBRE DEL PRODUCTO */}
        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors line-clamp-2">
          {product.name}
        </h3>
        
        {/* RATING SIMULADO */}
        <div className="flex items-center space-x-2 mb-3">
          <div className="flex space-x-1">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
              </svg>
            ))}
          </div>
          <span className="text-sm text-gray-500">(4.8)</span>
        </div>
        
        {/* PRECIO Y BOTÓN */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-2xl font-bold text-gray-900">
              ${product.price.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500 line-through ml-2">
              ${(product.price * 1.2).toLocaleString()}
            </span>
          </div>
          
          {/* BADGE DE DESCUENTO */}
          <div className="bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold">
            -20%
          </div>
        </div>
        
        {/* CARACTERÍSTICAS RÁPIDAS */}
        <div className="flex flex-wrap gap-2 mb-4">
          {['Garantía 1 año', 'Envío gratis'].map((feature) => (
            <span key={feature} className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-medium">
              {feature}
            </span>
          ))}
        </div>
        
        {/* BOTÓN DE AGREGAR AL CARRITO */}
        <button 
          id={`add-btn-${product.id}`}
          onClick={handleAddToCart}
          className="w-full bg-lime-400 hover:bg-lime-500 text-black font-bold py-3 px-6 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 4H19m-10-4v6a2 2 0 104 0v-6m-4 0h4" />
          </svg>
          <span>Agregar al Carrito</span>
        </button>
      </div>
      
      {/* EFECTO DE BRILLO AL HOVER */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      </div>
    </div>
  );
};

export default ProductCard;