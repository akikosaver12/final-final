import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function App() {
  const [formData, setFormData] = useState({
    nombre: '',
    estado: '',
    raza: '',
    edad: '',
    genero: '',
    enfermedades: '',
    historial: ''
  });
  const [imagen, setImagen] = useState<File | null>(null);
  const navigate = useNavigate();

  // 👉 Manejo de cambios en inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 👉 Manejo de imagen
  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImagen(e.target.files[0]);
    }
  };

  // 👉 Enviar al backend
  const handleSubmit = async () => {
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => data.append(key, value));
    if (imagen) data.append("imagen", imagen);

    const token = localStorage.getItem("token"); // JWT guardado al iniciar sesión

    const res = await fetch("http://localhost:5000/api/mascotas", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`, // autenticación
      },
      body: data,
    });

    if (res.ok) {
      navigate("/mascotas");
    } else {
      alert("Error al registrar la mascota");
    }
  };

  return (
    <div className="bg-gray-300 p-8 rounded-2xl max-w-3xl mx-auto mt-8 font-sans">
      <div className="flex flex-wrap gap-6">
        {/* Inputs */}
        <div className="flex-1">
          {['nombre', 'estado', 'raza', 'edad', 'genero'].map((campo, i) => (
            <div key={i} className="mb-3">
              <label className="block mb-1 font-medium">{campo}</label>
              <input
                type="text"
                name={campo}
                value={formData[campo as keyof typeof formData]}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl bg-[#7a6e6e] text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder={`Ingrese ${campo}`}
              />
            </div>
          ))}
        </div>

        {/* Imagen */}
        <div className="w-56 h-64 rounded-full flex items-center justify-center text-center text-white text-base relative overflow-hidden transition-colors bg-[#7a6e6e]">
          {imagen ? (
            <img src={URL.createObjectURL(imagen)} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <label htmlFor="imagen" className="cursor-pointer">
              Subir una imagen
            </label>
          )}
          <input id="imagen" type="file" accept="image/*" onChange={handleImagenChange} className="hidden" />
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
          className="w-full rounded-xl px-4 py-2 bg-[#7a6e6e] text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          placeholder="Escriba aquí las enfermedades"
        />
      </div>

      {/* Historial médico */}
      <div className="mt-6">
        <label className="block mb-1 font-medium">Historial médico</label>
        <textarea
          name="historial"
          value={formData.historial}
          onChange={handleChange}
          rows={5}
          className="w-full rounded-xl px-4 py-2 bg-[#7a6e6e] text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          placeholder="Escriba aquí el historial médico"
        />
      </div>

      {/* Botón */}
      <div className="mt-8">
        <button
          onClick={handleSubmit}
          className="bg-[#7a6e6e] hover:bg-[#5c5252] text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          Crear mi mascota
        </button>
      </div>
    </div>
  );
}

export default App;
