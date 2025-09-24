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

// 🔍 Rutas de health check - DEBEN IR ANTES DE OTRAS RUTAS
app.get('/health', (req, res) => {
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