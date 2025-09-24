const express = require('express');
const router = express.Router();

// Importar middleware y utilidades
const { verifyToken } = require('../middleware/auth');
const { 
  validateProductData, 
  validateObjectId,
  sanitizeString 
} = require('../utils/validators');

// Importar modelo
const Producto = require('../models/Producto');

// 📋 OBTENER TODOS LOS PRODUCTOS (Público)
router.get('/', async (req, res) => {
  try {
    console.log('📋 Obteniendo productos...');
    
    const { 
      page = 1, 
      limit = 10, 
      categoria, 
      search,
      minPrice,
      maxPrice,
      destacados,
      nuevo 
    } = req.query;

    // Construir query de filtros
    const query = { activo: true };
    
    if (categoria && categoria !== 'todas') {
      query.categoria = categoria;
    }
    
    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } },
        { marca: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (minPrice || maxPrice) {
      query.precio = {};
      if (minPrice) query.precio.$gte = parseFloat(minPrice);
      if (maxPrice) query.precio.$lte = parseFloat(maxPrice);
    }
    
    if (destacados === 'true') {
      query.destacado = true;
    }
    
    if (nuevo === 'true') {
      query.nuevo = true;
    }

    // Calcular paginación
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Ejecutar consulta con manejo de errores
    const [productos, totalCount] = await Promise.all([
      Producto.find(query)
        .populate('usuario', 'name email')
        .sort({ createdAt: -1, destacado: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .catch(err => {
          console.error('Error en query productos:', err);
          return [];
        }),
      Producto.countDocuments(query).catch(err => {
        console.error('Error en count productos:', err);
        return 0;
      })
    ]);

    console.log(`✅ Productos encontrados: ${productos.length}`);

    // Respuesta exitosa
    res.json({
      success: true,
      productos,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
        hasPrevPage: pageNum > 1
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener productos',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'FETCH_ERROR'
    });
  }
});

// 🔍 OBTENER PRODUCTO POR ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar ID
    const idValidation = validateObjectId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'ID de producto inválido',
        code: 'INVALID_ID'
      });
    }

    console.log('🔍 Obteniendo producto:', id);

    const producto = await Producto.findById(id)
      .populate('usuario', 'name email')
      .lean();
    
    if (!producto) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      producto
    });

  } catch (error) {
    console.error('❌ Error obteniendo producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener producto',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'FETCH_ERROR'
    });
  }
});

// 🆕 CREAR PRODUCTO (Solo admin)
router.post('/', verifyToken, async (req, res) => {
  try {
    // Verificar permisos de admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado. Solo administradores pueden crear productos.',
        code: 'UNAUTHORIZED'
      });
    }

    const {
      nombre,
      descripcion,
      precio,
      categoria,
      stock,
      marca,
      peso,
      destacado = false,
      nuevo = false,
      tags = []
    } = req.body;

    console.log('🆕 Creando producto:', nombre);

    // Validar datos del producto
    const productData = {
      nombre: sanitizeString(nombre),
      descripcion: sanitizeString(descripcion),
      precio: parseFloat(precio),
      categoria: sanitizeString(categoria),
      stock: parseInt(stock)
    };

    const validation = validateProductData(productData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Datos de producto inválidos',
        details: validation.message,
        code: 'INVALID_PRODUCT_DATA'
      });
    }

    // Crear producto
    const nuevoProducto = new Producto({
      nombre: productData.nombre,
      descripcion: productData.descripcion,
      precio: productData.precio,
      categoria: productData.categoria,
      stock: productData.stock,
      marca: sanitizeString(marca) || '',
      peso: peso ? parseFloat(peso) : undefined,
      destacado: destacado === true || destacado === 'true',
      nuevo: nuevo === true || nuevo === 'true',
      tags: Array.isArray(tags) ? tags.map(tag => sanitizeString(tag)).filter(Boolean) : [],
      usuario: req.user.id,
      activo: true
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
        success: false,
        error: 'Error de validación',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al crear producto',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'CREATE_ERROR'
    });
  }
});

// ✏️ ACTUALIZAR PRODUCTO (Solo admin)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    // Verificar permisos de admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado. Solo administradores pueden actualizar productos.',
        code: 'UNAUTHORIZED'
      });
    }

    const { id } = req.params;
    
    // Validar ID
    const idValidation = validateObjectId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'ID de producto inválido',
        code: 'INVALID_ID'
      });
    }

    console.log('✏️ Actualizando producto:', id);

    const producto = await Producto.findById(id);
    
    if (!producto) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Actualizar campos si se proporcionan
    const {
      nombre,
      descripcion,
      precio,
      categoria,
      stock,
      marca,
      peso,
      destacado,
      nuevo,
      tags,
      activo
    } = req.body;

    if (nombre) producto.nombre = sanitizeString(nombre);
    if (descripcion) producto.descripcion = sanitizeString(descripcion);
    if (precio !== undefined) producto.precio = parseFloat(precio);
    if (categoria) producto.categoria = sanitizeString(categoria);
    if (stock !== undefined) producto.stock = parseInt(stock);
    if (marca !== undefined) producto.marca = sanitizeString(marca) || '';
    if (peso !== undefined) producto.peso = peso ? parseFloat(peso) : undefined;
    if (destacado !== undefined) producto.destacado = destacado === true || destacado === 'true';
    if (nuevo !== undefined) producto.nuevo = nuevo === true || nuevo === 'true';
    if (tags !== undefined) producto.tags = Array.isArray(tags) ? tags.map(tag => sanitizeString(tag)).filter(Boolean) : [];
    if (activo !== undefined) producto.activo = activo === true || activo === 'true';

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
        success: false,
        error: 'Error de validación',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al actualizar producto',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'UPDATE_ERROR'
    });
  }
});

// 🗑️ ELIMINAR PRODUCTO (Solo admin)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Verificar permisos de admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado. Solo administradores pueden eliminar productos.',
        code: 'UNAUTHORIZED'
      });
    }

    const { id } = req.params;
    
    // Validar ID
    const idValidation = validateObjectId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'ID de producto inválido',
        code: 'INVALID_ID'
      });
    }

    console.log('🗑️ Eliminando producto:', id);

    const producto = await Producto.findById(id);
    
    if (!producto) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Marcar como inactivo en lugar de eliminar físicamente
    producto.activo = false;
    await producto.save();

    console.log('✅ Producto eliminado exitosamente:', producto._id);

    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar producto',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      code: 'DELETE_ERROR'
    });
  }
});

// 📊 OBTENER CATEGORÍAS DISPONIBLES
router.get('/categorias/disponibles', async (req, res) => {
  try {
    console.log('📊 Obteniendo categorías disponibles...');
    
    const categorias = [
      { value: 'alimento', label: 'Alimento' },
      { value: 'juguetes', label: 'Juguetes' },
      { value: 'medicamentos', label: 'Medicamentos' },
      { value: 'accesorios', label: 'Accesorios' },
      { value: 'higiene', label: 'Higiene' },
      { value: 'otros', label: 'Otros' }
    ];
    
    res.json(categorias);

  } catch (error) {
    console.error('❌ Error obteniendo categorías:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener categorías',
      code: 'FETCH_ERROR'
    });
  }
});

module.exports = router;