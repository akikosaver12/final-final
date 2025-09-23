const mongoose = require('mongoose');

// Esquema para reseñas de productos
const ReseñaSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  calificacion: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comentario: {
    type: String,
    trim: true,
    maxlength: 500
  },
  verificada: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Esquema principal del producto
const ProductoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  descripcion: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 1000
  },
  precio: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Información del producto
  categoria: {
    type: String,
    required: true,
    enum: ["alimento", "juguetes", "medicamentos", "accesorios", "higiene", "otros"],
    default: "otros"
  },
  subcategoria: {
    type: String,
    trim: true
  },
  marca: {
    type: String,
    trim: true
  },
  modelo: {
    type: String,
    trim: true
  },
  
  // Stock e inventario
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  stockMinimo: {
    type: Number,
    default: 5,
    min: 0
  },
  unidadMedida: {
    type: String,
    enum: ['unidad', 'kg', 'g', 'litro', 'ml', 'pack'],
    default: 'unidad'
  },
  
  // Imágenes
  imagen: {
    type: String,
    default: ""
  },
  imagenes: [{
    url: String,
    alt: String,
    esPrincipal: {
      type: Boolean,
      default: false
    }
  }],
  
  // Descuentos
  descuento: {
    tiene: {
      type: Boolean,
      default: false
    },
    porcentaje: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      validate: {
        validator: function(v) {
          if (this.descuento.tiene && (v <= 0 || v > 100)) {
            return false;
          }
          return true;
        },
        message: 'El porcentaje de descuento debe estar entre 1 y 100'
      }
    },
    fechaInicio: {
      type: Date
    },
    fechaFin: {
      type: Date
    },
    motivoDescuento: {
      type: String,
      trim: true
    }
  },
  
  // Garantía
  garantia: {
    tiene: {
      type: Boolean,
      default: false
    },
    meses: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: function(v) {
          if (this.garantia.tiene && v <= 0) {
            return false;
          }
          return true;
        },
        message: 'Los meses de garantía deben ser mayor a 0'
      }
    },
    descripcion: {
      type: String,
      default: "",
      trim: true
    }
  },
  
  // Envío
  envioGratis: {
    type: Boolean,
    default: false
  },
  peso: {
    type: Number,
    min: 0
  },
  dimensiones: {
    largo: {
      type: Number,
      min: 0
    },
    ancho: {
      type: Number,
      min: 0
    },
    alto: {
      type: Number,
      min: 0
    }
  },
  
  // Información adicional
  ingredientes: {
    type: String,
    trim: true
  },
  instrucciones: {
    type: String,
    trim: true
  },
  contraindicaciones: {
    type: String,
    trim: true
  },
  fechaVencimiento: {
    type: Date
  },
  lote: {
    type: String,
    trim: true
  },
  
  // Especificaciones técnicas
  especificaciones: [{
    nombre: {
      type: String,
      required: true,
      trim: true
    },
    valor: {
      type: String,
      required: true,
      trim: true
    }
  }],
  
  // Tags y palabras clave
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // SEO
  seo: {
    metaTitulo: String,
    metaDescripcion: String,
    palabrasClave: [String]
  },
  
  // Estado del producto
  activo: {
    type: Boolean,
    default: true
  },
  destacado: {
    type: Boolean,
    default: false
  },
  nuevo: {
    type: Boolean,
    default: true
  },
  agotado: {
    type: Boolean,
    default: false
  },
  
  // Estadísticas
  vistas: {
    type: Number,
    default: 0
  },
  ventasTotal: {
    type: Number,
    default: 0
  },
  
  // Reseñas
  reseñas: [ReseñaSchema],
  
  // Relaciones
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para precio con descuento
ProductoSchema.virtual('precioConDescuento').get(function() {
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
  return Math.round(this.precio * (1 - descuentoDecimal));
});

// Virtual para verificar si el descuento está vigente
ProductoSchema.virtual('descuentoVigente').get(function() {
  if (!this.descuento.tiene) return false;
  
  const ahora = new Date();
  if (this.descuento.fechaInicio && ahora < this.descuento.fechaInicio) {
    return false;
  }
  if (this.descuento.fechaFin && ahora > this.descuento.fechaFin) {
    return false;
  }
  
  return true;
});

// Virtual para ahorro por descuento
ProductoSchema.virtual('ahorroDescuento').get(function() {
  return this.precio - this.precioConDescuento;
});

// Virtual para porcentaje de descuento efectivo
ProductoSchema.virtual('porcentajeDescuentoEfectivo').get(function() {
  if (!this.descuentoVigente) return 0;
  return Math.round((this.ahorroDescuento / this.precio) * 100);
});

// Virtual para calificación promedio
ProductoSchema.virtual('calificacionPromedio').get(function() {
  if (this.reseñas.length === 0) return 0;
  const suma = this.reseñas.reduce((acc, reseña) => acc + reseña.calificacion, 0);
  return Math.round((suma / this.reseñas.length) * 10) / 10;
});

// Virtual para número de reseñas
ProductoSchema.virtual('numeroReseñas').get(function() {
  return this.reseñas.length;
});

// Virtual para verificar si está disponible
ProductoSchema.virtual('disponible').get(function() {
  return this.activo && this.stock > 0 && !this.agotado;
});

// Virtual para estado del stock
ProductoSchema.virtual('estadoStock').get(function() {
  if (this.stock === 0) return 'agotado';
  if (this.stock <= this.stockMinimo) return 'bajo';
  return 'disponible';
});

// Método para verificar si el descuento está vigente
ProductoSchema.methods.isDescuentoVigente = function() {
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

// Método para obtener precio con descuento
ProductoSchema.methods.getPrecioConDescuento = function() {
  if (!this.isDescuentoVigente() || this.descuento.porcentaje <= 0) {
    return this.precio;
  }
  
  const descuentoDecimal = this.descuento.porcentaje / 100;
  return Math.round(this.precio * (1 - descuentoDecimal));
};

// Método para agregar reseña
ProductoSchema.methods.agregarReseña = function(userId, calificacion, comentario) {
  // Verificar si el usuario ya tiene una reseña
  const reseñaExistente = this.reseñas.find(r => r.usuario.toString() === userId.toString());
  
  if (reseñaExistente) {
    reseñaExistente.calificacion = calificacion;
    reseñaExistente.comentario = comentario;
  } else {
    this.reseñas.push({
      usuario: userId,
      calificacion,
      comentario
    });
  }
  
  return this.save();
};

// Método para actualizar stock
ProductoSchema.methods.actualizarStock = function(cantidad, operacion = 'disminuir') {
  if (operacion === 'disminuir') {
    this.stock = Math.max(0, this.stock - cantidad);
  } else if (operacion === 'aumentar') {
    this.stock += cantidad;
  }
  
  this.agotado = this.stock === 0;
  
  return this.save();
};

// Método para incrementar vistas
ProductoSchema.methods.incrementarVistas = function() {
  this.vistas += 1;
  return this.save({ validateBeforeSave: false });
};

// Middleware para actualizar estado de agotado
ProductoSchema.pre('save', function(next) {
  this.agotado = this.stock === 0;
  
  // Marcar como no nuevo después de 30 días
  if (this.nuevo) {
    const treintaDiasAtras = new Date();
    treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
    if (this.createdAt < treintaDiasAtras) {
      this.nuevo = false;
    }
  }
  
  next();
});

// Índices para optimización
ProductoSchema.index({ categoria: 1, activo: 1 });
ProductoSchema.index({ precio: 1 });
ProductoSchema.index({ destacado: 1, activo: 1 });
ProductoSchema.index({ nuevo: 1, activo: 1 });
ProductoSchema.index({ tags: 1 });
ProductoSchema.index({ nombre: 'text', descripcion: 'text', tags: 'text' });

const Producto = mongoose.model("Producto", ProductoSchema);

module.exports = Producto;