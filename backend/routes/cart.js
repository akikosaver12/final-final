const express = require('express');
const router = express.Router();

// Importar modelos, middlewares y utilidades
const Cart = require('../models/Cart');
const Producto = require('../models/Producto');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { validateCartData, validateCartItem, validateObjectId } = require('../utils/validators');

console.log('Rutas de carrito cargadas');

// Obtener carrito del usuario
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar que el usuario solo pueda acceder a su propio carrito
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      // Si no existe carrito, crear uno vacío
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }

    // Limpiar items inválidos
    cart.cleanupItems();
    await cart.save();
    
    // Formatear respuesta
    const response = {
      items: cart.items.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        category: item.category,
        stock: item.stock,
        brand: item.brand,
        sku: item.sku,
        subtotal: item.subtotal,
        notes: item.notes
      })),
      total: cart.total,
      subtotal: cart.subtotal,
      taxes: cart.taxes,
      shipping: cart.shipping,
      discounts: cart.discounts,
      itemCount: cart.itemCount,
      uniqueItems: cart.uniqueItems,
      lastUpdated: cart.lastUpdated
    };

    res.json(response);

  } catch (error) {
    console.error('Error obteniendo carrito:', error);
    res.status(500).json({ 
      error: 'Error del servidor', 
      code: 'FETCH_ERROR'
    });
  }
});

// Guardar/actualizar carrito del usuario
router.post('/', verifyToken, async (req, res) => {
  try {
    const { userId, items } = req.body;
    
    // Verificar que el usuario solo pueda actualizar su propio carrito
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    // Validar datos del carrito
    const validation = validateCartData({ userId, items });
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Datos de carrito inválidos',
        details: validation.message,
        code: 'INVALID_CART_DATA'
      });
    }

    // Convertir items al formato del modelo
    const cartItems = [];
    
    for (const item of items) {
      // Validar cada item individualmente
      const itemValidation = validateCartItem(item);
      if (!itemValidation.isValid) {
        return res.status(400).json({
          error: 'Item inválido en el carrito',
          details: itemValidation.message,
          code: 'INVALID_CART_ITEM'
        });
      }

      // Verificar stock del producto si está disponible
      try {
        const producto = await Producto.findById(item.id || item.productId);
        if (producto) {
          if (producto.stock < item.quantity) {
            return res.status(400).json({
              error: `Stock insuficiente para ${producto.nombre}`,
              availableStock: producto.stock,
              requestedQuantity: item.quantity,
              code: 'INSUFFICIENT_STOCK'
            });
          }
        }
      } catch (productError) {
        console.warn('Error verificando producto:', productError.message);
      }

      cartItems.push({
        productId: item.id || item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        category: item.category,
        stock: item.stock,
        brand: item.brand,
        sku: item.sku,
        notes: item.notes
      });
    }

    // Buscar carrito existente o crear uno nuevo
    let cart = await Cart.findOne({ userId });
    
    if (cart) {
      cart.items = cartItems;
    } else {
      cart = new Cart({ userId, items: cartItems });
    }

    // Limpiar items y guardar
    cart.cleanupItems();
    await cart.save();

    res.json({
      success: true,
      message: 'Carrito actualizado',
      total: cart.total,
      subtotal: cart.subtotal,
      itemCount: cart.itemCount,
      uniqueItems: cart.uniqueItems
    });

  } catch (error) {
    console.error('Error guardando carrito:', error);
    res.status(500).json({ 
      error: 'Error del servidor', 
      code: 'SAVE_ERROR'
    });
  }
});

// Agregar item al carrito
router.post('/item', verifyToken, async (req, res) => {
  try {
    const { userId, item } = req.body;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    // Validar item
    const itemValidation = validateCartItem(item);
    if (!itemValidation.isValid) {
      return res.status(400).json({
        error: 'Datos de item inválidos',
        details: itemValidation.message,
        code: 'INVALID_ITEM_DATA'
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Verificar stock del producto
    try {
      const producto = await Producto.findById(item.id || item.productId);
      if (producto) {
        const existingItem = cart.items.find(cartItem => 
          cartItem.productId === (item.id || item.productId)
        );
        const totalQuantity = (existingItem ? existingItem.quantity : 0) + (item.quantity || 1);
        
        if (producto.stock < totalQuantity) {
          return res.status(400).json({
            error: `Stock insuficiente para ${producto.nombre}`,
            availableStock: producto.stock,
            requestedQuantity: totalQuantity,
            code: 'INSUFFICIENT_STOCK'
          });
        }
      }
    } catch (productError) {
      console.warn('Error verificando producto:', productError.message);
    }

    // Agregar item usando método del modelo
    const itemData = {
      id: item.id || item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      image: item.image,
      category: item.category,
      stock: item.stock,
      brand: item.brand,
      sku: item.sku,
      notes: item.notes
    };

    await cart.addItem(itemData);

    res.json({
      success: true,
      message: 'Item agregado al carrito',
      total: cart.total,
      itemCount: cart.itemCount,
      uniqueItems: cart.uniqueItems
    });

  } catch (error) {
    console.error('Error agregando item:', error);
    
    if (error.message.includes('Stock insuficiente') || error.message.includes('Máximo')) {
      return res.status(400).json({
        error: error.message,
        code: 'STOCK_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Error agregando item', 
      code: 'ADD_ITEM_ERROR'
    });
  }
});

// Actualizar cantidad de un item
router.put('/quantity', verifyToken, async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    if (!productId) {
      return res.status(400).json({
        error: 'ID de producto es requerido',
        code: 'MISSING_PRODUCT_ID'
      });
    }

    if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 0)) {
      return res.status(400).json({
        error: 'Cantidad debe ser un número entero mayor o igual a 0',
        code: 'INVALID_QUANTITY'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ 
        error: 'Carrito no encontrado',
        code: 'CART_NOT_FOUND'
      });
    }

    // Verificar stock si se está aumentando la cantidad
    if (quantity > 0) {
      try {
        const producto = await Producto.findById(productId);
        if (producto && producto.stock < quantity) {
          return res.status(400).json({
            error: `Stock insuficiente para ${producto.nombre}`,
            availableStock: producto.stock,
            requestedQuantity: quantity,
            code: 'INSUFFICIENT_STOCK'
          });
        }
      } catch (productError) {
        console.warn('Error verificando producto:', productError.message);
      }
    }

    await cart.updateItemQuantity(productId, quantity);

    res.json({
      success: true,
      message: 'Cantidad actualizada',
      total: cart.total,
      itemCount: cart.itemCount,
      uniqueItems: cart.uniqueItems
    });

  } catch (error) {
    console.error('Error actualizando cantidad:', error);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        error: error.message,
        code: 'ITEM_NOT_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Error actualizando cantidad', 
      code: 'UPDATE_QUANTITY_ERROR'
    });
  }
});

// Eliminar item específico del carrito
router.delete('/item/:userId/:productId', verifyToken, async (req, res) => {
  try {
    const { userId, productId } = req.params;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ 
        error: 'Carrito no encontrado',
        code: 'CART_NOT_FOUND'
      });
    }

    await cart.removeItem(productId);

    res.json({
      success: true,
      message: 'Item eliminado del carrito',
      total: cart.total,
      itemCount: cart.itemCount,
      uniqueItems: cart.uniqueItems
    });

  } catch (error) {
    console.error('Error eliminando item:', error);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        error: error.message,
        code: 'ITEM_NOT_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Error eliminando item', 
      code: 'REMOVE_ITEM_ERROR'
    });
  }
});

// Limpiar carrito del usuario
router.delete('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
      await cart.save();
    } else {
      await cart.clear();
    }

    res.json({ 
      success: true,
      message: 'Carrito limpiado'
    });

  } catch (error) {
    console.error('Error limpiando carrito:', error);
    res.status(500).json({ 
      error: 'Error del servidor', 
      code: 'CLEAR_ERROR'
    });
  }
});

// Aplicar cupón de descuento
router.post('/coupon', verifyToken, async (req, res) => {
  try {
    const { userId, couponCode, discount, type } = req.body;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    if (!couponCode || !discount || !type) {
      return res.status(400).json({
        error: 'Código de cupón, descuento y tipo son requeridos',
        code: 'MISSING_COUPON_DATA'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ 
        error: 'Carrito no encontrado',
        code: 'CART_NOT_FOUND'
      });
    }

    await cart.applyCoupon(couponCode, discount, type);

    res.json({
      success: true,
      message: 'Cupón aplicado',
      total: cart.total,
      discounts: cart.discounts,
      coupons: cart.coupons
    });

  } catch (error) {
    console.error('Error aplicando cupón:', error);
    
    if (error.message.includes('ya fue aplicado')) {
      return res.status(400).json({
        error: error.message,
        code: 'COUPON_ALREADY_APPLIED'
      });
    }
    
    res.status(500).json({ 
      error: 'Error aplicando cupón', 
      code: 'COUPON_ERROR'
    });
  }
});

// Remover cupón
router.delete('/coupon/:userId/:couponCode', verifyToken, async (req, res) => {
  try {
    const { userId, couponCode } = req.params;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ 
        error: 'Carrito no encontrado',
        code: 'CART_NOT_FOUND'
      });
    }

    await cart.removeCoupon(couponCode);

    res.json({
      success: true,
      message: 'Cupón removido',
      total: cart.total,
      discounts: cart.discounts,
      coupons: cart.coupons
    });

  } catch (error) {
    console.error('Error removiendo cupón:', error);
    res.status(500).json({ 
      error: 'Error removiendo cupón', 
      code: 'REMOVE_COUPON_ERROR'
    });
  }
});

// Actualizar información de envío
router.put('/shipping', verifyToken, async (req, res) => {
  try {
    const { userId, shippingData } = req.body;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ 
        error: 'Carrito no encontrado',
        code: 'CART_NOT_FOUND'
      });
    }

    await cart.updateShippingInfo(shippingData);

    res.json({
      success: true,
      message: 'Información de envío actualizada',
      shipping: cart.shipping,
      total: cart.total,
      tempShippingInfo: cart.tempShippingInfo
    });

  } catch (error) {
    console.error('Error actualizando envío:', error);
    res.status(500).json({ 
      error: 'Error actualizando información de envío', 
      code: 'SHIPPING_ERROR'
    });
  }
});

// Obtener carritos abandonados (solo admin)
router.get('/admin/abandoned', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso restringido a administradores',
        code: 'ADMIN_REQUIRED'
      });
    }

    const abandonedCarts = await Cart.findAbandonedCarts();

    const cartsWithUserInfo = await Promise.all(
      abandonedCarts.map(async (cart) => {
        try {
          const User = require('../models/User');
          const user = await User.findById(cart.userId).select('name email');
          return {
            ...cart.toObject(),
            user
          };
        } catch (error) {
          return {
            ...cart.toObject(),
            user: null
          };
        }
      })
    );

    res.json({
      success: true,
      abandonedCarts: cartsWithUserInfo,
      count: abandonedCarts.length
    });

  } catch (error) {
    console.error('Error obteniendo carritos abandonados:', error);
    res.status(500).json({
      error: 'Error obteniendo carritos abandonados',
      code: 'ABANDONED_CARTS_ERROR'
    });
  }
});

// Estadísticas de carritos (solo admin)
router.get('/admin/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso restringido a administradores',
        code: 'ADMIN_REQUIRED'
      });
    }

    const stats = await Cart.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$total' },
          averageValue: { $avg: '$total' },
          totalItems: { $sum: '$itemCount' }
        }
      }
    ]);

    const totalCarts = await Cart.countDocuments();
    const activeCartsWithItems = await Cart.countDocuments({
      status: 'active',
      itemCount: { $gt: 0 }
    });

    res.json({
      success: true,
      stats: {
        totalCarts,
        activeCartsWithItems,
        byStatus: stats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalValue: stat.totalValue,
            averageValue: Math.round(stat.averageValue * 100) / 100,
            totalItems: stat.totalItems
          };
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de carritos:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      code: 'STATS_ERROR'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Cart API',
    timestamp: new Date().toISOString(),
    features: {
      persistentCart: 'enabled',
      coupons: 'enabled',
      shipping: 'enabled',
      abandonment: 'enabled',
      stockValidation: 'enabled'
    },
    endpoints: {
      'GET /:userId': 'Obtener carrito del usuario',
      'POST /': 'Guardar/actualizar carrito',
      'POST /item': 'Agregar item al carrito',
      'PUT /quantity': 'Actualizar cantidad de item',
      'DELETE /item/:userId/:productId': 'Eliminar item específico',
      'DELETE /:userId': 'Limpiar carrito',
      'POST /coupon': 'Aplicar cupón',
      'DELETE /coupon/:userId/:couponCode': 'Remover cupón',
      'PUT /shipping': 'Actualizar información de envío',
      'GET /admin/abandoned': 'Carritos abandonados (admin)',
      'GET /admin/stats': 'Estadísticas de carritos (admin)',
      'GET /health': 'Estado del servicio'
    }
  });
});

module.exports = router;