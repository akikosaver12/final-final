import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    telefono: "",
    direccion: {
      calle: "",
      ciudad: "",
      estado: "",
      pais: "Colombia",
    },
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Validar teléfono en tiempo real
  const validarTelefono = (telefono) => {
    const telefonoLimpio = telefono.replace(/[\s\-\(\)]/g, "");
    return /^\+?[\d]{7,15}$/.test(telefonoLimpio);
  };

  // Manejar cambios en inputs normales
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Manejar cambios en campos de dirección
  const handleDireccionChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      direccion: {
        ...prev.direccion,
        [name]: value,
      },
    }));

    if (errors[`direccion.${name}`]) {
      setErrors((prev) => ({
        ...prev,
        [`direccion.${name}`]: "",
      }));
    }
  };

  // Validar formulario
  const validarFormulario = () => {
    const nuevosErrores = {};

    if (!formData.name.trim()) {
      nuevosErrores.name = "El nombre es obligatorio";
    } else if (formData.name.trim().length < 2) {
      nuevosErrores.name = "El nombre debe tener al menos 2 caracteres";
    }

    if (!formData.email.trim()) {
      nuevosErrores.email = "El email es obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nuevosErrores.email = "El email debe tener un formato válido";
    }

    if (!formData.password) {
      nuevosErrores.password = "La contraseña es obligatoria";
    } else if (formData.password.length < 6) {
      nuevosErrores.password = "La contraseña debe tener al menos 6 caracteres";
    }

    if (!formData.telefono.trim()) {
      nuevosErrores.telefono = "El teléfono es obligatorio";
    } else if (!validarTelefono(formData.telefono)) {
      nuevosErrores.telefono =
        "El teléfono debe tener un formato válido (7-15 dígitos)";
    }

    if (!formData.direccion.calle.trim()) {
      nuevosErrores["direccion.calle"] = "La dirección es obligatoria";
    } else if (formData.direccion.calle.trim().length < 5) {
      nuevosErrores["direccion.calle"] =
        "La dirección debe tener al menos 5 caracteres";
    }

    if (!formData.direccion.ciudad.trim()) {
      nuevosErrores["direccion.ciudad"] = "La ciudad es obligatoria";
    } else if (formData.direccion.ciudad.trim().length < 2) {
      nuevosErrores["direccion.ciudad"] =
        "La ciudad debe tener al menos 2 caracteres";
    }

    if (!formData.direccion.estado.trim()) {
      nuevosErrores["direccion.estado"] =
        "El estado/departamento es obligatorio";
    } else if (formData.direccion.estado.trim().length < 2) {
      nuevosErrores["direccion.estado"] =
        "El estado debe tener al menos 2 caracteres";
    }

    return nuevosErrores;
  };

  // Manejar el registro
  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("🔄 Iniciando registro con datos:", formData);

    const erroresValidacion = validarFormulario();
    if (Object.keys(erroresValidacion).length > 0) {
      console.log("❌ Errores de validación:", erroresValidacion);
      setErrors(erroresValidacion);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      console.log("📤 Enviando datos al servidor...");
      const res = await fetch("http://localhost:5000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      console.log("📥 Respuesta del servidor:", data);

      if (res.ok) {
        console.log("✅ Registro exitoso!");
        alert("✅ ¡Registro exitoso! Bienvenido a la clínica veterinaria");
        navigate("/");
      } else {
        console.log("❌ Error en el registro:", data);
        if (data.campos) {
          const erroresServidor = {};
          data.campos.forEach((campo) => {
            erroresServidor[campo] = `${campo} es requerido`;
          });
          setErrors(erroresServidor);
        } else {
          alert("❌ " + (data.error || "Error en el registro"));
        }
      }
    } catch (error) {
      console.error("💥 Error de conexión:", error);
      alert(
        "⚠️ Error de conexión con el servidor. Verifica que esté corriendo en http://localhost:5000"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-2xl shadow-xl"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-purple-700 mb-2">
              Crear Cuenta
            </h2>
            <p className="text-gray-600">
              Únete a nuestra clínica veterinaria
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Información Personal */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">
                Información Personal
              </h3>
              
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Ej: Juan Pérez"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition ${
                    errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.name && (
                  <p className="text-red-600 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="ejemplo@correo.com"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition ${
                    errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.email && (
                  <p className="text-red-600 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña *
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition ${
                    errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.password && (
                  <p className="text-red-600 text-sm mt-1">{errors.password}</p>
                )}
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  name="telefono"
                  placeholder="Ej: +57 301 234 5678 o 3012345678"
                  value={formData.telefono}
                  onChange={handleChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition ${
                    errors.telefono ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.telefono && (
                  <p className="text-red-600 text-sm mt-1">{errors.telefono}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Formato: números con o sin código de país
                </p>
              </div>
            </div>

            {/* Dirección */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">
                Dirección de Residencia
              </h3>

              {/* Calle/Dirección */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección Completa *
                </label>
                <input
                  type="text"
                  name="calle"
                  placeholder="Ej: Calle 123 #45-67, Barrio Centro"
                  value={formData.direccion.calle}
                  onChange={handleDireccionChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition ${
                    errors['direccion.calle'] ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors['direccion.calle'] && (
                  <p className="text-red-600 text-sm mt-1">{errors['direccion.calle']}</p>
                )}
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad *
                </label>
                <input
                  type="text"
                  name="ciudad"
                  placeholder="Ej: Barranquilla"
                  value={formData.direccion.ciudad}
                  onChange={handleDireccionChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition ${
                    errors['direccion.ciudad'] ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors['direccion.ciudad'] && (
                  <p className="text-red-600 text-sm mt-1">{errors['direccion.ciudad']}</p>
                )}
              </div>

              {/* Estado/Departamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departamento/Estado *
                </label>
                <input
                  type="text"
                  name="estado"
                  placeholder="Ej: Atlántico"
                  value={formData.direccion.estado}
                  onChange={handleDireccionChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition ${
                    errors['direccion.estado'] ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors['direccion.estado'] && (
                  <p className="text-red-600 text-sm mt-1">{errors['direccion.estado']}</p>
                )}
              </div>

              {/* País */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  País
                </label>
                <select
                  name="pais"
                  value={formData.direccion.pais}
                  onChange={handleDireccionChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
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

              {/* Espacio adicional para mantener el balance del diseño */}
              <div className="h-16 flex items-center justify-center">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-blue-700 text-sm font-medium">
                    📍 La dirección nos ayuda a brindar un mejor servicio
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="mt-8 space-y-4">
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
                  Registrando...
                </span>
              ) : (
                'Crear Cuenta'
              )}
            </button>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-purple-600 hover:text-purple-700 font-semibold hover:underline transition"
                >
                  Inicia Sesión
                </button>
              </p>
            </div>
          </div>

          {/* Nota de campos obligatorios */}
          <div className="mt-6 p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-700">
              <span className="font-semibold">Nota:</span> Los campos marcados con (*) son obligatorios. 
              Toda la información proporcionada será utilizada únicamente para brindar un mejor servicio veterinario.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;