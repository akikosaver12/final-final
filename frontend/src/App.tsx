import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/layout/Layout';

// Importar todas las páginas
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import CartPage from './pages/CartPage';
import ContactPage from './pages/ContactPage';
import AboutPage from './pages/AboutPage';
import MascotaPage from './pages/Mascotapage';
import Maxinfo from './components/mascotas/mas_infromacio';
import NuevaMascota from './components/mascotas/nuevamascota';
import User from './components/user/Login';
import Registro from './components/user/Register';
import Home from './components/user/Home';
import Edit from './components/mascotas/editarinfo'
import Prefil from './components/user/prefil'

// 🔹 Nueva página para admin
import AdminPanel from './components/user/AdminPanel';

// 👉 Middleware sencillo: protege rutas privadas
interface PrivateRouteProps {
  children: React.ReactNode;
  role?: string;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, role }) => {
  const token = localStorage.getItem("token");
  const user = (() => {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  })(); // el backend debe enviarlo

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role && user?.role !== role) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <CartProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/mascotas" element={<MascotaPage />} />
            <Route path="/edit/:idMascota" element={<Edit />} />
            <Route path="/perfil" element={<Prefil />} />
            
            {/* 👇 Aquí ya no pasamos idMascota manual */}
            <Route path="/mascota/:idMascota" element={<Maxinfo />} />

            <Route path="/nueva-mascota" element={<NuevaMascota />} />

            {/* Login / Registro */}
            <Route path="/login" element={<User />} />
            <Route path="/registro" element={<Registro />} />

            {/* Rutas privadas */}
            <Route
              path="/home"
              element={
                <PrivateRoute>
                  <Home />
                </PrivateRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <PrivateRoute role="admin">
                  <AdminPanel />
                </PrivateRoute>
              }
            />

            {/* 404 */}
            <Route
              path="*"
              element={
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <h1 className="text-3xl font-bold text-gray-600 mb-4">
                      Página No Encontrada
                    </h1>
                    <p className="text-gray-500 mb-8">
                      La página que buscas no existe o fue movida.
                    </p>
                    <a
                      href="/"
                      className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                    >
                      🏠 Volver al Inicio
                    </a>
                  </div>
                </div>
              }
            />
          </Routes>
        </Layout>
      </Router>
    </CartProvider>
  );
}

export default App;
