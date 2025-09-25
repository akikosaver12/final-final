const express = require('express');
const router = express.Router();

// Importar modelos y middlewares básicos
const Mascota = require('../models/Mascota');
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');

console.log('🐾 Rutas de mascotas cargadas');

// Función de validación simple para ObjectId
const isValidObjectId = (id) => {
  return id && id.match(/^[0-9a-fA-F]{24}$/);
};

// Función de validación simple para datos de mascota
const validatePetData = (data) => {
  const { nombre, especie, raza, edad, genero, estado } = data;
  const errors = [];

  if (!nombre || nombre.trim().length < 1) {
    errors.push('El nombre es requerido');
  }
  if (!especie) {
    errors.push('La especie es requerida');
  }
  if (!raza || raza.trim().length < 1) {
    errors.push('La raza es requerida');
  }
  if (!edad && edad !== 0) {
    errors.push('La edad es requerida');
  }
  if (!genero) {
    errors.push('El género es requerido');
  }
  if (!estado) {
    errors.push('El estado es requerido');
  }

  return {
    isValid: errors.length === 0,
    message: errors.join(', ')
  };
};

// Función simple de paginación
const validatePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  
  return {
    page: Math.max(1, pageNum),
    limit: Math.min(Math.max(1, limitNum), 50)
  };
};

// 📝 CREAR NUEVA MASCOTA
router.post('/', verifyToken, async (req, res) => {
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
      imagen: req.body.imagen || '',
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
    const skip = (page - 1) * limit;
    
    const [mascotas, totalCount] = await Promise.all([
      Mascota.find(query)
        .populate('usuario', 'name email telefono')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Mascota.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    console.log(`✅ ${mascotas.length} mascotas obtenidas de ${totalCount} totales`);

    res.json({
      mascotas,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo mascotas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 🐾 OBTENER MASCOTAS DE UN USUARIO ESPECÍFICO (para admin)
router.get('/usuario/:userId', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🐾 Admin obteniendo mascotas del usuario:', userId);

    // Validar ID de usuario
    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        error: 'ID de usuario inválido',
        code: 'INVALID_USER_ID'
      });
    }

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Obtener mascotas del usuario
    const mascotas = await Mascota.find({ 
      usuario: userId, 
      activo: true 
    })
    .populate('usuario', 'name email telefono')
    .sort({ createdAt: -1 });

    console.log(`✅ ${mascotas.length} mascotas encontradas para usuario ${user.name}`);

    res.json(mascotas);

  } catch (error) {
    console.error('❌ Error obteniendo mascotas de usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 👁️ OBTENER UNA MASCOTA ESPECÍFICA
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('👁️ Obteniendo mascota:', id);

    // Validar ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: 'ID de mascota inválido',
        code: 'INVALID_PET_ID'
      });
    }

    // Buscar mascota
    const mascota = await Mascota.findById(id)
      .populate('usuario', 'name email telefono');

    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'PET_NOT_FOUND'
      });
    }

    // Verificar que el usuario es propietario o admin
    if (req.user.role !== 'admin' && mascota.usuario._id.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para ver esta mascota',
        code: 'NOT_AUTHORIZED'
      });
    }

    console.log('✅ Mascota obtenida exitosamente');

    res.json(mascota);

  } catch (error) {
    console.error('❌ Error obteniendo mascota:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ✏️ ACTUALIZAR MASCOTA
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('✏️ Actualizando mascota:', id);

    // Validar ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: 'ID de mascota inválido',
        code: 'INVALID_PET_ID'
      });
    }

    // Buscar mascota
    const mascota = await Mascota.findById(id);
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'PET_NOT_FOUND'
      });
    }

    // Verificar que el usuario es propietario o admin
    if (req.user.role !== 'admin' && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para modificar esta mascota',
        code: 'NOT_AUTHORIZED'
      });
    }

    // Actualizar campos permitidos
    const allowedFields = [
      'nombre', 'especie', 'raza', 'edad', 'unidadEdad', 'genero', 'estado',
      'peso', 'color', 'enfermedades', 'alergias', 'medicamentos', 'historial',
      'esterilizado', 'fechaEsterilizacion', 'microchip', 'contactoEmergencia', 'imagen'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        mascota[field] = updateData[field];
      }
    });

    await mascota.save();
    await mascota.populate('usuario', 'name email telefono');

    console.log('✅ Mascota actualizada exitosamente');

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
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 🗑️ ELIMINAR MASCOTA (soft delete)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Eliminando mascota:', id);

    // Validar ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: 'ID de mascota inválido',
        code: 'INVALID_PET_ID'
      });
    }

    // Buscar mascota
    const mascota = await Mascota.findById(id);
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'PET_NOT_FOUND'
      });
    }

    // Verificar que el usuario es propietario o admin
    if (req.user.role !== 'admin' && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para eliminar esta mascota',
        code: 'NOT_AUTHORIZED'
      });
    }

    // Soft delete
    mascota.activo = false;
    await mascota.save();

    console.log('✅ Mascota eliminada exitosamente');

    res.json({
      success: true,
      message: 'Mascota eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando mascota:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 💉 AGREGAR VACUNA A MASCOTA
router.post('/:id/vacunas', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, fecha, veterinario, proximaDosis, notas } = req.body;

    console.log('💉 Agregando vacuna a mascota:', id);

    // Validar ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: 'ID de mascota inválido',
        code: 'INVALID_PET_ID'
      });
    }

    // Buscar mascota
    const mascota = await Mascota.findById(id);
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'PET_NOT_FOUND'
      });
    }

    // Verificar que el usuario es propietario o admin
    if (req.user.role !== 'admin' && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para modificar esta mascota',
        code: 'NOT_AUTHORIZED'
      });
    }

    // Validar datos requeridos
    if (!nombre || !fecha) {
      return res.status(400).json({
        error: 'Nombre y fecha de la vacuna son requeridos',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Crear nueva vacuna
    const nuevaVacuna = {
      nombre: nombre.trim(),
      fecha: new Date(fecha),
      veterinario: veterinario?.trim(),
      proximaDosis: proximaDosis ? new Date(proximaDosis) : undefined,
      notas: notas?.trim()
    };

    // Agregar vacuna al array
    mascota.vacunas.push(nuevaVacuna);
    await mascota.save();

    console.log('✅ Vacuna agregada exitosamente');

    res.json({
      success: true,
      message: 'Vacuna agregada exitosamente',
      mascota: await mascota.populate('usuario', 'name email')
    });

  } catch (error) {
    console.error('❌ Error agregando vacuna:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 🏥 AGREGAR OPERACIÓN A MASCOTA
router.post('/:id/operaciones', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, fecha, veterinario, costo, estado, notas } = req.body;

    console.log('🏥 Agregando operación a mascota:', id);

    // Validar ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: 'ID de mascota inválido',
        code: 'INVALID_PET_ID'
      });
    }

    // Buscar mascota
    const mascota = await Mascota.findById(id);
    if (!mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada',
        code: 'PET_NOT_FOUND'
      });
    }

    // Verificar que el usuario es propietario o admin
    if (req.user.role !== 'admin' && mascota.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para modificar esta mascota',
        code: 'NOT_AUTHORIZED'
      });
    }

    // Validar datos requeridos
    if (!nombre || !descripcion || !fecha) {
      return res.status(400).json({
        error: 'Nombre, descripción y fecha de la operación son requeridos',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Crear nueva operación
    const nuevaOperacion = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      fecha: new Date(fecha),
      veterinario: veterinario?.trim(),
      costo: costo ? parseFloat(costo) : undefined,
      estado: estado || 'completada',
      notas: notas?.trim()
    };

    // Agregar operación al array
    mascota.operaciones.push(nuevaOperacion);
    await mascota.save();

    console.log('✅ Operación agregada exitosamente');

    res.json({
      success: true,
      message: 'Operación agregada exitosamente',
      mascota: await mascota.populate('usuario', 'name email')
    });

  } catch (error) {
    console.error('❌ Error agregando operación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 📊 OBTENER ESTADÍSTICAS DE MASCOTAS (admin)
router.get('/stats/overview', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas de mascotas');

    const [
      totalMascotas,
      mascotasActivas,
      mascotasPorEspecie,
      mascotasPorEstado
    ] = await Promise.all([
      Mascota.countDocuments(),
      Mascota.countDocuments({ activo: true }),
      Mascota.aggregate([
        { $match: { activo: true } },
        { $group: { _id: '$especie', count: { $sum: 1 } } }
      ]),
      Mascota.aggregate([
        { $match: { activo: true } },
        { $group: { _id: '$estado', count: { $sum: 1 } } }
      ])
    ]);

    console.log('✅ Estadísticas obtenidas exitosamente');

    res.json({
      totalMascotas,
      mascotasActivas,
      mascotasInactivas: totalMascotas - mascotasActivas,
      porEspecie: mascotasPorEspecie,
      porEstado: mascotasPorEstado
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;