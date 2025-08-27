import React from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/shop/ProductCard';
import Loading from '../components/common/Loading';
import { brandConfig } from '../utils/brandConfig';


const HomePage: React.FC = () => {
  const { products, loading } = useProducts();
  const featuredProducts = products.slice(0, 3);

  return (
    <div className="bg-gray-50">
      
      {/* HERO SECTION ESPECTACULAR */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        
        {/* FONDO ANIMADO CON FORMAS */}
        <div className="absolute inset-0">
          {/* Gradiente de fondo */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-gray-100"></div>
          
          {/* Formas geométricas animadas */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-lime-400/20 to-lime-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-cyan-400/10 to-green-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
          
          {/* Puntos decorativos */}
          <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-lime-400 rounded-full animate-bounce delay-300"></div>
          <div className="absolute bottom-1/3 left-1/4 w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-700"></div>
          <div className="absolute top-1/3 left-1/3 w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-1000"></div>
        </div>
        
        {/* CONTENIDO PRINCIPAL DEL HERO */}
        <div className="relative z-10 container mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* LADO IZQUIERDO: TEXTO Y BOTONES */}
            <div className="text-center lg:text-left">
              
              {/* BADGE DE BIENVENIDA */}
              <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 mb-8 shadow-lg">
                <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></div>
                <span className="text-gray-700 font-medium text-sm">✨ Bienvenido a la experiencia premium</span>
              </div>
              
              {/* TÍTULO PRINCIPAL */}
              <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
  <span className="block">{brandConfig.name}</span>
  <span className="block bg-gradient-to-r from-[TU_COLOR_PRINCIPAL] via-[TU_COLOR_HOVER] to-[TU_COLOR_OSCURO] bg-clip-text text-transparent">
    
  </span>
  <span className="block text-4xl lg:text-5xl text-gray-600 font-normal">MAX</span>
</h1>
              
              {/* SUBTÍTULO */}
              <p className="text-xl lg:text-2xl text-gray-600 mb-8 leading-relaxed max-w-2xl"> 
  {brandConfig.company.description || 'Descubre productos [TU_NICHO] increíbles con la mejor calidad y precios competitivos que se adaptan a tu presupuesto'}
</p>
              
              {/* ESTADÍSTICAS RÁPIDAS */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-6 mb-10">
  <div className="text-center">
    <div className="text-2xl font-bold text-gray-900">500+</div>
    <div className="text-sm text-gray-500">Clientes satisfechos</div>
  </div>
  <div className="text-center">
    <div className="text-2xl font-bold text-gray-900">6+</div>
    <div className="text-sm text-gray-500">Productos</div>
  </div>
  <div className="text-center">
    <div className="text-2xl font-bold text-gray-900">4.8</div>
    <div className="text-sm text-gray-500">Rating promedio</div>
  </div>
</div>
              
              {/* BOTONES DE ACCIÓN */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link 
                  to="/products" 
                  className="group bg-lime-400 hover:bg-lime-500 text-black font-bold py-4 px-8 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 flex items-center justify-center space-x-3"
                >
                  <span>🚀 Explorar Productos</span>
                  <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                
                <Link 
                  to="/contact" 
                  className="group bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 font-semibold py-4 px-8 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
                >
                  <span>💬 Contáctanos</span>
                </Link>
              </div>
            </div>
            
            {/* LADO DERECHO: IMAGEN HEROICA */}
            <div className="relative">
              
              {/* TARJETA PRINCIPAL CON PRODUCTO DESTACADO */}
              <div className="relative bg-white rounded-3xl shadow-2xl p-8 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                
                {/* PRODUCT SHOWCASE */}
                <div className="text-center">
                  <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-8 mb-6 relative overflow-hidden">
                    {/* Producto iPhone moderno */}
                    <div className="relative z-10 flex items-center justify-center h-40">
                      <div className="w-32 h-32 bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 rounded-[2rem] shadow-2xl relative">
                        {/* Pantalla del iPhone */}
                        <div className="absolute inset-2 bg-black rounded-[1.5rem] flex items-center justify-center">
                          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                            <span className="text-white text-2xl">📱</span>
                          </div>
                        </div>
                        {/* Cámara */}
                        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-8 h-3 bg-black rounded-full"></div>
                      </div>
                    </div>
                    
                    {/* Efectos de fondo */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-lime-400/20 rounded-full blur-xl"></div>
                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-blue-400/20 rounded-full blur-lg"></div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2">iPhone 15 Pro Max</h3>
                  <p className="text-gray-600 mb-4">Titanio. Tan resistente. Tan ligero. Tan Pro.</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-gray-900">$1,199</span>
                    <div className="flex space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* FLOATING ELEMENTS */}
                <div className="absolute -top-4 -right-4 bg-lime-400 text-black px-3 py-1 rounded-xl text-sm font-bold shadow-lg">
                  ¡Nuevo!
                </div>
              </div>
              
              {/* TARJETAS FLOTANTES MEJORADAS */}
              <div className="absolute -top-6 -left-6 bg-white rounded-2xl shadow-xl p-4 animate-bounce">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">✓ Envío gratis</span>
                </div>
              </div>
              
              <div className="absolute -bottom-6 -right-6 bg-white rounded-2xl shadow-xl p-4 animate-pulse">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🛡️</span>
                  <span className="text-sm font-medium text-gray-700">Garantía 2 años</span>
                </div>
              </div>
              
              {/* NUEVA TARJETA FLOTANTE - POPULARIDAD */}
              <div className="absolute top-1/2 -left-8 bg-lime-400 text-black rounded-2xl shadow-xl p-3 transform -rotate-12 animate-pulse delay-500">
                <div className="text-center">
                  <div className="text-lg font-bold">🔥</div>
                  <div className="text-xs font-bold">Top Seller</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* SCROLL INDICATOR */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-gray-300 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-gray-300 rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* SECCIÓN DE PRODUCTOS DESTACADOS */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          
          {/* HEADER DE LA SECCIÓN */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-lime-100 text-lime-800 rounded-full px-4 py-2 mb-6">
              <span className="text-lg">⭐</span>
              <span className="font-medium">Productos Destacados</span>
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Los más <span className="text-lime-500">populares</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Descubre los productos más vendidos y mejor valorados por nuestra comunidad
            </p>
          </div>
          
          {/* GRID DE PRODUCTOS */}
          {loading ? (
            <div className="flex justify-center">
              <Loading message="Cargando productos increíbles..." size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          
          {/* BOTÓN VER MÁS */}
          <div className="text-center mt-12">
            <Link 
              to="/products" 
              className="inline-flex items-center space-x-2 bg-gray-900 text-white font-semibold py-4 px-8 rounded-2xl hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <span>Ver Todos los Productos</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* SECCIÓN DE BENEFICIOS */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🚚',
                title: 'Envío Gratis',
                description: 'En compras mayores a $100. Entrega en 24-48 horas.'
              },
              {
                icon: '🛡️',
                title: 'Garantía Premium',
                description: 'Hasta 2 años de garantía en todos nuestros productos.'
              },
              {
                icon: '💬',
                title: 'Soporte 24/7',
                description: 'Atención al cliente especializada cuando la necesites.'
              }
            ].map(({ icon, title, description }) => (
              <div key={title} className="bg-white rounded-3xl p-8 text-center shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;