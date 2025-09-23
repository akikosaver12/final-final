const mongoose = require('mongoose');

// Esquema para items de la orden
const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  image: {
    type: String
  },
  category: {
    type: String,
    required: true
  },
  // Precio al momento de la compra (por si cambia después)
  unitPriceAtPurchase: {
    type: Number,
    required: true
  },
  // Subtotal del item
  subtotal: {
    type: Number,
    required: true
  }
});

// Esquema principal de la orden
const OrderSchema = new mongoose.Schema({
  // Usuario que realizó la orden
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Items de la orden
  items: [OrderItemSchema],
  
  // Totales
  total: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  taxes: {
    type: Number,
    default: 0,
    min: 0
  },
  shipping: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Estado de la orden
  status: {
    type: String,
    enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'],
    default: 'pending'
  },
  
  // Información de pago
  paymentInfo: {
    method: {
      type: String,
      enum: ['mercadopago', 'credit_card', 'cash', 'transfer'],
      default: 'mercadopago'
    },
    transactionId: {
      type: String
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'in_process'],
      default: 'pending'
    },
    paymentDate: {
      type: Date
    },
    // Datos específicos de MercadoPago
    mercadoPagoData: {
      preferenceId: String,
      paymentId: String,
      merchantOrderId: String,
      externalReference: String,
      initPoint: String
    }
  },
  
  // Información de envío
  shippingInfo: {
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    trackingNumber: String,
    carrier: String,
    estimatedDelivery: Date,
    actualDelivery: Date
  },
  
  // Información del cliente
  customerInfo: {
    name: String,
    email: String,
    phone: String
  },
  
  // Notas y comentarios
  notes: {
    customer: String,
    admin: String
  },
  
  // Metadatos adicionales
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: {
      type: String,
      enum: ['web', 'mobile', 'admin'],
      default: 'web'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Middleware para calcular totales antes de guardar
OrderSchema.pre('save', function(next) {
  // Calcular subtotal de items
  this.subtotal = this.items.reduce((sum, item) => {
    item.subtotal = item.price * item.quantity;
    item.unitPriceAtPurchase = item.price;
    return sum + item.subtotal;
  }, 0);
  
  // Calcular total final
  this.total = this.subtotal + this.taxes + this.shipping - this.discount;
  
  next();
});

// Virtual para obtener el número de items
OrderSchema.virtual('itemCount').get(function() {
  return this.items.reduce((count, item) => count + item.quantity, 0);
});

// Virtual para verificar si la orden está pagada
OrderSchema.virtual('isPaid').get(function() {
  return this.paymentInfo.paymentStatus === 'approved' && this.status !== 'cancelled';
});

// Virtual para verificar si la orden puede ser cancelada
OrderSchema.virtual('canBeCancelled').get(function() {
  return ['pending', 'paid'].includes(this.status) && !['shipped', 'delivered'].includes(this.status);
});

// Método para actualizar estado de pago
OrderSchema.methods.updatePaymentStatus = function(paymentData) {
  this.paymentInfo.paymentStatus = paymentData.status;
  this.paymentInfo.transactionId = paymentData.transactionId;
  this.paymentInfo.paymentDate = paymentData.paymentDate || new Date();
  
  if (paymentData.mercadoPagoData) {
    this.paymentInfo.mercadoPagoData = {
      ...this.paymentInfo.mercadoPagoData,
      ...paymentData.mercadoPagoData
    };
  }
  
  // Actualizar estado de la orden según el pago
  if (paymentData.status === 'approved') {
    this.status = 'paid';
  } else if (paymentData.status === 'rejected') {
    this.status = 'failed';
  }
  
  return this.save();
};

// Método para cancelar orden
OrderSchema.methods.cancel = function(reason) {
  if (!this.canBeCancelled) {
    throw new Error('Esta orden no puede ser cancelada');
  }
  
  this.status = 'cancelled';
  this.notes.admin = `Orden cancelada: ${reason}`;
  
  return this.save();
};

// Método para marcar como enviada
OrderSchema.methods.markAsShipped = function(shippingData) {
  this.status = 'shipped';
  this.shippingInfo.trackingNumber = shippingData.trackingNumber;
  this.shippingInfo.carrier = shippingData.carrier;
  this.shippingInfo.estimatedDelivery = shippingData.estimatedDelivery;
  
  return this.save();
};

// Índices para optimización
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ 'paymentInfo.paymentStatus': 1 });
OrderSchema.index({ 'paymentInfo.mercadoPagoData.preferenceId': 1 });
OrderSchema.index({ 'paymentInfo.mercadoPagoData.paymentId': 1 });

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;