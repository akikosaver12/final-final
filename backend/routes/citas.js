const express = require('express');
const router = express.Router();

// Importar modelos, middlewares y utilidades
const Cita = require('../models/Cita');
const Mascota = require('../models/Mascota');
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { validateAppointmentData, validateObjectId, validatePagination } = require('../utils/validators');
const { sendAppointmentReminder } = require('../utils/email');

console.log('📅 Rutas de citas cargadas');

// Horarios permitidos para citas
const HORARIOS_PERMITIDOS = {
  mañana: {
    inicio: 7,
    fin: 12,
    intervalo: 30 // minutos
  },
  tarde: {
    inicio: 14,
    fin: 18,
    intervalo: 30
  }
};

// Función para generar horarios disponibles
const generarHorariosDisponibles = () => {
  const horarios = [];
  
  // Horarios de mañana
  for (let hora = HORARIOS_PERMITIDOS.mañana.inicio; hora <= HORARIOS_PERMITIDOS.mañana.fin; hora++) {
    for (let minuto = 0; minuto < 60; minuto += HORARIOS_PERMITIDOS.mañana.intervalo) {
      if (hora === HORARIOS_PERMITIDOS.mañana.fin && minuto > 0) break;
      
      const tiempo = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
      horarios.push({
        hora: tiempo,
        periodo: 'mañana',
        disponible: true
      });
    }
  }
  
  // Horarios de tarde
  for (let hora = HORARIOS_PERMITIDOS.tarde.inicio; hora <= HORARIOS_PERMITIDOS.tarde.fin; hora++) {
    for (let minuto = 0; minuto < 60; minuto += HORARIOS_PERMITIDOS.tarde.intervalo) {
      if (hora === HORARIOS_PERMITIDOS.tarde.fin && minuto > 0) break;
      
      const tiempo = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
      horarios.push({
        hora: tiempo,
        periodo: 'tarde',
        disponible: true
      });
    }
  }
  
  return horarios;
};

// 📝 CREAR NUEVA CITA
router.post('/', verifyToken, async (req, res) => {
  try {
    const { 
      mascotaId, tipo, fecha, hora, motivo, sintomas, notas, 
      esEmergencia, requiereAyuno, instruccionesPreparacion 
    } = req.body;

    console.log('📅 Creando nueva cita para mascota:', mascotaId);

    // Validar datos de entrada
    const validation = validateAppointmentData({ mascotaId, tipo, fecha, hora, motivo });
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Datos de cita inválidos',
        details: validation.message,
        code: 'INVALID_APPOINTMENT_DATA'
      });
    }

    // Verificar que la mascota existe y pertenece al usuario
    const mascota = await Mascota.findById(mascotaId).populate('usuario');
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'MASCOTA_NOT_FOUND'
      });
    }

    if (req.user.role !== 'admin' && mascota.usuario._id.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para agendar cita para esta mascota',
        code: 'UNAUTHORIZED'
      });
    }

    // Verificar disponibilidad del horario
    const fechaNormalizada = new Date(fecha + 'T00:00:00');
    const citaExistente = await Cita.findOne({ 
      fecha: fechaNormalizada, 
      hora: hora,
      estado: { $nin: ['cancelada'] }
    });
    
    if (citaExistente) {
      return res.status(400).json({ 
        error: 'Ya existe una cita agendada para esa fecha y hora',
        code: 'TIME_SLOT_TAKEN'
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
      sintomas: sintomas ? sintomas.trim() : '',
      notas: notas ? notas.trim() : '',
      esEmergencia: esEmergencia === true || esEmergencia === 'true',
      requiereAyuno: requiereAyuno === true || requiereAyuno === 'true',
      instruccionesPreparacion: instruccionesPreparacion ? instruccionesPreparacion.trim() : '',
      prioridad: esEmergencia ? 'urgente' : 'normal',
      creadaPor: req.user.id
    });

    await nuevaCita.save();
    
    // Poblar datos para la respuesta
    await nuevaCita.populate([
      { path: 'mascota', select: 'nombre especie raza imagen' },
      { path: 'usuario', select: 'name email telefono' }
    ]);

    console.log('✅ Cita creada exitosamente:', nuevaCita._id);

    res.status(201).json({
      success: true,
      message: 'Cita agendada exitosamente',
      cita: nuevaCita
    });

  } catch (error) {
    console.error('❌ Error creando cita:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Ya existe una cita agendada para esa fecha y hora',
        code: 'DUPLICATE_APPOINTMENT'
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        error: 'Error de validación',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 📋 OBTENER CITAS DEL USUARIO
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page, limit } = validatePagination(req.query.page, req.query.limit);
    const { fecha, estado, tipo, mascotaId } = req.query;
    
    console.log('📋 Obteniendo citas para usuario:', req.user.id);

    // Construir query
    let query = {};
    
    if (req.user.role !== 'admin') {
      query.usuario = req.user.id;
    }
    
    if (fecha) {
      const fechaNormalizada = new Date(fecha + 'T00:00:00');
      query.fecha = fechaNormalizada;
    }
    
    if (estado && estado !== 'todas') {
      query.estado = estado;
    }
    
    if (tipo && tipo !== 'todos') {
      query.tipo = tipo;
    }
    
    if (mascotaId) {
      const mascotaValidation = validateObjectId(mascotaId);
      if (mascotaValidation.isValid) {
        query.mascota = mascotaId;
      }
    }

    // Consultar citas
    const [citas, totalCount] = await Promise.all([
      Cita.find(query)
        .populate('mascota', 'nombre especie raza imagen')
        .populate('usuario', 'name email telefono')
        .populate('veterinario', 'name email')
        .sort({ fecha: 1, hora: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Cita.countDocuments(query)
    ]);

    console.log('📋 Citas encontradas:', citas.length);

    res.json({
      success: true,
      citas,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo citas:', error);
    res.status(500).json({
      error: 'Error obteniendo citas',
      code: 'FETCH_ERROR'
    });
  }
});

// 🔍 OBTENER CITA ESPECÍFICA
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar ID
    const idValidation = validateObjectId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        error: idValidation.message,
        code: 'INVALID_ID'
      });
    }

    console.log('🔍 Obteniendo cita:', id);

    const cita = await Cita.findById(id)
      .populate('mascota', 'nombre especie raza imagen usuario')
      .populate('usuario', 'name email telefono')
      .populate('veterinario', 'name email');

    if (!cita) {
      return res.status(404).json({
        error: 'Cita no encontrada',
        code: 'CITA_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && cita.usuario._id.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para ver esta cita',
        code: 'UNAUTHORIZED'
      });
    }

    res.json({
      success: true,
      cita
    });

  } catch (error) {
    console.error('❌ Error obteniendo cita:', error);
    res.status(500).json({
      error: 'Error obteniendo cita',
      code: 'FETCH_ERROR'
    });
  }
});

// ✏️ ACTUALIZAR CITA
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar ID
    const idValidation = validateObjectId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        error: idValidation.message,
        code: 'INVALID_ID'
      });
    }

    const cita = await Cita.findById(id);
    if (!cita) {
      return res.status(404).json({
        error: 'Cita no encontrada',
        code: 'CITA_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && cita.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para modificar esta cita',
        code: 'UNAUTHORIZED'
      });
    }

    // Los usuarios solo pueden modificar citas pendientes
    if (req.user.role !== 'admin' && cita.estado !== 'pendiente') {
      return res.status(400).json({
        error: 'Solo se pueden modificar citas pendientes',
        code: 'INVALID_STATUS'
      });
    }

    const { tipo, fecha, hora, motivo, sintomas, notas, instruccionesPreparacion } = req.body;

    console.log('✏️ Actualizando cita:', id);

    // Verificar disponibilidad si cambia fecha u hora
    if ((fecha && fecha !== cita.fecha.toISOString().split('T')[0]) || 
        (hora && hora !== cita.hora)) {
      
      const fechaNormalizada = fecha ? new Date(fecha + 'T00:00:00') : cita.fecha;
      const citaExistente = await Cita.findOne({ 
        fecha: fechaNormalizada, 
        hora: hora || cita.hora,
        _id: { $ne: cita._id },
        estado: { $nin: ['cancelada'] }
      });
      
      if (citaExistente) {
        return res.status(400).json({ 
          error: 'Ya existe una cita agendada para esa fecha y hora',
          code: 'TIME_SLOT_TAKEN'
        });
      }
    }

    // Actualizar campos
    if (tipo) cita.tipo = tipo;
    if (fecha) cita.fecha = new Date(fecha + 'T00:00:00');
    if (hora) cita.hora = hora;
    if (motivo) cita.motivo = motivo.trim();
    if (sintomas !== undefined) cita.sintomas = sintomas.trim();
    if (notas !== undefined) cita.notas = notas.trim();
    if (instruccionesPreparacion !== undefined) cita.instruccionesPreparacion = instruccionesPreparacion.trim();
    
    cita.modificadaPor = req.user.id;

    await cita.save();
    
    await cita.populate([
      { path: 'mascota', select: 'nombre especie raza imagen' },
      { path: 'usuario', select: 'name email telefono' },
      { path: 'veterinario', select: 'name email' }
    ]);

    console.log('✅ Cita actualizada exitosamente:', cita._id);

    res.json({
      success: true,
      message: 'Cita actualizada exitosamente',
      cita
    });

  } catch (error) {
    console.error('❌ Error actualizando cita:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Ya existe una cita agendada para esa fecha y hora',
        code: 'DUPLICATE_APPOINTMENT'
      });
    }
    
    res.status(500).json({
      error: 'Error actualizando cita',
      code: 'UPDATE_ERROR'
    });
  }
});

// ❌ CANCELAR CITA
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    
    // Validar ID
    const idValidation = validateObjectId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        error: idValidation.message,
        code: 'INVALID_ID'
      });
    }

    const cita = await Cita.findById(id);
    if (!cita) {
      return res.status(404).json({
        error: 'Cita no encontrada',
        code: 'CITA_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && cita.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para cancelar esta cita',
        code: 'UNAUTHORIZED'
      });
    }

    // Verificar que se pueda cancelar
    if (!cita.puedeSerCancelada) {
      return res.status(400).json({
        error: 'Esta cita no puede ser cancelada (debe ser con al menos 2 horas de anticipación)',
        code: 'CANNOT_CANCEL'
      });
    }

    // Cancelar cita
    const motivoCancelacion = motivo || 'Sin motivo especificado';
    const canceladaPor = req.user.role === 'admin' ? 'veterinario' : 'cliente';
    
    await cita.cancelar(motivoCancelacion, canceladaPor, req.user.id);

    console.log('❌ Cita cancelada exitosamente:', cita._id);

    res.json({
      success: true,
      message: 'Cita cancelada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error cancelando cita:', error);
    
    if (error.message.includes('no puede ser cancelada')) {
      return res.status(400).json({
        error: error.message,
        code: 'CANNOT_CANCEL'
      });
    }
    
    res.status(500).json({
      error: 'Error cancelando cita',
      code: 'CANCEL_ERROR'
    });
  }
});

// 🕐 OBTENER HORARIOS DISPONIBLES
router.get('/horarios-disponibles/:fecha', verifyToken, async (req, res) => {
  try {
    const { fecha } = req.params;
    
    console.log('🕐 Obteniendo horarios disponibles para:', fecha);

    // Validar fecha
    const fechaObj = new Date(fecha + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaObj < hoy) {
      return res.status(400).json({
        error: 'No se pueden agendar citas en fechas pasadas',
        code: 'INVALID_DATE'
      });
    }

    // No permitir domingos
    if (fechaObj.getDay() === 0) {
      return res.status(400).json({
        error: 'No se atiende los domingos',
        code: 'SUNDAY_NOT_ALLOWED'
      });
    }

    // Obtener citas existentes para esa fecha
    const citasExistentes = await Cita.find({
      fecha: fechaObj,
      estado: { $nin: ['cancelada'] }
    }).select('hora');

    const horasOcupadas = citasExistentes.map(cita => cita.hora);

    // Generar horarios disponibles
    const horariosDisponibles = generarHorariosDisponibles()
      .filter(horario => !horasOcupadas.includes(horario.hora));

    console.log('✅ Horarios disponibles generados:', horariosDisponibles.length);

    res.json({
      success: true,
      fecha,
      horariosDisponibles,
      totalDisponibles: horariosDisponibles.length,
      horasOcupadas: horasOcupadas.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo horarios:', error);
    res.status(500).json({
      error: 'Error obteniendo horarios disponibles',
      code: 'FETCH_ERROR'
    });
  }
});

// 🔔 ENVIAR RECORDATORIO DE CITA (solo admin)
router.post('/:id/recordatorio', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const cita = await Cita.findById(id)
      .populate('mascota', 'nombre especie raza')
      .populate('usuario', 'name email');

    if (!cita) {
      return res.status(404).json({
        error: 'Cita no encontrada',
        code: 'CITA_NOT_FOUND'
      });
    }

    if (cita.estado !== 'confirmada') {
      return res.status(400).json({
        error: 'Solo se pueden enviar recordatorios de citas confirmadas',
        code: 'INVALID_STATUS'
      });
    }

    // Enviar recordatorio por email
    const emailResult = await sendAppointmentReminder(
      cita.usuario.email,
      cita.usuario.name,
      {
        mascota: cita.mascota,
        tipo: cita.tipo,
        fecha: cita.fecha,
        hora: cita.hora,
        motivo: cita.motivo,
        instruccionesPreparacion: cita.instruccionesPreparacion
      }
    );

    if (emailResult.success) {
      cita.recordatorioEnviado = true;
      cita.fechaRecordatorio = new Date();
      await cita.save();

      console.log('🔔 Recordatorio enviado para cita:', cita._id);

      res.json({
        success: true,
        message: 'Recordatorio enviado exitosamente'
      });
    } else {
      res.status(500).json({
        error: 'Error enviando recordatorio',
        details: emailResult.error,
        code: 'EMAIL_ERROR'
      });
    }

  } catch (error) {
    console.error('❌ Error enviando recordatorio:', error);
    res.status(500).json({
      error: 'Error enviando recordatorio',
      code: 'REMINDER_ERROR'
    });
  }
});

// 📊 ESTADÍSTICAS DE CITAS (solo admin)
router.get('/admin/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    console.log('📊 Obteniendo estadísticas de citas');

    // Construir filtros de fecha
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.fecha = {};
      if (startDate) matchStage.fecha.$gte = new Date(startDate);
      if (endDate) matchStage.fecha.$lte = new Date(endDate);
    }

    // Estadísticas generales
    const stats = await Cita.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalCitas: { $sum: 1 },
          citasPorEstado: {
            $push: '$estado'
          },
          citasPorTipo: {
            $push: '$tipo'
          },
          emergencias: {
            $sum: { $cond: ['$esEmergencia', 1, 0] }
          }
        }
      }
    ]);

    // Procesar estadísticas
    let estadoStats = {};
    let tipoStats = {};

    if (stats.length > 0) {
      stats[0].citasPorEstado.forEach(estado => {
        estadoStats[estado] = (estadoStats[estado] || 0) + 1;
      });

      stats[0].citasPorTipo.forEach(tipo => {
        tipoStats[tipo] = (tipoStats[tipo] || 0) + 1;
      });
    }

    // Citas próximas
    const citasProximas = await Cita.countDocuments({
      fecha: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // próximos 7 días
      },
      estado: { $in: ['pendiente', 'confirmada'] }
    });

    res.json({
      success: true,
      stats: {
        totalCitas: stats[0]?.totalCitas || 0,
        porEstado: estadoStats,
        porTipo: tipoStats,
        emergencias: stats[0]?.emergencias || 0,
        citasProximas,
        periodo: {
          inicio: startDate || 'Sin límite',
          fin: endDate || 'Sin límite'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      code: 'STATS_ERROR'
    });
  }
});

// 🩺 HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Citas API',
    timestamp: new Date().toISOString(),
    schedule: {
      morningHours: '7:00 AM - 12:00 PM',
      afternoonHours: '2:00 PM - 6:00 PM',
      interval: '30 minutes',
      closedDays: ['Sunday']
    },
    features: {
      appointments: 'enabled',
      scheduling: 'enabled',
      reminders: 'enabled',
      emergencies: 'enabled',
      statistics: 'enabled'
    },
    endpoints: {
      'POST /': 'Crear cita',
      'GET /': 'Obtener citas del usuario',
      'GET /:id': 'Obtener cita específica',
      'PUT /:id': 'Actualizar cita',
      'DELETE /:id': 'Cancelar cita',
      'GET /horarios-disponibles/:fecha': 'Horarios disponibles',
      'POST /:id/recordatorio': 'Enviar recordatorio (admin)',
      'GET /admin/stats': 'Estadísticas (admin)',
      'GET /health': 'Estado del servicio'
    }
  });
});

module.exports = router;