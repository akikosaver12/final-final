const mongoose = require('mongoose');

// Esquema para servicios adicionales en la cita
const ServicioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  precio: {
    type: Number,
    min: 0
  },
  descripcion: {
    type: String,
    trim: true
  }
});

// Esquema principal de cita
const CitaSchema = new mongoose.Schema({
  // Relaciones
  mascota: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mascota",
    required: true,
    index: true
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  veterinario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  // Información básica de la cita
  tipo: {
    type: String,
    required: true,
    enum: ["consulta", "operacion", "vacunacion", "emergencia", "control", "limpieza_dental", "esterilizacion", "revision"],
    index: true
  },
  fecha: {
    type: Date,
    required: true,
    index: true
  },
  hora: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Formato de hora inválido. Usar HH:MM'
    }
  },
  duracion: {
    type: Number, // en minutos
    default: 30
  },
  
  // Información de la consulta
  motivo: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 500
  },
  sintomas: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  notas: {
    type: String,
    default: "",
    trim: true,
    maxlength: 1000
  },
  notasVeterinario: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Estado de la cita
  estado: {
    type: String,
    default: "pendiente",
    enum: ["pendiente", "confirmada", "en_curso", "completada", "cancelada", "no_asistio"],
    index: true
  },
  prioridad: {
    type: String,
    enum: ["baja", "normal", "alta", "urgente"],
    default: "normal"
  },
  
  // Servicios y costos
  servicios: [ServicioSchema],
  costoTotal: {
    type: Number,
    min: 0,
    default: 0
  },
  costoConsulta: {
    type: Number,
    min: 0,
    default: 0
  },
  descuentoAplicado: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Información de pago
  estadoPago: {
    type: String,
    enum: ["pendiente", "pagado", "parcial", "cancelado"],
    default: "pendiente"
  },
  metodoPago: {
    type: String,
    enum: ["efectivo", "tarjeta", "transferencia", "mercadopago"],
    default: "efectivo"
  },
  
  // Recordatorios
  recordatorioEnviado: {
    type: Boolean,
    default: false
  },
  fechaRecordatorio: {
    type: Date
  },
  
  // Resultado de la consulta
  diagnostico: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  tratamiento: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  medicamentos: [{
    nombre: {
      type: String,
      required: true,
      trim: true
    },
    dosis: {
      type: String,
      required: true,
      trim: true
    },
    frecuencia: {
      type: String,
      required: true,
      trim: true
    },
    duracion: {
      type: String,
      required: true,
      trim: true
    },
    instrucciones: {
      type: String,
      trim: true
    }
  }],
  
  // Archivos adjuntos
  archivos: [{
    nombre: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true
    },
    tipo: {
      type: String,
      enum: ["imagen", "documento", "resultado", "radiografia", "otro"],
      default: "documento"
    },
    descripcion: {
      type: String,
      trim: true
    }
  }],
  
  // Cita de seguimiento
  requiereSeguimiento: {
    type: Boolean,
    default: false
  },
  fechaSeguimiento: {
    type: Date
  },
  
  // Información de cancelación
  motivoCancelacion: {
    type: String,
    trim: true
  },
  fechaCancelacion: {
    type: Date
  },
  canceladaPor: {
    type: String,
    enum: ["cliente", "veterinario", "sistema"],
    trim: true
  },
  
  // Información adicional
  esEmergencia: {
    type: Boolean,
    default: false
  },
  requiereAyuno: {
    type: Boolean,
    default: false
  },
  instruccionesPreparacion: {
    type: String,
    trim: true
  },
  
  // Metadata
  creadaPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  modificadaPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índice único para evitar doble reserva en la misma fecha y hora
CitaSchema.index({ fecha: 1, hora: 1 }, { unique: true });

// Virtual para fecha y hora combinadas
CitaSchema.virtual('fechaHora').get(function() {
  const fecha = new Date(this.fecha);
  const [horas, minutos] = this.hora.split(':');
  fecha.setHours(parseInt(horas), parseInt(minutos), 0, 0);
  return fecha;
});

// Virtual para verificar si la cita es hoy
CitaSchema.virtual('esHoy').get(function() {
  const hoy = new Date();
  const fechaCita = new Date(this.fecha);
  return hoy.toDateString() === fechaCita.toDateString();
});

// Virtual para verificar si la cita ya pasó
CitaSchema.virtual('yaPaso').get(function() {
  const ahora = new Date();
  const fechaHoraCita = this.fechaHora;
  return fechaHoraCita < ahora;
});

// Virtual para tiempo restante hasta la cita
CitaSchema.virtual('tiempoRestante').get(function() {
  const ahora = new Date();
  const fechaHoraCita = this.fechaHora;
  const diferencia = fechaHoraCita - ahora;
  
  if (diferencia < 0) return 'Cita pasada';
  
  const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
  
  if (dias > 0) return `${dias} días`;
  if (horas > 0) return `${horas} horas`;
  return `${minutos} minutos`;
});

// Virtual para verificar si puede ser cancelada
CitaSchema.virtual('puedeSerCancelada').get(function() {
  const estadosPermitidos = ['pendiente', 'confirmada'];
  const tiempoMinimo = 2 * 60 * 60 * 1000; // 2 horas en milisegundos
  const ahora = new Date();
  const fechaHoraCita = this.fechaHora;
  
  return estadosPermitidos.includes(this.estado) && 
         (fechaHoraCita - ahora) > tiempoMinimo;
});

// Virtual para verificar si puede ser reprogramada
CitaSchema.virtual('puedeSerReprogramada').get(function() {
  return ['pendiente', 'confirmada'].includes(this.estado) && !this.yaPaso;
});

// Método para confirmar cita
CitaSchema.methods.confirmar = function(veterinarioId, notas) {
  if (!['pendiente'].includes(this.estado)) {
    throw new Error('Solo se pueden confirmar citas pendientes');
  }
  
  this.estado = 'confirmada';
  this.veterinario = veterinarioId;
  if (notas) this.notasVeterinario = notas;
  this.modificadaPor = veterinarioId;
  
  return this.save();
};

// Método para cancelar cita
CitaSchema.methods.cancelar = function(motivo, canceladaPor, userId) {
  if (!this.puedeSerCancelada) {
    throw new Error('Esta cita no puede ser cancelada');
  }
  
  this.estado = 'cancelada';
  this.motivoCancelacion = motivo;
  this.fechaCancelacion = new Date();
  this.canceladaPor = canceladaPor;
  this.modificadaPor = userId;
  
  return this.save();
};

// Método para completar cita
CitaSchema.methods.completar = function(datosConsulta, veterinarioId) {
  this.estado = 'completada';
  this.veterinario = veterinarioId;
  
  if (datosConsulta.diagnostico) this.diagnostico = datosConsulta.diagnostico;
  if (datosConsulta.tratamiento) this.tratamiento = datosConsulta.tratamiento;
  if (datosConsulta.medicamentos) this.medicamentos = datosConsulta.medicamentos;
  if (datosConsulta.notasVeterinario) this.notasVeterinario = datosConsulta.notasVeterinario;
  if (datosConsulta.costoTotal) this.costoTotal = datosConsulta.costoTotal;
  if (datosConsulta.requiereSeguimiento) {
    this.requiereSeguimiento = true;
    this.fechaSeguimiento = datosConsulta.fechaSeguimiento;
  }
  
  this.modificadaPor = veterinarioId;
  
  return this.save();
};

// Método para iniciar cita
CitaSchema.methods.iniciar = function(veterinarioId) {
  if (this.estado !== 'confirmada') {
    throw new Error('Solo se pueden iniciar citas confirmadas');
  }
  
  this.estado = 'en_curso';
  this.veterinario = veterinarioId;
  this.modificadaPor = veterinarioId;
  
  return this.save();
};

// Método para marcar como no asistió
CitaSchema.methods.marcarNoAsistio = function(userId) {
  if (this.estado !== 'confirmada' || !this.yaPaso) {
    throw new Error('Solo se pueden marcar como no asistido las citas confirmadas que ya pasaron');
  }
  
  this.estado = 'no_asistio';
  this.modificadaPor = userId;
  
  return this.save();
};

// Método para reprogramar cita
CitaSchema.methods.reprogramar = function(nuevaFecha, nuevaHora, motivo, userId) {
  if (!this.puedeSerReprogramada) {
    throw new Error('Esta cita no puede ser reprogramada');
  }
  
  this.fecha = nuevaFecha;
  this.hora = nuevaHora;
  this.estado = 'pendiente';
  this.notas += `\nReprogramada: ${motivo}`;
  this.recordatorioEnviado = false;
  this.modificadaPor = userId;
  
  return this.save();
};

// Middleware para calcular costo total antes de guardar
CitaSchema.pre('save', function(next) {
  if (this.servicios && this.servicios.length > 0) {
    const costoServicios = this.servicios.reduce((total, servicio) => total + (servicio.precio || 0), 0);
    this.costoTotal = this.costoConsulta + costoServicios - this.descuentoAplicado;
  } else {
    this.costoTotal = this.costoConsulta - this.descuentoAplicado;
  }
  
  // Asegurar que el costo no sea negativo
  this.costoTotal = Math.max(0, this.costoTotal);
  
  next();
});

// Middleware para actualizar timestamps de modificación
CitaSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Índices adicionales para optimización
CitaSchema.index({ fecha: 1, estado: 1 });
CitaSchema.index({ tipo: 1, estado: 1 });
CitaSchema.index({ veterinario: 1, fecha: 1 });
CitaSchema.index({ esEmergencia: 1, prioridad: 1 });

const Cita = mongoose.model("Cita", CitaSchema);

module.exports = Cita;