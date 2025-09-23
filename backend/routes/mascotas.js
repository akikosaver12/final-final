const express = require('express');
const router = express.Router();

// Importar modelos, middlewares y utilidades
const Mascota = require('../models/Mascota');
const User = require('../models/User');
const { verifyToken, isAdmin, isOwnerOrAdmin } = require('../middleware/auth');
const { uploadSingle, validateUploadedFiles } = require('../middleware/upload');
const { validatePetData, validateObjectId, validatePagination } = require('../utils/validators');

console.log('🐾 Rutas de mascotas cargadas');

// 📝 CREAR NUEVA MASCOTA
router.post('/', verifyToken, uploadSingle('imagen'), validateUploadedFiles, async (req, res) => {
  try {
    const { 
      nombre, especie, raza, edad, unidadEdad, genero, estado, peso, color,
      enfermedades, alergias, medicamentos, historial,
      esterilizado, fechaEsterilizacion,
      microchip, fechaImplante,
      contactoEmergencia
    } = req.body;

    console.log('🐾 Creando nueva mascota:', nombre, 'para usuario:', req.user.id);

    // Validar datos básicos
    const petData = { nombre, especie, raza, edad: parseInt(edad), genero, estado };
    const validation = validatePetData(petData);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Datos de mascota inválidos',
        details: validation.message,
        code: 'INVALID_PET_DATA'
      });
    }

    // Crear nueva mascota
    const nuevaMascota = new Mascota({
      nombre: nombre.trim(),
      especie,
      raza: raza.trim(),
      edad: parseInt(edad),
      unidadEdad: unidadEdad || 'años',
      genero,
      estado,
      peso: peso ? parseFloat(peso) : undefined,
      color: color ? color.trim() : undefined,
      enfermedades: enfermedades ? enfermedades.trim() : '',
      alergias: alergias ? alergias.trim() : '',
      medicamentos: medicamentos ? medicamentos.trim() : '',
      historial: historial ? historial.trim() : '',
      esterilizado: esterilizado === 'true' || esterilizado === true,
      fechaEsterilizacion: fechaEsterilizacion ? new Date(fechaEsterilizacion) : undefined,
      microchip: microchip ? {
        numero: microchip.toString().trim(),
        fechaImplante: fechaImplante ? new Date(fechaImplante) : undefined
      } : undefined,
      contactoEmergencia: contactoEmergencia ? {
        nombre: contactoEmergencia.nombre?.trim(),
        telefono: contactoEmergencia.telefono?.trim(),
        relacion: contactoEmergencia.relacion?.trim()
      } : undefined,
      imagen: req.file ? req.file.url : '',
      usuario: req.user.id
    });

    await nuevaMascota.save();
    
    // Poblar datos del usuario para la respuesta
    await nuevaMascota.populate('usuario', 'name email telefono');

    console.log('✅ Mascota creada exitosamente:', nuevaMascota._id);

    res.status(201).json({
      success: true,
      message: 'Mascota registrada exitosamente',
      mascota: nuevaMascota
    });

  } catch (error) {
    console.error('❌ Error creando mascota:', error);
    
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

// 📋 OBTENER MASCOTAS DEL USUARIO
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page, limit } = validatePagination(req.query.page, req.query.limit);
    const { especie, estado, search } = req.query;
    
    console.log('📋 Obteniendo mascotas para usuario:', req.user.id);

    // Construir query
    const query = { usuario: req.user.id, activo: true };
    
    if (especie && especie !== 'todas') {
      query.especie = especie;
    }
    
    if (estado && estado !== 'todos') {
      query.estado = estado;
    }
    
    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { raza: { $regex: search, $options: 'i' } }
      ];
    }

    // Consultar mascotas con paginación
    const [mascotas, totalCount] = await Promise.all([
      Mascota.find(query)
        .populate('usuario', 'name email telefono')
        .sort({ createdAt: -1 })
        .skip(page - 1)
        .limit(limit)
        .lean(),
      Mascota.countDocuments(query)
    ]);

    console.log('📋 Mascotas encontradas:', mascotas.length);

    res.json({
      success: true,
      mascotas,
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
    console.error('❌ Error obteniendo mascotas:', error);
    res.status(500).json({
      error: 'Error obteniendo mascotas',
      code: 'FETCH_ERROR'
    });
  }
});

// 🔍 OBTENER MASCOTA ESPECÍFICA
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

    console.log('🔍 Obteniendo mascota:', id);

    const mascota = await Mascota.findById(id).populate('usuario', 'name email telefono');
    
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'MASCOTA_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && mascota.usuario._id.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para ver esta mascota',
        code: 'UNAUTHORIZED'
      });
    }

    res.json({
      success: true,
      mascota
    });

  } catch (error) {
    console.error('❌ Error obteniendo mascota:', error);
    res.status(500).json({
      error: 'Error obteniendo mascota',
      code: 'FETCH_ERROR'
    });
  }
});

// ✏️ ACTUALIZAR MASCOTA
router.put('/:id', verifyToken, uploadSingle('imagen'), validateUploadedFiles, async (req, res) => {
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

    const mascota = await Mascota.findById(id);
    
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'MASCOTA_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para editar esta mascota',
        code: 'UNAUTHORIZED'
      });
    }

    const {
      nombre, especie, raza, edad, unidadEdad, genero, estado, peso, color,
      enfermedades, alergias, medicamentos, historial,
      esterilizado, fechaEsterilizacion,
      microchip, fechaImplante,
      contactoEmergencia
    } = req.body;

    console.log('✏️ Actualizando mascota:', id);

    // Validar datos si se proporcionan
    if (nombre || especie || raza || edad !== undefined || genero || estado) {
      const petData = {
        nombre: nombre || mascota.nombre,
        especie: especie || mascota.especie,
        raza: raza || mascota.raza,
        edad: edad !== undefined ? parseInt(edad) : mascota.edad,
        genero: genero || mascota.genero,
        estado: estado || mascota.estado
      };
      
      const validation = validatePetData(petData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Datos de mascota inválidos',
          details: validation.message,
          code: 'INVALID_PET_DATA'
        });
      }
    }

    // Actualizar campos
    if (nombre && nombre.trim()) mascota.nombre = nombre.trim();
    if (especie) mascota.especie = especie;
    if (raza && raza.trim()) mascota.raza = raza.trim();
    if (edad !== undefined) mascota.edad = parseInt(edad);
    if (unidadEdad) mascota.unidadEdad = unidadEdad;
    if (genero) mascota.genero = genero;
    if (estado) mascota.estado = estado;
    if (peso !== undefined) mascota.peso = peso ? parseFloat(peso) : null;
    if (color !== undefined) mascota.color = color ? color.trim() : null;
    
    // Campos médicos
    if (enfermedades !== undefined) mascota.enfermedades = enfermedades.trim();
    if (alergias !== undefined) mascota.alergias = alergias.trim();
    if (medicamentos !== undefined) mascota.medicamentos = medicamentos.trim();
    if (historial !== undefined) mascota.historial = historial.trim();
    
    // Información adicional
    if (esterilizado !== undefined) {
      mascota.esterilizado = esterilizado === 'true' || esterilizado === true;
    }
    
    if (fechaEsterilizacion) {
      mascota.fechaEsterilizacion = new Date(fechaEsterilizacion);
    }
    
    // Microchip
    if (microchip !== undefined) {
      if (microchip && typeof microchip === 'object') {
        mascota.microchip = {
          numero: microchip.numero?.toString().trim() || '',
          fechaImplante: fechaImplante ? new Date(fechaImplante) : mascota.microchip?.fechaImplante
        };
      } else if (microchip) {
        mascota.microchip = {
          numero: microchip.toString().trim(),
          fechaImplante: fechaImplante ? new Date(fechaImplante) : undefined
        };
      }
    }
    
    // Contacto de emergencia
    if (contactoEmergencia !== undefined) {
      if (contactoEmergencia && typeof contactoEmergencia === 'object') {
        mascota.contactoEmergencia = {
          nombre: contactoEmergencia.nombre?.trim() || '',
          telefono: contactoEmergencia.telefono?.trim() || '',
          relacion: contactoEmergencia.relacion?.trim() || ''
        };
      }
    }

    // Actualizar imagen si se subió nueva
    if (req.file) {
      mascota.imagen = req.file.url;
    }

    await mascota.save();
    await mascota.populate('usuario', 'name email telefono');

    console.log('✅ Mascota actualizada exitosamente:', mascota._id);

    res.json({
      success: true,
      message: 'Mascota actualizada exitosamente',
      mascota
    });

  } catch (error) {
    console.error('❌ Error actualizando mascota:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        error: 'Error de validación',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      error: 'Error actualizando mascota',
      code: 'UPDATE_ERROR'
    });
  }
});

// 🗑️ ELIMINAR MASCOTA (marcar como inactiva)
router.delete('/:id', verifyToken, async (req, res) => {
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

    const mascota = await Mascota.findById(id);
    
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'MASCOTA_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para eliminar esta mascota',
        code: 'UNAUTHORIZED'
      });
    }

    // Marcar como inactiva en lugar de eliminar
    mascota.activo = false;
    await mascota.save();

    console.log('✅ Mascota marcada como inactiva:', mascota._id);

    res.json({
      success: true,
      message: 'Mascota eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando mascota:', error);
    res.status(500).json({
      error: 'Error eliminando mascota',
      code: 'DELETE_ERROR'
    });
  }
});

// 💉 AGREGAR VACUNA
router.post('/:id/vacunas', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, fecha, veterinario, proximaDosis, notas, imagen } = req.body;

    // Validar ID
    const idValidation = validateObjectId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        error: idValidation.message,
        code: 'INVALID_ID'
      });
    }

    // Validaciones
    if (!nombre || !fecha) {
      return res.status(400).json({
        error: 'Nombre y fecha de la vacuna son obligatorios',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const mascota = await Mascota.findById(id);
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'MASCOTA_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para agregar vacunas a esta mascota',
        code: 'UNAUTHORIZED'
      });
    }

    // Agregar vacuna
    const nuevaVacuna = {
      nombre: nombre.trim(),
      fecha: new Date(fecha),
      veterinario: veterinario ? veterinario.trim() : undefined,
      proximaDosis: proximaDosis ? new Date(proximaDosis) : undefined,
      notas: notas ? notas.trim() : undefined,
      imagen: imagen || ''
    };

    await mascota.agregarVacuna(nuevaVacuna);

    console.log('💉 Vacuna agregada a mascota:', mascota._id);

    res.json({
      success: true,
      message: 'Vacuna agregada exitosamente',
      mascota
    });

  } catch (error) {
    console.error('❌ Error agregando vacuna:', error);
    res.status(500).json({
      error: 'Error agregando vacuna',
      code: 'ADD_VACCINE_ERROR'
    });
  }
});

// 🏥 AGREGAR OPERACIÓN
router.post('/:id/operaciones', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, fecha, veterinario, costo, estado, notas, imagen } = req.body;

    // Validar ID
    const idValidation = validateObjectId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        error: idValidation.message,
        code: 'INVALID_ID'
      });
    }

    // Validaciones
    if (!nombre || !descripcion || !fecha) {
      return res.status(400).json({
        error: 'Nombre, descripción y fecha de la operación son obligatorios',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const mascota = await Mascota.findById(id);
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'MASCOTA_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para agregar operaciones a esta mascota',
        code: 'UNAUTHORIZED'
      });
    }

    // Agregar operación
    const nuevaOperacion = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      fecha: new Date(fecha),
      veterinario: veterinario ? veterinario.trim() : undefined,
      costo: costo ? parseFloat(costo) : undefined,
      estado: estado || 'completada',
      notas: notas ? notas.trim() : undefined,
      imagen: imagen || ''
    };

    await mascota.agregarOperacion(nuevaOperacion);

    console.log('🏥 Operación agregada a mascota:', mascota._id);

    res.json({
      success: true,
      message: 'Operación agregada exitosamente',
      mascota
    });

  } catch (error) {
    console.error('❌ Error agregando operación:', error);
    res.status(500).json({
      error: 'Error agregando operación',
      code: 'ADD_OPERATION_ERROR'
    });
  }
});

// 📊 OBTENER ESTADÍSTICAS DE MASCOTAS (solo admin)
router.get('/admin/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas de mascotas');

    const stats = await Mascota.aggregate([
      { $match: { activo: true } },
      {
        $group: {
          _id: null,
          totalMascotas: { $sum: 1 },
          porEspecie: {
            $push: '$especie'
          },
          porEstado: {
            $push: '$estado'
          },
          edadPromedio: { $avg: '$edad' }
        }
      }
    ]);

    // Procesar estadísticas
    let especieStats = {};
    let estadoStats = {};

    if (stats.length > 0) {
      stats[0].porEspecie.forEach(especie => {
        especieStats[especie] = (especieStats[especie] || 0) + 1;
      });

      stats[0].porEstado.forEach(estado => {
        estadoStats[estado] = (estadoStats[estado] || 0) + 1;
      });
    }

    // Obtener mascotas que necesitan vacunas
    const mascotasConVacunasPendientes = await Mascota.countDocuments({
      activo: true,
      'vacunas.proximaDosis': {
        $gte: new Date(),
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // próximos 30 días
      }
    });

    res.json({
      success: true,
      stats: {
        totalMascotas: stats[0]?.totalMascotas || 0,
        edadPromedio: Math.round((stats[0]?.edadPromedio || 0) * 10) / 10,
        porEspecie: especieStats,
        porEstado: estadoStats,
        vacunasPendientes: mascotasConVacunasPendientes
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
    service: 'Mascotas API',
    timestamp: new Date().toISOString(),
    features: {
      crud: 'enabled',
      fileUpload: 'enabled',
      vaccines: 'enabled',
      operations: 'enabled',
      statistics: 'enabled'
    },
    endpoints: {
      'POST /': 'Crear mascota',
      'GET /': 'Obtener mascotas del usuario',
      'GET /:id': 'Obtener mascota específica',
      'PUT /:id': 'Actualizar mascota',
      'DELETE /:id': 'Eliminar mascota',
      'POST /:id/vacunas': 'Agregar vacuna',
      'POST /:id/operaciones': 'Agregar operación',
      'GET /admin/stats': 'Estadísticas (admin)',
      'GET /health': 'Estado del servicio'
    }
  });
});

module.exports = router;