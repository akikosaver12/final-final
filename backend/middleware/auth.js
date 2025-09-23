const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

// Middleware para verificar token JWT
const verifyToken = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ 
        error: "Token de acceso requerido",
        code: "MISSING_TOKEN"
      });
    }

    // Extraer token (formato: "Bearer TOKEN")
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ 
        error: "Formato de token inválido",
        code: "INVALID_TOKEN_FORMAT"
      });
    }

    // Verificar y decodificar token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: "Token expirado",
          code: "TOKEN_EXPIRED"
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: "Token inválido",
          code: "INVALID_TOKEN"
        });
      } else {
        throw jwtError;
      }
    }

    // Verificar que el usuario existe y está activo
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ 
        error: "Usuario no encontrado",
        code: "USER_NOT_FOUND"
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        error: "Cuenta desactivada",
        code: "ACCOUNT_DEACTIVATED"
      });
    }

    // Verificar si el email está verificado (excepto para usuarios de Google)
    if (!user.googleId && !user.emailVerified) {
      return res.status(403).json({ 
        error: "Email no verificado",
        code: "EMAIL_NOT_VERIFIED",
        requiresVerification: true
      });
    }

    // Agregar información del usuario al request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      authMethod: user.authMethod
    };

    // Actualizar último acceso
    user.updateLastLogin().catch(err => 
      console.error('Error updating last login:', err)
    );

    next();

  } catch (error) {
    console.error("Error en middleware de autenticación:", error);
    return res.status(500).json({ 
      error: "Error interno de autenticación",
      code: "AUTH_INTERNAL_ERROR"
    });
  }
};

// Middleware para verificar role de administrador
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: "Usuario no autenticado",
      code: "USER_NOT_AUTHENTICATED"
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ 
      error: "Permisos de administrador requeridos",
      code: "ADMIN_REQUIRED"
    });
  }

  next();
};

// Middleware para verificar que es el propietario del recurso o admin
const isOwnerOrAdmin = (resourceIdParam = 'id', userIdField = 'usuario') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: "Usuario no autenticado",
          code: "USER_NOT_AUTHENTICATED"
        });
      }

      // Si es admin, permitir acceso
      if (req.user.role === "admin") {
        return next();
      }

      // Obtener ID del recurso de los parámetros
      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return res.status(400).json({ 
          error: "ID del recurso no proporcionado",
          code: "RESOURCE_ID_MISSING"
        });
      }

      // Si el campo userIdField es directo (como userId), comparar directamente
      if (userIdField === 'userId' || userIdField === 'usuario') {
        if (req.params.userId && req.params.userId !== req.user.id) {
          return res.status(403).json({ 
            error: "Acceso denegado",
            code: "ACCESS_DENIED"
          });
        }
      }

      next();

    } catch (error) {
      console.error("Error en middleware isOwnerOrAdmin:", error);
      return res.status(500).json({ 
        error: "Error interno de autorización",
        code: "AUTH_INTERNAL_ERROR"
      });
    }
  };
};

// Middleware para verificar email verificado
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: "Usuario no autenticado",
      code: "USER_NOT_AUTHENTICATED"
    });
  }

  // Usuarios de Google están automáticamente verificados
  if (req.user.authMethod === 'google' || req.user.googleId) {
    return next();
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({ 
      error: "Email no verificado. Verifica tu email antes de continuar.",
      code: "EMAIL_NOT_VERIFIED",
      requiresVerification: true
    });
  }

  next();
};

// Middleware opcional - no falla si no hay token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          authMethod: user.authMethod
        };
      } else {
        req.user = null;
      }
    } catch (jwtError) {
      req.user = null;
    }

    next();

  } catch (error) {
    console.error("Error en middleware de autenticación opcional:", error);
    req.user = null;
    next();
  }
};

// Middleware para rate limiting por usuario
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }
    
    const requests = userRequests.get(userId);
    
    // Limpiar requests viejos
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: "Demasiadas solicitudes",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    validRequests.push(now);
    userRequests.set(userId, validRequests);
    
    next();
  };
};

// Middleware para validar permisos específicos
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: "Usuario no autenticado",
        code: "USER_NOT_AUTHENTICATED"
      });
    }

    // Administradores tienen todos los permisos
    if (req.user.role === 'admin') {
      return next();
    }

    // Definir permisos por rol
    const rolePermissions = {
      user: ['read_own', 'create_own', 'update_own'],
      admin: ['*'] // Todos los permisos
    };

    const userPermissions = rolePermissions[req.user.role] || [];
    
    if (!userPermissions.includes('*') && !userPermissions.includes(permission)) {
      return res.status(403).json({ 
        error: `Permiso '${permission}' requerido`,
        code: "PERMISSION_DENIED"
      });
    }

    next();
  };
};

// Middleware para logging de actividad de usuarios
const logUserActivity = (action) => {
  return (req, res, next) => {
    if (req.user) {
      console.log(`[${new Date().toISOString()}] Usuario ${req.user.id} (${req.user.email}) realizó acción: ${action}`);
    }
    next();
  };
};

// Función para generar tokens JWT
const generateToken = (payload, expiresIn = '1d') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Función para generar refresh tokens
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET + '_refresh', { expiresIn: '7d' });
};

// Middleware para verificar refresh token
const verifyRefreshToken = (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        error: "Refresh token requerido",
        code: "MISSING_REFRESH_TOKEN"
      });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET + '_refresh');
    req.refreshTokenData = decoded;
    
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: "Refresh token expirado",
        code: "REFRESH_TOKEN_EXPIRED"
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: "Refresh token inválido",
        code: "INVALID_REFRESH_TOKEN"
      });
    }

    console.error("Error verificando refresh token:", error);
    return res.status(500).json({ 
      error: "Error interno",
      code: "INTERNAL_ERROR"
    });
  }
};

module.exports = {
  verifyToken,
  isAdmin,
  isOwnerOrAdmin,
  requireEmailVerification,
  optionalAuth,
  rateLimitByUser,
  hasPermission,
  logUserActivity,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};