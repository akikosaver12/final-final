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
   Modelos
   ====================== */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, trim: true },
    password: { type: String, required: true },
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
   Rutas de Autenticación
   ====================== */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Validaciones básicas
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "El correo ya está registrado" });

    const hashed = await bcrypt.hash(password, 10);
    await new User({ name, email, password: hashed, role }).save();

    res.status(201).json({ message: "Usuario registrado con éxito" });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son obligatorios" });
    }

    const u = await User.findOne({ email });
    if (!u) return res.status(400).json({ error: "Usuario no encontrado" });

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: u._id, role: u.role }, JWT_SECRET, { expiresIn: "1d" });

    res.json({
      user: { id: u._id, name: u.name, email: u.email, role: u.role },
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

/* ======================
   Usuarios & Mascotas
   ====================== */
router.get("/usuarios", verifyToken, isAdmin, async (req, res) => {
  try {
    const usuarios = await User.find().select("-password");

    const usuariosConMascotas = await Promise.all(
      usuarios.map(async (u) => {
        const totalMascotas = await Mascota.countDocuments({ usuario: u._id });
        return { ...u.toObject(), totalMascotas };
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
    const usuario = await User.findById(req.params.id).select("name email");
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
    const mascotas = await Mascota.find({ usuario: req.user.id }).populate("usuario", "name email");

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
    const mascota = await Mascota.findById(req.params.id).populate("usuario", "name email");
    
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

// 👉 Agregar vacuna a mascota
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
   Dashboard Admin
   ====================== */
router.get("/admin/dashboard", verifyToken, isAdmin, async (req, res) => {
  try {
    const [totalUsuarios, totalProductos, totalMascotas] = await Promise.all([
      User.countDocuments(),
      Producto.countDocuments(),
      Mascota.countDocuments(),
    ]);

    res.json({ totalUsuarios, totalProductos, totalMascotas });
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






router.get("/productos", verifyToken, async (req, res) => {
  try {
    const productos = await Producto.find().populate("usuario", "name email");

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
    const producto = await Producto.findById(req.params.id).populate("usuario", "name email");
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
   Salud
   ====================== */
router.get("/health", (req, res) => res.json({ ok: true }));

/* ======================
   Montar rutas
   ====================== */
app.use("/api", router);

/* ======================
   Servidor
   ====================== */
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));