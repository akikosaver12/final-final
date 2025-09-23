const express = require('express');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const router = express.Router();

// Importar modelos y middlewares
const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require('../models/Cart');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { validatePaymentData } = require('../utils/validators');
const { sendPaymentConfirmation } = require('../utils/email');

// 🔍 VERIFICAR TOKEN AL CARGAR EL MÓDULO
console.log('🔍 === VERIFICANDO MERCADOPAGO EN PAYMENTS.JS ===');
console.log('🔑 Token en payments:', process.env.MERCADOPAGO_ACCESS_TOKEN ? '✅ DISPONIBLE' : '❌ NO DISPONIBLE');
if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
  console.log('🔑 Token primeros chars:', process.env.MERCADOPAGO_ACCESS_TOKEN.substring(0, 20) + '...');
  console.log('🔑 Token es TEST:', process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-') ? '✅ SÍ' : '❌ NO');
} else {
  console.error('❌ MERCADOPAGO_ACCESS_TOKEN no está configurado en routes/payments.js');
}

// 🔧 CONFIGURAR MERCADOPAGO
if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  console.error('❌ ERROR CRÍTICO: MERCADOPAGO_ACCESS_TOKEN no está definido');
  console.error('🔧 SOLUCIÓN: Verifica tu archivo .env y reinicia el servidor');
  throw new Error('MERCADOPAGO_ACCESS_TOKEN requerido');
}

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  options: { 
    timeout: 15000,
    retries: 3
  }
});

const preference = new Preference(client);
const paymentAPI = new Payment(client);

console.log('✅ MercadoPago configurado correctamente en payments.js');

// URLs de configuración
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// 🛒 CREAR PREFERENCIA DE PAGO
router.post('/create-preference', verifyToken, async (req, res) => {
  try {
    const { items, userId, total } = req.body;

    console.log('📦 === PROCESANDO NUEVA ORDEN DE PAGO ===');
    console.log('👤 Usuario ID:', userId);
    console.log('🛍️ Items recibidos:', items?.length || 0);
    console.log('💰 Total solicitado:', total);

    // 🔍 VALIDAR DATOS DE ENTRADA
    const validation = validatePaymentData({ items, userId, total });
    if (!validation.isValid) {
      console.error('❌ Error de validación:', validation.message);
      return res.status(400).json({
        error: 'Datos de pago inválidos',
        details: validation.message,
        code: 'INVALID_PAYMENT_DATA'
      });
    }

    // Verificar que el usuario logueado coincida con el userId
    if (req.user.id !== userId) {
      console.error('❌ Error: Usuario no autorizado');
      return res.status(403).json({
        error: 'No autorizado para crear orden para otro usuario',
        code: 'UNAUTHORIZED_USER'
      });
    }

    // 📝 OBTENER INFORMACIÓN DEL USUARIO
    const user = await User.findById(userId).select('name email telefono direccion');
    if (!user) {
      console.error('❌ Error: Usuario no encontrado');
      return res.status(404).json({
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // 📝 CREAR ORDEN EN BASE DE DATOS
    const newOrder = new Order({
      userId,
      items: items.map(item => ({
        productId: item.productId || item.id,
        name: item.name,
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity),
        image: item.image,
        category: item.category || 'otros',
        unitPriceAtPurchase: parseFloat(item.price),
        subtotal: parseFloat(item.price) * parseInt(item.quantity)
      })),
      subtotal: parseFloat(total),
      total: parseFloat(total),
      status: 'pending',
      paymentInfo: {
        method: 'mercadopago',
        paymentStatus: 'pending'
      },
      customerInfo: {
        name: user.name,
        email: user.email,
        phone: user.telefono
      },
      shippingInfo: {
        address: {
          street: user.direccion?.calle || '',
          city: user.direccion?.ciudad || '',
          state: user.direccion?.estado || '',
          country: user.direccion?.pais || 'Colombia'
        }
      }
    });

    const savedOrder = await newOrder.save();
    console.log('✅ Orden creada en DB con ID:', savedOrder._id);

    // 🏷️ PREPARAR ITEMS PARA MERCADOPAGO
    const mercadopagoItems = items.map(item => {
      const mpItem = {
        id: (item.productId || item.id || 'item').toString(),
        title: item.name || 'Producto',
        quantity: parseInt(item.quantity) || 1,
        unit_price: parseFloat(item.price) || 0,
        currency_id: 'COP'
      };
      
      console.log(`🏷️ Item MP: ${mpItem.title} x${mpItem.quantity} = $${mpItem.unit_price}`);
      return mpItem;
    });

    // 🎫 CONFIGURAR PREFERENCIA DE MERCADOPAGO
    const preferenceData = {
      items: mercadopagoItems,
      payer: {
        name: user.name,
        email: user.email,
        phone: {
          number: user.telefono || ''
        },
        address: {
          street_name: user.direccion?.calle || '',
          city_name: user.direccion?.ciudad || '',
          state_name: user.direccion?.estado || ''
        }
      },
      back_urls: {
        success: `${FRONTEND_URL}/payment-success`,
        failure: `${FRONTEND_URL}/payment-failure`,
        pending: `${FRONTEND_URL}/payment-pending`
      },
      auto_return: 'approved',
      external_reference: savedOrder._id.toString(),
      notification_url: `${BACKEND_URL}/api/payments/webhook`,
      statement_descriptor: 'VETERINARIA',
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 12 // Hasta 12 cuotas
      },
      shipments: {
        cost: 0,
        mode: 'not_specified'
      }
    };

    console.log('🎫 Creando preferencia con datos:');
    console.log('📧 Email:', preferenceData.payer.email);
    console.log('📞 Teléfono:', preferenceData.payer.phone.number);
    console.log('🏠 Dirección:', preferenceData.payer.address.street_name);
    console.log('🔗 Notification URL:', preferenceData.notification_url);

    // 🚀 CREAR PREFERENCIA EN MERCADOPAGO
    const result = await preference.create({ body: preferenceData });

    console.log('✅ === PREFERENCIA CREADA EXITOSAMENTE ===');
    console.log('🆔 Preference ID:', result.id);
    console.log('🔗 Init Point:', result.init_point);
    console.log('📋 External Reference:', result.external_reference);

    // 📝 ACTUALIZAR ORDEN CON DATOS DE MERCADOPAGO
    savedOrder.paymentInfo.mercadoPagoData = {
      preferenceId: result.id,
      externalReference: result.external_reference,
      initPoint: result.init_point
    };
    await savedOrder.save();

    // 🛒 MARCAR CARRITO COMO CONVERTIDO SI EXISTE
    try {
      await Cart.findOneAndUpdate(
        { userId },
        { status: 'converted', orderId: savedOrder._id.toString(), convertedAt: new Date() }
      );
      console.log('🛒 Carrito marcado como convertido');
    } catch (cartError) {
      console.warn('⚠️ Error actualizando carrito:', cartError.message);
    }

    // 📤 RESPUESTA EXITOSA
    res.status(200).json({
      success: true,
      preferenceId: result.id,
      initPoint: result.init_point,
      orderId: savedOrder._id.toString(),
      message: 'Preferencia de pago creada exitosamente',
      paymentInfo: {
        preferenceId: result.id,
        orderId: savedOrder._id,
        amount: total,
        currency: 'COP'
      }
    });

  } catch (error) {
    console.error('❌ === ERROR CREANDO PREFERENCIA ===');
    console.error('📝 Mensaje:', error.message);
    console.error('🔢 Status:', error.status);
    console.error('📋 Causa:', error.cause);
    console.error('🔍 Stack:', error.stack?.substring(0, 500));

    // 🔍 ANÁLISIS DE ERROR ESPECÍFICO
    let errorMessage = 'Error al crear preferencia de pago';
    let errorCode = 'PAYMENT_CREATION_ERROR';

    if (error.message === 'invalid_token' || error.cause?.error === 'invalid_token') {
      errorMessage = 'Token de MercadoPago inválido. Contacta al administrador.';
      errorCode = 'INVALID_MERCADOPAGO_TOKEN';
      console.error('🔧 SOLUCIÓN: Verificar MERCADOPAGO_ACCESS_TOKEN en .env');
    } else if (error.status === 400 || error.cause?.status === 400) {
      errorMessage = 'Datos de pago inválidos';
      errorCode = 'INVALID_PAYMENT_DATA';
    } else if (error.status === 401 || error.cause?.status === 401) {
      errorMessage = 'No autorizado - Token inválido';
      errorCode = 'UNAUTHORIZED';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Error de conexión con MercadoPago. Intenta nuevamente.';
      errorCode = 'CONNECTION_ERROR';
    }

    res.status(500).json({ 
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// 🔔 WEBHOOK PARA NOTIFICACIONES DE MERCADOPAGO
router.post('/webhook', async (req, res) => {
  try {
    console.log('🔔 === WEBHOOK DE MERCADOPAGO RECIBIDO ===');
    console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));
    console.log('🔗 Headers:', JSON.stringify(req.headers, null, 2));
    
    const { type, data, action } = req.body;

    if (type === 'payment') {
      const paymentId = data.id;
      console.log('💳 Procesando notificación de pago ID:', paymentId);

      try {
        // 📋 OBTENER INFORMACIÓN DEL PAGO DESDE MERCADOPAGO
        console.log('🔍 Consultando pago en MercadoPago...');
        const paymentInfo = await paymentAPI.get({ id: paymentId });
        
        console.log('💳 === INFORMACIÓN DEL PAGO ===');
        console.log('🆔 Payment ID:', paymentInfo.id);
        console.log('📊 Status:', paymentInfo.status);
        console.log('📋 External Reference:', paymentInfo.external_reference);
        console.log('💰 Transaction Amount:', paymentInfo.transaction_amount);
        console.log('💳 Payment Method:', paymentInfo.payment_method_id);
        console.log('📧 Payer Email:', paymentInfo.payer?.email);

        // 🔍 BUSCAR ORDEN POR EXTERNAL REFERENCE
        if (!paymentInfo.external_reference) {
          console.warn('⚠️ Payment sin external_reference');
          return res.status(200).json({ received: true, warning: 'No external reference' });
        }

        const order = await Order.findById(paymentInfo.external_reference).populate('userId');
        
        if (!order) {
          console.error('❌ Orden no encontrada para external_reference:', paymentInfo.external_reference);
          return res.status(200).json({ received: true, error: 'Order not found' });
        }

        console.log('📦 Orden encontrada:', order._id, 'Estado actual:', order.status);

        // 📝 ACTUALIZAR ORDEN SEGÚN ESTADO DEL PAGO
        const updateData = {
          'paymentInfo.paymentStatus': paymentInfo.status,
          'paymentInfo.transactionId': paymentInfo.id.toString(),
          'paymentInfo.paymentDate': new Date(),
          'paymentInfo.mercadoPagoData.paymentId': paymentInfo.id.toString(),
          'paymentInfo.mercadoPagoData.merchantOrderId': paymentInfo.order?.id || null
        };

        let newOrderStatus = order.status;

        switch (paymentInfo.status) {
          case 'approved':
            newOrderStatus = 'paid';
            updateData.status = 'paid';
            console.log('✅ Pago aprobado - Marcando orden como pagada');
            
            // 📧 Enviar email de confirmación
            try {
              if (order.customerInfo?.email) {
                const emailResult = await sendPaymentConfirmation(
                  order.customerInfo.email,
                  order.customerInfo.name,
                  order
                );
                console.log('📧 Email de confirmación:', emailResult.success ? 'Enviado' : 'Error');
              }
            } catch (emailError) {
              console.warn('⚠️ Error enviando email de confirmación:', emailError.message);
            }
            break;

          case 'pending':
            updateData.status = 'pending';
            console.log('⏳ Pago pendiente');
            break;

          case 'in_process':
            updateData.status = 'processing';
            console.log('🔄 Pago en proceso');
            break;

          case 'rejected':
          case 'cancelled':
            updateData.status = 'failed';
            console.log('❌ Pago rechazado/cancelado');
            break;

          default:
            console.log('❓ Estado de pago no reconocido:', paymentInfo.status);
        }

        // 💾 GUARDAR CAMBIOS EN LA ORDEN
        const updatedOrder = await Order.findByIdAndUpdate(
          order._id,
          updateData,
          { new: true }
        );

        console.log('📝 Orden actualizada:', updatedOrder._id, 'Nuevo estado:', updatedOrder.status);
        console.log('✅ Webhook procesado exitosamente');

      } catch (paymentError) {
        console.error('❌ Error procesando información de pago:', paymentError);
        
        // Aún así responder OK para evitar reenvíos
        return res.status(200).json({ 
          received: true, 
          error: 'Payment processing error',
          details: paymentError.message 
        });
      }

    } else {
      console.log('ℹ️ Tipo de notificación no procesada:', type);
    }

    // ⚠️ IMPORTANTE: Siempre responder 200 OK para que MercadoPago no reenvíe
    res.status(200).json({ 
      received: true,
      processed: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ === ERROR EN WEBHOOK ===');
    console.error('📝 Error:', error.message);
    console.error('🔍 Stack:', error.stack);
    
    // Incluso con errores, responder 200 para evitar reenvíos infinitos
    res.status(200).json({ 
      received: true,
      error: 'Webhook processing failed',
      timestamp: new Date().toISOString()
    });
  }
});

// 📋 OBTENER ÓRDENES DEL USUARIO
router.get('/orders/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    
    console.log('📋 Obteniendo órdenes para usuario:', userId);
    
    // Verificar que el usuario solo pueda ver sus propias órdenes (excepto admin)
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        error: 'No autorizado para ver órdenes de otro usuario',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    // Construir query
    const query = { userId };
    if (status) {
      query.status = status;
    }

    // Paginación
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Consultar órdenes
    const [orders, totalCount] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query)
    ]);

    console.log('📋 Órdenes encontradas:', orders.length);

    res.json({
      success: true,
      orders,
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
    console.error('❌ Error obteniendo órdenes:', error);
    res.status(500).json({ 
      error: 'Error obteniendo órdenes',
      details: error.message 
    });
  }
});

// 🔍 OBTENER ORDEN ESPECÍFICA
router.get('/order/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('🔍 Obteniendo orden:', orderId);
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        error: 'Orden no encontrada',
        code: 'ORDER_NOT_FOUND'
      });
    }

    // Verificar permisos
    if (req.user.role !== 'admin' && req.user.id !== order.userId) {
      return res.status(403).json({
        error: 'No autorizado para ver esta orden',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }
    
    res.json({
      success: true,
      order
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo orden:', error);
    res.status(500).json({ 
      error: 'Error obteniendo orden',
      details: error.message 
    });
  }
});

// 🔄 REENVIAR NOTIFICACIÓN DE PAGO (para debugging)
router.post('/retry-payment-notification/:paymentId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Solo administradores pueden reenviar notificaciones',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { paymentId } = req.params;
    
    console.log('🔄 Reenviando notificación para pago:', paymentId);

    // Simular webhook
    const webhookData = {
      type: 'payment',
      data: { id: paymentId },
      action: 'payment.updated'
    };

    // Llamar al webhook internamente
    req.body = webhookData;
    
    // Redirigir a webhook handler
    return router.handle({
      ...req,
      method: 'POST',
      url: '/webhook',
      body: webhookData
    }, res);

  } catch (error) {
    console.error('❌ Error reenviando notificación:', error);
    res.status(500).json({
      error: 'Error reenviando notificación',
      details: error.message
    });
  }
});

// 📊 ESTADÍSTICAS DE PAGOS (solo admin)
router.get('/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Acceso restringido a administradores',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { startDate, endDate } = req.query;
    
    // Construir filtros de fecha
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const matchStage = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    // Agregaciones para estadísticas
    const [statsResult] = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrder: { $avg: '$total' },
          ordersByStatus: {
            $push: '$status'
          },
          paymentMethods: {
            $push: '$paymentInfo.method'
          }
        }
      }
    ]);

    // Procesar estadísticas por estado
    const statusStats = {};
    if (statsResult) {
      statsResult.ordersByStatus.forEach(status => {
        statusStats[status] = (statusStats[status] || 0) + 1;
      });
    }

    res.json({
      success: true,
      stats: {
        totalOrders: statsResult?.totalOrders || 0,
        totalRevenue: statsResult?.totalRevenue || 0,
        averageOrderValue: Math.round((statsResult?.averageOrder || 0) * 100) / 100,
        ordersByStatus: statusStats,
        dateRange: {
          startDate: startDate || 'No especificada',
          endDate: endDate || 'No especificada'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      details: error.message
    });
  }
});

// 🩺 HEALTH CHECK ESPECÍFICO PARA PAGOS
router.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    service: 'Payments API',
    timestamp: new Date().toISOString(),
    mercadopago: {
      configured: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
      tokenType: process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('TEST-') ? 'TEST' : 
                 process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('APP_USR-') ? 'PRODUCTION' : 'UNKNOWN',
      tokenLength: process.env.MERCADOPAGO_ACCESS_TOKEN?.length || 0,
      clientConfigured: !!client
    },
    urls: {
      frontend: FRONTEND_URL,
      backend: BACKEND_URL,
      webhook: `${BACKEND_URL}/api/payments/webhook`
    },
    endpoints: {
      'POST /create-preference': 'Crear preferencia de pago',
      'POST /webhook': 'Webhook de MercadoPago',
      'GET /orders/:userId': 'Obtener órdenes del usuario',
      'GET /order/:orderId': 'Obtener orden específica',
      'GET /stats': 'Estadísticas (admin)',
      'GET /health': 'Estado del servicio'
    }
  };

  console.log('🩺 Health check de pagos:', health.mercadopago);
  res.json(health);
});

module.exports = router;