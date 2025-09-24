import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

const GoogleCompleteRegister = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);
  
  const [formData, setFormData] = useState({
    telefono: '',
    direccion: {
      calle: '',
      ciudad: '',
      estado: '',
      pais: 'Colombia'
    }
  });

  const [errors, setErrors] = useState({});

  // Verificar si hay datos de Google del estado de navegación
  useEffect(() => {
    const stateData = location.state;
    if (!stateData || !stateData.googleUser) {
      console.warn('No se encontraron datos de Google, redirigiendo a registro normal');
      navigate('/registro');
      return;
    }
    
    console.log('Datos de Google recibidos:', stateData.googleUser);
    setGoogleUser(stateData.googleUser);
  }, [location.state, navigate]);

  // Validaciones
  const validarTelefono = useCallback((telefono) => {
    if (!telefono) return false;
    const telefonoLimpio = telefono.replace(/[\s\-\(\)]/g, "");
    return /^\+?[\d]{7,15}$/.test(telefonoLimpio);
  }, []);

  const validarDireccion = useCallback((direccion) => {
    return {
      calle: direccion.calle && direccion.calle.trim().length >= 5,
      ciudad: direccion.ciudad && direccion.ciudad.trim().length >= 2,
      estado: direccion.estado && direccion.estado.trim().length >= 2
    };
  }, []);

  // Manejar cambios en inputs normales
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Limpiar errores
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Validación en tiempo real
    if (name === 'telefono' && value) {
      setTimeout(() => {
        if (!validarTelefono(value)) {
          setErrors(prev => ({ ...prev, telefono: 'Formato de teléfono inválido' }));
        }
      }, 500);
    }
  }, [errors, validarTelefono]);

  // Manejar cambios en dirección
  const handleDireccionChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      direccion: { ...prev.direccion, [name]: value }
    }));

    const errorKey = `direccion.${name}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }

    // Validación en tiempo real para dirección
    if (value) {
      setTimeout(() => {
        if (name === 'calle' && value.trim().length < 5) {
          setErrors(prev => ({ ...prev, [`direccion.${name}`]: 'La dirección debe tener al menos 5 caracteres' }));
        } else if ((name === 'ciudad' || name === 'estado') && value.trim().length < 2) {
          setErrors(prev => ({ ...prev, [`direccion.${name}`]: `${name.charAt(0).toUpperCase() + name.slice(1)} debe tener al menos 2 caracteres` }));
        }
      }, 500);
    }
  }, [errors]);

  // Validar formulario completo
  const validarFormulario = useCallback(() => {
    const nuevosErrores = {};

    if (!formData.telefono.trim()) {
      nuevosErrores.telefono = "El teléfono es obligatorio";
    } else if (!validarTelefono(formData.telefono)) {
      nuevosErrores.telefono = "Teléfono inválido (7-15 dígitos)";
    }

    const direccionValidation = validarDireccion(formData.direccion);
    
    if (!formData.direccion.calle.trim()) {
      nuevosErrores["direccion.calle"] = "La dirección es obligatoria";
    } else if (!direccionValidation.calle) {
      nuevosErrores["direccion.calle"] = "La dirección debe tener al menos 5 caracteres";
    }

    if (!formData.direccion.ciudad.trim()) {
      nuevosErrores["direccion.ciudad"] = "La ciudad es obligatoria";
    } else if (!direccionValidation.ciudad) {
      nuevosErrores["direccion.ciudad"] = "La ciudad debe tener al menos 2 caracteres";
    }

    if (!formData.direccion.estado.trim()) {
      nuevosErrores["direccion.estado"] = "El estado/departamento es obligatorio";
    } else if (!direccionValidation.estado) {
      nuevosErrores["direccion.estado"] = "El estado debe tener al menos 2 caracteres";
    }

    return nuevosErrores;
  }, [formData, validarTelefono, validarDireccion]);

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!googleUser) {
      alert("Error: Información de Google no disponible. Redirigiendo...");
      navigate('/registro');
      return;
    }

    const errores = validarFormulario();
    if (Object.keys(errores).length > 0) {
      console.log('Errores de validación:', errores);
      setErrors(errores);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      console.log('Completando registro con Google para:', googleUser.email);

      const payload = {
        ...googleUser,
        ...formData
      };

      console.log('Datos a enviar:', {
        ...payload,
        googleId: '[GOOGLE_ID_OCULTO]'
      });

      const res = await fetch(`${API_URL}/auth/google/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log('Respuesta del servidor:', data);

      if (res.ok) {
        // Registro completado exitosamente
        localStorage.setItem("token", data.tokens.accessToken);
        localStorage.setItem("refreshToken", data.tokens.refreshToken);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        console.log('✅ Registro con Google completado para:', data.user.email);
        alert(data.message || "¡Registro completado exitosamente!");
        navigate(data.redirectTo || "/dashboard");
      } else {
        console.log('❌ Error completando registro:', data);
        
        if (data.code === 'INVALID_PHONE') {
          setErrors({ telefono: data.error });
        } else if (data.code === 'INVALID_ADDRESS') {
          setErrors({ "direccion.calle": data.error });
        } else if (data.code === 'USER_ALREADY_EXISTS') {
          alert("Ya existe una cuenta con este email. Intenta iniciar sesión.");
          navigate('/login');
        } else if (data.code === 'MISSING_REQUIRED_FIELDS') {
          alert("Faltan campos obligatorios. Por favor, completa toda la información.");
        } else {
          alert("Error completando el registro: " + (data.error || "Error desconocido"));
        }
      }
    } catch (error) {
      console.error("Error completando registro:", error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        alert("No se pudo conectar con el servidor. Verifica que esté corriendo en puerto 5000.");
      } else {
        alert("Error de conexión con el servidor");
      }
    } finally {
      setLoading(false);
    }
  };

  // Volver al registro normal
  const volverAlRegistro = () => {
    navigate('/registro');
  };

  if (!googleUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información de Google...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white p-8 rounded-2xl shadow-xl">
          {/* Header con información de Google */}
          <div className="text-center mb-8">
            <div className="mb-4">
              {googleUser.profilePicture && (
                <img 
                  src={googleUser.profilePicture} 
                  alt="Foto de perfil" 
                  className="w-20 h-20 rounded-full mx-auto border-4 border-purple-200 shadow-md"
                />
              )}
            </div>
            <h2 className="text-2xl font-bold text-purple-700 mb-2">
              Hola {googleUser.name}!
            </h2>
            <p className="text-gray-600 text-sm">
              Solo necesitamos un poco más de información para completar tu registro en la clínica veterinaria
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Información de Google (solo lectura) */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="text-sm font-semibold text-green-800 mb-3">
                  ✅ Información verificada con Google
                </h3>
                
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      value={googleUser.name}
                      disabled
                      className="w-full p-3 border rounded-lg bg-green-50 text-green-800 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      Email verificado
                    </label>
                    <input
                      type="email"
                      value={googleUser.email}
                      disabled
                      className="w-full p-3 border rounded-lg bg-green-50 text-green-800 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Información adicional requerida */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">
                  Información adicional requerida
                </h3>

                {/* Teléfono */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    placeholder="Ej: +57 301 234 5678 o 3012345678"
                    value={formData.telefono}
                    onChange={handleChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 transition ${
                      errors.telefono ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    maxLength="20"
                    disabled={loading}
                  />
                  {errors.telefono && (
                    <p className="text-red-600 text-sm mt-1">{errors.telefono}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">
                    Necesitamos tu teléfono para contactarte sobre las citas de tus mascotas
                  </p>
                </div>

                {/* Dirección completa */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección completa *
                  </label>
                  <input
                    type="text"
                    name="calle"
                    placeholder="Ej: Calle 123 #45-67, Barrio Centro"
                    value={formData.direccion.calle}
                    onChange={handleDireccionChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 transition ${
                      errors['direccion.calle'] ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    maxLength="200"
                    disabled={loading}
                  />
                  {errors['direccion.calle'] && (
                    <p className="text-red-600 text-sm mt-1">{errors['direccion.calle']}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Ciudad */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ciudad *
                    </label>
                    <input
                      type="text"
                      name="ciudad"
                      placeholder="Ej: Barranquilla"
                      value={formData.direccion.ciudad}
                      onChange={handleDireccionChange}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 transition ${
                        errors['direccion.ciudad'] ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      maxLength="100"
                      disabled={loading}
                    />
                    {errors['direccion.ciudad'] && (
                      <p className="text-red-600 text-sm mt-1">{errors['direccion.ciudad']}</p>
                    )}
                  </div>

                  {/* Estado/Departamento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Departamento *
                    </label>
                    <input
                      type="text"
                      name="estado"
                      placeholder="Ej: Atlántico"
                      value={formData.direccion.estado}
                      onChange={handleDireccionChange}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 transition ${
                        errors['direccion.estado'] ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      maxLength="100"
                      disabled={loading}
                    />
                    {errors['direccion.estado'] && (
                      <p className="text-red-600 text-sm mt-1">{errors['direccion.estado']}</p>
                    )}
                  </div>
                </div>

                {/* País */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    País
                  </label>
                  <select
                    name="pais"
                    value={formData.direccion.pais}
                    onChange={handleDireccionChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition"
                    disabled={loading}
                  >
                    <option value="Colombia">Colombia</option>
                    <option value="México">México</option>
                    <option value="Argentina">Argentina</option>
                    <option value="Chile">Chile</option>
                    <option value="Perú">Perú</option>
                    <option value="Venezuela">Venezuela</option>
                    <option value="Ecuador">Ecuador</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Información sobre el uso de datos */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">
                Tu información está segura
              </h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Usamos tu dirección para servicios de entrega y emergencias</li>
                <li>• Tu teléfono es para confirmación de citas y notificaciones importantes</li>
                <li>• Tu información personal nunca será compartida con terceros</li>
                <li>• Cumplimos con todas las normativas de protección de datos</li>
              </ul>
            </div>

            {/* Botones */}
            <div className="mt-8 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition duration-300 ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-purple-600 hover:bg-purple-700 hover:transform hover:scale-105'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Completando registro...
                  </span>
                ) : (
                  'Completar Registro con Google'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={volverAlRegistro}
                  className="text-sm text-gray-500 hover:text-gray-700 underline transition"
                  disabled={loading}
                >
                  ← Volver al registro normal (sin Google)
                </button>
              </div>
            </div>

            {/* Nota sobre campos obligatorios */}
            <div className="mt-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Los campos marcados con (*) son obligatorios.</span> 
                Tu cuenta con Google ya está verificada, solo necesitamos esta información adicional 
                para brindarte el mejor servicio veterinario.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GoogleCompleteRegister;