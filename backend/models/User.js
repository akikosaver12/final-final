const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [100, 'El nombre no puede exceder 100 caracteres'],
    validate: {
      validator: function(v) {
        return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v);
      },
      message: 'El nombre solo debe contener letras y espacios'
    }
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Email inválido'
    }
  },
  password: {
    type: String,
    required: function() {
      // Password es requerido solo si no es usuario de Google
      return !this.googleId;
    },
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    maxlength: [128, 'La contraseña es demasiado larga']
  },
  telefono: {
    type: String,
    required: [true, 'El teléfono es requerido'],
    trim: true,
    validate: {
      validator: function(v) {
        const telefonoLimpio = v.replace(/[\s\-\(\)]/g, "");
        return /^\+?[\d]{7,15}$/.test(telefonoLimpio);
      },
      message: 'Formato de teléfono inválido'
    }
  },
  direccion: {
    calle: {
      type: String,
      required: [true, 'La dirección es requerida'],
      trim: true,
      minlength: [5, 'La dirección debe tener al menos 5 caracteres'],
      maxlength: [200, 'La dirección es demasiado larga']
    },
    ciudad: {
      type: String,
      required: [true, 'La ciudad es requerida'],
      trim: true,
      minlength: [2, 'La ciudad debe tener al menos 2 caracteres'],
      maxlength: [100, 'La ciudad es demasiado larga']
    },
    estado: {
      type: String,
      required: [true, 'El estado/departamento es requerido'],
      trim: true,
      minlength: [2, 'El estado debe tener al menos 2 caracteres'],
      maxlength: [100, 'El estado es demasiado largo']
    },
    pais: {
      type: String,
      default: 'Colombia',
      trim: true,
      maxlength: [50, 'El país es demasiado largo']
    }
  },
  role: {
    type: String,
    enum: {
      values: ['user', 'admin'],
      message: 'Role debe ser user o admin'
    },
    default: 'user'
  },
  
  // CAMPOS PARA GOOGLE OAUTH
  googleId: {
    type: String,
    sparse: true, // Permite índice único pero con valores null/undefined
    validate: {
      validator: function(v) {
        // Solo validar si existe
        return !v || typeof v === 'string';
      },
      message: 'Google ID debe ser un string válido'
    }
  },
  profilePicture: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        // Solo validar si existe
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'URL de foto de perfil inválida'
    }
  },
  authMethod: {
    type: String,
    enum: {
      values: ['local', 'google'],
      message: 'Método de auth debe ser local o google'
    },
    default: 'local'
  },

  // CAMPOS DE VERIFICACIÓN DE EMAIL
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false, // No incluir en queries por defecto
    validate: {
      validator: function(v) {
        return !v || /^[a-f0-9]{64}$/.test(v);
      },
      message: 'Token de verificación inválido'
    }
  },
  emailVerificationExpires: {
    type: Date,
    select: false,
    validate: {
      validator: function(v) {
        return !v || v > new Date();
      },
      message: 'Fecha de expiración debe ser futura'
    }
  },
  
  // CAMPOS DE RESET DE PASSWORD
  passwordResetToken: {
    type: String,
    select: false,
    validate: {
      validator: function(v) {
        return !v || /^[a-f0-9]{64}$/.test(v);
      },
      message: 'Token de reset inválido'
    }
  },
  passwordResetExpires: {
    type: Date,
    select: false,
    validate: {
      validator: function(v) {
        return !v || v > new Date();
      },
      message: 'Fecha de expiración debe ser futura'
    }
  },
  
  // CAMPOS DE ESTADO DE CUENTA
  isActive: {
    type: Boolean,
    default: true
  },
  pendingActivation: {
    type: Boolean,
    default: true
  },
  
  // TIMESTAMPS Y ACTIVIDAD
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    select: false
  }
}, {
  timestamps: true, // Crea automáticamente createdAt y updatedAt
  toJSON: {
    transform: function(doc, ret) {
      // Eliminar campos sensibles del JSON
      delete ret.password;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      delete ret.__v;
      return ret;
    }
  }
});

// ÍNDICES OPTIMIZADOS - CORRIGE LOS WARNINGS DE MONGODB
userSchema.index({ email: 1 }, { unique: true, background: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true, background: true });
userSchema.index({ emailVerificationToken: 1 }, { sparse: true, background: true });
userSchema.index({ passwordResetToken: 1 }, { sparse: true, background: true });
userSchema.index({ authMethod: 1, isActive: 1 }, { background: true });
userSchema.index({ createdAt: -1 }, { background: true });
userSchema.index({ lastLogin: -1 }, { background: true });
userSchema.index({ 
  name: 'text', 
  email: 'text', 
  'direccion.ciudad': 'text' 
}, { 
  name: 'search_index',
  background: true 
});

// VIRTUAL PARA CUENTA BLOQUEADA
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// VIRTUAL PARA NOMBRE COMPLETO
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// VIRTUAL PARA DIRECCIÓN COMPLETA
userSchema.virtual('fullAddress').get(function() {
  const { calle, ciudad, estado, pais } = this.direccion;
  return `${calle}, ${ciudad}, ${estado}, ${pais}`;
});

// MIDDLEWARE PRE-SAVE PARA VALIDACIONES PERSONALIZADAS
userSchema.pre('save', async function(next) {
  // Validar email único
  if (this.isModified('email')) {
    const existingUser = await this.constructor.findOne({
      email: this.email,
      _id: { $ne: this._id }
    });
    
    if (existingUser) {
      const error = new Error('El email ya está en uso');
      error.code = 'DUPLICATE_EMAIL';
      return next(error);
    }
  }

  // Validar GoogleId único si existe
  if (this.isModified('googleId') && this.googleId) {
    const existingUser = await this.constructor.findOne({
      googleId: this.googleId,
      _id: { $ne: this._id }
    });
    
    if (existingUser) {
      const error = new Error('Esta cuenta de Google ya está vinculada');
      error.code = 'DUPLICATE_GOOGLE_ID';
      return next(error);
    }
  }

  // Limpiar tokens expirados
  if (this.emailVerificationExpires && this.emailVerificationExpires <= new Date()) {
    this.emailVerificationToken = undefined;
    this.emailVerificationExpires = undefined;
  }

  if (this.passwordResetExpires && this.passwordResetExpires <= new Date()) {
    this.passwordResetToken = undefined;
    this.passwordResetExpires = undefined;
  }

  next();
});

// MIDDLEWARE PRE-FIND PARA EXCLUIR CAMPOS SENSIBLES
userSchema.pre(/^find/, function(next) {
  this.select('-password -emailVerificationToken -passwordResetToken -loginAttempts -lockUntil');
  next();
});

// MÉTODO DE INSTANCIA - ACTUALIZAR ÚLTIMO LOGIN
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.loginAttempts = 0; // Reset login attempts en login exitoso
  this.lockUntil = undefined;
  return this.save({ validateBeforeSave: false });
};

// MÉTODO DE INSTANCIA - INCREMENTAR INTENTOS DE LOGIN
userSchema.methods.incLoginAttempts = function() {
  // Si ya tenemos un campo lockUntil y ha expirado, empezar de nuevo
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Si hemos alcanzado el máximo de intentos y no estamos bloqueados, bloquear
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 horas
  }
  
  return this.updateOne(updates);
};

// MÉTODO DE INSTANCIA - VERIFICAR SI PUEDE AUTENTICARSE
userSchema.methods.canAuthenticate = function() {
  return this.isActive && !this.isLocked && this.emailVerified;
};

// MÉTODO DE INSTANCIA - OBTENER INFORMACIÓN PÚBLICA
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    profilePicture: this.profilePicture,
    authMethod: this.authMethod,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin
  };
};

// MÉTODO ESTÁTICO - ESTADÍSTICAS DE USUARIOS
userSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        verifiedUsers: {
          $sum: { $cond: [{ $eq: ['$emailVerified', true] }, 1, 0] }
        },
        googleUsers: {
          $sum: { $cond: [{ $ne: ['$googleId', null] }, 1, 0] }
        },
        localUsers: {
          $sum: { $cond: [{ $eq: ['$authMethod', 'local'] }, 1, 0] }
        },
        newThisMonth: {
          $sum: {
            $cond: [
              {
                $gte: ['$createdAt', new Date(new Date().getFullYear(), new Date().getMonth(), 1)]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
};

// MÉTODO ESTÁTICO - BÚSQUEDA AVANZADA
userSchema.statics.searchUsers = function(searchTerm, options = {}) {
  const { 
    page = 1, 
    limit = 10, 
    role, 
    authMethod, 
    isActive, 
    emailVerified,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options;
  
  const query = {};
  
  // Búsqueda de texto
  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { 'direccion.ciudad': { $regex: searchTerm, $options: 'i' } }
    ];
  }
  
  // Filtros adicionales
  if (role && ['user', 'admin'].includes(role)) {
    query.role = role;
  }
  
  if (authMethod && ['local', 'google'].includes(authMethod)) {
    query.authMethod = authMethod;
  }
  
  if (isActive !== undefined) {
    query.isActive = isActive;
  }
  
  if (emailVerified !== undefined) {
    query.emailVerified = emailVerified;
  }
  
  // Paginación
  const skip = (page - 1) * limit;
  
  // Ordenamiento
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

// MÉTODO ESTÁTICO - BUSCAR POR EMAIL O GOOGLE ID
userSchema.statics.findByEmailOrGoogleId = function(email, googleId) {
  const query = { $or: [] };
  
  if (email) {
    query.$or.push({ email: email.toLowerCase() });
  }
  
  if (googleId) {
    query.$or.push({ googleId: googleId });
  }
  
  if (query.$or.length === 0) {
    return null;
  }
  
  return this.findOne(query);
};

// MÉTODO ESTÁTICO - LIMPIAR TOKENS EXPIRADOS
userSchema.statics.cleanExpiredTokens = function() {
  const now = new Date();
  
  return this.updateMany(
    {
      $or: [
        { emailVerificationExpires: { $lte: now } },
        { passwordResetExpires: { $lte: now } }
      ]
    },
    {
      $unset: {
        emailVerificationToken: "",
        emailVerificationExpires: "",
        passwordResetToken: "",
        passwordResetExpires: ""
      }
    }
  );
};

// MÉTODO ESTÁTICO - OBTENER USUARIOS INACTIVOS
userSchema.statics.getInactiveUsers = function(days = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    lastLogin: { $lt: cutoffDate },
    isActive: true,
    emailVerified: true
  }).select('name email lastLogin createdAt');
};

// HOOK POST-SAVE PARA LOGGING
userSchema.post('save', function(doc) {
  console.log(`Usuario ${doc.authMethod === 'google' ? 'Google' : 'local'} guardado:`, doc.email);
});

// HOOK PRE-REMOVE PARA CLEANUP
userSchema.pre('remove', function(next) {
  console.log(`Eliminando usuario:`, this.email);
  // Aquí podrías agregar lógica para limpiar datos relacionados
  next();
});

// CREAR EL MODELO
const User = mongoose.model('User', userSchema);

module.exports = User;