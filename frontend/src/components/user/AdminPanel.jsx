import { useState, useEffect, useRef } from "react";

const BASE_URL = "http://localhost:5000";

const AdminPanel = () => {
  // --- Obtener token robusto ---
  const getToken = () => {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw =
        localStorage.getItem("token") || localStorage.getItem("auth") || "";
      try {
        const maybe = JSON.parse(raw);
        if (maybe && typeof maybe === "object" && maybe.token) return maybe.token;
      } catch {}
      return raw;
    }
    return "";
  };

  const [activeTab, setActiveTab] = useState("productos");
  const [formData, setFormData] = useState({
    nombre: "",
    precio: "",
    descripcion: "",
    imagen: null,
    // NUEVOS CAMPOS AGREGADOS
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

  // Función para agregar vacunas
  const handleAgregarVacuna = async (e, mascotaId) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const vacuna = {
      nombre: formData.get("nombre"),
      fecha: formData.get("fecha"),
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
    const formData = new FormData(e.target);
    const operacion = {
      nombre: formData.get("nombre"),
      descripcion: formData.get("descripcion"),
      fecha: formData.get("fecha"),
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

  // --- Server Health ---
  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setWarn("");
    const isServerOnline = await checkServerHealth();
    if (!isServerOnline) {
      setWarn("❌ El servidor no está disponible.");
      return;
    }
    const token = getToken();
    if (!token) return setWarn("Debes iniciar sesión para subir productos.");

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
        data.append("imagen", formData.imagen);
      }

      await fetchJSON(`${BASE_URL}/api/productos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });

      alert("✅ Producto agregado con éxito");
      
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
      if (fileRef.current) fileRef.current.value = "";
      getProductos();
    } catch (err) {
      setWarn(`❌ Error al subir producto: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Usuarios ---
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

  // --- Productos ---
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

  // --- Citas ---
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
    if (activeTab === "verProductos") getProductos();
    if (activeTab === "verCitas") getCitas();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (previewImage) URL.revokeObjectURL(previewImage);
    };
  }, [previewImage]);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-purple-700 text-white flex flex-col p-6">
        <h2 className="text-2xl font-bold mb-4">👑 Admin</h2>

        <div
          className={`mb-6 px-3 py-2 rounded text-sm ${
            serverStatus === "online"
              ? "bg-green-600"
              : serverStatus === "offline"
              ? "bg-red-600"
              : "bg-yellow-600"
          }`}
        >
          {serverStatus === "online" && "🟢 Servidor Online"}
          {serverStatus === "offline" && "🔴 Servidor Offline"}
          {serverStatus === "checking" && "🟡 Verificando..."}
        </div>

        <button
          onClick={() => setActiveTab("productos")}
          className={`text-left px-4 py-2 mb-2 rounded-lg ${
            activeTab === "productos" ? "bg-purple-900" : "hover:bg-purple-600"
          }`}
        >
          Subir Productos
        </button>
        <button
          onClick={() => setActiveTab("verProductos")}
          className={`text-left px-4 py-2 mb-2 rounded-lg ${
            activeTab === "verProductos" ? "bg-purple-900" : "hover:bg-purple-600"
          }`}
        >
          Ver Productos
        </button>
        <button
          onClick={() => setActiveTab("verUsuarios")}
          className={`text-left px-4 py-2 mb-2 rounded-lg ${
            activeTab === "verUsuarios" ? "bg-purple-900" : "hover:bg-purple-600"
          }`}
        >
          Ver Usuarios
        </button>
        <button
          onClick={() => setActiveTab("verCitas")}
          className={`text-left px-4 py-2 mb-2 rounded-lg ${
            activeTab === "verCitas" ? "bg-purple-900" : "hover:bg-purple-600"
          }`}
        >
          Ver Citas
        </button>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 p-10">
        <h1 className="text-3xl font-bold text-purple-700 mb-6">
          Panel de Administración
        </h1>

        {warn && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded">
            {warn}
          </div>
        )}

        {/* Subir Productos - FORMULARIO ACTUALIZADO */}
        {activeTab === "productos" && (
          <form
            onSubmit={handleSubmit}
            className="bg-white p-8 rounded-xl shadow-md max-w-4xl space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información básica */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-700">Información Básica</h3>
                
                <input
                  type="text"
                  name="nombre"
                  placeholder="Nombre del producto"
                  className="w-full border p-3 rounded text-lg"
                  onChange={handleChange}
                  value={formData.nombre}
                  required
                />
                
                <textarea
                  name="descripcion"
                  placeholder="Descripción"
                  className="w-full border p-3 rounded text-lg"
                  rows="3"
                  onChange={handleChange}
                  value={formData.descripcion}
                  required
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    name="precio"
                    placeholder="Precio"
                    min="0"
                    step="0.01"
                    className="w-full border p-3 rounded text-lg"
                    onChange={handleChange}
                    value={formData.precio}
                    required
                  />
                  <input
                    type="number"
                    name="stock"
                    placeholder="Stock"
                    min="0"
                    className="w-full border p-3 rounded text-lg"
                    onChange={handleChange}
                    value={formData.stock}
                  />
                </div>
                
                <select
                  name="categoria"
                  className="w-full border p-3 rounded text-lg"
                  onChange={handleChange}
                  value={formData.categoria}
                  required
                >
                  {categorias.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                
                <input
                  ref={fileRef}
                  type="file"
                  name="imagen"
                  accept="image/*"
                  className="w-full"
                  onChange={handleChange}
                />
                
                {previewImage && (
                  <img
                    src={previewImage}
                    alt="preview"
                    className="w-32 h-32 object-cover rounded-lg shadow"
                  />
                )}
              </div>
              
              {/* Opciones avanzadas */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-700">Opciones Avanzadas</h3>
                
                {/* Envío gratis */}
                <label className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    name="envioGratis"
                    checked={formData.envioGratis}
                    onChange={handleChange}
                    className="w-5 h-5 text-green-600"
                  />
                  <span className="text-green-800 font-medium">🚚 Envío Gratis</span>
                </label>
                
                {/* Descuento */}
                <div className="p-4 bg-orange-50 rounded-lg">
                  <label className="flex items-center space-x-3 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="tieneDescuento"
                      checked={formData.tieneDescuento}
                      onChange={handleChange}
                      className="w-5 h-5 text-orange-600"
                    />
                    <span className="text-orange-800 font-medium">🏷️ Tiene Descuento</span>
                  </label>
                  
                  {formData.tieneDescuento && (
                    <div className="space-y-3">
                      <input
                        type="number"
                        name="porcentajeDescuento"
                        placeholder="% de descuento"
                        min="1"
                        max="100"
                        className="w-full border p-2 rounded"
                        onChange={handleChange}
                        value={formData.porcentajeDescuento}
                        required={formData.tieneDescuento}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          name="fechaInicioDescuento"
                          placeholder="Fecha inicio"
                          className="w-full border p-2 rounded text-sm"
                          onChange={handleChange}
                          value={formData.fechaInicioDescuento}
                        />
                        <input
                          type="date"
                          name="fechaFinDescuento"
                          placeholder="Fecha fin"
                          className="w-full border p-2 rounded text-sm"
                          onChange={handleChange}
                          value={formData.fechaFinDescuento}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Garantía */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <label className="flex items-center space-x-3 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="tieneGarantia"
                      checked={formData.tieneGarantia}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600"
                    />
                    <span className="text-blue-800 font-medium">🛡️ Tiene Garantía</span>
                  </label>
                  
                  {formData.tieneGarantia && (
                    <div className="space-y-3">
                      <input
                        type="number"
                        name="mesesGarantia"
                        placeholder="Meses de garantía"
                        min="1"
                        max="120"
                        className="w-full border p-2 rounded"
                        onChange={handleChange}
                        value={formData.mesesGarantia}
                        required={formData.tieneGarantia}
                      />
                      <textarea
                        name="descripcionGarantia"
                        placeholder="Descripción de la garantía"
                        className="w-full border p-2 rounded text-sm"
                        rows="2"
                        onChange={handleChange}
                        value={formData.descripcionGarantia}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-3 rounded-lg text-lg hover:bg-purple-700 disabled:opacity-50"
              disabled={loading || serverStatus !== "online"}
            >
              {loading ? "Subiendo..." : "Subir Producto"}
            </button>
          </form>
        )}

        {/* Ver Productos - VISTA ACTUALIZADA */}
        {activeTab === "verProductos" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-purple-700">Productos</h2>
              <button
                onClick={getProductos}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                🔄 Recargar
              </button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {productos.length === 0 ? (
                <p className="text-gray-600">No hay productos registrados</p>
              ) : (
                productos.map((p) => (
                  <div
                    key={p._id}
                    className="bg-white p-4 rounded-lg shadow-md flex flex-col"
                  >
                    {p.imagen && (
                      <img
                        src={
                          p.imagen.startsWith("http")
                            ? p.imagen
                            : `${BASE_URL}${p.imagen}`
                        }
                        alt={p.nombre}
                        className="w-full h-40 object-cover rounded-md mb-4"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    
                    {/* Header con badges */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.envioGratis && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          🚚 Envío Gratis
                        </span>
                      )}
                      {p.descuentoVigente && (
                        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                          🏷️ -{p.descuento.porcentaje}%
                        </span>
                      )}
                      {p.garantia?.tiene && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          🛡️ Garantía
                        </span>
                      )}
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                        {categorias.find(cat => cat.value === p.categoria)?.label || p.categoria}
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-purple-700 text-xl mb-2">
                      {p.nombre}
                    </h3>
                    
                    {/* Precios */}
                    <div className="mb-2">
                      {p.descuentoVigente ? (
                        <div>
                          <span className="text-lg font-bold text-green-600">
                            {formatearPrecio(p.precioConDescuento)}
                          </span>
                          <span className="text-sm text-gray-500 line-through ml-2">
                            {formatearPrecio(p.precio)}
                          </span>
                          <div className="text-xs text-green-600">
                            Ahorras: {formatearPrecio(p.ahorroDescuento)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-lg font-bold text-gray-700">
                          {formatearPrecio(p.precio)}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-500 text-sm flex-1 mb-3">{p.descripcion}</p>
                    
                    {/* Información adicional */}
                    <div className="space-y-2 text-xs text-gray-600 mb-4">
                      <div className="flex justify-between">
                        <span>Stock:</span>
                        <span className={p.stock <= 0 ? "text-red-600" : "text-green-600"}>
                          {p.stock || 0} unidades
                        </span>
                      </div>
                      
                      {p.garantia?.tiene && (
                        <div className="flex justify-between">
                          <span>Garantía:</span>
                          <span>{p.garantia.meses} meses</span>
                        </div>
                      )}
                      
                      {p.descuento?.tiene && (
                        <div className="text-xs">
                          <div className="flex justify-between">
                            <span>Descuento:</span>
                            <span>{p.descuento.porcentaje}%</span>
                          </div>
                          {p.descuento.fechaInicio && (
                            <div className="text-gray-500">
                              Desde: {formatearFecha(p.descuento.fechaInicio)}
                            </div>
                          )}
                          {p.descuento.fechaFin && (
                            <div className="text-gray-500">
                              Hasta: {formatearFecha(p.descuento.fechaFin)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-auto space-y-2">
                      <p className="text-xs text-gray-400">ID: {p._id}</p>
                      <button
                        onClick={() => eliminarProducto(p._id)}
                        className="w-full bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 transition-colors"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Ver Usuarios */}
        {activeTab === "verUsuarios" && !selectedUser && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-purple-700">Usuarios</h2>
              <button
                onClick={getUsuarios}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                🔄 Recargar
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {usuarios.length === 0 ? (
                <p className="text-gray-600">No hay usuarios registrados</p>
              ) : (
                usuarios.map((u) => (
                  <div
                    key={u._id}
                    onClick={() => {
                      setSelectedUser(u);
                      setActiveTab("detalleUsuario");
                      getMascotasUsuario(u._id);
                    }}
                    className="bg-white p-4 rounded-lg shadow-md cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="font-bold text-purple-700">{u.name}</h3>
                    <p className="text-gray-600">{u.email}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-white bg-purple-600 px-2 py-1 rounded">
                        {u.role?.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        Mascotas: {u.totalMascotas || 0}
                      </span>
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-purple-700">Citas</h2>
              <button
                onClick={getCitas}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                🔄 Recargar
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
              {citas.length === 0 ? (
                <p className="text-gray-600">No hay citas registradas</p>
              ) : (
                citas.map((c) => (
                  <div
                    key={c._id}
                    className="bg-white p-6 rounded-lg shadow-md"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-purple-700 text-xl">
                          {c.usuario?.name || "Usuario no especificado"}
                        </h3>
                        <p className="text-gray-600">{c.usuario?.email}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        c.estado === "confirmada" ? "bg-green-100 text-green-800" :
                        c.estado === "pendiente" ? "bg-yellow-100 text-yellow-800" :
                        c.estado === "cancelada" ? "bg-red-100 text-red-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {c.estado?.toUpperCase() || "PENDIENTE"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">Fecha:</span>
                          <p className="text-gray-600">{c.fecha ? new Date(c.fecha).toLocaleDateString() : "No especificada"}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Hora:</span>
                          <p className="text-gray-600">{c.hora || "No especificada"}</p>
                        </div>
                      </div>

                      {c.mascota && (
                        <div>
                          <span className="font-semibold text-gray-700">Mascota:</span>
                          <p className="text-gray-600">{c.mascota.nombre} ({c.mascota.especie})</p>
                        </div>
                      )}

                      {c.motivo && (
                        <div>
                          <span className="font-semibold text-gray-700">Motivo:</span>
                          <p className="text-gray-600">{c.motivo}</p>
                        </div>
                      )}

                      {c.notas && (
                        <div>
                          <span className="font-semibold text-gray-700">Notas:</span>
                          <p className="text-gray-600">{c.notas}</p>
                        </div>
                      )}

                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-400">ID: {c._id}</p>
                        {c.createdAt && (
                          <p className="text-xs text-gray-400">Creada: {new Date(c.createdAt).toLocaleString()}</p>
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
              className="mb-6 bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
            >
              ⬅ Volver a Usuarios
            </button>

            <h2 className="text-2xl font-bold text-purple-700 mb-4">
              Mascotas de {selectedUser.name}
            </h2>

            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {mascotasUsuario.length === 0 ? (
                <p className="text-gray-600">
                  Este usuario no tiene mascotas registradas
                </p>
              ) : (
                mascotasUsuario.map((m) => (
                  <div
                    key={m._id}
                    className="bg-white p-6 rounded-lg shadow-md"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-purple-700 text-xl">{m.nombre}</h3>
                        <p className="text-gray-600">{m.especie} • {m.raza}</p>
                      </div>
                      {m.imagen && (
                        <img
                          src={
                            m.imagen.startsWith("http")
                              ? m.imagen
                              : `${BASE_URL}${m.imagen}`
                          }
                          alt={m.nombre}
                          className="w-20 h-20 object-cover rounded-lg"
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      )}
                    </div>

                    {/* Información básica */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">Edad:</span>
                          <p className="text-gray-600">{m.edad ? `${m.edad} años` : "No especificada"}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Género:</span>
                          <p className="text-gray-600">{m.genero || "No especificado"}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Estado:</span>
                          <p className="text-gray-600">{m.estado || "No especificado"}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Enfermedades:</span>
                          <p className="text-gray-600">{m.enfermedades || "Ninguna"}</p>
                        </div>
                      </div>
                      {m.historial && (
                        <div className="mt-4">
                          <span className="font-semibold text-gray-700">Historial:</span>
                          <p className="text-gray-600 mt-1">{m.historial}</p>
                        </div>
                      )}
                    </div>

                    {/* Sección de vacunas */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-purple-600 mb-3 text-lg">Vacunas</h4>
                      {m.vacunas && m.vacunas.length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {m.vacunas.map((v, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-green-50 rounded">
                              <span className="font-medium text-green-800">{v.nombre}</span>
                              <span className="text-green-600 text-sm">{new Date(v.fecha).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 mb-4">No hay vacunas registradas</p>
                      )}
                      <form
                        className="grid grid-cols-1 md:grid-cols-3 gap-2"
                        onSubmit={(e) => handleAgregarVacuna(e, m._id)}
                      >
                        <input
                          type="text"
                          name="nombre"
                          placeholder="Nombre vacuna"
                          className="border rounded px-3 py-2 text-sm"
                          required
                        />
                        <input
                          type="date"
                          name="fecha"
                          className="border rounded px-3 py-2 text-sm"
                          required
                        />
                        <button
                          type="submit"
                          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm font-medium"
                        >
                          Agregar Vacuna
                        </button>
                      </form>
                    </div>

                    {/* Sección de operaciones */}
                    <div>
                      <h4 className="font-semibold text-purple-600 mb-3 text-lg">Operaciones</h4>
                      {m.operaciones && m.operaciones.length > 0 ? (
                        <div className="space-y-3 mb-4">
                          {m.operaciones.map((op, idx) => (
                            <div key={idx} className="p-3 bg-blue-50 rounded">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-blue-800">{op.nombre}</span>
                                <span className="text-blue-600 text-sm">{new Date(op.fecha).toLocaleDateString()}</span>
                              </div>
                              <p className="text-blue-700 text-sm">{op.descripcion}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 mb-4">No hay operaciones registradas</p>
                      )}
                      <form
                        className="space-y-2"
                        onSubmit={(e) => handleAgregarOperacion(e, m._id)}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            type="text"
                            name="nombre"
                            placeholder="Nombre operación"
                            className="border rounded px-3 py-2 text-sm"
                            required
                          />
                          <input
                            type="date"
                            name="fecha"
                            className="border rounded px-3 py-2 text-sm"
                            required
                          />
                        </div>
                        <textarea
                          name="descripcion"
                          placeholder="Descripción de la operación"
                          className="w-full border rounded px-3 py-2 text-sm"
                          rows="2"
                          required
                        />
                        <button
                          type="submit"
                          className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm font-medium"
                        >
                          Agregar Operación
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;