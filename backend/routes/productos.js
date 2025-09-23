const express = require('express');
const router = express.Router();

// Importar modelos, middlewares y utilidades
const Producto = require('../models/Producto');
const { verifyToken, isAdmin, optionalAuth } = require('../middleware/auth');
const { uploadMultiple, validateUploadedFiles } = require('../middleware/upload');
const { validateProductData, validateObjectId, validatePagination } = require('../utils/validators');

console.log('🛍️ Rutas de productos cargadas');

// 📝 CREAR NUEVO PRODUCTO (solo admin y usuarios autorizados)
router.post('/', verifyToken, uploadMultiple('imagenes', 5), validateUploadedFiles, async (req, res) => {
  try {
    const {
      nombre, descripcion, precio, categoria, subcategoria, marca, modelo,
      stock, stockMinimo, unidadMedida,
      // Descuento
      tieneDescuento, porcentajeDescuento, fechaInicioDescuento, fechaFinDescuento, motivoDescuento,
      // Garantía
      tieneGarantia, mesesGarantia, descripcionGarantia,
      // Otros
      envioGratis, peso, ingredientes, instrucciones, contraindicaciones,
      fechaVencimiento, lote, tags, destacado, nuevo
    } = req.body;

    console.log('🛍️ Creando nuevo producto:', nombre);

    // Preparar datos del producto
    const productData = {
      nombre: nombre?.trim(),
      descripcion: descripcion?.trim(),
      precio: parseFloat(precio),
      categoria: categoria || 'otros',
      subcategoria: subcategoria?.trim(),
      marca: marca?.trim(),
      modelo: modelo?.trim(),
      stock: parseInt(stock) || 0,
      stockMinimo: parseInt(stockMinimo) || 5,
      unidadMedida: unidadMedida || 'unidad',
      envioGratis: envioGratis === 'true' || envioGratis === true,
      peso: peso ? parseFloat(peso) : undefined,
      ingredientes: ingredientes?.trim(),
      instrucciones: instrucciones?.trim(),
      contraindicaciones: contraindicaciones?.trim(),
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : undefined,
      lote: lote?.trim(),
      destacado: destacado === 'true' || destacado === true,
      nuevo: nuevo === 'true' || nuevo === true,
      descuento: {
        tiene: tieneDescuento === 'true' || tieneDescuento === true,
        porcentaje: parseFloat(porcentajeDescuento) || 0,
        fechaInicio: fechaInicioDescuento ? new Date(fechaInicioDescuento) : null,
        fechaFin: fechaFinDescuento ? new Date(fechaFinDescuento) : null,
        motivoDescuento: motivoDescuento?.trim()
      },
      garantia: {
        tiene: tieneGarantia === 'true' || tieneGarantia === true,
        meses: parseInt(mesesGarantia) || 0,
        descripcion: descripcionGarantia?.trim() || ""
      }
    };

    // Validar datos del producto
    const validation = validateProductData(productData);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Datos de producto inválidos',
        details: validation.message,
        code: 'INVALID_PRODUCT_DATA'
      });
    }

    // Procesar imágenes
    let imagenPrincipal = '';
    let imagenes = [];

    if (req.files && req.files.length > 0) {
      imagenPrincipal = req.files[0].url;
      
      imagenes = req.files.map((file, index) => ({
        url: file.url,
        alt: `${nombre} - Imagen ${index + 1}`,
        esPrincipal: index === 0
      }));
    }

    // Procesar tags
    let tagsArray = [];
    if (tags) {
      tagsArray = typeof tags === 'string' 
        ? tags.split(',').map(tag => tag.trim().toLowerCase())
        : Array.isArray(tags) ? tags.map(tag => tag.trim().toLowerCase()) : [];
    }

    // Crear producto
    const nuevoProducto = new Producto({
      ...productData,
      imagen: imagenPrincipal,
      imagenes,
      tags: tagsArray,
      usuario: req.user.id
    });

    await nuevoProducto.save();
    await nuevoProducto.populate('usuario', 'name email');

    console.log('✅ Producto creado exitosamente:', nuevoProducto._id);

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      producto: nuevoProducto
    });

  } catch (error) {
    console.error('❌ Error creando producto:', error);
    
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

// 📋 OBTENER PRODUCTOS (público con filtros)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { page, limit } = validatePagination(req.query.page, req.query.limit);
    const { 
      categoria, subcategoria, marca, 
      precioMin, precioMax, 
      descuento, garantia, envioGratis, 
      destacado, nuevo, disponible,
      search, sortBy, order 
    } = req.query;

    console.log('📋 Obteniendo productos con filtros');

    // Construir query
    const query = { activo: true };

    // Filtros de categoría
    if (categoria && categoria !== 'todos') {
      query.categoria = categoria;
    }
    
    if (subcategoria) {
      query.subcategoria = { $regex: subcategoria, $options: 'i' };
    }
    
    if (marca) {
      query.marca = { $regex: marca, $options: 'i' };
    }

    // Filtros de precio
    if (precioMin || precioMax) {
      query.precio = {};
      if (precioMin) query.precio.$gte = parseFloat(precioMin);
      if (precioMax) query.precio.$lte = parseFloat(precioMax);
    }

    // Filtros booleanos
    if (descuento === 'true') {
      query['descuento.tiene'] = true;
    }
    
    if (garantia === 'true') {
      query['garantia.tiene'] = true;
    }
    
    if (envioGratis === 'true') {
      query.envioGratis = true;
    }
    
    if (destacado === 'true') {
      query.destacado = true;
    }
    
    if (nuevo === 'true') {
      query.nuevo = true;
    }
    
    if (disponible === 'true') {
      query.stock = { $gt: 0 };
      query.agotado = false;
    }

    // Búsqueda por texto
    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } },
        { marca: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Configurar ordenamiento
    let sortOptions = { createdAt: -1 }; // Por defecto más reciente
    
    if (sortBy) {
      const sortOrder = order === 'asc' ? 1 : -1;
      
      switch (sortBy) {
        case 'precio':
          sortOptions = { precio: sortOrder };
          break;
        case 'nombre':
          sortOptions = { nombre: sortOrder };
          break;
        case 'stock':
          sortOptions = { stock: sortOrder };
          break;
        case 'vistas':
          sortOptions = { vistas: sortOrder };
          break;
        case 'ventas':
          sortOptions = { ventasTotal: sortOrder };
          break;
        default:
          sortOptions = { createdAt: sortOrder };
      }
    }

    // Consultar productos
    const [productos, totalCount] = await Promise.all([
      Producto.find(query)
        .populate('usuario', 'name email')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Producto.countDocuments(query)
    ]);

    // Procesar productos para agregar información calculada
    const productosConDatos = productos.map(producto => {
      // Calcular precio con descuento
      let precioConDescuento = producto.precio;
      let descuentoVigente = false;
      
      if (producto.descuento.tiene && producto.descuento.porcentaje > 0) {
        const ahora = new Date();
        const inicioValido = !producto.descuento.fechaInicio || ahora >= producto.descuento.fechaInicio;
        const finValido = !producto.descuento.fechaFin || ahora <= producto.descuento.fechaFin;
        
        if (inicioValido && finValido) {
          descuentoVigente = true;
          const descuentoDecimal = producto.descuento.porcentaje / 100;
          precioConDescuento = Math.round(producto.precio * (1 - descuentoDecimal));
        }
      }

      return {
        ...producto,
        precioConDescuento,
        descuentoVigente,
        ahorroDescuento: producto.precio - precioConDescuento,
        disponible: producto.stock > 0 && !producto.agotado,
        estadoStock: producto.stock === 0 ? 'agotado' : 
                     producto.stock <= producto.stockMinimo ? 'bajo' : 'disponible'
      };
    });

    console.log('📋 Productos encontrados:', productos.length);

    res.json({
      success: true,
      productos: productosConDatos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      },
      filters: {
        totalWithFilters: totalCount,
        appliedFilters: Object.keys(req.query).filter(key => 
          !['page', 'limit', 'sortBy', 'order'].includes(key) && req.query[key]
        )
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo productos:', error);
    res.status(500).json({
      error: 'Error obteniendo productos',
      code: 'FETCH_ERROR'
    });
  }
});

// 🔍 OBTENER PRODUCTO ESPECÍFICO
router.get('/:id', optionalAuth, async (req, res) => {
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

    console.log('🔍 Obteniendo producto:', id);

    const producto = await Producto.findById(id).populate([
      { path: 'usuario', select: 'name email telefono' },
      { path: 'reseñas.usuario', select: 'name profilePicture' }
    ]);

    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        code: 'PRODUCTO_NOT_FOUND'
      });
    }

    // Incrementar vistas (solo para usuarios no autenticados o diferentes al creador)
    if (!req.user || req.user.id !== producto.usuario._id.toString()) {
      await producto.incrementarVistas();
    }

    // Calcular información adicional
    const productoData = producto.toObject();
    productoData.precioConDescuento = producto.getPrecioConDescuento();
    productoData.descuentoVigente = producto.isDescuentoVigente();
    productoData.ahorroDescuento = productoData.precio - productoData.precioConDescuento;
    productoData.disponible = producto.disponible;
    productoData.estadoStock = producto.estadoStock;

    // Obtener productos relacionados (misma categoría)
    const productosRelacionados = await Producto.find({
      categoria: producto.categoria,
      _id: { $ne: producto._id },
      activo: true,
      stock: { $gt: 0 }
    })
    .limit(4)
    .select('nombre precio imagen descuento')
    .lean();

    res.json({
      success: true,
      producto: productoData,
      productosRelacionados
    });

  } catch (error) {
    console.error('❌ Error obteniendo producto:', error);
    res.status(500).json({
      error: 'Error obteniendo producto',
      code: 'FETCH_ERROR'
    });
  }
});

// ✏️ ACTUALIZAR PRODUCTO
router.put('/:id', verifyToken, uploadMultiple('imagenes', 5), validateUploadedFiles, async (req, res) => {
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

    const producto = await Producto.findById(id);
    
    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        code: 'PRODUCTO_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && producto.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para editar este producto',
        code: 'UNAUTHORIZED'
      });
    }

    const {
      nombre, descripcion, precio, categoria, subcategoria, marca, modelo,
      stock, stockMinimo, unidadMedida,
      tieneDescuento, porcentajeDescuento, fechaInicioDescuento, fechaFinDescuento, motivoDescuento,
      tieneGarantia, mesesGarantia, descripcionGarantia,
      envioGratis, peso, ingredientes, instrucciones, contraindicaciones,
      fechaVencimiento, lote, tags, destacado, nuevo, activo
    } = req.body;

    console.log('✏️ Actualizando producto:', id);

    // Actualizar campos básicos
    if (nombre && nombre.trim()) producto.nombre = nombre.trim();
    if (descripcion && descripcion.trim()) producto.descripcion = descripcion.trim();
    if (precio !== undefined) producto.precio = parseFloat(precio);
    if (categoria) producto.categoria = categoria;
    if (subcategoria !== undefined) producto.subcategoria = subcategoria?.trim();
    if (marca !== undefined) producto.marca = marca?.trim();
    if (modelo !== undefined) producto.modelo = modelo?.trim();
    if (stock !== undefined) producto.stock = parseInt(stock);
    if (stockMinimo !== undefined) producto.stockMinimo = parseInt(stockMinimo);
    if (unidadMedida) producto.unidadMedida = unidadMedida;
    if (envioGratis !== undefined) producto.envioGratis = envioGratis === 'true' || envioGratis === true;
    if (peso !== undefined) producto.peso = peso ? parseFloat(peso) : null;
    if (ingredientes !== undefined) producto.ingredientes = ingredientes?.trim();
    if (instrucciones !== undefined) producto.instrucciones = instrucciones?.trim();
    if (contraindicaciones !== undefined) producto.contraindicaciones = contraindicaciones?.trim();
    if (fechaVencimiento) producto.fechaVencimiento = new Date(fechaVencimiento);
    if (lote !== undefined) producto.lote = lote?.trim();
    if (destacado !== undefined) producto.destacado = destacado === 'true' || destacado === true;
    if (nuevo !== undefined) producto.nuevo = nuevo === 'true' || nuevo === true;
    if (activo !== undefined) producto.activo = activo === 'true' || activo === true;

    // Actualizar descuento
    if (tieneDescuento !== undefined) {
      producto.descuento.tiene = tieneDescuento === 'true' || tieneDescuento === true;
      if (producto.descuento.tiene) {
        if (porcentajeDescuento !== undefined) producto.descuento.porcentaje = parseFloat(porcentajeDescuento);
        if (fechaInicioDescuento) producto.descuento.fechaInicio = new Date(fechaInicioDescuento);
        if (fechaFinDescuento) producto.descuento.fechaFin = new Date(fechaFinDescuento);
        if (motivoDescuento !== undefined) producto.descuento.motivoDescuento = motivoDescuento?.trim();
      } else {
        producto.descuento.porcentaje = 0;
        producto.descuento.fechaInicio = null;
        producto.descuento.fechaFin = null;
        producto.descuento.motivoDescuento = '';
      }
    }

    // Actualizar garantía
    if (tieneGarantia !== undefined) {
      producto.garantia.tiene = tieneGarantia === 'true' || tieneGarantia === true;
      if (producto.garantia.tiene) {
        if (mesesGarantia !== undefined) producto.garantia.meses = parseInt(mesesGarantia);
        if (descripcionGarantia !== undefined) producto.garantia.descripcion = descripcionGarantia?.trim() || '';
      } else {
        producto.garantia.meses = 0;
        producto.garantia.descripcion = '';
      }
    }

    // Actualizar tags
    if (tags !== undefined) {
      if (typeof tags === 'string') {
        producto.tags = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
      } else if (Array.isArray(tags)) {
        producto.tags = tags.map(tag => tag.trim().toLowerCase());
      }
    }

    // Actualizar imágenes si se subieron nuevas
    if (req.files && req.files.length > 0) {
      producto.imagen = req.files[0].url;
      
      producto.imagenes = req.files.map((file, index) => ({
        url: file.url,
        alt: `${producto.nombre} - Imagen ${index + 1}`,
        esPrincipal: index === 0
      }));
    }

    // Validar datos actualizados
    const productData = {
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      categoria: producto.categoria,
      stock: producto.stock,
      descuento: producto.descuento,
      garantia: producto.garantia
    };

    const validation = validateProductData(productData);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Datos de producto inválidos',
        details: validation.message,
        code: 'INVALID_PRODUCT_DATA'
      });
    }

    await producto.save();
    await producto.populate('usuario', 'name email');

    console.log('✅ Producto actualizado exitosamente:', producto._id);

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      producto
    });

  } catch (error) {
    console.error('❌ Error actualizando producto:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        error: 'Error de validación',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      error: 'Error actualizando producto',
      code: 'UPDATE_ERROR'
    });
  }
});

// 🗑️ ELIMINAR PRODUCTO (marcar como inactivo)
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

    const producto = await Producto.findById(id);
    
    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        code: 'PRODUCTO_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && producto.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'No autorizado para eliminar este producto',
        code: 'UNAUTHORIZED'
      });
    }

    // Marcar como inactivo
    producto.activo = false;
    await producto.save();

    console.log('✅ Producto marcado como inactivo:', producto._id);

    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando producto:', error);
    res.status(500).json({
      error: 'Error eliminando producto',
      code: 'DELETE_ERROR'
    });
  }
});

// ⭐ AGREGAR RESEÑA
router.post('/:id/resenas', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { calificacion, comentario } = req.body;

    // Validar ID
    const idValidation = validateObjectId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        error: idValidation.message,
        code: 'INVALID_ID'
      });
    }

    // Validar calificación
    if (!calificacion || calificacion < 1 || calificacion > 5) {
      return res.status(400).json({
        error: 'Calificación debe estar entre 1 y 5',
        code: 'INVALID_RATING'
      });
    }

    const producto = await Producto.findById(id);
    
    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        code: 'PRODUCTO_NOT_FOUND'
      });
    }

    // Agregar reseña
    await producto.agregarReseña(req.user.id, calificacion, comentario);

    console.log('⭐ Reseña agregada al producto:', producto._id);

    res.json({
      success: true,
      message: 'Reseña agregada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error agregando reseña:', error);
    res.status(500).json({
      error: 'Error agregando reseña',
      code: 'ADD_REVIEW_ERROR'
    });
  }
});

// 📊 OBTENER CATEGORÍAS DISPONIBLES
router.get('/meta/categorias', (req, res) => {
  const categorias = [
    { value: 'alimento', label: 'Alimento', icon: '🍖' },
    { value: 'juguetes', label: 'Juguetes', icon: '🎾' },
    { value: 'medicamentos', label: 'Medicamentos', icon: '💊' },
    { value: 'accesorios', label: 'Accesorios', icon: '🦮' },
    { value: 'higiene', label: 'Higiene', icon: '🧼' },
    { value: 'otros', label: 'Otros', icon: '📦' }
  ];
  
  res.json({
    success: true,
    categorias
  });
});

// 📊 ESTADÍSTICAS DE PRODUCTOS (solo admin)
router.get('/admin/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas de productos');

    const stats = await Producto.aggregate([
      { $match: { activo: true } },
      {
        $group: {
          _id: null,
          totalProductos: { $sum: 1 },
          precioPromedio: { $avg: '$precio' },
          stockTotal: { $sum: '$stock' },
          productosPorCategoria: { $push: '$categoria' },
          productosConDescuento: {
            $sum: { $cond: ['$descuento.tiene', 1, 0] }
          },
          productosConGarantia: {
            $sum: { $cond: ['$garantia.tiene', 1, 0] }
          },
          productosEnvioGratis: {
            $sum: { $cond: ['$envioGratis', 1, 0] }
          }
        }
      }
    ]);

    // Estadísticas por categoría
    let categoriaStats = {};
    if (stats.length > 0) {
      stats[0].productosPorCategoria.forEach(categoria => {
        categoriaStats[categoria] = (categoriaStats[categoria] || 0) + 1;
      });
    }

    // Productos con stock bajo
    const productosStockBajo = await Producto.countDocuments({
      activo: true,
      $expr: { $lte: ['$stock', '$stockMinimo'] }
    });

    res.json({
      success: true,
      stats: {
        totalProductos: stats[0]?.totalProductos || 0,
        precioPromedio: Math.round((stats[0]?.precioPromedio || 0) * 100) / 100,
        stockTotal: stats[0]?.stockTotal || 0,
        productosPorCategoria: categoriaStats,
        productosConDescuento: stats[0]?.productosConDescuento || 0,
        productosConGarantia: stats[0]?.productosConGarantia || 0,
        productosEnvioGratis: stats[0]?.productosEnvioGratis || 0,
        productosStockBajo
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
    service: 'Productos API',
    timestamp: new Date().toISOString(),
    features: {
      crud: 'enabled',
      fileUpload: 'enabled',
      discounts: 'enabled',
      warranties: 'enabled',
      reviews: 'enabled',
      categories: 'enabled',
      search: 'enabled',
      filters: 'enabled'
    },
    endpoints: {
      'POST /': 'Crear producto',
      'GET /': 'Obtener productos con filtros',
      'GET /:id': 'Obtener producto específico',
      'PUT /:id': 'Actualizar producto',
      'DELETE /:id': 'Eliminar producto',
      'POST /:id/resenas': 'Agregar reseña',
      'GET /meta/categorias': 'Obtener categorías',
      'GET /admin/stats': 'Estadísticas (admin)',
      'GET /health': 'Estado del servicio'
    }
  });
});

module.exports = router;