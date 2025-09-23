const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();

// Importar modelos, middlewares y utilidades
const User = require('../models/User');
const { verifyToken, generateToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { 
  validateEmail, 
  validatePassword, 
  validatePhone, 
  validateAddress,
  sanitizeString
} = require('../utils/validators');
const { 
  sendVerificationEmail, 
  sendWelcomeEmail,
  sendPasswordResetEmail,
  generateVerificationToken,
  checkEmailRateLimit 
} = require('../utils/email');

// Configuración de Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// URLs de configuración
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

console.log('🔐 Rutas de autenticación cargadas');
console.log('🔑 Google Client ID configurado:', !!GOOGLE_CLIENT_ID);

// 📧 REGISTRO TRADICIONAL CON VERIFICACIÓN POR EMAIL
router.post('/register', async (req, res) => {
  try {
    let { name, email, password, telefono, direccion, role } = req.body;
    
    console.log('📝 Nueva solicitud de registro para:', email);

    // Sanitizar datos de entrada
    name = sanitizeString(name);
    email = sanitizeString(email)?.toLowerCase();

    // Validaciones básicas
    if (!name || !email || !password || !telefono || !direccion) {
      return res.status(400).json({ 
        error: "Todos los campos son obligatorios",
        campos: ["name", "email", "password", "telefono", "direccion"],
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validar email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ 
        error: emailValidation.message,
        code: 'INVALID_EMAIL'
      });
    }

    // Validar contraseña
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: passwordValidation.message,
        code: 'INVALID_PASSWORD'
      });
    }

    // Validar teléfono
    const phoneValidation = validatePhone(telefono);
    if (!phoneValidation.isValid) {
      return res.status(400).json({ 
        error: phoneValidation.message,
        code: 'INVALID_PHONE'
      });
    }

    // Validar dirección
    const addressValidation = validateAddress(direccion);
    if (!addressValidation.isValid) {
      return res.status(400).json({ 
        error: addressValidation.message,
        code: 'INVALID_ADDRESS'
      });
    }

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.emailVerified) {
        return res.status(400).json({ 
          error: "El correo ya está registrado y verificado",
          code: 'EMAIL_ALREADY_EXISTS'
        });
      } else {
        // Email existe pero no verificado - eliminar registro anterior
        await User.deleteOne({ _id: existingUser._id });
        console.log('🗑️ Registro anterior no verificado eliminado para:', email);
      }
    }

    // Generar token de verificación
    const verificationToken = generateVerificationToken();
    const tokenExpiration = new Date();
    tokenExpiration.setHours(tokenExpiration.getHours() + 24); // 24 horas

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Crear usuario pendiente de verificación
    const newUser = new User({ 
      name: name.trim(), 
      email, 
      password: hashedPassword, 
      telefono: telefono.trim(),
      direccion: {
        calle: direccion.calle.trim(),
        ciudad: direccion.ciudad.trim(),
        estado: direccion.estado.trim(),
        pais: direccion.pais ? direccion.pais.trim() : 'Colombia'
      },
      role: role === 'admin' ? 'user' : 'user', // Por seguridad, siempre crear como user
      emailVerificationToken: verificationToken,
      emailVerificationExpires: tokenExpiration,
      emailVerified: false,
      pendingActivation: true,
      authMethod: 'local'
    });

    await newUser.save();
    console.log('✅ Usuario creado pendiente de verificación:', email);

    // Enviar email de verificación
    const emailResult = await sendVerificationEmail(email, name, verificationToken);
    
    if (emailResult.success) {
      res.status(201).json({ 
        message: "Registro exitoso",
        requiresVerification: true,
        email: email,
        instructions: "Te hemos enviado un email de verificación. Revisa tu bandeja de entrada y spam, luego haz clic en el enlace para activar tu cuenta.",
        expiresIn: "24 horas"
      });
    } else {
      // Si falla el envío del email, eliminar el usuario creado
      await User.deleteOne({ _id: newUser._id });
      
      console.error('❌ Error enviando email de verificación:', emailResult.error);
      
      res.status(500).json({ 
        error: "Error al enviar email de verificación",
        code: "EMAIL_SEND_FAILED",
        message: "No pudimos enviar el email de verificación. Por favor, verifica tu conexión e intenta de nuevo.",
        details: process.env.NODE_ENV === 'development' ? emailResult.error : undefined
      });
    }

  } catch (error) {
    console.error("❌ Error en registro:", error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      res.status(400).json({ 
        error: "Error de validación", 
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    } else if (error.code === 11000) {
      res.status(400).json({ 
        error: "El email ya está registrado",
        code: 'DUPLICATE_EMAIL'
      });
    } else {
      res.status(500).json({ 
        error: "Error interno del servidor",
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

// 📧 VERIFICAR EMAIL
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('🔍 Verificando token de email:', token.substring(0, 10) + '...');

    // Validar formato del token
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ 
        error: "Token de verificación inválido",
        code: "INVALID_TOKEN_FORMAT"
      });
    }

    // Buscar usuario con el token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
      emailVerified: false
    });

    if (!user) {
      return res.status(400).json({ 
        error: "Token de verificación inválido o expirado",
        code: "TOKEN_NOT_FOUND",
        action: "Por favor, regístrate nuevamente o solicita un nuevo email de verificación"
      });
    }

    // Activar usuario
    user.emailVerified = true;
    user.pendingActivation = false;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    
    await user.save();
    
    console.log('✅ Email verificado exitosamente para:', user.email);

    // Enviar email de bienvenida
    await sendWelcomeEmail(user.email, user.name);

    res.json({
      success: true,
      message: "¡Email verificado exitosamente!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: true
      },
      redirectTo: "/login"
    });

  } catch (error) {
    console.error("❌ Error verificando email:", error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      code: "INTERNAL_ERROR"
    });
  }
});

// 📧 REENVIAR VERIFICACIÓN
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: "Email es requerido",
        code: 'MISSING_EMAIL'
      });
    }

    // Rate limiting
    if (!checkEmailRateLimit(email, 1)) {
      return res.status(429).json({ 
        error: "Debes esperar 1 minuto antes de solicitar otro email",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }

    // Buscar usuario no verificado
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerified: false,
      pendingActivation: true
    });

    if (!user) {
      return res.status(404).json({ 
        error: "No se encontró una cuenta pendiente de verificación con este email",
        code: "USER_NOT_FOUND"
      });
    }

    // Generar nuevo token
    const newToken = generateVerificationToken();
    const newExpiration = new Date();
    newExpiration.setHours(newExpiration.getHours() + 24);

    user.emailVerificationToken = newToken;
    user.emailVerificationExpires = newExpiration;
    await user.save();

    // Reenviar email
    const emailResult = await sendVerificationEmail(email, user.name, newToken);
    
    if (emailResult.success) {
      res.json({
        message: "Email de verificación reenviado exitosamente",
        email: email,
        expiresIn: "24 horas"
      });
    } else {
      res.status(500).json({
        error: "Error al reenviar email de verificación",
        code: "EMAIL_SEND_FAILED"
      });
    }

  } catch (error) {
    console.error("❌ Error reenviando email:", error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      code: "INTERNAL_ERROR"
    });
  }
});

// 🔐 LOGIN TRADICIONAL
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    
    email = sanitizeString(email)?.toLowerCase();
    
    console.log('🔐 Intento de login para:', email);
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: "Email y contraseña son obligatorios",
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Buscar usuario
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        error: "Credenciales inválidas",
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verificar si el email está verificado
    if (!user.emailVerified && !user.googleId) {
      return res.status(403).json({ 
        error: "Debes verificar tu email antes de iniciar sesión",
        requiresVerification: true,
        email: user.email,
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: "Credenciales inválidas",
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verificar si la cuenta está activa
    if (!user.isActive) {
      return res.status(403).json({
        error: "Cuenta desactivada. Contacta al administrador.",
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Generar tokens
    const token = generateToken({ id: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ id: user._id, role: user.role });

    // Actualizar último login
    await user.updateLastLogin();

    console.log('✅ Login exitoso para:', email);

    res.json({
      success: true,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        telefono: user.telefono,
        direccion: user.direccion,
        role: user.role,
        profilePicture: user.profilePicture,
        authMethod: user.authMethod,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin
      },
      tokens: {
        accessToken: token,
        refreshToken: refreshToken
      },
      redirectTo: user.role === "admin" ? "/admin" : "/dashboard"
    });

  } catch (error) {
    console.error("❌ Error en login:", error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      code: 'INTERNAL_ERROR'
    });
  }
});

// 🔄 REFRESH TOKEN
router.post('/refresh-token', verifyRefreshToken, async (req, res) => {
  try {
    const { id, role } = req.refreshTokenData;

    // Verificar que el usuario aún existe y está activo
    const user = await User.findById(id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "Usuario no válido",
        code: 'INVALID_USER'
      });
    }

    // Generar nuevos tokens
    const newToken = generateToken({ id, role });
    const newRefreshToken = generateRefreshToken({ id, role });

    res.json({
      success: true,
      tokens: {
        accessToken: newToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    console.error("❌ Error en refresh token:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      code: 'INTERNAL_ERROR'
    });
  }
});

// 🔍 VERIFICAR TOKEN ACTUAL
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -emailVerificationToken');
    
    if (!user) {
      return res.status(404).json({ 
        error: "Usuario no encontrado",
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        telefono: user.telefono,
        direccion: user.direccion,
        role: user.role,
        profilePicture: user.profilePicture,
        authMethod: user.authMethod,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error("❌ Error obteniendo usuario:", error);
    res.status(500).json({ 
      error: "Error interno del servidor",
      code: 'INTERNAL_ERROR'
    });
  }
});

// 🔄 ACTUALIZAR PERFIL
router.put('/profile', verifyToken, async (req, res) => {
  try {
    let { name, telefono, direccion } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        error: "Usuario no encontrado",
        code: 'USER_NOT_FOUND'
      });
    }

    // Validar y sanitizar datos
    if (name) {
      name = sanitizeString(name);
      if (name.length < 2) {
        return res.status(400).json({
          error: "El nombre debe tener al menos 2 caracteres",
          code: 'INVALID_NAME'
        });
      }
      user.name = name;
    }

    if (telefono) {
      const phoneValidation = validatePhone(telefono);
      if (!phoneValidation.isValid) {
        return res.status(400).json({
          error: phoneValidation.message,
          code: 'INVALID_PHONE'
        });
      }
      user.telefono = telefono.trim();
    }

    if (direccion) {
      const addressValidation = validateAddress(direccion);
      if (!addressValidation.isValid) {
        return res.status(400).json({
          error: addressValidation.message,
          code: 'INVALID_ADDRESS'
        });
      }
      user.direccion = {
        calle: direccion.calle.trim(),
        ciudad: direccion.ciudad.trim(),
        estado: direccion.estado.trim(),
        pais: direccion.pais ? direccion.pais.trim() : user.direccion.pais
      };
    }

    await user.save();

    console.log('✅ Perfil actualizado para usuario:', user.email);

    res.json({
      success: true,
      message: "Perfil actualizado exitosamente",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        telefono: user.telefono,
        direccion: user.direccion,
        role: user.role
      }
    });

  } catch (error) {
    console.error("❌ Error actualizando perfil:", error);
    res.status(500).json({ 
      error: "Error actualizando perfil",
      code: 'UPDATE_ERROR'
    });
  }
});

// 🔑 CAMBIAR CONTRASEÑA
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Contraseña actual y nueva son requeridas",
        code: 'MISSING_PASSWORDS'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: "Usuario no encontrado",
        code: 'USER_NOT_FOUND'
      });
    }

    // Verificar contraseña actual
    const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidCurrentPassword) {
      return res.status(401).json({
        error: "Contraseña actual incorrecta",
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Validar nueva contraseña
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: passwordValidation.message,
        code: 'INVALID_NEW_PASSWORD'
      });
    }

    // Hashear nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedNewPassword;
    await user.save();

    console.log('✅ Contraseña cambiada para usuario:', user.email);

    res.json({
      success: true,
      message: "Contraseña cambiada exitosamente"
    });

  } catch (error) {
    console.error("❌ Error cambiando contraseña:", error);
    res.status(500).json({
      error: "Error cambiando contraseña",
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

// 📧 RECUPERAR CONTRASEÑA
router.post('/forgot-password', async (req, res) => {
  try {
    let { email } = req.body;
    
    email = sanitizeString(email)?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: "Email es requerido",
        code: 'MISSING_EMAIL'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Por seguridad, siempre responder éxito aunque el usuario no exista
      return res.json({
        message: "Si existe una cuenta con ese email, recibirás instrucciones de recuperación"
      });
    }

    // Rate limiting para reset de contraseña
    if (!checkEmailRateLimit(email, 5)) { // 5 minutos
      return res.status(429).json({
        error: "Debes esperar 5 minutos antes de solicitar otro reset",
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    // Generar token de reset
    const resetToken = generateVerificationToken();
    const resetExpiration = new Date();
    resetExpiration.setHours(resetExpiration.getHours() + 1); // 1 hora

    // Guardar token en el usuario
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpiration;
    await user.save();

    // Enviar email
    const emailResult = await sendPasswordResetEmail(user.email, user.name, resetToken);
    
    if (emailResult.success) {
      console.log('✅ Email de reset enviado para:', email);
    } else {
      console.error('❌ Error enviando email de reset:', emailResult.error);
    }

    // Siempre responder éxito por seguridad
    res.json({
      message: "Si existe una cuenta con ese email, recibirás instrucciones de recuperación"
    });

  } catch (error) {
    console.error("❌ Error en forgot password:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      code: 'INTERNAL_ERROR'
    });
  }
});

// 🆔 OBTENER USUARIOS (solo admin)
router.get('/users', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: "Acceso restringido a administradores",
        code: 'ADMIN_REQUIRED'
      });
    }

    const { page = 1, limit = 10, search, role } = req.query;
    
    // Construir query de búsqueda
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role && ['user', 'admin'].includes(role)) {
      query.role = role;
    }

    // Paginación
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select('-password -emailVerificationToken -passwordResetToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalItems: totalCount,
        itemsPerPage: limitNum
      }
    });

  } catch (error) {
    console.error("❌ Error obteniendo usuarios:", error);
    res.status(500).json({
      error: "Error obteniendo usuarios",
      code: 'FETCH_USERS_ERROR'
    });
  }
});

// 🩺 HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Authentication API',
    timestamp: new Date().toISOString(),
    features: {
      registration: 'enabled',
      emailVerification: 'enabled',
      googleOAuth: GOOGLE_CLIENT_ID ? 'enabled' : 'disabled',
      passwordReset: 'enabled',
      refreshTokens: 'enabled'
    },
    endpoints: {
      'POST /register': 'Registro de usuario',
      'GET /verify-email/:token': 'Verificación de email',
      'POST /resend-verification': 'Reenviar verificación',
      'POST /login': 'Inicio de sesión',
      'POST /refresh-token': 'Renovar token',
      'GET /me': 'Obtener usuario actual',
      'PUT /profile': 'Actualizar perfil',
      'PUT /change-password': 'Cambiar contraseña',
      'POST /forgot-password': 'Recuperar contraseña',
      'GET /users': 'Listar usuarios (admin)',
      'GET /health': 'Estado del servicio'
    }
  });
});

module.exports = router;