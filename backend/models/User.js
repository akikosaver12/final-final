const mongoose = require('mongoose');

// Esquema de Usuario con verificación de email y Google OAuth
const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true,
      minlength: 2,
      maxlength: 50
    },
    email: { 
      type: String, 
      unique: true, 
      required: true, 
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
    },
    password: { 
      type: String, 
      required: function() {
        return !this.googleId; // Password requerido solo si no es usuario de Google
      },
      minlength: 6
    },
    telefono: { 
      type: String, 
      required: true, 
      trim: true,
      validate: {
        validator: function(v) {
          return /^\+?[\d\s\-\(\)]{7,15}$/.test(v);
        },
        message: 'El teléfono debe tener un formato válido'
      }
    },
    direccion: {
      calle: { 
        type: String, 
        required: true, 
        trim: true,
        minlength: 5
      },
      ciudad: { 
        type: String, 
        required: true, 
        trim: true,
        minlength: 2
      },
      estado: { 
        type: String, 
        required: true, 
        trim: true,
        minlength: 2
      },
      pais: { 
        type: String, 
        required: true, 
        trim: true, 
        default: 'Colombia' 
      }
    },
    role: { 
      type: String, 
      default: "user", 
      enum: ["user", "admin"] 
    },
    
    // Campos para Google OAuth
    googleId: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    profilePicture: { 
      type: String 
    },
    authMethod: { 
      type: String, 
      enum: ["local", "google", "both"], 
      default: "local" 
    },
    
    // Campos para verificación de email
    emailVerified: { 
      type: Boolean, 
      default: false 
    },
    emailVerificationToken: { 
      type: String 
    },
    emailVerificationExpires: { 
      type: Date 
    },
    pendingActivation: { 
      type: Boolean, 
      default: true 
    },
    
    // Campos adicionales
    lastLogin: { 
      type: Date 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Middleware para verificación automática de Google
userSchema.pre('save', function(next) {
  if (this.googleId && !this.emailVerified) {
    this.emailVerified = true;
    this.pendingActivation = false;
    this.authMethod = this.password ? 'both' : 'google';
  }
  next();
});

// Virtual para dirección completa
userSchema.virtual('direccionCompleta').get(function() {
  return `${this.direccion.calle}, ${this.direccion.ciudad}, ${this.direccion.estado}, ${this.direccion.pais}`;
});

// Virtual para contar mascotas (se llena por populate)
userSchema.virtual('totalMascotas', {
  ref: 'Mascota',
  localField: '_id',
  foreignField: 'usuario',
  count: true
});

// Método para verificar si el usuario puede iniciar sesión
userSchema.methods.canLogin = function() {
  return this.isActive && (this.emailVerified || this.googleId);
};

// Método para actualizar último login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Índices para optimización
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ emailVerificationToken: 1 });

const User = mongoose.model("User", userSchema);

module.exports = User;