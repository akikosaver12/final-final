import React, { useState, useEffect, useRef } from "react";

const BASE_URL = "http://localhost:5000";

// 👉 Token robusto
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

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("productos");
  const [formData, setFormData] = useState({ nombre: "", precio: "", descripcion: "", imagen: null });
  const [previewImage, setPreviewImage] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [mascotasUsuario, setMascotasUsuario] = useState([]);

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState("");
  const [serverStatus, setServerStatus] = useState("checking");

  const fileRef = useRef(null);

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
    const headers = {
      ...(options.headers || {}),
    };
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

  // --- Handlers formulario ---
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files && files[0]) {
      setFormData((s) => ({ ...s, [name]: files[0] }));
      setPreviewImage(URL.createObjectURL(files[0]));
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
      data.append("nombre", formData.nombre);
      data.append("precio", formData.precio);
      data.append("descripcion", formData.descripcion);
      if (formData.imagen) {
        data.append("imagen", formData.imagen);
      }

      await fetchJSON(`${BASE_URL}/api/productos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });

      alert("✅ Producto agregado con éxito");
      setFormData({ nombre: "", precio: "", descripcion: "", imagen: null });
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

  // --- Eliminar producto ---
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

  // --- Effects ---
  useEffect(() => {
    checkServerHealth();
  }, []);

  useEffect(() => {
    if (activeTab === "verUsuarios") getUsuarios();
    if (activeTab === "verProductos") getProductos();
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

        <button onClick={() => setActiveTab("productos")}
          className={`text-left px-4 py-2 mb-2 rounded-lg ${activeTab === "productos" ? "bg-purple-900" : "hover:bg-purple-600"}`}>
          Subir Productos
        </button>
        <button onClick={() => setActiveTab("verProductos")}
          className={`text-left px-4 py-2 mb-2 rounded-lg ${activeTab === "verProductos" ? "bg-purple-900" : "hover:bg-purple-600"}`}>
          Ver Productos
        </button>
        <button onClick={() => setActiveTab("verUsuarios")}
          className={`text-left px-4 py-2 mb-2 rounded-lg ${activeTab === "verUsuarios" ? "bg-purple-900" : "hover:bg-purple-600"}`}>
          Ver Usuarios
        </button>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 p-10">
        <h1 className="text-3xl font-bold text-purple-700 mb-6">Panel de Administración</h1>
        {warn && <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded">{warn}</div>}

        {/* Subir Productos */}
        {activeTab === "productos" && (
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-md max-w-2xl space-y-6">
            <input type="text" name="nombre" placeholder="Nombre del producto"
              className="w-full border p-3 rounded text-lg" onChange={handleChange} value={formData.nombre} required />
            <input type="number" name="precio" placeholder="Precio" min="0" step="0.01"
              className="w-full border p-3 rounded text-lg" onChange={handleChange} value={formData.precio} required />
            <textarea name="descripcion" placeholder="Descripción" className="w-full border p-3 rounded text-lg"
              rows="4" onChange={handleChange} value={formData.descripcion} required />
            <input ref={fileRef} type="file" name="imagen" accept="image/*" className="w-full" onChange={handleChange} />
            {previewImage && <img src={previewImage} alt="preview" className="w-48 h-48 object-cover rounded-lg shadow" />}
            <button type="submit" className="w-full bg-purple-600 text-white py-3 rounded-lg text-lg hover:bg-purple-700 disabled:opacity-50"
              disabled={loading || serverStatus !== "online"}>
              {loading ? "Subiendo..." : "Subir Producto"}
            </button>
          </form>
        )}

        {/* Ver Productos */}
        {activeTab === "verProductos" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-purple-700">Productos</h2>
              <button onClick={getProductos} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                🔄 Recargar
              </button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {productos.length === 0 ? (
                <p className="text-gray-600">No hay productos registrados</p>
              ) : (
                productos.map((p) => (
                  <div key={p._id} className="bg-white p-4 rounded-lg shadow-md flex flex-col">
                    {p.imagen && (
                      <img src={p.imagen.startsWith("http") ? p.imagen : `${BASE_URL}${p.imagen}`}
                        alt={p.nombre} className="w-full h-40 object-cover rounded-md mb-4"
                        onError={(e) => { e.target.style.display = "none"; }} />
                    )}
                    <h3 className="font-bold text-purple-700 text-xl">{p.nombre}</h3>
                    <p className="text-gray-600">💲 ${p.precio}</p>
                    <p className="text-gray-500 mt-2 flex-1">{p.descripcion}</p>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-gray-400">ID: {p._id}</p>
                      <button onClick={() => eliminarProducto(p._id)}
                        className="w-full bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 transition-colors">
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
              <button onClick={getUsuarios} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                🔄 Recargar
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {usuarios.length === 0 ? (
                <p className="text-gray-600">No hay usuarios registrados</p>
              ) : (
                usuarios.map((u) => (
                  <div key={u._id} onClick={() => { setSelectedUser(u); setActiveTab("detalleUsuario"); getMascotasUsuario(u._id); }}
                    className="bg-white p-4 rounded-lg shadow-md cursor-pointer hover:bg-gray-50 transition-colors">
                    <h3 className="font-bold text-purple-700">{u.name}</h3>
                    <p className="text-gray-600">{u.email}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-white bg-purple-600 px-2 py-1 rounded">{u.role?.toUpperCase()}</span>
                      <span className="text-sm text-gray-500">Mascotas: {u.totalMascotas || 0}</span>
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
            <button onClick={() => { setActiveTab("verUsuarios"); setSelectedUser(null); }}
              className="mb-6 bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 transition-colors">⬅ Volver a Usuarios</button>
            <h2 className="text-2xl font-bold text-purple-700 mb-4">Mascotas de {selectedUser.name}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {mascotasUsuario.length === 0 ? (
                <p className="text-gray-600">Este usuario no tiene mascotas registradas</p>
              ) : (
                mascotasUsuario.map((m) => (
                  <div key={m._id} className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-purple-700">{m.nombre}</h3>
                      <p className="text-gray-600">{m.especie}</p>
                    </div>
                    {m.imagen && (
                      <img src={m.imagen.startsWith("http") ? m.imagen : `${BASE_URL}${m.imagen}`} alt={m.nombre}
                        className="w-16 h-16 object-cover rounded-lg"
                        onError={(e) => e.target.style.display = "none"} />
                    )}
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
