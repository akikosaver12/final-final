import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Vacuna {
  nombre: string;
  fecha: string;
  imagen?: string;
}

interface Operacion {
  nombre: string;
  descripcion: string;
  fecha: string;
  imagen?: string;
}

interface Mascota {
  _id: string;
  nombre?: string;
  especie?: string;
  estado?: string;
  raza?: string;
  edad?: number;
  genero?: string;
  vacunas?: Vacuna[];
  operaciones?: Operacion[];
  imagen?: string;
  usuario?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

const MascotaInfo: React.FC = () => {
  const { idMascota } = useParams<{ idMascota: string }>();
  const [mascota, setMascota] = useState<Mascota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMascota = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("No hay token de autenticación");
          setLoading(false);
          return;
        }

        if (!idMascota) {
          setError("No se proporcionó un ID de mascota");
          setLoading(false);
          return;
        }

        const url = `http://localhost:5000/api/mascotas/${idMascota}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al obtener los datos de la mascota");
        }

        const data = await response.json();
        setMascota(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Ocurrió un error desconocido");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMascota();
  }, [idMascota]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center">
        <p>Cargando información de la mascota...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center">
        <p className="text-red-400">Error: {error}</p>
        <p className="text-gray-400 mt-2">
          {idMascota ? `ID de mascota: ${idMascota}` : "Sin ID específico"}
        </p>
      </div>
    );
  }

  if (!mascota) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center">
        <p>No se encontró información de la mascota</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex">
      {/* Columna Izquierda */}
      <div className="w-2/3 p-10 space-y-6">
        <h1 className="text-xl font-bold uppercase tracking-wide">
          {mascota.nombre || "Sin nombre"}
        </h1>

        <section>
          <h2 className="text-lg font-semibold">Estado</h2>
          <p>{mascota.estado || "No especificado"}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Raza</h2>
          <p>{mascota.raza || "No especificado"}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Edad</h2>
          <p>{mascota.edad ? `${mascota.edad} años` : "No especificado"}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Género</h2>
          <p>{mascota.genero || "No especificado"}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Vacunas</h2>
          {mascota.vacunas && mascota.vacunas.length > 0 ? (
            <ul className="list-disc ml-5">
              {mascota.vacunas.map((v, i) => (
                <li key={i}>
                  {v.nombre} - {new Date(v.fecha).toLocaleDateString()}
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay vacunas registradas</p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold">Operaciones</h2>
          {mascota.operaciones && mascota.operaciones.length > 0 ? (
            <ul className="list-disc ml-5">
              {mascota.operaciones.map((op, i) => (
                <li key={i}>
                  <strong>{op.nombre}</strong> - {op.descripcion} (
                  {new Date(op.fecha).toLocaleDateString()})
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay operaciones registradas</p>
          )}
        </section>
      </div>

      {/* Columna Derecha */}
      <div className="relative w-1/3 flex items-center justify-center bg-gray-800">
        <MascotaCard mascota={mascota} />

        <div className="max-h-[80%] w-full flex items-center justify-center">
          {mascota.imagen ? (
            <img
              src={mascota.imagen}
              alt={mascota.nombre || "Mascota"}
              className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://via.placeholder.com/300x400/374151/9CA3AF?text=Sin+Imagen";
              }}
            />
          ) : (
            <div className="w-64 h-80 bg-gray-700 rounded-lg flex items-center justify-center">
              <p className="text-gray-400 text-center">Sin imagen disponible</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MascotaCard: React.FC<{ mascota: Mascota }> = ({ mascota }) => {
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta mascota?")) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("No hay token de autenticación");
        return;
      }

      const response = await fetch(`http://localhost:5000/api/mascotas/${mascota._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar mascota");
      }

      alert("Mascota eliminada con éxito");
      navigate("/mascotas");
    } catch (err) {
      console.error("Error eliminando mascota:", err);
      alert("Ocurrió un error al eliminar la mascota");
    }
  };

  return (
    <div className="absolute top-4 right-4 flex gap-4">
      <button
        className="px-4 py-1 text-sm font-semibold border border-yellow-400 text-yellow-400 rounded hover:bg-yellow-400 hover:text-white transition"
        onClick={() => navigate(`/edit/${mascota._id}`)}
      >
        Editar
      </button>
      <button
        className="px-4 py-1 text-sm font-semibold border border-red-400 text-red-400 rounded hover:bg-red-400 hover:text-white transition"
        onClick={handleDelete}
      >
        Eliminar
      </button>
    </div>
  );
};

export default MascotaInfo;
