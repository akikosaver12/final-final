import React, { useState, useEffect, useRef } from "react";
import { 
  Package, Users, Calendar, Plus, Edit3, Trash2, Eye, 
  RefreshCw, ArrowLeft, Save, X, Camera, Shield, 
  Truck, Tag, Award, AlertCircle, CheckCircle,
  TrendingUp, Activity, Settings
} from "lucide-react";

const BASE_URL = "http://localhost:5000";

const AdminPanel = () => {
  // --- Obtener token robusto ---
  const getToken = () => {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem("token") || localStorage.getItem("auth") || "";
      try {
        const maybe = JSON.parse(raw);
        if (maybe && typeof maybe === "object" && maybe.token) return maybe.token;
      } catch {}
      return raw;
    }
    return "";
  };

  // --- fetch helper ---
  const fetchJSON = async (url, options = {}) => {
    try {
      const token = getToken();
      const headers = { ...(options.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url, { ...options, headers });
      let bodyText = await res.text();
      if (!res.ok) {
        let message = bodyText || `HTTP ${res.status}`;
        try {
          const j = JSON.parse(bodyText);
          message = j.error || j.message || message;
        } catch {}
        throw new Error(`${res.status} ${res.statusText} - ${message}`);
      }
      try {
        return JSON.parse(bodyText);
      } catch {
        return bodyText;
      }
    } catch (error) {
      console.error(`❌ Fetch error for ${url}:`, error);
      throw error;
    }
  };

  // --- Server Health ---
  const checkServerHealth = async () => {
    try {
      setServerStatus("checking");
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        setServerStatus("online");
        return true;
      } else {
        setServerStatus("offline");
        return false;
      }
    } catch (error) {
      console.error("Server health check failed:", error);
      setServerStatus("offline");
      return false;
    }
  };

  // Estados principales
  const [activeTab, setActiveTab] = useState("productos");
  const [formData, setFormData] = useState({
    nombre: "",
    precio: "",
    descripcion: "",
    imagen: null,
    categoria: "otros",
    stock: "",
    tieneDescuento: false,
    porcentajeDescuento: "",
    fechaInicioDescuento: "",
    fechaFinDescuento: "",
    tieneGarantia: false,
    mesesGarantia: "",
    descripcionGarantia: "",
    envioGratis: false
  });
  
  // Estados para edición
  const [editingProduct, setEditingProduct] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Estados de datos
  const [previewImage, setPreviewImage] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [mascotasUsuario, setMascotasUsuario] = useState([]);
  const [productos, setProductos] = useState([]);
  const [citas, setCitas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState("");
  const [serverStatus, setServerStatus] = useState("checking");
  const fileRef = useRef(null);

  // --- FUNCIONES PARA PRODUCTOS ---

  // Función para iniciar edición
  const startEditProduct = (producto) => {
    setIsEditMode(true);
    setEditingProduct(producto);
    setActiveTab("productos");
    
    setFormData({
      nombre: producto.nombre || "",
      precio: producto.precio || "",
      descripcion: producto.descripcion || "",
      imagen: null,
      categoria: producto.categoria || "otros",
      stock: producto.stock || "",
      tieneDescuento: producto.descuento?.tiene || false,
      porcentajeDescuento: producto.descuento?.porcentaje || "",
      fechaInicioDescuento: producto.descuento?.fechaInicio ? 
        new Date(producto.descuento.fechaInicio).toISOString().split('T')[0] : "",
      fechaFinDescuento: producto.descuento?.fechaFin ?
        new Date(producto.descuento.fechaFin).toISOString().split('T')[0] : "",
      tieneGarantia: producto.garantia?.tiene || false,
      mesesGarantia: producto.garantia?.meses || "",
      descripcionGarantia: producto.garantia?.descripcion || "",
      envioGratis: producto.envioGratis || false
    });
    
    setPreviewImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // FUNCIÓN PARA CANCELAR EDICIÓN
  const cancelEdit = () => {
    setIsEditMode(false);
    setEditingProduct(null);
    
    // Resetear formulario
    setFormData({
      nombre: "",
      precio: "",
      descripcion: "",
      imagen: null,
      categoria: "otros",
      stock: "",
      tieneDescuento: false,
      porcentajeDescuento: "",
      fechaInicioDescuento: "",
      fechaFinDescuento: "",
      tieneGarantia: false,
      mesesGarantia: "",
      descripcionGarantia: "",
      envioGratis: false
    });
    
    setPreviewImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // --- Handlers formulario actualizados ---
  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    if (files && files[0]) {
      setFormData((s) => ({ ...s, [name]: files[0] }));
      setPreviewImage(URL.createObjectURL(files[0]));
    } else if (type === 'checkbox') {
      setFormData((s) => ({ ...s, [name]: checked }));
    } else {
      setFormData((s) => ({ ...s, [name]: value }));
    }
  };

  // FUNCIÓN ACTUALIZADA PARA MANEJAR CREAR/EDITAR
  const handleSubmit = async (e) => {
    e.preventDefault();
    setWarn("");
    const isServerOnline = await checkServerHealth();
    if (!isServerOnline) {
      setWarn("❌ El servidor no está disponible.");
      return;
    }
    const token = getToken();
    if (!token) return setWarn("Debes iniciar sesión para gestionar productos.");

    setLoading(true);
    try {
      const data = new FormData();
      
      // Campos básicos
      data.append("nombre", formData.nombre);
      data.append("precio", formData.precio);
      data.append("descripcion", formData.descripcion);
      
      // Nuevos campos
      data.append("categoria", formData.categoria);
      data.append("stock", formData.stock || "0");
      data.append("envioGratis", formData.envioGratis);
      
      // Campos de descuento
      data.append("tieneDescuento", formData.tieneDescuento);
      if (formData.tieneDescuento) {
        data.append("porcentajeDescuento", formData.porcentajeDescuento);
        if (formData.fechaInicioDescuento) {
          data.append("fechaInicioDescuento", formData.fechaInicioDescuento);
        }
        if (formData.fechaFinDescuento) {
          data.append("fechaFinDescuento", formData.fechaFinDescuento);
        }
      }
      
      // Campos de garantía
      data.append("tieneGarantia", formData.tieneGarantia);
      if (formData.tieneGarantia) {
        data.append("mesesGarantia", formData.mesesGarantia);
        data.append("descripcionGarantia", formData.descripcionGarantia);
      }

      if (formData.imagen) {
        data.append("imagenes", formData.imagen);
      }

      // DETERMINAR SI ES CREAR O EDITAR
      const url = isEditMode 
        ? `${BASE_URL}/api/productos/${editingProduct._id}`
        : `${BASE_URL}/api/productos`;
      
      const method = isEditMode ? "PUT" : "POST";

      await fetchJSON(url, {
        method: method,
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });

      alert(isEditMode ? "✅ Producto actualizado con éxito" : "✅ Producto agregado con éxito");
      
      // Reset form
      setFormData({
        nombre: "",
        precio: "",
        descripcion: "",
        imagen: null,
        categoria: "otros",
        stock: "",
        tieneDescuento: false,
        porcentajeDescuento: "",
        fechaInicioDescuento: "",
        fechaFinDescuento: "",
        tieneGarantia: false,
        mesesGarantia: "",
        descripcionGarantia: "",
        envioGratis: false
      });
      
      setPreviewImage(null);
      setIsEditMode(false);
      setEditingProduct(null);
      
      if (fileRef.current) fileRef.current.value = "";
      getProductos();
    } catch (err) {
      setWarn(`❌ Error al ${isEditMode ? 'actualizar' : 'crear'} producto: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIONES DE USUARIOS ---
  const getUsuarios = async () => {
    setWarn("");
    const isServerOnline = await checkServerHealth();
    if (!isServerOnline) return setUsuarios([]);
    try {
      const token = getToken();
      if (!token) return setWarn("Debes iniciar sesión como admin.");
      const me = await fetchJSON(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (me?.role !== "admin") return setWarn("Tu usuario no es admin.");
      const data = await fetchJSON(`${BASE_URL}/api/auth/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuarios(data.usuarios || data);
    } catch (error) {
      setWarn(`No se pudieron cargar los usuarios: ${error.message}`);
    }
  };

  const getMascotasUsuario = async (userId) => {
    setWarn("");
    try {
      const token = getToken();
      if (!token) return setWarn("Debes iniciar sesión para ver mascotas.");
      const data = await fetchJSON(`${BASE_URL}/api/mascotas/usuario/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMascotasUsuario(data || []);
    } catch (error) {
      setWarn(`No se pudieron cargar las mascotas: ${error.message}`);
    }
  };

  // --- FUNCIONES DE PRODUCTOS ---
  const getProductos = async () => {
    setWarn("");
    const isServerOnline = await checkServerHealth();
    if (!isServerOnline) return setProductos([]);
    try {
      const data = await fetchJSON(`${BASE_URL}/api/productos`);
      setProductos(data);
    } catch (error) {
      setWarn(`No se pudieron cargar los productos: ${error.message}`);
    }
  };

  const getCategorias = async () => {
    try {
      const data = await fetchJSON(`${BASE_URL}/api/productos/categorias/disponibles`);
      setCategorias(data);
    } catch (error) {
      console.error("Error cargando categorías:", error);
      // Fallback a categorías predeterminadas
      setCategorias([
        { value: 'alimento', label: 'Alimento' },
        { value: 'juguetes', label: 'Juguetes' },
        { value: 'medicamentos', label: 'Medicamentos' },
        { value: 'accesorios', label: 'Accesorios' },
        { value: 'higiene', label: 'Higiene' },
        { value: 'otros', label: 'Otros' }
      ]);
    }
  };

  const eliminarProducto = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este producto?")) return;
    const isServerOnline = await checkServerHealth();
    if (!isServerOnline) {
      alert("❌ El servidor no está disponible.");
      return;
    }
    try {
      const token = getToken();
      if (!token) return alert("Debes iniciar sesión como admin.");
      await fetchJSON(`${BASE_URL}/api/productos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("🗑️ Producto eliminado con éxito");
      getProductos();
    } catch (error) {
      alert(`❌ Error al eliminar: ${error.message}`);
    }
  };

  // --- FUNCIONES DE CITAS ---
  const getCitas = async () => {
    setWarn("");
    const isServerOnline = await checkServerHealth();
    if (!isServerOnline) return setCitas([]);
    try {
      const token = getToken();
      if (!token) return setWarn("Debes iniciar sesión como admin.");
      const me = await fetchJSON(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (me?.role !== "admin") return setWarn("Tu usuario no es admin.");
      const data = await fetchJSON(`${BASE_URL}/api/citas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCitas(data);
    } catch (error) {
      setWarn(`No se pudieron cargar las citas: ${error.message}`);
    }
  };

  // --- FUNCIONES DE MASCOTAS (Vacunas y Operaciones) ---
  
  // Función para agregar vacunas
  const handleAgregarVacuna = async (e, mascotaId) => {
    e.preventDefault();
    const formDataVacuna = new FormData(e.target);
    const vacuna = {
      nombre: formDataVacuna.get("nombre"),
      fecha: formDataVacuna.get("fecha"),
    };

    const token = getToken();
    try {
      const res = await fetch(`${BASE_URL}/api/mascotas/${mascotaId}/vacunas`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(vacuna),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error al agregar vacuna: ${errorText}`);
      }
      const result = await res.json();
      setMascotasUsuario((prev) =>
        prev.map((m) => (m._id === mascotaId ? result.mascota : m))
      );
      e.target.reset();
      alert("✅ Vacuna agregada correctamente");
    } catch (err) {
      alert("No se pudo agregar la vacuna: " + err.message);
    }
  };

  // Función para agregar operaciones
  const handleAgregarOperacion = async (e, mascotaId) => {
    e.preventDefault();
    const formDataOperacion = new FormData(e.target);
    const operacion = {
      nombre: formDataOperacion.get("nombre"),
      descripcion: formDataOperacion.get("descripcion"),
      fecha: formDataOperacion.get("fecha"),
    };

    const token = getToken();
    try {
      const res = await fetch(`${BASE_URL}/api/mascotas/${mascotaId}/operaciones`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(operacion),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error al agregar operación: ${errorText}`);
      }
      const result = await res.json();
      setMascotasUsuario((prev) =>
        prev.map((m) => (m._id === mascotaId ? result.mascota : m))
      );
      e.target.reset();
      alert("✅ Operación agregada correctamente");
    } catch (err) {
      alert("No se pudo agregar la operación: " + err.message);
    }
  };

  // --- FUNCIONES AUXILIARES ---
  const formatearPrecio = (precio) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(precio);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "";
    return new Date(fecha).toLocaleDateString('es-CO');
  };

  // --- EFFECTS ---
  useEffect(() => {
    checkServerHealth();
    getCategorias();
  }, []);

  useEffect(() => {
    if (activeTab === "verUsuarios") getUsuarios();
    if (activeTab === "verProductos") getProductos();
    if (activeTab === "verCitas") getCitas();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (previewImage) URL.revokeObjectURL(previewImage);
    };
  }, [previewImage]);

  // Configuración de sidebar
  const sidebarItems = [
    { id: "productos", label: isEditMode ? "Editar Producto" : "Crear Producto", icon: Plus },
    { id: "verProductos", label: "Ver Productos", icon: Package },
    { id: "verUsuarios", label: "Ver Usuarios", icon: Users },
    { id: "verCitas", label: "Ver Citas", icon: Calendar },
  ];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Sidebar */}
      <aside className="w-80 bg-white shadow-xl border-r border-gray-200">
        <div className="p-8">
          {/* Header del Admin */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-lime-400 to-lime-500 rounded-2xl flex items-center justify-center">
                <Settings className="text-black" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
                <p className="text-sm text-gray-500">Gestión del sistema</p>
              </div>
            </div>

            {/* Status del servidor */}
            <div
              className={`px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-3 ${
                serverStatus === "online"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : serverStatus === "offline"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : "bg-yellow-50 text-yellow-800 border border-yellow-200"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                serverStatus === "online" ? "bg-green-500" : 
                serverStatus === "offline" ? "bg-red-500" : "bg-yellow-500"
              }`} />
              {serverStatus === "online" && "🟢 Servidor Online"}
              {serverStatus === "offline" && "🔴 Servidor Offline"}
              {serverStatus === "checking" && "🟡 Verificando..."}
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== "productos" && isEditMode) {
                      cancelEdit();
                    }
                  }}
                  className={`w-full text-left px-4 py-4 rounded-2xl transition-all duration-200 flex items-center gap-3 font-medium ${
                    activeTab === item.id
                      ? "bg-gradient-to-r from-lime-400 to-lime-500 text-black shadow-lg"
                      : "hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                  }`}
                >
                  <Icon size={20} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Panel de Administración
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-lime-400 to-lime-500 rounded-full"></div>
          </div>

          {/* Mensajes de advertencia */}
          {warn && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-center gap-3">
              <AlertCircle className="text-yellow-600" size={20} />
              <span className="text-yellow-800">{warn}</span>
            </div>
          )}

          {/* Formulario Productos - CREAR/EDITAR */}
          {activeTab === "productos" && (
            <div>
              {/* Header con botón cancelar en modo edición */}
              {isEditMode && (
                <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-semibold text-blue-800 mb-2 flex items-center gap-3">
                        <Edit3 className="text-blue-600" size={24} />
                        ✏️ Editando: {editingProduct?.nombre}
                      </h3>
                      <p className="text-blue-600">Modifica los campos que desees actualizar</p>
                    </div>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2"
                    >
                      <X size={16} />
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <Package className="text-lime-500" size={28} />
                  {isEditMode ? 'Editar Producto' : 'Crear Nuevo Producto'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Información básica */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nombre del Producto *
                      </label>
                      <input
                        type="text"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Precio (COP) *
                      </label>
                      <input
                        type="number"
                        name="precio"
                        value={formData.precio}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Categoría *
                      </label>
                      <select
                        name="categoria"
                        value={formData.categoria}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                      >
                        {categorias.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Stock *
                      </label>
                      <input
                        type="number"
                        name="stock"
                        value={formData.stock}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* Descripción */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Descripción
                    </label>
                    <textarea
                      name="descripcion"
                      value={formData.descripcion}
                      onChange={handleChange}
                      rows="4"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                    ></textarea>
                  </div>

                  {/* Imagen */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Imagen del Producto
                    </label>
                    <div className="mt-2">
                      <input
                        type="file"
                        ref={fileRef}
                        name="imagen"
                        onChange={handleChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-lime-400 transition-colors flex items-center justify-center gap-2"
                      >
                        <Camera size={20} />
                        {previewImage ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
                      </button>
                      {previewImage && (
                        <div className="mt-4">
                          <img
                            src={previewImage}
                            alt="Preview"
                            className="w-32 h-32 object-cover rounded-xl border border-gray-300"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Descuento */}
                  <div className="border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        name="tieneDescuento"
                        checked={formData.tieneDescuento}
                        onChange={handleChange}
                        className="w-5 h-5"
                      />
                      <label className="font-semibold text-gray-700">
                        Aplicar Descuento
                      </label>
                    </div>
                    
                    {formData.tieneDescuento && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Porcentaje (%)
                          </label>
                          <input
                            type="number"
                            name="porcentajeDescuento"
                            value={formData.porcentajeDescuento}
                            onChange={handleChange}
                            min="1"
                            max="100"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Fecha Inicio
                          </label>
                          <input
                            type="date"
                            name="fechaInicioDescuento"
                            value={formData.fechaInicioDescuento}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Fecha Fin
                          </label>
                          <input
                            type="date"
                            name="fechaFinDescuento"
                            value={formData.fechaFinDescuento}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Garantía */}
                  <div className="border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        name="tieneGarantia"
                        checked={formData.tieneGarantia}
                        onChange={handleChange}
                        className="w-5 h-5"
                      />
                      <label className="font-semibold text-gray-700">
                        Incluir Garantía
                      </label>
                    </div>
                    
                    {formData.tieneGarantia && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Meses de Garantía
                          </label>
                          <input
                            type="number"
                            name="mesesGarantia"
                            value={formData.mesesGarantia}
                            onChange={handleChange}
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Descripción de Garantía
                          </label>
                          <input
                            type="text"
                            name="descripcionGarantia"
                            value={formData.descripcionGarantia}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Envío gratis */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="envioGratis"
                      checked={formData.envioGratis}
                      onChange={handleChange}
                      className="w-5 h-5"
                    />
                    <label className="font-semibold text-gray-700 flex items-center gap-2">
                      <Truck size={20} />
                      Envío Gratis
                    </label>
                  </div>

                  {/* Botones */}
                  <div className="flex gap-4 pt-6">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-lime-400 to-lime-500 text-black py-4 rounded-2xl font-semibold text-lg hover:from-lime-500 hover:to-lime-600 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {loading ? (
                        <RefreshCw className="animate-spin" size={20} />
                      ) : (
                        <Save size={20} />
                      )}
                      {loading ? 'Procesando...' : isEditMode ? 'Actualizar Producto' : 'Crear Producto'}
                    </button>
                    
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-6 py-4 bg-gray-200 text-gray-700 rounded-2xl font-medium hover:bg-gray-300 transition-colors flex items-center gap-2"
                      >
                        <X size={20} />
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Ver Productos */}
          {activeTab === "verProductos" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Lista de Productos</h2>
                <button
                  onClick={() => {
                    getProductos();
                  }}
                  className="px-6 py-3 bg-lime-500 text-white rounded-xl hover:bg-lime-600 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={18} />
                  Actualizar
                </button>
              </div>

              <div className="grid gap-6">
                {productos.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                    <Package className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-600 text-xl">No hay productos registrados</p>
                  </div>
                ) : (
                  productos.map((producto) => (
                    <div
                      key={producto._id}
                      className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
                    >
                      <div className="flex items-start gap-6">
                        {/* Imagen */}
                        {producto.imagenes && producto.imagenes[0] && (
                          <img
                            src={
                              producto.imagenes[0].startsWith("http")
                                ? producto.imagenes[0]
                                : `${BASE_URL}${producto.imagenes[0]}`
                            }
                            alt={producto.nombre}
                            className="w-24 h-24 object-cover rounded-xl shadow-md"
                            onError={(e) => (e.target.style.display = "none")}
                          />
                        )}
                        
                        {/* Información */}
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {producto.nombre}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                                  {producto.categoria}
                                </span>
                                <span className={`px-3 py-1 rounded-full font-medium ${
                                  producto.stock > 0 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  Stock: {producto.stock}
                                </span>
                              </div>
                            </div>
                            
                            {/* Precio */}
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-600">
                                {formatearPrecio(producto.precio)}
                              </div>
                              {producto.descuento?.tiene && (
                                <div className="text-sm text-red-600 font-medium">
                                  {producto.descuento.porcentaje}% OFF
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Descripción */}
                          {producto.descripcion && (
                            <p className="text-gray-600 mb-4 line-clamp-2">
                              {producto.descripcion}
                            </p>
                          )}
                          
                          {/* Características */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            {producto.envioGratis && (
                              <span className="bg-lime-100 text-lime-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                                <Truck size={12} />
                                Envío Gratis
                              </span>
                            )}
                            {producto.garantia?.tiene && (
                              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                                <Shield size={12} />
                                {producto.garantia.meses} meses garantía
                              </span>
                            )}
                            {producto.destacado && (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                                <Award size={12} />
                                Destacado
                              </span>
                            )}
                          </div>
                          
                          {/* Botones de acción */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => startEditProduct(producto)}
                              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                            >
                              <Edit3 size={16} />
                              Editar
                            </button>
                            <button
                              onClick={() => eliminarProducto(producto._id)}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                            >
                              <Trash2 size={16} />
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Ver Usuarios */}
          {activeTab === "verUsuarios" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Lista de Usuarios</h2>
                <button
                  onClick={getUsuarios}
                  className="px-6 py-3 bg-lime-500 text-white rounded-xl hover:bg-lime-600 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={18} />
                  Actualizar
                </button>
              </div>

              <div className="grid gap-4">
                {usuarios.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                    <Users className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-600 text-xl">No hay usuarios registrados</p>
                  </div>
                ) : (
                  usuarios.map((usuario) => (
                    <div
                      key={usuario._id}
                      className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {usuario.name}
                          </h3>
                          <div className="space-y-1 text-sm text-gray-600">
                            <p>{usuario.email}</p>
                            {usuario.telefono && <p>📞 {usuario.telefono}</p>}
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                usuario.role === 'admin' 
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {usuario.role || 'user'}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                usuario.isVerified 
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {usuario.isVerified ? 'Verificado' : 'No verificado'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(usuario);
                              setActiveTab("detalleUsuario");
                              getMascotasUsuario(usuario._id);
                            }}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                          >
                            <Eye size={16} />
                            Ver Mascotas
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Ver Citas */}
          {activeTab === "verCitas" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Lista de Citas</h2>
                <button
                  onClick={getCitas}
                  className="px-6 py-3 bg-lime-500 text-white rounded-xl hover:bg-lime-600 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={18} />
                  Actualizar
                </button>
              </div>

              <div className="grid gap-4">
                {citas.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                    <Calendar className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-600 text-xl">No hay citas registradas</p>
                  </div>
                ) : (
                  citas.map((cita) => (
                    <div
                      key={cita._id}
                      className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Cita #{cita._id.slice(-6)}
                          </h3>
                          {cita.usuario && (
                            <p className="text-lg text-gray-700 mb-2">
                              Cliente: {cita.usuario.name}
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          cita.estado === "confirmada" 
                            ? "bg-green-100 text-green-800"
                            : cita.estado === "cancelada"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {cita.estado?.toUpperCase() || "PENDIENTE"}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-gray-50 p-3 rounded-xl">
                            <span className="font-semibold text-gray-700 block mb-1">Fecha:</span>
                            <p className="text-gray-900">{cita.fecha ? formatearFecha(cita.fecha) : "No especificada"}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-xl">
                            <span className="font-semibold text-gray-700 block mb-1">Hora:</span>
                            <p className="text-gray-900">{cita.hora || "No especificada"}</p>
                          </div>
                        </div>

                        {cita.mascota && (
                          <div className="bg-blue-50 p-3 rounded-xl">
                            <span className="font-semibold text-blue-700 block mb-1">Mascota:</span>
                            <p className="text-blue-900">{cita.mascota.nombre} ({cita.mascota.especie})</p>
                          </div>
                        )}

                        {cita.motivo && (
                          <div className="bg-purple-50 p-3 rounded-xl">
                            <span className="font-semibold text-purple-700 block mb-1">Motivo:</span>
                            <p className="text-purple-900">{cita.motivo}</p>
                          </div>
                        )}

                        {cita.notas && (
                          <div className="bg-orange-50 p-3 rounded-xl">
                            <span className="font-semibold text-orange-700 block mb-1">Notas:</span>
                            <p className="text-orange-900">{cita.notas}</p>
                          </div>
                        )}

                        <div className="pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-400">ID: {cita._id}</p>
                          {cita.createdAt && (
                            <p className="text-xs text-gray-400">Creada: {new Date(cita.createdAt).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Detalle Usuario */}
          {activeTab === "detalleUsuario" && selectedUser && (
            <div>
              <button
                onClick={() => {
                  setActiveTab("verUsuarios");
                  setSelectedUser(null);
                }}
                className="mb-8 bg-gray-200 px-6 py-3 rounded-2xl hover:bg-gray-300 transition-colors flex items-center gap-2 font-medium"
              >
                <ArrowLeft size={18} />
                Volver a Usuarios
              </button>

              <h2 className="text-3xl font-bold text-gray-900 mb-8">
                Mascotas de {selectedUser.name}
              </h2>

              <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
                {mascotasUsuario.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-white rounded-2xl shadow-lg">
                    <Activity className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-600 text-xl">
                      Este usuario no tiene mascotas registradas
                    </p>
                  </div>
                ) : (
                  mascotasUsuario.map((mascota) => (
                    <div
                      key={mascota._id}
                      className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="font-bold text-gray-900 text-2xl">{mascota.nombre}</h3>
                          <p className="text-gray-600 text-lg">{mascota.especie} • {mascota.raza}</p>
                        </div>
                        {mascota.imagen && (
                          <img
                            src={
                              mascota.imagen.startsWith("http")
                                ? mascota.imagen
                                : `${BASE_URL}${mascota.imagen}`
                            }
                            alt={mascota.nombre}
                            className="w-24 h-24 object-cover rounded-2xl shadow-lg"
                            onError={(e) => (e.target.style.display = "none")}
                          />
                        )}
                      </div>

                      {/* Información básica */}
                      <div className="mb-8 p-6 bg-gray-50 rounded-2xl">
                        <div className="grid grid-cols-2 gap-6 text-sm">
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Edad:</span>
                            <p className="text-gray-900">{mascota.edad ? `${mascota.edad} ${mascota.unidadEdad || 'años'}` : "No especificada"}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Género:</span>
                            <p className="text-gray-900">{mascota.genero || "No especificado"}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Estado:</span>
                            <p className="text-gray-900">{mascota.estado || "No especificado"}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Peso:</span>
                            <p className="text-gray-900">{mascota.peso ? `${mascota.peso} kg` : "No especificado"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Información médica */}
                      {(mascota.enfermedades || mascota.alergias || mascota.medicamentos) && (
                        <div className="mb-6 p-4 bg-red-50 rounded-xl">
                          <h4 className="font-semibold text-red-800 mb-3">Información Médica</h4>
                          <div className="space-y-2 text-sm">
                            {mascota.enfermedades && (
                              <div>
                                <span className="font-medium text-red-700">Enfermedades:</span>
                                <p className="text-red-900">{mascota.enfermedades}</p>
                              </div>
                            )}
                            {mascota.alergias && (
                              <div>
                                <span className="font-medium text-red-700">Alergias:</span>
                                <p className="text-red-900">{mascota.alergias}</p>
                              </div>
                            )}
                            {mascota.medicamentos && (
                              <div>
                                <span className="font-medium text-red-700">Medicamentos:</span>
                                <p className="text-red-900">{mascota.medicamentos}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Vacunas */}
                      <div className="mb-6">
                        <h4 className="font-semibold text-gray-800 mb-4">Vacunas</h4>
                        {mascota.vacunas && mascota.vacunas.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {mascota.vacunas.map((vacuna, index) => (
                              <div key={index} className="bg-green-50 p-3 rounded-lg">
                                <p className="font-medium text-green-800">{vacuna.nombre}</p>
                                <p className="text-green-600 text-sm">
                                  {vacuna.fecha ? formatearFecha(vacuna.fecha) : 'Sin fecha'}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm mb-4">Sin vacunas registradas</p>
                        )}
                        
                        {/* Formulario para agregar vacuna */}
                        <details className="bg-gray-50 p-4 rounded-lg">
                          <summary className="cursor-pointer font-medium text-gray-700 mb-3">
                            Agregar Nueva Vacuna
                          </summary>
                          <form onSubmit={(e) => handleAgregarVacuna(e, mascota._id)} className="space-y-3">
                            <div>
                              <input
                                type="text"
                                name="nombre"
                                placeholder="Nombre de la vacuna"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                              />
                            </div>
                            <div>
                              <input
                                type="date"
                                name="fecha"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                              />
                            </div>
                            <button
                              type="submit"
                              className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            >
                              Agregar Vacuna
                            </button>
                          </form>
                        </details>
                      </div>

                      {/* Operaciones */}
                      <div className="mb-6">
                        <h4 className="font-semibold text-gray-800 mb-4">Operaciones</h4>
                        {mascota.operaciones && mascota.operaciones.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {mascota.operaciones.map((operacion, index) => (
                              <div key={index} className="bg-blue-50 p-3 rounded-lg">
                                <p className="font-medium text-blue-800">{operacion.nombre}</p>
                                <p className="text-blue-600 text-sm">{operacion.descripcion}</p>
                                <p className="text-blue-600 text-sm">
                                  {operacion.fecha ? formatearFecha(operacion.fecha) : 'Sin fecha'}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm mb-4">Sin operaciones registradas</p>
                        )}
                        
                        {/* Formulario para agregar operación */}
                        <details className="bg-gray-50 p-4 rounded-lg">
                          <summary className="cursor-pointer font-medium text-gray-700 mb-3">
                            Agregar Nueva Operación
                          </summary>
                          <form onSubmit={(e) => handleAgregarOperacion(e, mascota._id)} className="space-y-3">
                            <div>
                              <input
                                type="text"
                                name="nombre"
                                placeholder="Nombre de la operación"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                              />
                            </div>
                            <div>
                              <textarea
                                name="descripcion"
                                placeholder="Descripción"
                                rows="2"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                              ></textarea>
                            </div>
                            <div>
                              <input
                                type="date"
                                name="fecha"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                required
                              />
                            </div>
                            <button
                              type="submit"
                              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                              Agregar Operación
                            </button>
                          </form>
                        </details>
                      </div>

                      {/* Información adicional */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700 block mb-1">Esterilizado:</span>
                          <p className="text-gray-900">{mascota.esterilizado ? "Sí" : "No"}</p>
                        </div>
                        {mascota.microchip?.numero && (
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Microchip:</span>
                            <p className="text-gray-900">{mascota.microchip.numero}</p>
                          </div>
                        )}
                      </div>

                      {/* Historial */}
                      {mascota.historial && (
                        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                          <span className="font-semibold text-blue-700 block mb-2">Historial:</span>
                          <p className="text-blue-900 text-sm">{mascota.historial}</p>
                        </div>
                      )}

                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-400">ID: {mascota._id}</p>
                        {mascota.createdAt && (
                          <p className="text-xs text-gray-400">Registrada: {new Date(mascota.createdAt).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;