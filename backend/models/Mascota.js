const mongoose = require('mongoose');

// Esquema para vacunas
const VacunaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  fecha: {
    type: Date,
    required: true
  },
  imagen: {
    type: String,
    default: ""
  },
  veterinario: {
    type: String,
    trim: true
  },
  proximaDosis: {
    type: Date
  },
  notas: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Esquema para operaciones
const OperacionSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  fecha: {
    type: Date,
    required: true
  },
  imagen: {
    type: String,
    default: ""
  },
  veterinario: {
    type: String,
    trim: true
  },
  costo: {
    type: Number,
    min: 0
  },
  estado: {
    type: String,
    enum: ['programada', 'en_proceso', 'completada', 'cancelada'],
    default: 'completada'
  },
  notas: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Esquema principal de mascota
const MascotaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 50
  },
  especie: {
    type: String,
    required: true,
    trim: true,
    enum: ['Perro', 'Gato', 'Ave', 'Reptil', 'Pez', 'Roedor', 'Otro']
  },
  raza: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  edad: {
    type: Number,
    required: true,
    min: 0,
    max: 30
  },
  unidadEdad: {
    type: String,
    enum: ['meses', 'años'],
    default: 'años'
  },
  genero: {
    type: String,
    required: true,
    enum: ['Macho', 'Hembra']
  },
  estado: {
    type: String,
    required: true,
    trim: true,
    enum: ['Saludable', 'Enfermo', 'En tratamiento', 'Recuperándose', 'Crítico']
  },
  peso: {
    type: Number,
    min: 0,
    max: 200
  },
  color: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Información médica
  enfermedades: {
    type: String,
    default: "",
    trim: true
  },
  alergias: {
    type: String,
    default: "",
    trim: true
  },
  medicamentos: {
    type: String,
    default: "",
    trim: true
  },
  historial: {
    type: String,
    default: "",
    trim: true
  },
  
  // Información adicional
  microchip: {
    numero: {
      type: String,
      trim: true
    },
    fechaImplante: {
      type: Date
    }
  },
  esterilizado: {
    type: Boolean,
    default: false
  },
  fechaEsterilizacion: {
    type: Date
  },
  
  // Archivos
  imagen: {
    type: String,
    default: ""
  },
  documentos: [{
    nombre: String,
    url: String,
    tipo: {
      type: String,
      enum: ['certificado', 'examen', 'radiografia', 'otro']
    },
    fecha: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Relaciones
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  
  // Historiales médicos
  vacunas: [VacunaSchema],
  operaciones: [OperacionSchema],
  
  // Estado de la mascota
  activo: {
    type: Boolean,
    default: true
  },
  fallecido: {
    type: Boolean,
    default: false
  },
  fechaFallecimiento: {
    type: Date
  },
  
  // Información de contacto de emergencia
  contactoEmergencia: {
    nombre: String,
    telefono: String,
    relacion: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para edad formateada
MascotaSchema.virtual('edadFormateada').get(function() {
  return `${this.edad} ${this.unidadEdad}`;
});

// Virtual para próximas vacunas
MascotaSchema.virtual('proximasVacunas').get(function() {
  const hoy = new Date();
  return this.vacunas.filter(vacuna => 
    vacuna.proximaDosis && vacuna.proximaDosis > hoy
  ).sort((a, b) => a.proximaDosis - b.proximaDosis);
});

// Virtual para verificar si necesita vacunas
MascotaSchema.virtual('necesitaVacunas').get(function() {
  const hoy = new Date();
  const treintaDias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return this.vacunas.some(vacuna => 
    vacuna.proximaDosis && 
    vacuna.proximaDosis >= hoy && 
    vacuna.proximaDosis <= treintaDias
  );
});

// Método para agregar vacuna
MascotaSchema.methods.agregarVacuna = function(datosVacuna) {
  this.vacunas.push(datosVacuna);
  return this.save();
};

// Método para agregar operación
MascotaSchema.methods.agregarOperacion = function(datosOperacion) {
  this.operaciones.push(datosOperacion);
  return this.save();
};

// Método para actualizar estado
MascotaSchema.methods.actualizarEstado = function(nuevoEstado, notas) {
  this.estado = nuevoEstado;
  if (notas) {
    this.historial += `\n${new Date().toLocaleDateString()}: Estado cambiado a ${nuevoEstado}. ${notas}`;
  }
  return this.save();
};

// Método para marcar como fallecido
MascotaSchema.methods.marcarComoFallecido = function(fecha, causa) {
  this.fallecido = true;
  this.activo = false;
  this.fechaFallecimiento = fecha || new Date();
  this.estado = 'Fallecido';
  if (causa) {
    this.historial += `\n${new Date().toLocaleDateString()}: Mascota fallecida. Causa: ${causa}`;
  }
  return this.save();
};

// Middleware para actualizar timestamps de vacunas y operaciones
MascotaSchema.pre('save', function(next) {
  // Actualizar timestamps de subdocumentos si son nuevos
  if (this.isModified('vacunas')) {
    this.vacunas.forEach(vacuna => {
      if (vacuna.isNew) {
        vacuna.createdAt = new Date();
        vacuna.updatedAt = new Date();
      } else if (vacuna.isModified()) {
        vacuna.updatedAt = new Date();
      }
    });
  }
  
  if (this.isModified('operaciones')) {
    this.operaciones.forEach(operacion => {
      if (operacion.isNew) {
        operacion.createdAt = new Date();
        operacion.updatedAt = new Date();
      } else if (operacion.isModified()) {
        operacion.updatedAt = new Date();
      }
    });
  }
  
  next();
});

// Índices para optimización
MascotaSchema.index({ usuario: 1, activo: 1 });
MascotaSchema.index({ especie: 1 });
MascotaSchema.index({ estado: 1 });
MascotaSchema.index({ nombre: 'text', raza: 'text' });

const Mascota = mongoose.model("Mascota", MascotaSchema);

module.exports = Mascota;