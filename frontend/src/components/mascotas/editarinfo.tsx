import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

type FormFields =
  | "nombre"
  | "especie"
  | "estado"
  | "raza"
  | "edad"
  | "genero"
  | "enfermedades"
  | "historial";

function EditarMascota() {
  const { idMascota } = useParams();
  const [formData, setFormData] = useState<Record<FormFields, string>>({
    nombre: "",
    especie: "",
    estado: "",
    raza: "",
    edad: "",
    genero: "",
    enfermedades: "",
    historial: "",
  });
  const [imagen, setImagen] = useState<File | null>(null);
  const [imagenActual, setImagenActual] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMascota = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!idMascota) throw new Error("ID de mascota no válido.");
        const res = await fetch(
          `http://localhost:5000/api/mascotas/${idMascota}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok) {
          if (res.status === 404) throw new Error("Mascota no encontrada");
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        setFormData({
          nombre: data.nombre || "",
          especie: data.especie || "",
          estado: data.estado || "",
          raza: data.raza || "",
          edad: data.edad?.toString() || "",
          genero: data.genero || "",
          enfermedades: data.enfermedades || "",
          historial: data.historial || "",
        });
        setImagenActual(data.imagen || "");
      } catch (error) {
        console.error("Error al cargar mascota:", error);
        alert(
          error instanceof Error
            ? `No se pudo cargar la mascota: ${error.message}`
            : "No se pudo cargar la mascota: error desconocido"
        );
      } finally {
        setLoading(false);
      }
    };

    if (idMascota) fetchMascota();
  }, [idMascota]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({ ...formData, [e.target.name as FormFields]: e.target.value });
  };

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setImagen(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (!idMascota) {
      alert("ID de mascota no válido.");
      return;
    }
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) =>
        data.append(key, value)
      );
      if (imagen) data.append("imagen", imagen);

      const token = localStorage.getItem("token");
      if (!token) {
        alert("No se encontró el token de autenticación.");
        return;
      }
      const res = await fetch(
        `http://localhost:5000/api/mascotas/${idMascota}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: data,
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al actualizar");
      }

      alert("Mascota actualizada correctamente");
      navigate("/mascotas");
    } catch (error) {
      console.error("Error al actualizar:", error);
      alert(
        error instanceof Error
          ? `No se pudo actualizar la mascota: ${error.message}`
          : "No se pudo actualizar la mascota: error desconocido"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Cargando datos de la mascota...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-300 p-8 rounded-2xl max-w-3xl mx-auto mt-8 font-sans">
      <h1 className="text-2xl font-bold mb-6 text-center">Editar Mascota</h1>

      <div className="flex flex-wrap gap-6">
        <div className="flex-1">
          {/* Nombre */}
          <div className="mb-3">
            <label className="block mb-1 font-medium">Nombre</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-xl bg-[#7a6e6e] text-white focus:ring-2 focus:ring-gray-500"
              placeholder="Ingrese nombre"
            />
          </div>

          {/* Especie */}
          <div className="mb-3">
            <label className="block mb-1 font-medium">Especie</label>
            <select
              name="especie"
              value={formData.especie}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-xl bg-[#7a6e6e] text-white focus:ring-2 focus:ring-gray-500"
            >
              <option value="">Seleccione especie</option>
              <option value="Perro">Perro</option>
              <option value="Gato">Gato</option>
              <option value="Ave">Ave</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          {/* Raza */}
          <div className="mb-3">
            <label className="block mb-1 font-medium">Raza</label>
            <input
              type="text"
              name="raza"
              value={formData.raza}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-xl bg-[#7a6e6e] text-white focus:ring-2 focus:ring-gray-500"
              placeholder="Ingrese raza"
            />
          </div>

          {/* Edad */}
          <div className="mb-3">
            <label className="block mb-1 font-medium">Edad</label>
            <input
              type="number"
              name="edad"
              value={formData.edad}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-xl bg-[#7a6e6e] text-white focus:ring-2 focus:ring-gray-500"
              placeholder="Ingrese edad"
            />
          </div>

          {/* Género */}
          <div className="mb-3">
            <label className="block mb-1 font-medium">Género</label>
            <select
              name="genero"
              value={formData.genero}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-xl bg-[#7a6e6e] text-white focus:ring-2 focus:ring-gray-500"
            >
              <option value="">Seleccione género</option>
              <option value="Macho">Macho</option>
              <option value="Hembra">Hembra</option>
            </select>
          </div>

          {/* Estado */}
          <div className="mb-3">
            <label className="block mb-1 font-medium">Estado</label>
            <select
              name="estado"
              value={formData.estado}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-xl bg-[#7a6e6e] text-white focus:ring-2 focus:ring-gray-500"
            >
              <option value="">Seleccione</option>
              <option value="Disponible">Disponible</option>
              <option value="Adoptado">Adoptado</option>
              <option value="En proceso">En proceso</option>
            </select>
          </div>
        </div>

        {/* Imagen */}
        <div className="w-56 h-64 rounded-lg flex items-center justify-center text-center text-white text-base relative overflow-hidden transition-colors bg-[#7a6e6e]">
          {imagen ? (
            <img
              src={URL.createObjectURL(imagen)}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          ) : imagenActual ? (
            <div className="w-full h-full relative">
              <img
                src={imagenActual}
                alt="Imagen actual"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <label
                  htmlFor="imagen"
                  className="cursor-pointer text-white text-sm"
                >
                  Cambiar imagen
                </label>
              </div>
            </div>
          ) : (
            <label htmlFor="imagen" className="cursor-pointer">
              Subir una imagen
            </label>
          )}
          <input
            id="imagen"
            type="file"
            accept="image/*"
            onChange={handleImagenChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Enfermedades */}
      <div className="mt-6">
        <label className="block mb-1 font-medium">Enfermedades</label>
        <textarea
          name="enfermedades"
          value={formData.enfermedades}
          onChange={handleChange}
          rows={4}
          className="w-full rounded-xl px-4 py-2 bg-[#7a6e6e] text-white focus:ring-2 focus:ring-gray-500"
          placeholder="Escriba aquí las enfermedades"
        />
      </div>

      {/* Historial */}
      <div className="mt-6">
        <label className="block mb-1 font-medium">Historial médico</label>
        <textarea
          name="historial"
          value={formData.historial}
          onChange={handleChange}
          rows={5}
          className="w-full rounded-xl px-4 py-2 bg-[#7a6e6e] text-white focus:ring-2 focus:ring-gray-500"
          placeholder="Escriba aquí el historial médico"
        />
      </div>

      {/* Botones */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={handleSubmit}
          className="bg-[#7a6e6e] hover:bg-[#5c5252] text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          Guardar cambios
        </button>
        <button
          onClick={() => navigate("/mascotas")}
          className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default EditarMascota;
