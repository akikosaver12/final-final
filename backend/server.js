const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// 🚨 CARGAR VARIABLES DE ENTORNO ANTES QUE NADA
require('dotenv').config();

// 🔍 VERIFICACIÓN DE VARIABLES DE ENTORNO
console.log('🔍 === VERIFICACIÓN DE VARIABLES DE ENTORNO ===');
console.log('📁 Directorio actual:', __dirname);
console.log('🔑 MERCADOPAGO_ACCESS_TOKEN:', process.env.MERCADOPAGO_ACCESS_TOKEN ? '✅ CARGADO' : '❌ NO ENCONTRADO');
if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
  console.log('🔑 Token (primeros 20 chars):', process.env.MERCADOPAGO_ACCESS_TOKEN.substring(0, 20) + '...');
  console.log('🔑 Token length:', process.env.MERCADOPAGO_ACCESS_TOKEN.length);
  console.log('🔑 Empieza con TEST-:', process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-') ? '✅ SÍ' : '❌ NO');
}
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
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://accounts.google.com',
    'https://www.googleapis.com'
  ],
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// 🔍 Ruta de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mercadopago_configured: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
    mercadopago_token_type: process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('TEST-') ? 'TEST' : 
                           process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('APP_USR-') ? 'PRODUCTION' : 'UNKNOWN',
    mongodb_connected: mongoose.connection.readyState === 1,
    services: ['payments', 'auth', 'mascotas', 'productos', 'citas', 'cart']
  });
});

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