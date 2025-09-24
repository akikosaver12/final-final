import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/layout/Layout';

// Importar todas las páginas existentes
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import CartPage from './pages/CartPage';
import ContactPage from './pages/ContactPage';
import AboutPage from './pages/AboutPage';
import MascotaPage from './pages/Mascotapage';
import Maxinfo from './components/mascotas/mas_infromacio';
import NuevaMascota from './components/mascotas/nuevamascota';
import Home from './components/user/Home';
import Edit from './components/mascotas/editarinfo';
import Prefil from './components/user/prefil';
import ProductDetail from './components/shop/ProductDetail';
import AdminPanel from './components/user/AdminPanel';

// COMPONENTES DE AUTENTICACIÓN ACTUALIZADOS
import Login from './components/user/Login';          // Tu componente Login actualizado
import Register from './components/user/Register';    // Tu componente Register actualizado

// NUEVOS COMPONENTES PARA GOOGLE OAUTH Y VERIFICACIÓN
import GoogleCompleteRegister from './components/user/GRegistration'; // NUEVO
import EmailVerificationPending from './components/user/EmailVerificationPending';
import EmailVerificationSuccess from './components/user/EmailVerificationSuccess';

// Google Client ID
const GOOGLE_CLIENT_ID = "503963971592-17vo21di0tjf249341l4ocscemath5p0.apps.googleusercontent.com";

// Middleware para proteger rutas privadas - MEJORADO
interface PrivateRouteProps {
  children: React.ReactNode;
  role?: string;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, role }) => {
  const token = localStorage.getItem("token");
  
  // Manejo seguro del usuario con mejor error handling
  const user = (() => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return null;
      
      const parsedUser = JSON.parse(userStr);
      
      // Validar que el usuario tenga los campos necesarios
      if (!parsedUser.id && !parsedUser._id) {
        console.warn('Usuario en localStorage no tiene ID válido');
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        return null;
      }
      
      return parsedUser;
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
      // Limpiar localStorage si está corrupto
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      return null;
    }
  })();

  // Verificar token
  if (!token) {
    console.log('No hay token, redirigiendo a login');
    return <Navigate to="/login" replace />;
  }

  // Verificar rol si es necesario
  if (role && user?.role !== role) {
    console.log(`Usuario con rol ${user?.role} intentó acceder a ruta que requiere rol ${role}`);
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

// Componente para rutas públicas (redirigir si ya está logueado)
interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children, redirectTo = "/home" }) => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  
  // Si ya está logueado, redirigir
  if (token && user) {
    try {
      const parsedUser = JSON.parse(user);
      const finalRedirect = parsedUser.role === 'admin' ? '/admin' : redirectTo;
      return <Navigate to={finalRedirect} replace />;
    } catch (error) {
      // Si hay error parseando, limpiar y permitir acceso
      localStorage.clear();
    }
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <CartProvider>
        <Router>
          <Layout>
            <Routes>
              {/* RUTAS PÚBLICAS */}
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/product/:id" element={<ProductDetail />} />

              {/* AUTENTICACIÓN - Solo accesible si NO está logueado */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              <Route 
                path="/registro" 
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                } 
              />

              {/* NUEVAS RUTAS DE VERIFICACIÓN DE EMAIL */}
              <Route path="/verificacion-pendiente" element={<EmailVerificationPending />} />
              <Route path="/verificar-email" element={<EmailVerificationSuccess />} />

              {/* NUEVA RUTA PARA COMPLETAR REGISTRO CON GOOGLE */}
              <Route 
                path="/google-complete-register" 
                element={
                  <PublicRoute redirectTo="/dashboard">
                    <GoogleCompleteRegister />
                  </PublicRoute>
                } 
              />

              {/* RUTAS PRIVADAS - Requieren autenticación */}
              <Route
                path="/home"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />

              <Route
                path="/mascotas"
                element={
                  <PrivateRoute>
                    <MascotaPage />
                  </PrivateRoute>
                }
              />

              <Route
                path="/mascota/:idMascota"
                element={
                  <PrivateRoute>
                    <Maxinfo />
                  </PrivateRoute>
                }
              />

              <Route
                path="/nueva-mascota"
                element={
                  <PrivateRoute>
                    <NuevaMascota />
                  </PrivateRoute>
                }
              />

              <Route
                path="/edit/:idMascota"
                element={
                  <PrivateRoute>
                    <Edit />
                  </PrivateRoute>
                }
              />

              <Route
                path="/perfil"
                element={
                  <PrivateRoute>
                    <Prefil />
                  </PrivateRoute>
                }
              />

              {/* RUTA ADMIN - Solo para administradores */}
              <Route
                path="/admin"
                element={
                  <PrivateRoute role="admin">
                    <AdminPanel />
                  </PrivateRoute>
                }
              />

              {/* RUTAS LEGACY (mantener compatibilidad) */}
              <Route path="/gregistro" element={<Navigate to="/google-complete-register" replace />} />

              {/* PÁGINA 404 MEJORADA */}
              <Route
                path="*"
                element={
                  <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100 flex items-center justify-center px-4">
                    <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md">
                      <div className="text-8xl mb-6">🔍</div>
                      <h1 className="text-4xl font-bold text-gray-800 mb-4">
                        404
                      </h1>
                      <h2 className="text-xl font-semibold text-gray-600 mb-4">
                        Página No Encontrada
                      </h2>
                      <p className="text-gray-500 mb-8">
                        La página que buscas no existe o fue movida. Verifica la URL o regresa al inicio.
                      </p>
                      <div className="space-y-3">
                        <a
                          href="/"
                          className="block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                        >
                          🏠 Volver al Inicio
                        </a>
                        <a
                          href="/mascotas"
                          className="block bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                        >
                          🐾 Ver mis Mascotas
                        </a>
                      </div>
                    </div>
                  </div>
                }
              />
            </Routes>
          </Layout>
        </Router>
      </CartProvider>
    </GoogleOAuthProvider>
  );
}

export default App;