import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Mascota {
  _id: string;
  nombre: string;
  edad: string;
  genero: string;
  raza: string;
  estado: string;
  imagen?: string;
  especie?: string;
  enfermedades?: string;
  historial?: string;
}

const MascotaCard = () => {
  const navigate = useNavigate();
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchMascotas = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");
        
        if (!token) {
          setError("No estás autenticado. Por favor inicia sesión.");
          navigate("/login");
          return;
        }

        console.log("🐾 Obteniendo mascotas del usuario...");

        const res = await fetch("http://localhost:5000/api/mascotas", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("📥 Status respuesta mascotas:", res.status);

        if (!res.ok) {
          if (res.status === 401) {
            setError("Sesión expirada. Por favor inicia sesión nuevamente.");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
            return;
          }
          
          if (res.status === 500) {
            setError("Error interno del servidor. Por favor intenta más tarde.");
            return;
          }

          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        console.log("📥 Mascotas recibidas:", data);

        setMascotas(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("❌ Error obteniendo mascotas:", err);
        setError(err.message || "Error al obtener mascotas");
      } finally {
        setLoading(false);
      }
    };

    fetchMascotas();
  }, [navigate]);

  const irADetalle = (id: string) => {
    navigate(`/mascota/${id}`);
  };

  const irAFormularioNueva = () => {
    navigate("/nueva-mascota");
  };

  const reintentar = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mascotas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-center bg-red-50 p-6 rounded-lg max-w-md">
          <div className="text-red-600 text-xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={reintentar}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Mis Mascotas</h1>
        <p className="text-gray-600">Gestiona la información de tus mascotas</p>
      </div>

      {/* Botón para agregar nueva mascota */}
      <div className="flex justify-center mb-6">
        <button
          onClick={irAFormularioNueva}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all duration-200 flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Agregar Nueva Mascota</span>
        </button>
      </div>

      {/* Lista de mascotas */}
      <div className="flex flex-wrap justify-center gap-6">
        {mascotas.length > 0 ? (
          mascotas.map((m) => (
            <div
              key={m._id}
              onClick={() => irADetalle(m._id)}
              className="bg-white rounded-2xl p-6 w-80 shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl border border-gray-100"
            >
              <div className="flex items-center mb-4">
                <img
                  src={m.imagen || "https://via.placeholder.com/150?text=🐾"}
                  alt={m.nombre}
                  className="w-20 h-20 object-cover rounded-full mr-4 border-4 border-purple-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "https://via.placeholder.com/150?text=🐾";
                  }}
                />
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{m.nombre}</h3>
                  <p className="text-sm text-gray-500 capitalize">{m.especie || "Mascota"}</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span className="font-medium">Edad:</span>
                  <span>{m.edad} {parseInt(m.edad) === 1 ? 'año' : 'años'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Género:</span>
                  <span>{m.genero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Raza:</span>
                  <span className="truncate ml-2">{m.raza}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Estado:</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    m.estado.toLowerCase().includes('sano') ? 'bg-green-100 text-green-800' :
                    m.estado.toLowerCase().includes('enfermo') ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {m.estado}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center">
                  Toca para ver más detalles
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🐾</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No tienes mascotas registradas
            </h3>
            <p className="text-gray-500 mb-6">
              Comienza agregando información de tu primera mascota
            </p>
            <button
              onClick={irAFormularioNueva}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Registrar mi primera mascota
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MascotaCard;
