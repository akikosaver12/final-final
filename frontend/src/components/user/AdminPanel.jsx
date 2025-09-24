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

  // --- Estados principales ---
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
  
  // Estado para edición
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
  
  // Refs
  const fileRef = useRef(null);

  // --- Funciones de servidor ---
  const checkServerHealth = async () => {
    try {
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

  // --- Fetch helper ---
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

  // --- Funciones de edición ---
  const startEditProduct = (producto) => {
    setIsEditMode(true);
    setEditingProduct(producto);
    setActiveTab("productos");
    
    // Llenar el formulario con los datos del producto
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
    
    // Limpiar preview de imagen
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
      setPreviewImage(null);
    }
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    setEditingProduct(null);
    
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
    
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
      setPreviewImage(null);
    }
    
    if (fileRef.current) fileRef.current.value = "";
  };

  // --- Handlers del formulario ---
  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    
    if (files && files[0]) {
      setFormData((s) => ({ ...s, [name]: files[0] }));
      if (previewImage) URL.revokeObjectURL(previewImage);
      setPreviewImage(URL.createObjectURL(files[0]));
    } else if (type === 'checkbox') {
      setFormData((s) => ({ ...s, [name]: checked }));
    } else {
      setFormData((s) => ({ ...s, [name]: value }));
    }
  };

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
        data.append("imagen", formData.imagen);
      }

      // Determinar si es crear o editar
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
      
      // Reset y reload
      cancelEdit();
      getProductos();
      
    } catch (err) {
      setWarn(`❌ Error al ${isEditMode ? 'actualizar' : 'crear'} producto: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Funciones de datos ---
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
      
      const data = await fetchJSON(`${BASE_URL}/api/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setUsuarios(data);
    } catch (error) {
      setWarn(`No se pudieron cargar los usuarios: ${error.message}`);
    }
  };

  const getMascotasUsuario = async (userId) => {
    setWarn("");
    try {
      const token = getToken();
      if (!token) return setWarn("Debes iniciar sesión para ver mascotas.");
      
      const data = await fetchJSON(`${BASE_URL}/api/usuarios/${userId}/mascotas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setMascotasUsuario(data.mascotas || []);
    } catch (error) {
      setWarn(`No se pudieron cargar las mascotas: ${error.message}`);
    }
  };

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

  // --- Utility Functions ---
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

  // --- Effects ---
  useEffect(() => {
    checkServerHealth();
    getCategorias();
  }, []);

  useEffect(() => {
    if (activeTab === "verUsuarios") getUsuarios();
    else if (activeTab === "verProductos") getProductos();
    else if (activeTab === "verCitas") getCitas();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (previewImage) URL.revokeObjectURL(previewImage);
    };
  }, [previewImage]);

  // --- Configuración del Sidebar ---
  const sidebarItems = [
    { id: "productos", label: isEditMode ? "Editar Producto" : "Crear Producto", icon: Plus },
    { id: "verProductos", label: "Ver Productos", icon: Package },
    { id: "verUsuarios", label: "Ver Usuarios", icon: Users },
    { id: "verCitas", label: "Ver Citas", icon: Calendar },
  ];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Sidebar Moderno */}
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
            <div className={`px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-3 ${
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

          {warn && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-center gap-3">
              <AlertCircle className="text-yellow-600" size={20} />
              <span className="text-yellow-800">{warn}</span>
            </div>
          )}

          {/* ===== FORMULARIO PRODUCTOS ===== */}
          {activeTab === "productos" && (
            <div>
              {/* Header con botón cancelar para edición */}
              {isEditMode && (
                <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-semibold text-blue-800 mb-2 flex items-center gap-3">
                        <Edit3 className="text-blue-600" size={24} />
                        ✏️ Editando: {editingProduct?.nombre}
                      </h3>
                      <p className="text-blue-600">
                        Modifica los campos que desees actualizar
                      </p>
                    </div>
                    <button
                      onClick={cancelEdit}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-2xl flex items-center gap-2 transition-colors"
                    >
                      <X size={16} />
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl shadow-2xl p-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    {isEditMode ? "✏️ Editar Producto" : "➕ Crear Nuevo Producto"}
                  </h2>
                  <div className="w-16 h-1 bg-gradient-to-r from-lime-400 to-lime-500 rounded-full"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Información básica */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        Nombre del Producto *
                      </label>
                      <input
                        type="text"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        className="w-full border-2 border-gray-200 p-3 rounded-2xl focus:ring-2 focus:ring-lime-400 focus:border-lime-400 transition-all duration-200"
                        placeholder="Ej: Alimento Premium para Perros"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        Precio (COP) *
                      </label>
                      <input
                        type="number"
                        name="precio"
                        value={formData.precio}
                        onChange={handleChange}
                        className="w-full border-2 border-gray-200 p-3 rounded-2xl focus:ring-2 focus:ring-lime-400 focus:border-lime-400 transition-all duration-200"
                        placeholder="50000"
                        min="0"
                        step="100"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        Categoría
                      </label>
                      <select
                        name="categoria"
                        value={formData.categoria}
                        onChange={handleChange}
                        className="w-full border-2 border-gray-200 p-3 rounded-2xl focus:ring-2 focus:ring-lime-400 focus:border-lime-400 transition-all duration-200"
                      >
                        {categorias.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        Stock disponible
                      </label>
                      <input
                        type="number"
                        name="stock"
                        value={formData.stock}
                        onChange={handleChange}
                        className="w-full border-2 border-gray-200 p-3 rounded-2xl focus:ring-2 focus:ring-lime-400 focus:border-lime-400 transition-all duration-200"
                        placeholder="100"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Descripción
                    </label>
                    <textarea
                      name="descripcion"
                      value={formData.descripcion}
                      onChange={handleChange}
                      className="w-full border-2 border-gray-200 p-3 rounded-2xl focus:ring-2 focus:ring-lime-400 focus:border-lime-400 transition-all duration-200 h-32"
                      placeholder="Descripción detallada del producto..."
                      required
                    />
                  </div>

                  {/* Imagen */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      {isEditMode ? "Cambiar imagen (opcional)" : "Imagen del producto"}
                    </label>
                    <input
                      ref={fileRef}
                      type="file"
                      name="imagen"
                      accept="image/*"
                      className="w-full border-2 border-gray-200 p-3 rounded-2xl focus:ring-2 focus:ring-lime-400 focus:border-lime-400 transition-all duration-200"
                      onChange={handleChange}
                    />
                    
                    {/* Imagen actual en modo edición */}
                    {isEditMode && !previewImage && editingProduct?.imagen && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">Imagen actual:</p>
                        <img
                          src={
                            editingProduct.imagen.startsWith("http")
                              ? editingProduct.imagen
                              : `${BASE_URL}${editingProduct.imagen}`
                          }
                          alt="Imagen actual"
                          className="w-40 h-40 object-cover rounded-2xl shadow-lg"
                        />
                      </div>
                    )}
                    
                    {/* Preview de nueva imagen */}
                    {previewImage && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">
                          {isEditMode ? "Nueva imagen:" : "Vista previa:"}
                        </p>
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="w-40 h-40 object-cover rounded-2xl shadow-lg"
                        />
                      </div>
                    )}
                  </div>

                  {/* Opciones adicionales */}
                  <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-gray-800 mb-4">Opciones Adicionales</h3>
                    
                    {/* Envío gratis */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="envioGratis"
                        checked={formData.envioGratis}
                        onChange={handleChange}
                        className="mr-3 w-4 h-4"
                      />
                      <label className="text-gray-700">
                        🚚 Envío gratis
                      </label>
                    </div>

                    {/* Descuento */}
                    <div>
                      <div className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          name="tieneDescuento"
                          checked={formData.tieneDescuento}
                          onChange={handleChange}
                          className="mr-3 w-4 h-4"
                        />
                        <label className="text-gray-700">
                          🏷️ Aplicar descuento
                        </label>
                      </div>

                      {formData.tieneDescuento && (
                        <div className="ml-7 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-gray-600 text-sm mb-1">
                              Porcentaje %
                            </label>
                            <input
                              type="number"
                              name="porcentajeDescuento"
                              value={formData.porcentajeDescuento}
                              onChange={handleChange}
                              className="w-full border border-gray-200 p-2 rounded-xl text-sm"
                              placeholder="15"
                              min="1"
                              max="99"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600 text-sm mb-1">
                              Fecha inicio
                            </label>
                            <input
                              type="date"
                              name="fechaInicioDescuento"
                              value={formData.fechaInicioDescuento}
                              onChange={handleChange}
                              className="w-full border border-gray-200 p-2 rounded-xl text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600 text-sm mb-1">
                              Fecha fin
                            </label>
                            <input
                              type="date"
                              name="fechaFinDescuento"
                              value={formData.fechaFinDescuento}
                              onChange={handleChange}
                              className="w-full border border-gray-200 p-2 rounded-xl text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Garantía */}
                    <div>
                      <div className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          name="tieneGarantia"
                          checked={formData.tieneGarantia}
                          onChange={handleChange}
                          className="mr-3 w-4 h-4"
                        />
                        <label className="text-gray-700">
                          🛡️ Incluir garantía
                        </label>
                      </div>

                      {formData.tieneGarantia && (
                        <div className="ml-7 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-gray-600 text-sm mb-1">
                              Meses de garantía
                            </label>
                            <input
                              type="number"
                              name="mesesGarantia"
                              value={formData.mesesGarantia}
                              onChange={handleChange}
                              className="w-full border border-gray-200 p-2 rounded-xl text-sm"
                              placeholder="12"
                              min="1"
                              max="60"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600 text-sm mb-1">
                              Descripción de garantía
                            </label>
                            <input
                              type="text"
                              name="descripcionGarantia"
                              value={formData.descripcionGarantia}
                              onChange={handleChange}
                              className="w-full border border-gray-200 p-2 rounded-xl text-sm"
                              placeholder="Garantía contra defectos de fabricación"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón enviar */}
                  <div className="flex justify-end pt-6">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`px-8 py-4 rounded-2xl font-medium text-white flex items-center gap-3 text-lg shadow-xl transition-all duration-300 ${
                        loading
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-lime-400 to-lime-500 hover:from-lime-500 hover:to-lime-600 hover:shadow-2xl transform hover:-translate-y-1"
                      }`}
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="animate-spin" size={20} />
                          {isEditMode ? "Actualizando..." : "Creando..."}
                        </>
                      ) : (
                        <>
                          {isEditMode ? <Save size={20} /> : <Plus size={20} />}
                          {isEditMode ? "Actualizar Producto" : "Crear Producto"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ===== VER PRODUCTOS ===== */}
          {activeTab === "verProductos" && (
            <div>
              <div className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    📦 Productos Registrados
                  </h2>
                  <div className="w-16 h-1 bg-gradient-to-r from-lime-400 to-lime-500 rounded-full"></div>
                </div>
                <button
                  onClick={getProductos}
                  className="bg-lime-500 hover:bg-lime-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-colors shadow-lg"
                >
                  <RefreshCw size={18} />
                  Actualizar
                </button>
              </div>

              <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {productos.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Package className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-600 text-xl">No hay productos registrados</p>
                  </div>
                ) : (
                  productos.map((p) => (
                    <div
                      key={p._id}
                      className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300"
                    >
                      {/* Imagen del producto */}
                      {p.imagen && (
                        <div className="mb-6">
                          <img
                            src={
                              p.imagen.startsWith("http")
                                ? p.imagen
                                : `${BASE_URL}${p.imagen}`
                            }
                            alt={p.nombre}
                            className="w-full h-48 object-cover rounded-2xl shadow-md"
                            onError={(e) => (e.target.style.display = "none")}
                          />
                        </div>
                      )}

                      <div className="mb-4">
                        <h3 className="font-bold text-gray-900 text-xl mb-2">{p.nombre}</h3>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl font-bold text-lime-600">
                            {formatearPrecio(p.precio)}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            p.categoria === 'alimento' ? 'bg-green-100 text-green-800' :
                            p.categoria === 'juguetes' ? 'bg-purple-100 text-purple-800' :
                            p.categoria === 'medicamentos' ? 'bg-red-100 text-red-800' :
                            p.categoria === 'accesorios' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {p.categoria?.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 text-sm">
                        <p className="text-gray-600 line-clamp-3">
                          {p.descripcion}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 p-2 rounded-xl">
                            <span className="font-semibold text-gray-700 block">Stock:</span>
                            <p className="text-gray-900">{p.stock || "No especificado"}</p>
                          </div>
                          
                          {p.descuento?.tiene && (
                            <div className="bg-red-50 p-2 rounded-xl">
                              <span className="font-semibold text-red-700 block">Descuento:</span>
                              <p className="text-red-900">{p.descuento.porcentaje}% OFF</p>
                            </div>
                          )}
                        </div>

                        {p.envioGratis && (
                          <div className="bg-green-50 p-2 rounded-xl">
                            <span className="text-green-800 font-medium flex items-center gap-2">
                              <Truck size={16} />
                              Envío gratis
                            </span>
                          </div>
                        )}

                        {p.garantia?.tiene && (
                          <div className="bg-blue-50 p-2 rounded-xl">
                            <span className="text-blue-800 font-medium flex items-center gap-2">
                              <Shield size={16} />
                              Garantía {p.garantia.meses} meses
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Botones de acción */}
                      <div className="flex gap-2 mt-6">
                        <button
                          onClick={() => startEditProduct(p)}
                          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
                        >
                          <Edit3 size={16} />
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarProducto(p._id)}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
                        >
                          <Trash2 size={16} />
                          Eliminar
                        </button>
                      </div>

                      <div className="pt-4 mt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-400">ID: {p._id}</p>
                        {p.createdAt && (
                          <p className="text-xs text-gray-400">
                            Creado: {new Date(p.createdAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ===== VER USUARIOS ===== */}
          {activeTab === "verUsuarios" && (
            <div>
              <div className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    👥 Usuarios Registrados
                  </h2>
                  <div className="w-16 h-1 bg-gradient-to-r from-lime-400 to-lime-500 rounded-full"></div>
                </div>
                <button
                  onClick={getUsuarios}
                  className="bg-lime-500 hover:bg-lime-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-colors shadow-lg"
                >
                  <RefreshCw size={18} />
                  Actualizar
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {usuarios.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Users className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-600 text-xl">No hay usuarios registrados</p>
                  </div>
                ) : (
                  usuarios.map((u) => (
                    <div
                      key={u._id}
                      onClick={() => {
                        setSelectedUser(u);
                        setActiveTab("detalleUsuario");
                        getMascotasUsuario(u._id);
                      }}
                      className="bg-white p-6 rounded-2xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-purple-500 rounded-2xl flex items-center justify-center">
                          <Users className="text-white" size={20} />
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {u.role?.toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 text-xl mb-2">{u.name}</h3>
                        <div className="space-y-2 text-sm">
                          <div className="bg-gray-50 p-3 rounded-xl">
                            <span className="font-semibold text-gray-700 block mb-1">Email:</span>
                            <p className="text-gray-900 break-all">{u.email}</p>
                          </div>
                          
                          {u.telefono && (
                            <div className="bg-gray-50 p-3 rounded-xl">
                              <span className="font-semibold text-gray-700 block mb-1">Teléfono:</span>
                              <p className="text-gray-900">{u.telefono}</p>
                            </div>
                          )}
                          
                          {u.direccion && (
                            <div className="bg-gray-50 p-3 rounded-xl">
                              <span className="font-semibold text-gray-700 block mb-1">Dirección:</span>
                              <p className="text-gray-900">
                                {u.direccion.ciudad}, {u.direccion.estado}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-400">ID: {u._id}</p>
                          {u.createdAt && (
                            <p className="text-xs text-gray-400">
                              Registro: {new Date(u.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-center">
                          <span className="text-sm text-purple-600 font-medium flex items-center gap-2">
                            <Eye size={16} />
                            Click para ver mascotas
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ===== VER CITAS ===== */}
          {activeTab === "verCitas" && (
            <div>
              <div className="mb-8 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    📅 Citas Agendadas
                  </h2>
                  <div className="w-16 h-1 bg-gradient-to-r from-lime-400 to-lime-500 rounded-full"></div>
                </div>
                <button
                  onClick={getCitas}
                  className="bg-lime-500 hover:bg-lime-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-colors shadow-lg"
                >
                  <RefreshCw size={18} />
                  Actualizar
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {citas.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Calendar className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-600 text-xl">No hay citas agendadas</p>
                  </div>
                ) : (
                  citas.map((c) => (
                    <div
                      key={c._id}
                      className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-2xl flex items-center justify-center">
                          <Calendar className="text-white" size={20} />
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          c.estado === 'confirmada' ? 'bg-green-100 text-green-800' :
                          c.estado === 'cancelada' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {c.estado?.toUpperCase() || "PENDIENTE"}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-gray-50 p-3 rounded-xl">
                            <span className="font-semibold text-gray-700 block mb-1">Fecha:</span>
                            <p className="text-gray-900">
                              {c.fecha ? new Date(c.fecha).toLocaleDateString() : "No especificada"}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-xl">
                            <span className="font-semibold text-gray-700 block mb-1">Hora:</span>
                            <p className="text-gray-900">{c.hora || "No especificada"}</p>
                          </div>
                        </div>

                        {c.mascota && (
                          <div className="bg-blue-50 p-3 rounded-xl">
                            <span className="font-semibold text-blue-700 block mb-1">Mascota:</span>
                            <p className="text-blue-900">{c.mascota.nombre} ({c.mascota.especie})</p>
                          </div>
                        )}

                        {c.motivo && (
                          <div className="bg-purple-50 p-3 rounded-xl">
                            <span className="font-semibold text-purple-700 block mb-1">Motivo:</span>
                            <p className="text-purple-900">{c.motivo}</p>
                          </div>
                        )}

                        {c.notas && (
                          <div className="bg-orange-50 p-3 rounded-xl">
                            <span className="font-semibold text-orange-700 block mb-1">Notas:</span>
                            <p className="text-orange-900">{c.notas}</p>
                          </div>
                        )}

                        <div className="pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-400">ID: {c._id}</p>
                          {c.createdAt && (
                            <p className="text-xs text-gray-400">
                              Creada: {new Date(c.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ===== DETALLE USUARIO ===== */}
          {activeTab === "detalleUsuario" && selectedUser && (
            <div>
              <button
                onClick={() => {
                  setActiveTab("verUsuarios");
                  setSelectedUser(null);
                  setMascotasUsuario([]);
                }}
                className="mb-8 bg-gray-200 px-6 py-3 rounded-2xl hover:bg-gray-300 transition-colors flex items-center gap-2 font-medium"
              >
                <ArrowLeft size={18} />
                Volver a Usuarios
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  🐾 Mascotas de {selectedUser.name}
                </h2>
                <div className="w-16 h-1 bg-gradient-to-r from-lime-400 to-lime-500 rounded-full"></div>
              </div>

              <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
                {mascotasUsuario.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-white rounded-2xl shadow-lg">
                    <Activity className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-600 text-xl">
                      Este usuario no tiene mascotas registradas
                    </p>
                  </div>
                ) : (
                  mascotasUsuario.map((m) => (
                    <div
                      key={m._id}
                      className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="font-bold text-gray-900 text-2xl">{m.nombre}</h3>
                          <p className="text-gray-600 text-lg">{m.especie} • {m.raza}</p>
                        </div>
                        {m.imagen && (
                          <img
                            src={
                              m.imagen.startsWith("http")
                                ? m.imagen
                                : `${BASE_URL}${m.imagen}`
                            }
                            alt={m.nombre}
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
                            <p className="text-gray-900">
                              {m.edad ? `${m.edad} años` : "No especificada"}
                            </p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Género:</span>
                            <p className="text-gray-900">{m.genero || "No especificado"}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Estado:</span>
                            <p className="text-gray-900">{m.estado || "No especificado"}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Enfermedades:</span>
                            <p className="text-gray-900">{m.enfermedades || "Ninguna"}</p>
                          </div>
                        </div>
                        
                        {m.historial && (
                          <div className="mt-6">
                            <span className="font-semibold text-gray-700 block mb-2">Historial:</span>
                            <p className="text-gray-900">{m.historial}</p>
                          </div>
                        )}
                      </div>

                      {/* Sección de vacunas */}
                      <div className="mb-8">
                        <h4 className="font-semibold text-green-700 mb-4 text-xl">💉 Vacunas</h4>
                        {m.vacunas && m.vacunas.length > 0 ? (
                          <div className="space-y-3">
                            {m.vacunas.map((vacuna, idx) => (
                              <div key={idx} className="bg-green-50 p-4 rounded-xl border border-green-200">
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="font-semibold text-green-800">{vacuna.nombre}</h5>
                                  {vacuna.fecha && (
                                    <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded-lg">
                                      {formatearFecha(vacuna.fecha)}
                                    </span>
                                  )}
                                </div>
                                {vacuna.notas && (
                                  <p className="text-green-700 text-sm">{vacuna.notas}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">No hay vacunas registradas</p>
                        )}
                      </div>

                      {/* Sección de operaciones */}
                      <div>
                        <h4 className="font-semibold text-orange-700 mb-4 text-xl">🏥 Operaciones</h4>
                        {m.operaciones && m.operaciones.length > 0 ? (
                          <div className="space-y-3">
                            {m.operaciones.map((op, idx) => (
                              <div key={idx} className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="font-semibold text-orange-800">{op.nombre}</h5>
                                  {op.fecha && (
                                    <span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">
                                      {formatearFecha(op.fecha)}
                                    </span>
                                  )}
                                </div>
                                {op.notas && (
                                  <p className="text-orange-700 text-sm">{op.notas}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">No hay operaciones registradas</p>
                        )}
                      </div>

                      <div className="pt-6 mt-6 border-t border-gray-200">
                        <p className="text-xs text-gray-400">ID: {m._id}</p>
                        {m.createdAt && (
                          <p className="text-xs text-gray-400">
                            Registrada: {new Date(m.createdAt).toLocaleString()}
                          </p>
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