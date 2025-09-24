import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Phone, MapPin, Calendar, Edit3, Settings, 
  Heart, Save, X, AlertCircle, CheckCircle, LogOut, 
  Home, Shield
} from 'lucide-react';

const UserProfile = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [mascotas, setMascotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    telefono: '',
    direccion: {
      calle: '',
      ciudad: '',
      estado: '',
      pais: ''
    }
  });

  // Función para hacer requests autenticados - MEJORADA
  const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      navigate('/login');
      throw new Error('No hay token de autenticación');
    }

    const response = await fetch(`${process.env.REACT_APP_API || 'http://localhost:5000'}/api${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    // Si el token es inválido, redirigir al login
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      throw new Error('Sesión expirada');
    }

    return response;
  };

  // Cargar datos del usuario - CORREGIDA
  const loadUserData = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/auth/me');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al obtener datos del usuario');
      }
      
      const user = await response.json();
      console.log('Usuario cargado:', user); // Para debugging
      setUserData(user);
      
      // Inicializar formulario de edición con datos seguros
      setEditForm({
        name: user.name || '',
        telefono: user.telefono || '',
        direccion: {
          calle: user.direccion?.calle || '',
          ciudad: user.direccion?.ciudad || '',
          estado: user.direccion?.estado || '',
          pais: user.direccion?.pais || 'Colombia'
        }
      });
    } catch (err) {
      console.error('Error loading user data:', err);
      setError(err.message || 'Error al cargar los datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  // Cargar mascotas del usuario - CORREGIDA
  const loadMascotas = async () => {
    try {
      const response = await fetchWithAuth('/mascotas');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al obtener mascotas');
      }
      
      const mascotasData = await response.json();
      console.log('Mascotas recibidas:', mascotasData); // Para debugging
      
      // 🔸 CORRECCIÓN: Asegurar que mascotasData sea un array
      const mascotasArray = Array.isArray(mascotasData) ? mascotasData : 
                            (mascotasData?.mascotas && Array.isArray(mascotasData.mascotas)) ? mascotasData.mascotas :
                            (mascotasData?.data && Array.isArray(mascotasData.data)) ? mascotasData.data : [];
      
      console.log('Mascotas procesadas:', mascotasArray); // Para debugging
      setMascotas(mascotasArray);
    } catch (err) {
      console.error('Error loading mascotas:', err);
      setMascotas([]); // 🔸 Asegurar array vacío en caso de error
      // No mostrar error en UI por mascotas, es opcional
    }
  };

  // Manejar actualización del perfil - CORREGIDA COMPLETA
  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      setError(''); // Limpiar errores previos

      // Validar datos básicos
      if (!editForm.name || editForm.name.trim().length < 2) {
        throw new Error('El nombre debe tener al menos 2 caracteres');
      }

      if (editForm.telefono && !validatePhone(editForm.telefono)) {
        throw new Error('El formato del teléfono no es válido');
      }

      const response = await fetchWithAuth('/usuarios/perfil', {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Error al actualizar el perfil');
      }

      const updatedUser = await response.json();
      console.log('Usuario actualizado:', updatedUser); // Para debugging
      
      setUserData(updatedUser);
      setEditMode(false);
      setError('');
      
      // Mostrar mensaje de éxito
      alert('✅ Perfil actualizado exitosamente');

      // Actualizar localStorage si es necesario
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const newUser = { ...currentUser, ...updatedUser };
      localStorage.setItem('user', JSON.stringify(newUser));

    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  // Función de validación de teléfono
  const validatePhone = (phone) => {
    if (!phone) return true; // Teléfono es opcional
    
    const phoneRegex = /^\+?[\d\s\-\(\)]{7,15}$/;
    return phoneRegex.test(phone.trim());
  };

  // Manejar cambios en el formulario - MEJORADA
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('direccion.')) {
      const field = name.split('.')[1];
      setEditForm(prev => ({
        ...prev,
        direccion: {
          ...prev.direccion,
          [field]: value
        }
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Limpiar errores cuando el usuario modifica un campo
    if (error) {
      setError('');
    }
  };

  // Cerrar sesión - MEJORADA
  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Limpiar estado
      setUserData(null);
      setMascotas([]);
      setEditForm({
        name: '',
        telefono: '',
        direccion: {
          calle: '',
          ciudad: '',
          estado: '',
          pais: 'Colombia'
        }
      });
      
      navigate('/login');
    }
  };

  // Hook de efecto mejorado
  useEffect(() => {
    const initializeProfile = async () => {
      await loadUserData();
      await loadMascotas();
    };
    
    initializeProfile();
  }, [navigate]); // Agregar navigate como dependencia

  // Mostrar loading
  if (loading && !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  // Mostrar error
  if (error && !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadUserData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="bg-white shadow-lg rounded-3xl mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
                  <User className="text-white" size={32} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Mi Perfil</h1>
                  <p className="text-blue-100">Gestiona tu información personal</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/home')}
                  className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-xl hover:bg-opacity-30 transition-colors flex items-center gap-2"
                >
                  <Home size={18} />
                  Inicio
                </button>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <LogOut size={18} />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Información del Usuario */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-lg rounded-3xl overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Settings className="text-blue-600" size={24} />
                    <h2 className="text-2xl font-semibold text-gray-900">Información Personal</h2>
                  </div>
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 font-medium ${
                      editMode 
                        ? 'bg-gray-500 text-white hover:bg-gray-600' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {editMode ? <X size={18} /> : <Edit3 size={18} />}
                    {editMode ? 'Cancelar' : 'Editar'}
                  </button>
                </div>
              </div>
              
              <div className="px-8 py-6">
                {error && (
                  <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                    <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                    <p className="text-red-700">{error}</p>
                  </div>
                )}

                {!editMode ? (
                  // Vista de solo lectura
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-600">Nombre Completo</label>
                        <p className="text-lg text-gray-900 font-medium">{userData?.name || 'No especificado'}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-600">Correo Electrónico</label>
                        <div className="flex items-center gap-2">
                          <Mail className="text-gray-400" size={18} />
                          <p className="text-lg text-gray-900">{userData?.email}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-600">Teléfono</label>
                        <div className="flex items-center gap-2">
                          <Phone className="text-gray-400" size={18} />
                          <p className="text-lg text-gray-900">{userData?.telefono || 'No especificado'}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-600">Rol</label>
                        <div className="flex items-center gap-2">
                          <Shield className="text-gray-400" size={18} />
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            userData?.role === 'admin' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {userData?.role === 'admin' ? 'Administrador' : 'Usuario'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-600">Dirección</label>
                      <div className="flex items-start gap-2">
                        <MapPin className="text-gray-400 flex-shrink-0 mt-1" size={18} />
                        <p className="text-lg text-gray-900">
                          {userData?.direccion ? 
                            `${userData.direccion.calle}, ${userData.direccion.ciudad}, ${userData.direccion.estado}, ${userData.direccion.pais}` 
                            : 'No especificada'
                          }
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-600">Fecha de Registro</label>
                      <div className="flex items-center gap-2">
                        <Calendar className="text-gray-400" size={18} />
                        <p className="text-lg text-gray-900">
                          {userData?.createdAt 
                            ? new Date(userData.createdAt).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : 'No disponible'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Vista de edición
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo *</label>
                        <input
                          type="text"
                          name="name"
                          value={editForm.name}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Tu nombre completo"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Correo Electrónico</label>
                        <div className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-600">
                          {userData?.email} <span className="text-sm">(No se puede cambiar)</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                      <input
                        type="tel"
                        name="telefono"
                        value={editForm.telefono}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+57 300 123 4567"
                      />
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Dirección</h3>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Calle y Número</label>
                        <input
                          type="text"
                          name="direccion.calle"
                          value={editForm.direccion.calle}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Calle 123 # 45-67"
                        />
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Ciudad</label>
                          <input
                            type="text"
                            name="direccion.ciudad"
                            value={editForm.direccion.ciudad}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Bogotá"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Departamento/Estado</label>
                          <input
                            type="text"
                            name="direccion.estado"
                            value={editForm.direccion.estado}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Cundinamarca"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">País</label>
                        <select
                          name="direccion.pais"
                          value={editForm.direccion.pais}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="Colombia">Colombia</option>
                          <option value="México">México</option>
                          <option value="Argentina">Argentina</option>
                          <option value="Chile">Chile</option>
                          <option value="Perú">Perú</option>
                          <option value="Ecuador">Ecuador</option>
                          <option value="Venezuela">Venezuela</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setEditMode(false);
                          setError('');
                        }}
                        className="px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors flex items-center gap-2"
                      >
                        <X size={18} />
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={loading}
                        className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save size={18} />
                            Guardar Cambios
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Mascotas */}
          <div className="space-y-6">
            <div className="bg-white shadow-lg rounded-3xl overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-pink-500 to-red-500">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Heart className="text-white" size={20} />
                  Mis Mascotas ({mascotas.length})
                </h3>
              </div>
              
              <div className="p-6">
                {mascotas.length === 0 ? (
                  <div className="text-center py-8">
                    <Heart className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500 mb-4">No tienes mascotas registradas</p>
                    <button
                      onClick={() => navigate('/mascotas/nueva')}
                      className="bg-pink-500 text-white px-4 py-2 rounded-xl hover:bg-pink-600 transition-colors"
                    >
                      Registrar Mascota
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mascotas.map((mascota) => (
                      <div
                        key={mascota._id}
                        className="bg-gradient-to-r from-pink-50 to-red-50 border border-pink-200 rounded-2xl p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900 text-lg">{mascota.nombre}</h4>
                          <span className="text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded-full">
                            {mascota.especie}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><span className="font-medium">Raza:</span> {mascota.raza || 'No especificada'}</p>
                          <p><span className="font-medium">Edad:</span> {mascota.edad} {mascota.edad === 1 ? 'año' : 'años'}</p>
                          {mascota.genero && (
                            <p><span className="font-medium">Género:</span> {mascota.genero}</p>
                          )}
                          {mascota.estado && (
                            <p><span className="font-medium">Estado:</span> {mascota.estado}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <button
                      onClick={() => navigate('/mascotas/nueva')}
                      className="w-full bg-pink-500 text-white px-4 py-3 rounded-2xl hover:bg-pink-600 transition-colors font-medium"
                    >
                      + Agregar Nueva Mascota
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="bg-white shadow-lg rounded-3xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Acciones Rápidas</h3>
              </div>
              <div className="p-6 space-y-3">
                <button
                  onClick={() => navigate('/citas/nueva')}
                  className="w-full bg-blue-500 text-white px-4 py-3 rounded-xl hover:bg-blue-600 transition-colors text-left"
                >
                  📅 Agendar Cita
                </button>
                <button
                  onClick={() => navigate('/productos')}
                  className="w-full bg-green-500 text-white px-4 py-3 rounded-xl hover:bg-green-600 transition-colors text-left"
                >
                  🛒 Ver Productos
                </button>
                <button
                  onClick={() => navigate('/historial')}
                  className="w-full bg-purple-500 text-white px-4 py-3 rounded-xl hover:bg-purple-600 transition-colors text-left"
                >
                  📋 Ver Historial
                </button>
                {userData?.role === 'admin' && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="w-full bg-red-500 text-white px-4 py-3 rounded-xl hover:bg-red-600 transition-colors text-left"
                  >
                    ⚙️ Panel de Admin
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;