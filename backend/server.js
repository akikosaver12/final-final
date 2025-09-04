const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
const router = express.Router();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

app.use(cors());
app.use(express.json());

// Crear carpeta uploads si no existe
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

/* ======================
   Conexión a MongoDB Atlas
   ====================== */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Conectado a MongoDB Atlas");
  } catch (err) {
    console.error("❌ Error al conectar MongoDB:", err.message);
    process.exit(1);
  }
};
connectDB();

/* ======================
   MODELOS ACTUALIZADOS
   ====================== */
// ESQUEMA DE USUARIO ACTUALIZADO CON TELÉFONO Y DIRECCIÓN (SIN CÓDIGO POSTAL)
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, trim: true },
    password: { type: String, required: true },
    telefono: { 
      type: String, 
      required: true, 
      trim: true,
      validate: {
        validator: function(v) {
          // Validar que el teléfono tenga entre 7 y 15 dígitos
          return /^\+?[\d\s\-\(\)]{7,15}$/.test(v);
        },
        message: 'El teléfono debe tener un formato válido'
      }
    },
    direccion: {
      calle: { type: String, required: true, trim: true },
      ciudad: { type: String, required: true, trim: true },
      estado: { type: String, required: true, trim: true },
      pais: { type: String, required: true, trim: true, default: 'Colombia' }
    },
    role: { type: String, default: "user", enum: ["user", "admin"] },
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

const mascotaSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    especie: { type: String, required: true, trim: true },
    raza: { type: String, required: true, trim: true },
    edad: { type: Number, required: true, min: 0, max: 15 },
    genero: { type: String, required: true, enum: ["Macho", "Hembra"] },
    estado: { type: String, required: true, trim: true },
    enfermedades: { type: String, default: "", trim: true },
    historial: { type: String, default: "", trim: true },
    imagen: { type: String, default: "" },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vacunas: [
      {
        nombre: { type: String, required: true, trim: true },
        fecha: { type: Date, required: true },
        imagen: String,
      },
    ],
    operaciones: [
      {
        nombre: { type: String, required: true, trim: true },
        descripcion: { type: String, required: true, trim: true },
        fecha: { type: Date, required: true },
        imagen: String,
      },
    ],
  },
  { timestamps: true }
);
const Mascota = mongoose.model("Mascota", mascotaSchema);

const productoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    precio: { type: Number, required: true, min: 0 },
    imagen: String,
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
const Producto = mongoose.model("Producto", productoSchema);

const citaSchema = new mongoose.Schema(
  {
    mascota: { type: mongoose.Schema.Types.ObjectId, ref: "Mascota", required: true },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tipo: { type: String, required: true, enum: ["consulta", "operacion", "vacunacion", "emergencia"] },
    fecha: { type: Date, required: true },
    hora: { type: String, required: true }, // formato "HH:mm"
    motivo: { type: String, required: true, trim: true },
    estado: { type: String, default: "pendiente", enum: ["pendiente", "confirmada", "cancelada", "completada"] },
    notas: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

// Índice único para evitar doble reserva en la misma fecha y hora
citaSchema.index({ fecha: 1, hora: 1 }, { unique: true });

const Cita = mongoose.model("Cita", citaSchema);

/* ======================
   Middlewares de Auth
   ====================== */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(401).json({ error: "Acceso denegado: falta Authorization" });

  try {
    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token no proporcionado" });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "No tienes permisos de administrador" });
  next();
};

/* ======================
   Configuración de Multer
   ====================== */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB límite
});

/* ======================
   FUNCIONES DE UTILIDAD ACTUALIZADAS
   ====================== */
const esHorarioValido = (hora) => {
  const [hours, minutes] = hora.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;
  
  // 7:00 AM - 12:00 PM (420 - 720 minutos)
  const mañanaInicio = 7 * 60; // 420
  const mañanaFin = 12 * 60; // 720
  
  // 2:00 PM - 6:00 PM (840 - 1080 minutos)
  const tardeInicio = 14 * 60; // 840
  const tardeFin = 18 * 60; // 1080
  
  return (timeInMinutes >= mañanaInicio && timeInMinutes <= mañanaFin) ||
         (timeInMinutes >= tardeInicio && timeInMinutes <= tardeFin);
};

const esFechaValida = (fechaString) => {
  try {
    // Crear fecha al inicio del día para evitar problemas de zona horaria
    const fechaCita = new Date(fechaString + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a inicio del día
    
    // No se pueden agendar citas en el pasado
    if (fechaCita < hoy) return false;
    
    // No se pueden agendar citas los domingos (0 = domingo)
    if (fechaCita.getDay() === 0) return false;
    
    return true;
  } catch (error) {
    console.error('Error validando fecha:', error);
    return false;
  }
};

const normalizarFecha = (fechaString) => {
  return new Date(fechaString + 'T00:00:00');
};

// NUEVAS FUNCIONES DE VALIDACIÓN (SIN CÓDIGO POSTAL)
const validarTelefono = (telefono) => {
  // Remover espacios y caracteres especiales para validación
  const telefonoLimpio = telefono.replace(/[\s\-\(\)]/g, '');
  return /^\+?[\d]{7,15}$/.test(telefonoLimpio);
};

const validarDireccion = (direccion) => {
  const { calle, ciudad, estado } = direccion;
  
  if (!calle || !ciudad || !estado) {
    return { valido: false, mensaje: "Todos los campos de dirección son obligatorios" };
  }
  
  if (calle.trim().length < 5) {
    return { valido: false, mensaje: "La dirección debe tener al menos 5 caracteres" };
  }
  
  if (ciudad.trim().length < 2) {
    return { valido: false, mensaje: "La ciudad debe tener al menos 2 caracteres" };
  }
  
  if (estado.trim().length < 2) {
    return { valido: false, mensaje: "El estado debe tener al menos 2 caracteres" };
  }
  
  return { valido: true };
};

/* ======================
   RUTAS DE AUTENTICACIÓN ACTUALIZADAS
   ====================== */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, telefono, direccion, role } = req.body;
    
    // Validaciones básicas
    if (!name || !email || !password || !telefono || !direccion) {
      return res.status(400).json({ 
        error: "Todos los campos son obligatorios",
        campos: ["name", "email", "password", "telefono", "direccion"]
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    // Validar teléfono
    if (!validarTelefono(telefono)) {
      return res.status(400).json({ error: "El teléfono debe tener un formato válido (7-15 dígitos)" });
    }

    // Validar dirección
    const validacionDireccion = validarDireccion(direccion);
    if (!validacionDireccion.valido) {
      return res.status(400).json({ error: validacionDireccion.mensaje });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ error: "El correo ya está registrado" });

    const hashed = await bcrypt.hash(password, 10);
    const nuevoUsuario = new User({ 
      name: name.trim(), 
      email: email.trim().toLowerCase(), 
      password: hashed, 
      telefono: telefono.trim(),
      direccion: {
        calle: direccion.calle.trim(),
        ciudad: direccion.ciudad.trim(),
        estado: direccion.estado.trim(),
        pais: direccion.pais ? direccion.pais.trim() : 'Colombia'
      },
      role 
    });

    await nuevoUsuario.save();

    res.status(201).json({ 
      message: "Usuario registrado con éxito",
      usuario: {
        id: nuevoUsuario._id,
        name: nuevoUsuario.name,
        email: nuevoUsuario.email,
        telefono: nuevoUsuario.telefono,
        direccion: nuevoUsuario.direccion,
        role: nuevoUsuario.role
      }
    });
  } catch (error) {
    console.error("Error en registro:", error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      res.status(400).json({ error: "Error de validación", detalles: errors });
    } else if (error.code === 11000) {
      res.status(400).json({ error: "El email ya está registrado" });
    } else {
      res.status(500).json({ error: "Error en el servidor" });
    }
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son obligatorios" });
    }

    const u = await User.findOne({ email: email.toLowerCase() });
    if (!u) return res.status(400).json({ error: "Usuario no encontrado" });

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: u._id, role: u.role }, JWT_SECRET, { expiresIn: "1d" });

    res.json({
      user: { 
        id: u._id, 
        name: u.name, 
        email: u.email, 
        telefono: u.telefono,
        direccion: u.direccion,
        role: u.role 
      },
      token,
      redirectTo: u.role === "admin" ? "/admin" : "/home",
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.get("/auth/me", verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("-password");
    if (!me) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(me);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

// NUEVA RUTA PARA ACTUALIZAR PERFIL DE USUARIO
router.put("/usuarios/perfil", verifyToken, async (req, res) => {
  try {
    const { name, telefono, direccion } = req.body;
    const usuario = await User.findById(req.user.id);
    
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Validar campos si se proporcionan
    if (telefono && !validarTelefono(telefono)) {
      return res.status(400).json({ error: "El teléfono debe tener un formato válido" });
    }

    if (direccion) {
      const validacionDireccion = validarDireccion(direccion);
      if (!validacionDireccion.valido) {
        return res.status(400).json({ error: validacionDireccion.mensaje });
      }
    }

    // Actualizar campos
    if (name && name.trim()) usuario.name = name.trim();
    if (telefono) usuario.telefono = telefono.trim();
    if (direccion) {
      usuario.direccion = {
        calle: direccion.calle.trim(),
        ciudad: direccion.ciudad.trim(),
        estado: direccion.estado.trim(),
        pais: direccion.pais ? direccion.pais.trim() : usuario.direccion.pais
      };
    }

    await usuario.save();

    res.json({
      message: "Perfil actualizado exitosamente",
      usuario: {
        id: usuario._id,
        name: usuario.name,
        email: usuario.email,
        telefono: usuario.telefono,
        direccion: usuario.direccion,
        role: usuario.role
      }
    });

  } catch (error) {
    console.error("Error actualizando perfil:", error);
    res.status(500).json({ error: "Error al actualizar perfil" });
  }
});

/* ======================
   USUARIOS & MASCOTAS ACTUALIZADOS
   ====================== */
router.get("/usuarios", verifyToken, isAdmin, async (req, res) => {
  try {
    const usuarios = await User.find().select("-password");

    const usuariosConMascotas = await Promise.all(
      usuarios.map(async (u) => {
        const totalMascotas = await Mascota.countDocuments({ usuario: u._id });
        return { 
          ...u.toObject(), 
          totalMascotas,
          direccionCompleta: `${u.direccion.calle}, ${u.direccion.ciudad}, ${u.direccion.estado}`
        };
      })
    );

    res.json(usuariosConMascotas);
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

router.get("/usuarios/:id/mascotas", verifyToken, async (req, res) => {
  try {
    const usuario = await User.findById(req.params.id).select("-password");
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    if (req.user.role !== "admin" && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "No autorizado para ver estas mascotas" });
    }

    const mascotas = await Mascota.find({ usuario: req.params.id });
    res.json({ usuario, mascotas });
  } catch (error) {
    console.error("Error obteniendo mascotas de usuario:", error);
    res.status(500).json({ error: "Error al obtener mascotas del usuario" });
  }
});

/* ======================
   Mascotas
   ====================== */
router.post("/mascotas", verifyToken, upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, especie, raza, edad, genero, estado, enfermedades, historial } = req.body;

    // Validaciones obligatorias
    if (!nombre || !especie || !raza || !edad || !genero || !estado) {
      const faltantes = [];
      if (!nombre) faltantes.push("nombre");
      if (!especie) faltantes.push("especie");
      if (!raza) faltantes.push("raza");
      if (!edad) faltantes.push("edad");
      if (!genero) faltantes.push("genero");
      if (!estado) faltantes.push("estado");

      return res.status(400).json({
        error: "Faltan campos obligatorios",
        campos: faltantes,
      });
    }

    const edadNum = parseInt(edad);
    if (isNaN(edadNum) || edadNum < 0 || edadNum > 15) {
      return res.status(400).json({ error: "La edad debe ser un número entre 0 y 15" });
    }

    if (!["Macho", "Hembra"].includes(genero)) {
      return res.status(400).json({ error: "El género debe ser 'Macho' o 'Hembra'" });
    }

    const nuevaMascota = new Mascota({
      nombre: nombre.trim(),
      especie: especie.trim(),
      raza: raza.trim(),
      edad: edadNum,
      genero,
      estado: estado.trim(),
      enfermedades: enfermedades ? enfermedades.trim() : "",
      historial: historial ? historial.trim() : "",
      imagen: req.file
        ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        : "",
      usuario: req.user.id,
    });

    await nuevaMascota.save();
    console.log('✅ Mascota registrada:', nuevaMascota.nombre, 'para usuario:', req.user.id);
    res.status(201).json({ msg: "Mascota registrada", mascota: nuevaMascota });
  } catch (err) {
    console.error("Error creando mascota:", err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      res.status(400).json({ msg: "Error de validación", errors });
    } else {
      res.status(500).json({ msg: "Error en el servidor", error: err.message });
    }
  }
});

router.get("/mascotas", verifyToken, async (req, res) => {
  try {
    console.log('📋 Obteniendo mascotas para usuario:', req.user.id);
    const mascotas = await Mascota.find({ usuario: req.user.id }).populate("usuario", "name email telefono");
    console.log('📋 Mascotas encontradas:', mascotas.length);

    const mascotasConImagen = mascotas.map((m) => ({
      ...m.toObject(),
      imagen: m.imagen
        ? m.imagen.startsWith("http")
          ? m.imagen
          : `${req.protocol}://${req.get("host")}${m.imagen}`
        : null,
    }));

    res.json(mascotasConImagen);
  } catch (error) {
    console.error("❌ Error al listar mascotas:", error);
    res.status(500).json({ message: "Error al listar mascotas", error: error.message });
  }
});

router.put("/mascotas/:id", verifyToken, upload.single("imagen"), async (req, res) => {
  try {
    const mascota = await Mascota.findById(req.params.id);
    if (!mascota) {
      return res.status(404).json({ error: "Mascota no encontrada" });
    }

    if (req.user.role !== "admin" && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para editar esta mascota" });
    }

    const { nombre, especie, raza, edad, genero, estado, enfermedades, historial } = req.body;

    // Validar campos obligatorios si se proporcionan
    if (edad !== undefined) {
      const edadNum = parseInt(edad);
      if (isNaN(edadNum) || edadNum < 0 || edadNum > 15) {
        return res.status(400).json({ error: "La edad debe ser un número entre 0 y 15" });
      }
      mascota.edad = edadNum;
    }

    if (genero !== undefined && !["Macho", "Hembra"].includes(genero)) {
      return res.status(400).json({ error: "El género debe ser 'Macho' o 'Hembra'" });
    }

    // Actualizar solo campos no vacíos
    if (nombre && nombre.trim()) mascota.nombre = nombre.trim();
    if (especie && especie.trim()) mascota.especie = especie.trim();
    if (raza && raza.trim()) mascota.raza = raza.trim();
    if (genero) mascota.genero = genero;
    if (estado && estado.trim()) mascota.estado = estado.trim();
    if (enfermedades !== undefined) mascota.enfermedades = enfermedades.trim();
    if (historial !== undefined) mascota.historial = historial.trim();

    if (req.file) {
      mascota.imagen = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

    await mascota.save();
    res.json({ msg: "Mascota actualizada correctamente", mascota });
  } catch (err) {
    console.error("Error actualizando mascota:", err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      res.status(400).json({ msg: "Error de validación", errors });
    } else {
      res.status(500).json({ msg: "Error al actualizar mascota", error: err.message });
    }
  }
});

router.get("/mascotas/:id", verifyToken, async (req, res) => {
  try {
    const mascota = await Mascota.findById(req.params.id).populate("usuario", "name email telefono");
    
    if (!mascota) {
      return res.status(404).json({ error: "Mascota no encontrada" });
    }

    const mascotaUserId = mascota.usuario._id.toString();
    const tokenUserId = req.user.id.toString();
    
    if (req.user.role !== "admin" && mascotaUserId !== tokenUserId) {
      return res.status(403).json({ 
        error: "No autorizado para ver esta mascota"
      });
    }

    const mascotaConImagen = {
      ...mascota.toObject(),
      imagen: mascota.imagen
        ? mascota.imagen.startsWith("http")
          ? mascota.imagen
          : `${req.protocol}://${req.get("host")}${mascota.imagen}`
        : null,
    };

    res.json(mascotaConImagen);
  } catch (error) {
    console.error("Error al obtener mascota:", error);
    res.status(500).json({ message: "Error al obtener mascota", error: error.message });
  }
});

// Agregar vacuna a mascota
router.post("/mascotas/:id/vacunas", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, fecha, imagen } = req.body;

    // Validaciones
    if (!nombre || !fecha) {
      return res.status(400).json({ error: "Nombre y fecha de la vacuna son obligatorios" });
    }

    if (!nombre.trim()) {
      return res.status(400).json({ error: "El nombre no puede estar vacío" });
    }

    const mascota = await Mascota.findById(id);
    if (!mascota) return res.status(404).json({ msg: "Mascota no encontrada" });

    // Verificar permisos: admin o dueño
    if (req.user.role !== "admin" && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para agregar vacunas a esta mascota" });
    }

    // Agregar vacuna al array
    mascota.vacunas.push({
      nombre: nombre.trim(),
      fecha: new Date(fecha),
      imagen: imagen || ""
    });

    await mascota.save();

    res.json({ msg: "Vacuna agregada correctamente", mascota });
  } catch (err) {
    console.error("Error agregando vacuna:", err);
    res.status(500).json({ msg: "Error al agregar vacuna", error: err.message });
  }
});

// Agregar operación a mascota
router.post("/mascotas/:id/operaciones", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, fecha, imagen } = req.body;

    // Validaciones
    if (!nombre || !descripcion || !fecha) {
      return res.status(400).json({ error: "Nombre, descripción y fecha de la operación son obligatorios" });
    }

    if (!nombre.trim() || !descripcion.trim()) {
      return res.status(400).json({ error: "El nombre y descripción no pueden estar vacíos" });
    }

    const mascota = await Mascota.findById(id);
    if (!mascota) return res.status(404).json({ msg: "Mascota no encontrada" });

    // Verificar permisos: admin o dueño
    if (req.user.role !== "admin" && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para agregar operaciones a esta mascota" });
    }

    // Agregar operación al array
    mascota.operaciones.push({
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      fecha: new Date(fecha),
      imagen: imagen || ""
    });

    await mascota.save();

    res.json({ msg: "Operación agregada correctamente", mascota });
  } catch (err) {
    console.error("Error agregando operación:", err);
    res.status(500).json({ msg: "Error al agregar operación", error: err.message });
  }
});

// Eliminar mascota
router.delete("/mascotas/:id", verifyToken, async (req, res) => {
  try {
    const mascota = await Mascota.findById(req.params.id);
    if (!mascota) return res.status(404).json({ error: "Mascota no encontrada" });

    // Validar permisos: admin o dueño
    if (req.user.role !== "admin" && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para eliminar esta mascota" });
    }

    await mascota.deleteOne();
    res.json({ msg: "Mascota eliminada con éxito" });
  } catch (err) {
    console.error("Error eliminando mascota:", err);
    res.status(500).json({ msg: "Error al eliminar mascota", error: err.message });
  }
});

/* ======================
   RUTAS DE CITAS
   ====================== */

// Crear nueva cita
router.post("/citas", verifyToken, async (req, res) => {
  try {
    console.log('📅 Creando nueva cita:', req.body);
    const { mascotaId, tipo, fecha, hora, motivo, notas } = req.body;

    // Validaciones obligatorias
    if (!mascotaId || !tipo || !fecha || !hora || !motivo) {
      return res.status(400).json({ 
        error: "Los campos mascota, tipo, fecha, hora y motivo son obligatorios" 
      });
    }

    // Validar que la mascota existe y pertenece al usuario
    const mascota = await Mascota.findById(mascotaId);
    if (!mascota) {
      return res.status(404).json({ error: "Mascota no encontrada" });
    }

    if (req.user.role !== "admin" && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para agendar cita para esta mascota" });
    }

    // Validar fecha
    if (!esFechaValida(fecha)) {
      return res.status(400).json({ 
        error: "Fecha inválida. No se pueden agendar citas en el pasado o los domingos" 
      });
    }

    // Validar horario
    if (!esHorarioValido(hora)) {
      return res.status(400).json({ 
        error: "Horario inválido. Los horarios de atención son: 7:00AM-12:00PM y 2:00PM-6:00PM" 
      });
    }

    // Verificar disponibilidad
    const fechaNormalizada = normalizarFecha(fecha);
    const citaExistente = await Cita.findOne({ 
      fecha: fechaNormalizada, 
      hora: hora 
    });
    
    if (citaExistente) {
      return res.status(400).json({ 
        error: "Ya existe una cita agendada para esa fecha y hora" 
      });
    }

    // Crear la cita
    const nuevaCita = new Cita({
      mascota: mascotaId,
      usuario: req.user.id,
      tipo,
      fecha: fechaNormalizada,
      hora,
      motivo: motivo.trim(),
      notas: notas ? notas.trim() : "",
    });

    await nuevaCita.save();
    console.log('✅ Cita creada exitosamente:', nuevaCita._id, 'para mascota:', mascota.nombre);
    
    // Poblar los datos para la respuesta
    await nuevaCita.populate([
      { path: 'mascota', select: 'nombre especie raza' },
      { path: 'usuario', select: 'name email telefono' }
    ]);

    res.status(201).json({ 
      message: "Cita agendada exitosamente",
      cita: nuevaCita 
    });

  } catch (err) {
    console.error("❌ Error creando cita:", err);
    if (err.code === 11000) {
      return res.status(400).json({ 
        error: "Ya existe una cita agendada para esa fecha y hora" 
      });
    }
    res.status(500).json({ 
      error: "Error al agendar cita",
      details: err.message 
    });
  }
});

// Listar citas del usuario
router.get("/citas", verifyToken, async (req, res) => {
  try {
    console.log('📋 Obteniendo citas para usuario:', req.user.id);
    let query = {};
    
    // Si no es admin, solo puede ver sus propias citas
    if (req.user.role !== "admin") {
      query.usuario = req.user.id;
    }

    const citas = await Cita.find(query)
      .populate('mascota', 'nombre especie raza imagen')
      .populate('usuario', 'name email telefono')
      .sort({ fecha: 1, hora: 1 });

    console.log('📋 Citas encontradas:', citas.length);
    res.json(citas);
  } catch (err) {
    console.error("❌ Error listando citas:", err);
    res.status(500).json({ error: "Error al obtener citas" });
  }
});

// Obtener horarios disponibles
router.get("/citas/horarios-disponibles/:fecha", verifyToken, async (req, res) => {
  try {
    const { fecha } = req.params;
    console.log('🕐 Obteniendo horarios para fecha:', fecha);
    
    if (!esFechaValida(fecha)) {
      return res.status(400).json({ 
        error: "Fecha inválida. No se pueden agendar citas en el pasado o los domingos" 
      });
    }

    // Buscar citas existentes
    const fechaNormalizada = normalizarFecha(fecha);
    const citasExistentes = await Cita.find({ fecha: fechaNormalizada }).select('hora');
    const horasOcupadas = citasExistentes.map(cita => cita.hora);
    
    console.log('⏰ Horas ocupadas para', fecha + ':', horasOcupadas);

    // Generar horarios disponibles
    const horariosDisponibles = [];
    
    // Horarios de la mañana (7:00 AM - 12:00 PM)
    for (let hora = 7; hora <= 11; hora++) {
      for (let minutos = 0; minutos < 60; minutos += 30) {
        const horario = `${hora.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
        if (!horasOcupadas.includes(horario)) {
          horariosDisponibles.push({
            hora: horario,
            periodo: 'mañana',
            disponible: true
          });
        }
      }
    }

    // Agregar 12:00 PM
    if (!horasOcupadas.includes('12:00')) {
      horariosDisponibles.push({
        hora: '12:00',
        periodo: 'mañana',
        disponible: true
      });
    }

    // Horarios de la tarde (2:00 PM - 6:00 PM)
    for (let hora = 14; hora <= 17; hora++) {
      for (let minutos = 0; minutos < 60; minutos += 30) {
        const horario = `${hora.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
        if (!horasOcupadas.includes(horario)) {
          horariosDisponibles.push({
            hora: horario,
            periodo: 'tarde',
            disponible: true
          });
        }
      }
    }

    // Agregar 6:00 PM
    if (!horasOcupadas.includes('18:00')) {
      horariosDisponibles.push({
        hora: '18:00',
        periodo: 'tarde',
        disponible: true
      });
    }

    console.log('✅ Horarios disponibles generados:', horariosDisponibles.length);

    res.json({
      fecha,
      horariosDisponibles,
      totalDisponibles: horariosDisponibles.length
    });

  } catch (err) {
    console.error("❌ Error obteniendo horarios:", err);
    res.status(500).json({ error: "Error al obtener horarios disponibles" });
  }
});

// Actualizar estado de cita (solo admin)
router.put("/citas/:id/estado", verifyToken, isAdmin, async (req, res) => {
  try {
    const { estado } = req.body;
    
    if (!["pendiente", "confirmada", "cancelada", "completada"].includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const cita = await Cita.findById(req.params.id);
    if (!cita) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    cita.estado = estado;
    await cita.save();

    await cita.populate([
      { path: 'mascota', select: 'nombre especie raza' },
      { path: 'usuario', select: 'name email telefono' }
    ]);

    console.log('📝 Estado de cita actualizado:', req.params.id, 'a', estado);

    res.json({ 
      message: "Estado de cita actualizado",
      cita 
    });

  } catch (err) {
    console.error("❌ Error actualizando cita:", err);
    res.status(500).json({ error: "Error al actualizar cita" });
  }
});

// Cancelar cita (usuario puede cancelar su propia cita)
router.delete("/citas/:id", verifyToken, async (req, res) => {
  try {
    const cita = await Cita.findById(req.params.id);
    if (!cita) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    // Solo el dueño de la cita o admin puede cancelarla
    if (req.user.role !== "admin" && cita.usuario.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para cancelar esta cita" });
    }

    // Verificar que la cita no esté ya completada
    if (cita.estado === "completada") {
      return res.status(400).json({ error: "No se puede cancelar una cita completada" });
    }

    await cita.deleteOne();
    console.log('❌ Cita cancelada:', req.params.id);
    res.json({ message: "Cita cancelada exitosamente" });

  } catch (err) {
    console.error("❌ Error cancelando cita:", err);
    res.status(500).json({ error: "Error al cancelar cita" });
  }
});

/* ======================
   Dashboard Admin
   ====================== */
router.get("/admin/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {
    const [totalUsuarios, totalProductos, totalMascotas, totalCitas] = await Promise.all([
      User.countDocuments(),
      Producto.countDocuments(),
      Mascota.countDocuments(),
      Cita.countDocuments(),
    ]);

    // Estadísticas adicionales de citas
    const citasPorEstado = await Cita.aggregate([
      {
        $group: {
          _id: "$estado",
          count: { $sum: 1 }
        }
      }
    ]);

    const citasHoy = await Cita.countDocuments({
      fecha: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });

    res.json({ 
      totalUsuarios, 
      totalProductos, 
      totalMascotas, 
      totalCitas,
      citasPorEstado,
      citasHoy
    });
  } catch (error) {
    console.error("Error en dashboard:", error);
    res.status(500).json({ error: "Error al obtener datos del dashboard" });
  }
});

/* ======================
   Productos
   ====================== */
router.post("/productos", verifyToken, upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, descripcion, precio } = req.body;

    // Validaciones obligatorias
    if (!nombre || !descripcion || !precio) {
      return res.status(400).json({ 
        error: "Los campos nombre, descripción y precio son obligatorios" 
      });
    }

    if (!nombre.trim() || !descripcion.trim()) {
      return res.status(400).json({ error: "Nombre y descripción no pueden estar vacíos" });
    }

    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum < 0) {
      return res.status(400).json({ error: "El precio debe ser un número mayor o igual a 0" });
    }

    const nuevoProducto = new Producto({
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      precio: precioNum,
      imagen: req.file
        ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        : "",
      usuario: req.user.id,
    });

    await nuevoProducto.save();
    res.status(201).json({ msg: "Producto creado", producto: nuevoProducto });
  } catch (err) {
    console.error("Error creando producto:", err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      res.status(400).json({ msg: "Error de validación", errors });
    } else {
      res.status(500).json({ msg: "Error al crear producto", error: err.message });
    }
  }
});

// Listar productos sin necesidad de login
router.get("/productos", async (req, res) => {
  try {
    const productos = await Producto.find().populate("usuario", "name email telefono");

    const productosConImagen = productos.map((p) => ({
      ...p.toObject(),
      imagen: p.imagen
        ? p.imagen.startsWith("http")
          ? p.imagen
          : `${req.protocol}://${req.get("host")}${p.imagen}`
        : null,
    }));

    res.json(productosConImagen);
  } catch (err) {
    console.error("Error listando productos:", err);
    res.status(500).json({ msg: "Error al listar productos", error: err.message });
  }
});

router.get("/productos/:id", verifyToken, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id).populate("usuario", "name email telefono");
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
    
    const productoConImagen = {
      ...producto.toObject(),
      imagen: producto.imagen
        ? producto.imagen.startsWith("http")
          ? producto.imagen
          : `${req.protocol}://${req.get("host")}${producto.imagen}`
        : null,
    };
    
    res.json(productoConImagen);
  } catch (err) {
    console.error("Error obteniendo producto:", err);
    res.status(500).json({ msg: "Error al obtener producto", error: err.message });
  }
});

router.delete("/productos/:id", verifyToken, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

    if (req.user.role !== "admin" && producto.usuario.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para eliminar este producto" });
    }

    await producto.deleteOne();
    res.json({ msg: "Producto eliminado" });
  } catch (err) {
    console.error("Error eliminando producto:", err);
    res.status(500).json({ msg: "Error al eliminar producto", error: err.message });
  }
});

/* ======================
   Rutas adicionales para admin - Gestión de citas
   ====================== */

// Obtener todas las citas (solo admin)
router.get("/admin/citas", verifyToken, isAdmin, async (req, res) => {
  try {
    const { fecha, estado, tipo } = req.query;
    let query = {};

    // Filtros opcionales
    if (fecha) {
      const fechaNormalizada = normalizarFecha(fecha);
      query.fecha = fechaNormalizada;
    }

    if (estado) {
      query.estado = estado;
    }

    if (tipo) {
      query.tipo = tipo;
    }

    const citas = await Cita.find(query)
      .populate('mascota', 'nombre especie raza imagen')
      .populate('usuario', 'name email telefono')
      .sort({ fecha: 1, hora: 1 });

    res.json(citas);
  } catch (err) {
    console.error("Error obteniendo citas admin:", err);
    res.status(500).json({ error: "Error al obtener citas" });
  }
});

// Obtener cita específica (admin o dueño)
router.get("/citas/:id", verifyToken, async (req, res) => {
  try {
    const cita = await Cita.findById(req.params.id)
      .populate('mascota', 'nombre especie raza imagen usuario')
      .populate('usuario', 'name email telefono');

    if (!cita) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    // Verificar permisos
    if (req.user.role !== "admin" && cita.usuario._id.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para ver esta cita" });
    }

    res.json(cita);
  } catch (err) {
    console.error("Error obteniendo cita:", err);
    res.status(500).json({ error: "Error al obtener cita" });
  }
});

// Actualizar cita completa (admin o dueño antes de que sea confirmada)
router.put("/citas/:id", verifyToken, async (req, res) => {
  try {
    const cita = await Cita.findById(req.params.id);
    if (!cita) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    // Solo admin o dueño pueden modificar
    if (req.user.role !== "admin" && cita.usuario.toString() !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para modificar esta cita" });
    }

    // Los usuarios solo pueden modificar citas pendientes
    if (req.user.role !== "admin" && cita.estado !== "pendiente") {
      return res.status(400).json({ error: "Solo se pueden modificar citas pendientes" });
    }

    const { tipo, fecha, hora, motivo, notas } = req.body;

    // Validar nuevos datos si se proporcionan
    if (fecha && !esFechaValida(fecha)) {
      return res.status(400).json({ 
        error: "Fecha inválida. No se pueden agendar citas en el pasado o los domingos" 
      });
    }

    if (hora && !esHorarioValido(hora)) {
      return res.status(400).json({ 
        error: "Horario inválido. Los horarios de atención son: 7:00AM-12:00PM y 2:00PM-6:00PM" 
      });
    }

    // Verificar disponibilidad si cambia fecha u hora
    if ((fecha && fecha !== cita.fecha.toISOString().split('T')[0]) || 
        (hora && hora !== cita.hora)) {
      const fechaNormalizada = fecha ? normalizarFecha(fecha) : cita.fecha;
      const citaExistente = await Cita.findOne({ 
        fecha: fechaNormalizada, 
        hora: hora || cita.hora,
        _id: { $ne: cita._id }
      });
      
      if (citaExistente) {
        return res.status(400).json({ 
          error: "Ya existe una cita agendada para esa fecha y hora" 
        });
      }
    }

    // Actualizar campos
    if (tipo) cita.tipo = tipo;
    if (fecha) cita.fecha = normalizarFecha(fecha);
    if (hora) cita.hora = hora;
    if (motivo) cita.motivo = motivo.trim();
    if (notas !== undefined) cita.notas = notas.trim();

    await cita.save();
    
    await cita.populate([
      { path: 'mascota', select: 'nombre especie raza' },
      { path: 'usuario', select: 'name email telefono' }
    ]);

    res.json({ 
      message: "Cita actualizada exitosamente",
      cita 
    });

  } catch (err) {
    console.error("Error actualizando cita:", err);
    res.status(500).json({ error: "Error al actualizar cita" });
  }
});

// Obtener estadísticas de citas por fecha (admin)
router.get("/admin/citas/estadisticas", verifyToken, isAdmin, async (req, res) => {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const estadisticas = await Cita.aggregate([
      {
        $match: {
          fecha: { $gte: inicioMes, $lte: finMes }
        }
      },
      {
        $group: {
          _id: {
            dia: { $dayOfMonth: "$fecha" },
            estado: "$estado"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.dia",
          estados: {
            $push: {
              estado: "$_id.estado",
              count: "$count"
            }
          },
          total: { $sum: "$count" }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    res.json({
      mes: hoy.getMonth() + 1,
      año: hoy.getFullYear(),
      estadisticas
    });

  } catch (err) {
    console.error("Error obteniendo estadísticas:", err);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

/* ======================
   Salud
   ====================== */
router.get("/health", (req, res) => {
  console.log('🩺 Health check solicitado');
  res.json({ 
    ok: true, 
    message: "🩺 Servidor veterinario funcionando correctamente",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado'
  });
});

/* ======================
   Montar rutas
   ====================== */
app.use("/api", router);

/* ======================
   Manejo de errores global
   ====================== */
app.use((err, req, res, next) => {
  console.error("❌ Error no manejado:", err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 5MB.' });
    }
  }
  
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

/* ======================
   Servidor
   ====================== */
app.listen(PORT, () => {
  console.log("🚀=======================================");
  console.log(`🩺 Servidor Veterinario corriendo en:`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🔗 API disponible en: http://localhost:${PORT}/api`);
  console.log("🩺 Endpoints principales:");
  console.log("   • Salud: GET /api/health");
  console.log("   • Registro: POST /api/register");
  console.log("   • Login: POST /api/login");
  console.log("   • Actualizar Perfil: PUT /api/usuarios/perfil");
  console.log("   • Mascotas: GET/POST /api/mascotas");
  console.log("   • Citas: GET/POST /api/citas");
  console.log("   • Horarios: GET /api/citas/horarios-disponibles/:fecha");
  console.log("   • Admin Dashboard: GET /api/admin/dashboard");
  console.log("   • Productos: GET /api/productos");
  console.log("=======================================🚀");
});