const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 🔍 VERIFICAR VARIABLES DE ENTORNO
console.log('================================================');
console.log('🔧 VERIFICANDO CONFIGURACIÓN DEL SERVIDOR...');
console.log('================================================');
console.log('🔑 JWT_SECRET configurado:', !!process.env.JWT_SECRET ? '✅ SÍ' : '❌ NO');
console.log('💳 MERCADOPAGO_ACCESS_TOKEN configurado:', !!process.env.MERCADOPAGO_ACCESS_TOKEN ? '✅ SÍ' : '❌ NO');
console.log('📧 EMAIL configurado:', !!process.env.EMAIL_USER ? '✅ SÍ' : '❌ NO');
console.log('🌐 FRONTEND_URL:', process.env.FRONTEND_URL || '❌ NO ENCONTRADO');
console.log('🌐 BACKEND_URL:', process.env.BACKEND_URL || '❌ NO ENCONTRADO');
console.log('💾 MONGO_URI configurado:', !!process.env.MONGO_URI ? '✅ SÍ' : '❌ NO');
console.log('================================================');

const app = express();
const PORT = process.env.PORT || 5000;

// URLs del frontend y backend
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// 🌐 CONFIGURACIÓN DE CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// 🔧 MIDDLEWARES
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Crear carpeta uploads si no existe
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// Middleware adicional para manejo de preflight
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
  } else {
    next();
  }
});

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


app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mercadopago_configured: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
    mongodb_connected: mongoose.connection.readyState === 1,
    services: ['payments', 'auth', 'mascotas', 'productos', 'citas', 'cart']
  });
});

/* ======================
   MODELOS ACTUALIZADOS CON VERIFICACIÓN DE EMAIL Y CARRITO
   ====================== */

// ESQUEMA DE USUARIO ACTUALIZADO CON TELÉFONO, DIRECCIÓN, GOOGLE OAUTH Y VERIFICACIÓN EMAIL
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
    // CAMPOS PARA GOOGLE OAUTH
    googleId: { type: String, unique: true, sparse: true },
    profilePicture: { type: String },
    authMethod: { type: String, enum: ["local", "google", "both"], default: "local" },
    // 📧 CAMPOS PARA VERIFICACIÓN DE EMAIL - NUEVO
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    // Para usuarios de Google, el email ya está verificado
    pendingActivation: { type: Boolean, default: true } // True hasta que se verifique el email
  },
  { timestamps: true }
);

// 📧 MIDDLEWARE PARA VERIFICACIÓN AUTOMÁTICA DE GOOGLE - NUEVO
userSchema.pre('save', function(next) {
  if (this.googleId && !this.emailVerified) {
    this.emailVerified = true;
    this.pendingActivation = false;
  }
  next();
});

const User = mongoose.model("User", userSchema);

// 🛒 ESQUEMA DE CARRITO - NUEVO MODELO PARA PERSISTENCIA
const CartItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  image: {
    type: String,
  },
  category: {
    type: String,
    required: true,
  },
  stock: {
    type: Number,
  },
});

const CartSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true, // Un carrito por usuario
    index: true,
  },
  items: [CartItemSchema],
  total: {
    type: Number,
    default: 0,
  },
  itemCount: {
    type: Number,
    default: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Middleware para calcular totales antes de guardar
CartSchema.pre('save', function(next) {
  this.total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.lastUpdated = new Date();
  next();
});

// Método para limpiar items con cantidad 0
CartSchema.methods.cleanupItems = function() {
  this.items = this.items.filter(item => item.quantity > 0);
  return this;
};

const Cart = mongoose.model('Cart', CartSchema);

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

// ESQUEMA DE PRODUCTO ACTUALIZADO CON NUEVOS CAMPOS
const productoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, required: true, trim: true },
    precio: { type: Number, required: true, min: 0 },
    imagen: String,
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // NUEVOS CAMPOS AGREGADOS
    descuento: {
      tiene: { type: Boolean, default: false },
      porcentaje: { 
        type: Number, 
        default: 0, 
        min: 0, 
        max: 100,
        validate: {
          validator: function(v) {
            // Solo validar si tiene descuento
            if (this.descuento.tiene && (v <= 0 || v > 100)) {
              return false;
            }
            return true;
          },
          message: 'El porcentaje de descuento debe estar entre 1 y 100'
        }
      },
      fechaInicio: { type: Date },
      fechaFin: { type: Date }
    },
    garantia: {
      tiene: { type: Boolean, default: false },
      meses: { 
        type: Number, 
        default: 0, 
        min: 0,
        validate: {
          validator: function(v) {
            // Solo validar si tiene garantía
            if (this.garantia.tiene && v <= 0) {
              return false;
            }
            return true;
          },
          message: 'Los meses de garantía deben ser mayor a 0'
        }
      },
      descripcion: { type: String, default: "", trim: true }
    },
    envioGratis: { 
      type: Boolean, 
      default: false 
    },
    // Campos adicionales opcionales
    stock: { type: Number, default: 0, min: 0 },
    categoria: { 
      type: String, 
      enum: ["alimento", "juguetes", "medicamentos", "accesorios", "higiene", "otros"],
      default: "otros"
    },
    activo: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Método para calcular precio con descuento
productoSchema.methods.getPrecioConDescuento = function() {
  if (!this.descuento.tiene || this.descuento.porcentaje <= 0) {
    return this.precio;
  }
  
  // Verificar si el descuento está vigente
  const ahora = new Date();
  if (this.descuento.fechaInicio && ahora < this.descuento.fechaInicio) {
    return this.precio;
  }
  if (this.descuento.fechaFin && ahora > this.descuento.fechaFin) {
    return this.precio;
  }
  
  const descuentoDecimal = this.descuento.porcentaje / 100;
  return this.precio * (1 - descuentoDecimal);
};

// Método para verificar si el descuento está vigente
productoSchema.methods.isDescuentoVigente = function() {
  if (!this.descuento.tiene) return false;
  
  const ahora = new Date();
  if (this.descuento.fechaInicio && ahora < this.descuento.fechaInicio) {
    return false;
  }
  if (this.descuento.fechaFin && ahora > this.descuento.fechaFin) {
    return false;
  }
  
  return true;
};

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
   🤖 SISTEMA AUTOMÁTICO DE GESTIÓN DE CITAS
   ====================== */

// Función para actualizar estados de citas vencidas
const actualizarCitasVencidas = async () => {
  try {
    const ahora = new Date();
    console.log('🔄 Iniciando actualización de citas vencidas...');

    // Construir fecha actual para comparar solo fechas (sin tiempo)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // Para citas de hoy, verificar también la hora
    const ahoraHora = new Date().toTimeString().substring(0, 5); // formato HH:MM

    const result = await Cita.updateMany(
      {
        $and: [
          { estado: { $in: ['pendiente', 'confirmada'] } },
          {
            $or: [
              // Citas de días anteriores
              { fecha: { $lt: hoy } },
              // Citas de hoy pero con hora pasada
              {
                $and: [
                  { fecha: { $gte: hoy } },
                  { fecha: { $lt: new Date(hoy.getTime() + 24*60*60*1000) } },
                  { hora: { $lt: ahoraHora } }
                ]
              }
            ]
          }
        ]
      },
      {
        $set: { estado: 'completada' },
        $currentDate: { updatedAt: true }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ ${result.modifiedCount} citas actualizadas a estado "completada"`);
    } else {
      console.log('ℹ️ No hay citas vencidas para actualizar');
    }

    return result;
  } catch (error) {
    console.error('❌ Error actualizando citas vencidas:', error);
    return null;
  }
};

// Función para eliminar citas antiguas (más de 3 días)
const eliminarCitasAntiguas = async () => {
  try {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 3); // 3 días atrás
    fechaLimite.setHours(23, 59, 59, 999); // Final del día hace 3 días
    
    console.log('🗑️ Iniciando eliminación de citas antiguas...');
    console.log('📅 Eliminando citas anteriores a:', fechaLimite.toLocaleDateString());

    // Encontrar citas para eliminar (completadas y canceladas)
    const citasParaEliminar = await Cita.find({
      fecha: { $lt: fechaLimite },
      estado: { $in: ['completada', 'cancelada'] }
    }).populate('mascota', 'nombre').populate('usuario', 'name email');

    if (citasParaEliminar.length > 0) {
      console.log('📋 Citas que serán eliminadas:');
      citasParaEliminar.forEach(cita => {
        console.log(`  - ${cita.mascota?.nombre || 'Mascota'} (${cita.usuario?.name}) - ${cita.fecha.toLocaleDateString()} - ${cita.estado}`);
      });

      // Eliminar las citas
      const result = await Cita.deleteMany({
        fecha: { $lt: fechaLimite },
        estado: { $in: ['completada', 'cancelada'] }
      });

      console.log(`✅ ${result.deletedCount} citas eliminadas exitosamente`);
      return result;
    } else {
      console.log('ℹ️ No hay citas antiguas para eliminar');
      return { deletedCount: 0 };
    }

  } catch (error) {
    console.error('❌ Error eliminando citas antiguas:', error);
    return null;
  }
};

// Función principal de mantenimiento
const ejecutarMantenimientoCitas = async () => {
  console.log('🤖 === INICIANDO MANTENIMIENTO AUTOMÁTICO DE CITAS ===');
  console.log('🕐 Timestamp:', new Date().toLocaleString());

  try {
    // 1. Actualizar estados de citas vencidas
    const resultadoActualizacion = await actualizarCitasVencidas();
    
    // 2. Eliminar citas antiguas
    const resultadoEliminacion = await eliminarCitasAntiguas();

    // 3. Mostrar resumen
    console.log('📊 === RESUMEN DEL MANTENIMIENTO ===');
    console.log(`📝 Citas actualizadas: ${resultadoActualizacion?.modifiedCount || 0}`);
    console.log(`🗑️ Citas eliminadas: ${resultadoEliminacion?.deletedCount || 0}`);
    console.log('✅ Mantenimiento completado exitosamente');
    console.log('==========================================');

    return {
      success: true,
      citasActualizadas: resultadoActualizacion?.modifiedCount || 0,
      citasEliminadas: resultadoEliminacion?.deletedCount || 0,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('❌ Error en mantenimiento de citas:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

// Función para obtener estadísticas de citas
const obtenerEstadisticasCitas = async () => {
  try {
    const ahora = new Date();
    const hace3Dias = new Date();
    hace3Dias.setDate(hace3Dias.getDate() - 3);

    const stats = await Cita.aggregate([
      {
        $facet: {
          porEstado: [
            {
              $group: {
                _id: '$estado',
                count: { $sum: 1 }
              }
            }
          ],
          vencidas: [
            {
              $match: {
                fecha: { $lt: ahora },
                estado: { $in: ['pendiente', 'confirmada'] }
              }
            },
            {
              $count: 'total'
            }
          ],
          elegiblesEliminacion: [
            {
              $match: {
                fecha: { $lt: hace3Dias },
                estado: { $in: ['completada', 'cancelada'] }
              }
            },
            {
              $count: 'total'
            }
          ],
          total: [
            {
              $count: 'total'
            }
          ]
        }
      }
    ]);

    return {
      porEstado: stats[0].porEstado,
      citasVencidas: stats[0].vencidas[0]?.total || 0,
      elegiblesEliminacion: stats[0].elegiblesEliminacion[0]?.total || 0,
      totalCitas: stats[0].total[0]?.total || 0,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return null;
  }
};

/* ======================
   ⏰ CONFIGURACIÓN DEL SISTEMA AUTOMÁTICO
   ====================== */

// Ejecutar mantenimiento cada 2 horas (más frecuente para mejor actualización)
const INTERVALO_MANTENIMIENTO = 2 * 60 * 60 * 1000; // 2 horas

let intervalId = null;

// Iniciar el sistema automático
const iniciarSistemaAutomatico = () => {
  console.log('🚀 Iniciando sistema automático de gestión de citas...');
  console.log(`⏰ Configurado para ejecutarse cada ${INTERVALO_MANTENIMIENTO / (60 * 60 * 1000)} horas`);
  
  // Ejecutar una vez al iniciar (después de 30 segundos para dar tiempo al servidor)
  setTimeout(() => {
    console.log('🔄 Ejecutando mantenimiento inicial...');
    ejecutarMantenimientoCitas();
  }, 30000);
  
  // Programar ejecuciones periódicas
  intervalId = setInterval(ejecutarMantenimientoCitas, INTERVALO_MANTENIMIENTO);
  
  console.log('✅ Sistema automático iniciado exitosamente');
};

// Detener el sistema automático
const detenerSistemaAutomatico = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('🛑 Sistema automático detenido');
  }
};

/* ======================
   Middlewares de Auth
   ====================== */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(401).json({ error: "Acceso denegado: Debes iniciar sesion primero" });

  try {
    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token no proporcionado" });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Debes iniciar sesion primero" });
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

// FUNCIONES DE VALIDACIÓN
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

// FUNCIÓN PARA VALIDAR DATOS DE PRODUCTO
const validarProducto = (datos) => {
  const { nombre, descripcion, precio, descuento, garantia, categoria, stock } = datos;
  
  // Validaciones básicas
  if (!nombre || !descripcion || precio === undefined) {
    return { valido: false, mensaje: "Nombre, descripción y precio son obligatorios" };
  }
  
  if (precio < 0) {
    return { valido: false, mensaje: "El precio no puede ser negativo" };
  }
  
  // Validar descuento
  if (descuento && descuento.tiene) {
    if (!descuento.porcentaje || descuento.porcentaje <= 0 || descuento.porcentaje > 100) {
      return { valido: false, mensaje: "El porcentaje de descuento debe estar entre 1 y 100" };
    }
    
    if (descuento.fechaInicio && descuento.fechaFin) {
      if (new Date(descuento.fechaInicio) >= new Date(descuento.fechaFin)) {
        return { valido: false, mensaje: "La fecha de inicio del descuento debe ser anterior a la fecha de fin" };
      }
    }
  }
  
  // Validar garantía
  if (garantia && garantia.tiene) {
    if (!garantia.meses || garantia.meses <= 0) {
      return { valido: false, mensaje: "Los meses de garantía deben ser mayor a 0" };
    }
  }
  
  // Validar stock
  if (stock !== undefined && stock < 0) {
    return { valido: false, mensaje: "El stock no puede ser negativo" };
  }
  
  // Validar categoría
  const categoriasValidas = ["alimento", "juguetes", "medicamentos", "accesorios", "higiene", "otros"];
  if (categoria && !categoriasValidas.includes(categoria)) {
    return { valido: false, mensaje: "Categoría no válida" };
  }
  
  return { valido: true };
};

/* ======================
   📧 FUNCIONES DE EMAIL MEJORADAS - ACTUALIZADAS
   ====================== */

// Función para generar token de verificación
const generarTokenVerificacion = () => {
  return crypto.randomBytes(32).toString('hex');
};

// 📧 FUNCIÓN PARA LIMPIAR TOKENS EXPIRADOS - NUEVO
const limpiarTokensExpirados = async () => {
  try {
    const result = await User.deleteMany({
      emailVerificationExpires: { $lt: new Date() },
      emailVerified: false
    });
    console.log(`🗑️ Tokens expirados eliminados: ${result.deletedCount}`);
  } catch (error) {
    console.error('Error limpiando tokens:', error);
  }
};

// Ejecutar cada hora
setInterval(limpiarTokensExpirados, 60 * 60 * 1000);

// Plantilla HTML MEJORADA para email de verificación - con URLs dinámicas
const plantillaEmailVerificacion = (nombre, tokenVerificacion) => {
  const urlVerificacion = `${FRONTEND_URL}/verificar-email?token=${tokenVerificacion}`;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verificar Email - Clínica Veterinaria</title>
        <style>
            @media only screen and (max-width: 600px) {
                .container { width: 95% !important; padding: 20px !important; }
                .content { padding: 20px !important; }
                .verify-button { padding: 12px 20px !important; font-size: 14px !important; }
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .header {
                background: linear-gradient(135deg, #7c3aed, #6d28d9);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .content {
                padding: 40px 30px;
            }
            .verify-button {
                display: inline-block;
                background: linear-gradient(135deg, #7c3aed, #6d28d9);
                color: white !important;
                padding: 16px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                font-size: 16px;
                margin: 20px 0;
                transition: transform 0.2s;
            }
            .verify-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(124, 58, 237, 0.3);
            }
            .warning {
                background: #fef2f2;
                border-left: 4px solid #dc2626;
                padding: 16px;
                border-radius: 4px;
                margin: 20px 0;
            }
            .footer {
                background: #f8fafc;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #64748b;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🐾 Clínica Veterinaria</div>
                <p>Tu cuenta está casi lista</p>
            </div>
            
            <div class="content">
                <h2 style="color: #7c3aed; margin-bottom: 20px;">¡Hola ${nombre}!</h2>
                
                <p>Gracias por registrarte en nuestra clínica veterinaria. Solo necesitas verificar tu email para activar tu cuenta.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${urlVerificacion}" class="verify-button">
                        ✅ Verificar mi correo
                    </a>
                </div>
                
                <p>Si el botón no funciona, copia este enlace:</p>
                <p style="word-break: break-all; background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px;">
                    ${urlVerificacion}
                </p>
                
                <div class="warning">
                    <strong>⚠️ Importante:</strong> Este enlace expira en 24 horas.
                </div>
                
                <p><strong>Una vez verificado podrás:</strong></p>
                <ul style="color: #64748b;">
                    <li>Registrar tus mascotas</li>
                    <li>Agendar citas veterinarias</li>
                    <li>Acceder a nuestros productos</li>
                    <li>Gestionar tu perfil</li>
                    <li>Guardar tu carrito de compras</li>
                </ul>
            </div>
            
            <div class="footer">
                <p>Este email fue enviado desde Clínica Veterinaria</p>
                <p>Si no te registraste, puedes ignorar este mensaje</p>
                <p>© ${new Date().getFullYear()} Todos los derechos reservados</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Función mejorada para enviar email de verificación
const enviarEmailVerificacion = async (email, nombre, token) => {
  if (!transporter) {
    console.error('❌ Transporter no configurado');
    return { success: false, error: 'Servicio de email no configurado' };
  }

  try {
    const mailOptions = {
      from: {
        name: 'Clínica Veterinaria',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: '🐾 Verificar tu cuenta - Clínica Veterinaria',
      html: plantillaEmailVerificacion(nombre, token),
      // Opciones adicionales para mejorar entregabilidad
      replyTo: process.env.EMAIL_USER,
      headers: {
        'X-Mailer': 'Clinica-Veterinaria-App',
        'X-Priority': '3'
      }
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email de verificación enviado a:', email);
    console.log('📧 Message ID:', result.messageId);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    
    // Proporcionar mensajes de error más específicos
    let errorMessage = 'Error desconocido al enviar email';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Credenciales de email incorrectas. Verifica EMAIL_USER y EMAIL_PASS';
    } else if (error.code === 'ESOCKET') {
      errorMessage = 'Error de conexión con Gmail. Verifica tu conexión a internet';
    } else if (error.code === 'EENVELOPE') {
      errorMessage = 'Dirección de email inválida';
    }
    
    return { success: false, error: errorMessage, details: error.message };
  }
};

/* ======================
   FUNCIONES GOOGLE OAUTH - MEJORADAS
   ====================== */

// Función para verificar token de Google - MEJORADA
const verifyGoogleToken = async (token) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID, // Usar la constante correcta
    });
    
    const payload = ticket.getPayload();
    
    // Validar que el email esté verificado
    if (!payload.email_verified) {
      throw new Error('Email de Google no verificado');
    }
    
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified,
    };
  } catch (error) {
    console.error('Error verificando token de Google:', error);
    throw new Error('Token de Google inválido');
  }
};

/* ======================
   🛒 RUTAS DEL CARRITO - NUEVAS RUTAS PARA PERSISTENCIA
   ====================== */

// GET /api/cart/:userId - Obtener carrito del usuario
router.get("/cart/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar que el usuario solo pueda acceder a su propio carrito
    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      // Si no existe carrito, crear uno vacío
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }

    // Limpiar items expirados o inválidos si es necesario
    cart.cleanupItems();
    
    res.json({
      items: cart.items.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        category: item.category,
        stock: item.stock,
      })),
      total: cart.total,
      itemCount: cart.itemCount,
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

// POST /api/cart - Guardar/actualizar carrito del usuario
router.post("/cart", verifyToken, async (req, res) => {
  try {
    const { userId, items } = req.body;
    
    // Verificar que el usuario solo pueda actualizar su propio carrito
    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    // Validar items
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items debe ser un array' });
    }

    // Convertir items al formato del modelo
    const cartItems = items.map(item => ({
      productId: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      category: item.category,
      stock: item.stock,
    }));

    // Buscar carrito existente o crear uno nuevo
    let cart = await Cart.findOne({ userId });
    
    if (cart) {
      cart.items = cartItems;
    } else {
      cart = new Cart({ userId, items: cartItems });
    }

    // Limpiar items y guardar
    cart.cleanupItems();
    await cart.save();

    res.json({
      message: 'Carrito actualizado exitosamente',
      total: cart.total,
      itemCount: cart.itemCount,
    });
  } catch (error) {
    console.error('Error saving cart:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

// DELETE /api/cart/:userId - Limpiar carrito del usuario
router.delete("/cart/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar que el usuario solo pueda limpiar su propio carrito
    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    await Cart.findOneAndUpdate(
      { userId },
      { items: [], total: 0, itemCount: 0, lastUpdated: new Date() },
      { upsert: true }
    );

    res.json({ message: 'Carrito limpiado exitosamente' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

// PUT /api/cart/item - Agregar un item específico
router.put("/cart/item", verifyToken, async (req, res) => {
  try {
    const { userId, item } = req.body;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      cartItem => cartItem.productId === item.id
    );

    if (existingItemIndex > -1) {
      // Actualizar cantidad si el item ya existe
      cart.items[existingItemIndex].quantity += item.quantity || 1;
    } else {
      // Agregar nuevo item
      cart.items.push({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image,
        category: item.category,
        stock: item.stock,
      });
    }

    cart.cleanupItems();
    await cart.save();

    res.json({
      message: 'Item agregado al carrito',
      total: cart.total,
      itemCount: cart.itemCount,
    });
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

// DELETE /api/cart/item/:userId/:productId - Eliminar item específico
router.delete("/cart/item/:userId/:productId", verifyToken, async (req, res) => {
  try {
    const { userId, productId } = req.params;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Carrito no encontrado' });
    }

    cart.items = cart.items.filter(item => item.productId !== productId);
    await cart.save();

    res.json({
      message: 'Item eliminado del carrito',
      total: cart.total,
      itemCount: cart.itemCount,
    });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

// PUT /api/cart/quantity - Actualizar cantidad de un item
router.put("/cart/quantity", verifyToken, async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Carrito no encontrado' });
    }

    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item no encontrado en el carrito' });
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    cart.cleanupItems();
    await cart.save();

    res.json({
      message: 'Cantidad actualizada',
      total: cart.total,
      itemCount: cart.itemCount,
    });
  } catch (error) {
    console.error('Error updating item quantity:', error);
    res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
});

/* ======================
   📧 RUTAS DE AUTENTICACIÓN ACTUALIZADAS CON VERIFICACIÓN EMAIL
   ====================== */

// 📧 REGISTRO TRADICIONAL CON VERIFICACIÓN POR EMAIL - ACTUALIZADO
router.post("/register", verificarConfiguracionEmail, async (req, res) => {
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

    // Verificar si el email ya existe
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      if (exists.emailVerified) {
        return res.status(400).json({ error: "El correo ya está registrado y verificado" });
      } else {
        // Email existe pero no verificado - eliminar registro anterior
        await User.deleteOne({ _id: exists._id });
        console.log('🗑️ Registro anterior no verificado eliminado para:', email);
      }
    }

    // 📧 GENERAR TOKEN DE VERIFICACIÓN - NUEVO
    const tokenVerificacion = generarTokenVerificacion();
    const expiracionToken = new Date();
    expiracionToken.setHours(expiracionToken.getHours() + 24); // 24 horas

    const hashed = await bcrypt.hash(password, 10);
    
    // 📧 CREAR USUARIO PENDIENTE DE VERIFICACIÓN - ACTUALIZADO
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
      role,
      // 📧 CAMPOS DE VERIFICACIÓN - NUEVO
      emailVerificationToken: tokenVerificacion,
      emailVerificationExpires: expiracionToken,
      emailVerified: false,
      pendingActivation: true
    });

    await nuevoUsuario.save();
    console.log('📧 Usuario creado pendiente de verificación:', email);

    // 📧 ENVIAR EMAIL DE VERIFICACIÓN CON MEJOR MANEJO DE ERRORES
    const emailEnviado = await enviarEmailVerificacion(email, name, tokenVerificacion);
    
    if (emailEnviado.success) {
      res.status(201).json({ 
        message: "Registro iniciado exitosamente",
        requiereVerificacion: true,
        email: email,
        instrucciones: "Hemos enviado un email de verificación a tu correo. Por favor, revisa tu bandeja de entrada y spam, luego haz clic en el enlace para activar tu cuenta.",
        messageId: emailEnviado.messageId // Para debugging
      });
    } else {
      // Si falla el envío del email, eliminar el usuario creado
      await User.deleteOne({ _id: nuevoUsuario._id });
      
      console.error('❌ Error enviando email de verificación:', emailEnviado.error);
      
      res.status(500).json({ 
        error: "Error al enviar email de verificación",
        codigo: "EMAIL_SEND_FAILED",
        mensaje: "No pudimos enviar el email de verificación. Por favor, verifica tu conexión e intenta de nuevo.",
        detalles: process.env.NODE_ENV === 'development' ? emailEnviado.error : undefined
      });
    }

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

// 📧 RUTA PARA VERIFICAR EMAIL MEJORADA - NUEVO
router.get("/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('🔍 Verificando token:', token);

    // Validar formato del token
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ 
        error: "Token inválido",
        codigo: "INVALID_FORMAT",
        accion: "El formato del token no es válido"
      });
    }

    // Buscar usuario con el token
    const usuario = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }, // Token no expirado
      emailVerified: false
    });

    if (!usuario) {
      return res.status(400).json({ 
        error: "Token de verificación inválido o expirado",
        codigo: "TOKEN_NOT_FOUND",
        accion: "Por favor, regístrate nuevamente o solicita un nuevo email de verificación"
      });
    }

    // Activar usuario
    usuario.emailVerified = true;
    usuario.pendingActivation = false;
    usuario.emailVerificationToken = undefined;
    usuario.emailVerificationExpires = undefined;
    
    await usuario.save();
    
    console.log('✅ Email verificado exitosamente para:', usuario.email);

    res.json({
      success: true,
      message: "¡Email verificado exitosamente!",
      usuario: {
        id: usuario._id,
        name: usuario.name,
        email: usuario.email
      },
      redirigir: "/login"
    });

  } catch (error) {
    console.error("Error verificando email:", error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      codigo: "SERVER_ERROR"
    });
  }
});

// 📧 REENVIAR VERIFICACIÓN CON MIDDLEWARE - ACTUALIZADO
router.post("/resend-verification", verificarConfiguracionEmail, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email es requerido" });
    }

    // Verificar rate limiting
    if (!checkEmailRateLimit(email)) {
      return res.status(429).json({ 
        error: "Debes esperar 1 minuto antes de solicitar otro email",
        codigo: "RATE_LIMIT",
        tiempoEspera: "60 segundos"
      });
    }

    // Buscar usuario no verificado
    const usuario = await User.findOne({
      email: email.toLowerCase(),
      emailVerified: false,
      pendingActivation: true
    });

    if (!usuario) {
      return res.status(404).json({ 
        error: "No se encontró una cuenta pendiente de verificación con este email",
        codigo: "USER_NOT_FOUND"
      });
    }

    // Generar nuevo token
    const nuevoToken = generarTokenVerificacion();
    const nuevaExpiracion = new Date();
    nuevaExpiracion.setHours(nuevaExpiracion.getHours() + 24);

    usuario.emailVerificationToken = nuevoToken;
    usuario.emailVerificationExpires = nuevaExpiracion;
    await usuario.save();

    // Reenviar email
    const emailEnviado = await enviarEmailVerificacion(email, usuario.name, nuevoToken);
    
    if (emailEnviado.success) {
      res.json({
        message: "Email de verificación reenviado exitosamente",
        email: email,
        expiraEn: "24 horas",
        instrucciones: "Revisa tu bandeja de entrada y spam. El enlace expira en 24 horas."
      });
    } else {
      res.status(500).json({
        error: "Error al reenviar email de verificación",
        codigo: "EMAIL_SEND_FAILED",
        detalles: process.env.NODE_ENV === 'development' ? emailEnviado.error : undefined
      });
    }

  } catch (error) {
    console.error("Error reenviando email:", error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      codigo: "SERVER_ERROR"
    });
  }
});

// 📧 LOGIN ACTUALIZADO PARA VERIFICAR EMAIL - MODIFICADO
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son obligatorios" });
    }

    const u = await User.findOne({ email: email.toLowerCase() });
    if (!u) return res.status(400).json({ error: "Usuario no encontrado" });

    // 📧 VERIFICAR SI EL EMAIL ESTÁ VERIFICADO (solo para usuarios locales) - NUEVO
    if (!u.googleId && !u.emailVerified) {
      return res.status(403).json({ 
        error: "Debes verificar tu email antes de iniciar sesión",
        requiereVerificacion: true,
        email: u.email,
        mensaje: "Revisa tu bandeja de entrada y haz clic en el enlace de verificación"
      });
    }

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
        role: u.role,
        profilePicture: u.profilePicture,
        authMethod: u.googleId ? 'both' : 'local',
        emailVerified: u.emailVerified
      },
      token,
      redirectTo: u.role === "admin" ? "/admin" : "/home",
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// 📧 ENDPOINT PARA VERIFICAR ESTADO DEL SERVICIO DE EMAIL - NUEVO
router.get("/email/status", verifyToken, isAdmin, (req, res) => {
  const status = {
    configured: !!transporter,
    emailUser: process.env.EMAIL_USER || 'No configurado',
    hasEmailPass: !!(process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'tu-password-de-aplicacion'),
    service: 'Gmail'
  };

  if (status.configured) {
    res.json({
      status: 'Configurado correctamente',
      ...status,
      message: 'El servicio de email está listo para usar'
    });
  } else {
    res.status(500).json({
      status: 'No configurado',
      ...status,
      error: 'El servicio de email no está configurado correctamente',
      instrucciones: [
        '1. Configura EMAIL_USER en .env con tu email de Gmail',
        '2. Configura EMAIL_PASS en .env con una contraseña de aplicación',
        '3. Reinicia el servidor'
      ]
    });
  }
});

/* ======================
   GOOGLE OAUTH ROUTES - MEJORADAS CON VERIFICACIÓN
   ====================== */

// Ruta para autenticación con Google - MEJORADA
router.post("/auth/google", async (req, res) => {
  try {
    const { credential, userData } = req.body;
    
    console.log('📧 Iniciando autenticación con Google...');
    
    if (!credential) {
      return res.status(400).json({ error: "Token de Google requerido" });
    }

    // Verificar el token con Google
    const googleUser = await verifyGoogleToken(credential);
    console.log('✅ Usuario de Google verificado:', googleUser.email);

    // Buscar usuario existente por email o googleId
    let usuario = await User.findOne({ 
      $or: [
        { email: googleUser.email.toLowerCase() },
        { googleId: googleUser.googleId }
      ]
    });

    if (usuario) {
      // Usuario existente - hacer login
      console.log('👤 Usuario existente encontrado, iniciando sesión...');
      
      // Actualizar datos de Google si no los tiene
      if (!usuario.googleId) {
        usuario.googleId = googleUser.googleId;
        usuario.profilePicture = googleUser.picture;
        usuario.authMethod = 'both';
        // 📧 PARA USUARIOS DE GOOGLE, EL EMAIL YA ESTÁ VERIFICADO - NUEVO
        usuario.emailVerified = true;
        usuario.pendingActivation = false;
        await usuario.save();
        console.log('🔄 Datos de Google agregados al usuario existente');
      }

      const token = jwt.sign({ id: usuario._id, role: usuario.role }, JWT_SECRET, { expiresIn: "1d" });

      res.json({
        user: {
          id: usuario._id,
          name: usuario.name,
          email: usuario.email,
          telefono: usuario.telefono,
          direccion: usuario.direccion,
          role: usuario.role,
          profilePicture: usuario.profilePicture || googleUser.picture,
          authMethod: usuario.googleId ? 'both' : 'google',
          emailVerified: true // 📧 GOOGLE EMAILS SIEMPRE ESTÁN VERIFICADOS
        },
        token,
        redirectTo: usuario.role === "admin" ? "/admin" : "/home",
        message: "Sesión iniciada con Google"
      });

    } else {
      // Usuario nuevo - necesita completar registro
      console.log('🆕 Usuario nuevo de Google, requiere datos adicionales...');
      
      // Verificar si se proporcionaron datos adicionales
      if (!userData || !userData.telefono || !userData.direccion) {
        return res.json({
          requiresAdditionalInfo: true,
          googleUser: {
            name: googleUser.name,
            email: googleUser.email,
            picture: googleUser.picture,
            googleId: googleUser.googleId
          },
          message: "Se requiere información adicional para completar el registro"
        });
      }

      // Validar datos adicionales
      if (!validarTelefono(userData.telefono)) {
        return res.status(400).json({ 
          error: "El teléfono debe tener un formato válido (7-15 dígitos)" 
        });
      }

      const validacionDireccion = validarDireccion(userData.direccion);
      if (!validacionDireccion.valido) {
        return res.status(400).json({ error: validacionDireccion.mensaje });
      }

      // Crear nuevo usuario
      const hashedPassword = await bcrypt.hash("google_oauth_" + googleUser.googleId, 10);
      
      const nuevoUsuario = new User({
        name: googleUser.name,
        email: googleUser.email.toLowerCase(),
        password: hashedPassword,
        telefono: userData.telefono.trim(),
        direccion: {
          calle: userData.direccion.calle.trim(),
          ciudad: userData.direccion.ciudad.trim(),
          estado: userData.direccion.estado.trim(),
          pais: userData.direccion.pais || 'Colombia'
        },
        googleId: googleUser.googleId,
        profilePicture: googleUser.picture,
        authMethod: 'google',
        role: "user",
        // 📧 PARA USUARIOS DE GOOGLE, EL EMAIL YA ESTÁ VERIFICADO - NUEVO
        emailVerified: true,
        pendingActivation: false
      });

      await nuevoUsuario.save();
      console.log('✅ Nuevo usuario creado con Google:', nuevoUsuario.email);

      const token = jwt.sign({ id: nuevoUsuario._id, role: nuevoUsuario.role }, JWT_SECRET, { expiresIn: "1d" });

      res.status(201).json({
        user: {
          id: nuevoUsuario._id,
          name: nuevoUsuario.name,
          email: nuevoUsuario.email,
          telefono: nuevoUsuario.telefono,
          direccion: nuevoUsuario.direccion,
          role: nuevoUsuario.role,
          profilePicture: nuevoUsuario.profilePicture,
          authMethod: 'google',
          emailVerified: true // 📧 GOOGLE EMAILS SIEMPRE ESTÁN VERIFICADOS
        },
        token,
        redirectTo: "/home",
        message: "Cuenta creada exitosamente con Google"
      });
    }

  } catch (error) {
    console.error("❌ Error en autenticación con Google:", error);
    
    if (error.message === 'Token de Google inválido' || error.message === 'Email de Google no verificado') {
      return res.status(401).json({ error: error.message });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ error: "El email ya está registrado" });
    }
    
    res.status(500).json({ 
      error: "Error en el servidor durante autenticación con Google",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ruta para vincular cuenta de Google (usuario ya logueado)
router.post("/auth/google/link", verifyToken, async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: "Token de Google requerido" });
    }

    const googleUser = await verifyGoogleToken(credential);
    const usuario = await User.findById(req.user.id);

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Verificar que el email coincida
    if (googleUser.email.toLowerCase() !== usuario.email.toLowerCase()) {
      return res.status(400).json({ 
        error: "El email de Google debe coincidir con el email de tu cuenta" 
      });
    }

    // Vincular cuenta
    usuario.googleId = googleUser.googleId;
    usuario.profilePicture = googleUser.picture;
    await usuario.save();

    res.json({
      message: "Cuenta de Google vinculada exitosamente",
      user: {
        id: usuario._id,
        name: usuario.name,
        email: usuario.email,
        profilePicture: usuario.profilePicture,
        hasGoogleAuth: true
      }
    });

  } catch (error) {
    console.error("Error vinculando cuenta de Google:", error);
    res.status(500).json({ error: "Error al vincular cuenta de Google" });
  }
});

// Ruta para desvincular Google
router.delete("/auth/google/unlink", verifyToken, async (req, res) => {
  try {
    const usuario = await User.findById(req.user.id);
    
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (!usuario.googleId) {
      return res.status(400).json({ error: "No hay cuenta de Google vinculada" });
    }

    usuario.googleId = undefined;
    usuario.profilePicture = undefined;
    await usuario.save();

    res.json({ message: "Cuenta de Google desvinculada exitosamente" });

  } catch (error) {
    console.error("Error desvinculando Google:", error);
    res.status(500).json({ error: "Error al desvincular cuenta de Google" });
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

// RUTA PARA ACTUALIZAR PERFIL DE USUARIO
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
   📡 RUTAS DE API PARA MANTENIMIENTO AUTOMÁTICO DE CITAS
   ====================== */

// Ruta para ejecutar mantenimiento manual (solo admin)
router.post("/admin/citas/mantenimiento", verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('🔧 Mantenimiento manual solicitado por admin:', req.user.id);
    const resultado = await ejecutarMantenimientoCitas();
    
    res.json({
      message: 'Mantenimiento ejecutado exitosamente',
      ...resultado
    });
    
  } catch (error) {
    console.error('Error en mantenimiento manual:', error);
    res.status(500).json({ 
      error: 'Error ejecutando mantenimiento',
      details: error.message 
    });
  }
});

// Ruta para obtener estadísticas de mantenimiento (solo admin)
router.get("/admin/citas/estadisticas-mantenimiento", verifyToken, isAdmin, async (req, res) => {
  try {
    const estadisticas = await obtenerEstadisticasCitas();
    
    if (estadisticas) {
      res.json(estadisticas);
    } else {
      res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Ruta para obtener configuración del sistema automático (solo admin)
router.get("/admin/citas/config-automatico", verifyToken, isAdmin, (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mercadopago_configured: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
    mercadopago_token_type: process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('TEST-') ? 'TEST' : 
                           process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('APP_USR-') ? 'PRODUCTION' : 'UNKNOWN',
    mongodb_connected: mongoose.connection.readyState === 1,
    services: ['payments', 'auth', 'mascotas', 'productos', 'citas', 'cart']
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mercadopago_configured: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
    mongodb_connected: mongoose.connection.readyState === 1,
    services: ['payments', 'auth', 'mascotas', 'productos', 'citas', 'cart']
  });
});

// Ruta para categorías disponibles
app.get('/api/productos/categorias/disponibles', (req, res) => {
  const categorias = [
    { value: 'alimento', label: 'Alimento' },
    { value: 'juguetes', label: 'Juguetes' },
    { value: 'medicamentos', label: 'Medicamentos' },
    { value: 'accesorios', label: 'Accesorios' },
    { value: 'higiene', label: 'Higiene' },
    { value: 'otros', label: 'Otros' }
  ];
  res.json(categorias);
});

// 🔧 Ruta para poblar base de datos (SOLO EN DESARROLLO)
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  app.post('/api/seed-database', async (req, res) => {
    try {
      console.log('🌱 Poblando base de datos...');
      
      const User = require('./models/User');
      const Producto = require('./models/Producto');
      const bcrypt = require('bcryptjs');
      
      const userCount = await User.countDocuments();
      const productCount = await Producto.countDocuments();
      
      if (userCount > 0 && productCount > 0) {
        return res.json({ 
          success: true, 
          message: 'Base de datos ya tiene datos',
          counts: { usuarios: userCount, productos: productCount }
        });
      }
      
      // Crear usuario admin si no existe
      const adminExists = await User.findOne({ email: 'admin@veterinaria.com' });
      if (!adminExists) {
        const adminPassword = await bcrypt.hash('admin123', 12);
        await User.create({
          name: 'Admin Veterinaria',
          email: 'admin@veterinaria.com',
          password: adminPassword,
          role: 'admin',
          emailVerified: true,
          telefono: '+57 300 123 4567',
          direccion: {
            calle: 'Calle 100 # 20-30',
            ciudad: 'Bogotá',
            estado: 'Cundinamarca',
            pais: 'Colombia'
          }
        });
      }
      
      // Crear productos de prueba
      const productos = [
        {
          nombre: 'Alimento Premium para Perros',
          descripcion: 'Alimento balanceado de alta calidad para perros adultos. Rico en proteínas y vitaminas.',
          precio: 45000,
          categoria: 'alimento',
          stock: 50,
          marca: 'Royal Canin',
          peso: 3000,
          destacado: true,
          nuevo: true,
          tags: ['perros', 'alimento', 'premium']
        },
        {
          nombre: 'Collar Antipulgas para Gatos',
          descripcion: 'Collar efectivo contra pulgas y garrapatas. Protección por 6 meses.',
          precio: 25000,
          categoria: 'accesorios',
          stock: 30,
          marca: 'Seresto',
          destacado: true,
          tags: ['gatos', 'antipulgas', 'collar']
        },
        {
          nombre: 'Juguete Interactivo Kong',
          descripcion: 'Juguete resistente para perros. Ideal para mantener entretenidas a las mascotas.',
          precio: 35000,
          categoria: 'juguetes',
          stock: 25,
          marca: 'Kong',
          color: 'Rojo',
          tags: ['perros', 'juguete', 'resistente']
        },
        {
          nombre: 'Shampoo Medicinal',
          descripcion: 'Shampoo especial para pieles sensibles y problemas dermatológicos.',
          precio: 28000,
          categoria: 'higiene',
          stock: 40,
          marca: 'Virbac',
          tags: ['higiene', 'medicinal', 'piel sensible']
        },
        {
          nombre: 'Vitaminas para Mascotas',
          descripcion: 'Complejo vitamínico para fortalecer el sistema inmune de perros y gatos.',
          precio: 32000,
          categoria: 'medicamentos',
          stock: 35,
          marca: 'Pet-Tabs',
          fechaVencimiento: new Date('2025-12-31'),
          tags: ['vitaminas', 'salud', 'inmunidad']
        }
      ];
      
      await Producto.insertMany(productos);
      
      res.json({ 
        success: true, 
        message: 'Base de datos poblada exitosamente',
        created: {
          productos: productos.length,
          admin: adminExists ? 0 : 1
        }
      });
    } catch (error) {
      console.error('Error poblando DB:', error);
      res.status(500).json({ 
        error: 'Error poblando base de datos', 
        details: error.message 
      });
    }
  });
}

// 🛣️ IMPORTAR Y USAR RUTAS
const paymentRoutes = require('./routes/payments');
const authRoutes = require('./routes/auth');
const mascotasRoutes = require('./routes/mascotas');
const productosRoutes = require('./routes/productos');
const citasRoutes = require('./routes/citas');
const cartRoutes = require('./routes/cart');

app.use('/api/payments', paymentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/mascotas', mascotasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/cart', cartRoutes);

// Ruta de información de API
app.get('/api', (req, res) => {
  res.json({
    message: 'API Clínica Veterinaria',
    version: '1.0.0',
    endpoints: {
      payments: '/api/payments',
      auth: '/api/auth',
      mascotas: '/api/mascotas',
      productos: '/api/productos',
      citas: '/api/citas',
      cart: '/api/cart',
      health: '/health'
    }
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error("❌ Error no manejado:", err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log("🚀=======================================");
  console.log(`🩺 Servidor Veterinario corriendo en:`);
  console.log(`📍 ${BACKEND_URL}`);
  console.log(`🔗 API disponible en: ${BACKEND_URL}/api`);
  console.log(`🔗 Health check: ${BACKEND_URL}/health`);
  console.log("🛣️  Rutas principales:");
  console.log("   • Pagos: /api/payments");
  console.log("   • Autenticación: /api/auth");
  console.log("   • Mascotas: /api/mascotas");
  console.log("   • Productos: /api/productos");
  console.log("   • Citas: /api/citas");
  console.log("   • Carrito: /api/cart");
  console.log("=======================================🚀");
});

module.exports = app;