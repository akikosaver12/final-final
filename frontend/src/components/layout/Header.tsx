import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { brandConfig } from '../../utils/brandConfig';



const Header: React.FC = () => {
  const { state: cartState } = useCart();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const user = localStorage.getItem("user");

  return (
    <header className="bg-white shadow-lg sticky top-0 z-50 border-b border-gray-100">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          
          {/* LOGO */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-[TU_COLOR_PRINCIPAL] to-[TU_COLOR_HOVER] rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <span className="text-xl font-bold text-white">{brandConfig.logo.icon}</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 rounded-2xl transition-opacity duration-300 transform -skew-x-12"></div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
                {brandConfig.name}
              </h1>
              <p className="text-xs text-gray-500 -mt-1">{brandConfig.slogan}</p>
            </div>
          </Link>
          
          {/* BARRA DE BÚSQUEDA */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Buscar productos..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-2xl focus:bg-white focus:ring-2 focus:ring-lime-400 focus:outline-none transition-all duration-200 text-gray-700"
              />
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* NAVEGACIÓN PRINCIPAL */}
          <nav className="hidden lg:flex items-center space-x-1">
            {[
              { path: '/', label: 'Inicio' },
              { path: '/products', label: 'Productos' },
              { path: '/about', label: 'Nosotros' },
              { path: '/contact', label: 'Contacto' },
              { path: '/mascotas', label: 'Mascotas' }
            ].map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                  isActive(path)
                    ? 'bg-lime-400 text-black shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* SECCIÓN DERECHA */}
          <div className="flex items-center space-x-4">
            
            {/* Botón de favoritos */}
            <button className="p-2 text-gray-400 hover:text-red-500 transition-colors duration-200 relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>

            {/* Botón de iniciar sesión */}
            <Link
              to="/login"
              className="bg-lime-400 text-black px-4 py-3 rounded-2xl font-medium shadow-lg hover:bg-lime-500 transition-all duration-200"
            >
              Iniciar sesión
            </Link>

            {/* CARRITO */}
            <Link 
              to="/cart" 
              className="relative group"
            >
              <div className="flex items-center space-x-3 bg-gray-900 text-white px-4 py-3 rounded-2xl hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl">
                <div className="relative">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 4H19m-10-4v6a2 2 0 104 0v-6m-4 0h4" />
                  </svg>
                  
                  {cartState.itemCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-lime-400 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                      {cartState.itemCount}
                    </div>
                  )}
                </div>
                
                <div className="hidden sm:block">
                  <span className="font-medium">Carrito</span>
                  {cartState.total > 0 && (
                    <p className="text-xs text-gray-300 -mt-1">
                      ${cartState.total.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </Link>

            {/* Menú móvil */}
            <button className="lg:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN MÓVIL */}
        <nav className="lg:hidden mt-4 flex justify-center space-x-1 overflow-x-auto pb-2">
          {[
            { path: '/', label: 'Inicio', icon: '🏠' },
            { path: '/products', label: 'Productos', icon: '🛍️' },
            { path: '/cart', label: 'Carrito', icon: '🛒' },
            { path: '/about', label: 'Nosotros', icon: '🏢' },
            { path: '/contact', label: 'Contacto', icon: '📞' },
            { path: '/mascotas', label: 'Mascotas', icon: '🐾' },
            { path: '/login', label: 'Login', icon: '🔑' }
          ].map(({ path, label, icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center px-3 py-2 rounded-xl min-w-0 flex-shrink-0 transition-all duration-200 ${
                isActive(path)
                  ? 'bg-lime-400 text-black shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg mb-1">{icon}</span>
              <span className="text-xs font-medium whitespace-nowrap">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
