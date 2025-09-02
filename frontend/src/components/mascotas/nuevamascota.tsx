import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

interface FormState {
  nombre: string;
  especie: string;
  raza: string;
  edad: string;
  genero: string;
  estado: string;
  imagen: File | null;
}

const CrearMascota: React.FC = () => {
  const [formData, setFormData] = useState<FormState>({
    nombre: "",
    especie: "",
    raza: "",
    edad: "",
    genero: "",
    estado: "",
    imagen: null,
  });

  const navigate = useNavigate();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFormData((prev) => ({ ...prev, imagen: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value) data.append(key, value as any);
    });

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("http://localhost:5000/api/mascotas", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: data,
      });

      const json = await res.json();
      if (res.ok) {
        alert("Mascota creada con éxito");
        navigate("/mascotas"); // 👈 Redirige a la página de mascotas
      } else {
        alert("Error: " + JSON.stringify(json));
      }
    } catch (err) {
      console.error("Error de red:", err);
    }
  };

  return (
    <div className="bg-gray-300 p-8 rounded-2xl max-w-3xl mx-auto mt-8 font-sans">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-6">
          {/* Columna izquierda */}
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

          {/* Columna derecha: Imagen con preview */}
          <div className="w-56 h-64 rounded-full flex items-center justify-center text-center text-white text-base relative overflow-hidden transition-colors bg-[#7a6e6e]">
            {formData.imagen ? (
              <img
                src={URL.createObjectURL(formData.imagen)}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <label htmlFor="imagen" className="cursor-pointer">
                Subir una imagen
              </label>
            )}
            <input
              id="imagen"
              type="file"
              name="imagen"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Botón */}
        <div className="mt-8">
          <button
            type="submit"
            className="bg-[#7a6e6e] hover:bg-[#5c5252] text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Guardar Mascota
          </button>
        </div>
      </form>
    </div>
  );
};

export default CrearMascota;
