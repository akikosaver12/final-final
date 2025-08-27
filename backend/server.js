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

// 📂 Crear carpeta uploads si no existe
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

/* ======================
   📌 Conexión a MongoDB Atlas
   ====================== */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // ⏱ para cortar si no conecta
    });
    console.log("✅ Conectado a MongoDB Atlas");
  } catch (err) {
    console.error("❌ Error al conectar MongoDB:", err.message);
    process.exit(1); // detener servidor si no conecta
  }
};
connectDB();

/* ======================
   📌 Modelos
   ====================== */
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: "user" },
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

const mascotaSchema = new mongoose.Schema(
  {
    nombre: String,
    especie: String,
    raza: String,
    edad: Number,
    genero: String,
    estado: String,
    enfermedades: String,
    historial: String,
    imagen: String,
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
const Mascota = mongoose.model("Mascota", mascotaSchema);

const productoSchema = new mongoose.Schema(
  {
    nombre: String,
    descripcion: String,
    precio: Number,
    imagen: String,
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
const Producto = mongoose.model("Producto", productoSchema);

/* ======================
   📌 Middlewares de Auth
   ====================== */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(401).json({ error: "Acceso denegado: falta Authorization" });

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Token inválido" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "No tienes permisos de administrador" });
  next();
};

/* ======================
   📌 Configuración de Multer
   ====================== */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const upload = multer({ storage });

/* ======================
   📌 Rutas de Autenticación
   ====================== */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "El correo ya está registrado" });

    const hashed = await bcrypt.hash(password, 10);
    await new User({ name, email, password: hashed, role }).save();

    res.status(201).json({ message: "Usuario registrado con éxito" });
  } catch {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
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
  } catch {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Quién soy
router.get("/auth/me", verifyToken, async (req, res) => {
  const me = await User.findById(req.user.id).select("-password");
  res.json(me);
});

/* ======================
   📌 Usuarios & Mascotas
   ====================== */
router.get("/usuarios", verifyToken, isAdmin, async (_req, res) => {
  const usuarios = await User.find().select("-password");

  const usuariosConMascotas = await Promise.all(
    usuarios.map(async (u) => {
      const totalMascotas = await Mascota.countDocuments({ usuario: u._id });
      return { ...u.toObject(), totalMascotas };
    })
  );

  res.json(usuariosConMascotas);
});

router.get("/usuarios/:id/mascotas", verifyToken, async (req, res) => {
  const usuario = await User.findById(req.params.id).select("name email");
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

  if (req.user.role !== "admin" && req.user.id !== req.params.id) {
    return res.status(403).json({ error: "No autorizado para ver estas mascotas" });
  }

  const mascotas = await Mascota.find({ usuario: req.params.id });
  res.json({ usuario, mascotas });
});

/* ======================
   📌 Mascotas
   ====================== */
router.post("/mascotas", verifyToken, upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, especie, raza, edad, genero, estado, enfermedades, historial } = req.body;

    const nuevaMascota = new Mascota({
      nombre,
      especie,
      raza,
      edad,
      genero,
      estado,
      enfermedades,
      historial,
      imagen: req.file
        ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        : null,
      usuario: req.user.id,
    });

    await nuevaMascota.save();
    res.status(201).json({ msg: "Mascota registrada", mascota: nuevaMascota });
  } catch (err) {
    res.status(500).json({ msg: "Error en el servidor", error: err.message });
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
    res.status(500).json({ message: "Error al listar mascotas", error });
  }
});

/* ======================
   📌 Dashboard Admin
   ====================== */
router.get("/admin/dashboard", verifyToken, isAdmin, async (_req, res) => {
  const [totalUsuarios, totalProductos, totalMascotas] = await Promise.all([
    User.countDocuments(),
    Producto.countDocuments(),
    Mascota.countDocuments(),
  ]);

  res.json({ totalUsuarios, totalProductos, totalMascotas });
});


/* ======================
   📌 Productos
   ====================== */

// 📌 Crear un producto
router.post("/productos", verifyToken, upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, descripcion, precio } = req.body;

    const nuevoProducto = new Producto({
      nombre,
      descripcion,
      precio,
      imagen: req.file
        ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        : null,
      usuario: req.user.id,
    });

    await nuevoProducto.save();
    res.status(201).json({ msg: "Producto creado", producto: nuevoProducto });
  } catch (err) {
    res.status(500).json({ msg: "Error al crear producto", error: err.message });
  }
});

// 📌 Obtener todos los productos
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
    res.status(500).json({ msg: "Error al listar productos", error: err.message });
  }
});

// 📌 Obtener un producto por ID
router.get("/productos/:id", verifyToken, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id).populate("usuario", "name email");
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(producto);
  } catch (err) {
    res.status(500).json({ msg: "Error al obtener producto", error: err.message });
  }
});

// 📌 Eliminar producto (solo admin o dueño)
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
    res.status(500).json({ msg: "Error al eliminar producto", error: err.message });
  }
});


/* ======================
   📌 Salud
   ====================== */
router.get("/health", (_req, res) => res.json({ ok: true }));

/* ======================
   📌 Montar rutas
   ====================== */
app.use("/api", router);

/* ======================
   📌 Servidor
   ====================== */
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));
