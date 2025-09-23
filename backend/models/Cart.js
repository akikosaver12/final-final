const mongoose = require('mongoose');

// Esquema para items del carrito
const CartItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    index: true
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
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'La cantidad debe ser un número entero'
    }
  },
  image: {
    type: String
  },
  category: {
    type: String,
    required: true
  },
  stock: {
    type: Number,
    min: 0
  },
  
  // Información adicional del producto
  brand: {
    type: String,
    trim: true
  },
  sku: {
    type: String,
    trim: true
  },
  
  // Descuentos aplicados al momento de agregar al carrito
  originalPrice: {
    type: Number,
    min: 0
  },
  discountApplied: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Metadata del item
  addedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Opciones del producto (talla, color, etc.)
  options: {
    type: Map,
    of: String
  },
  
  // Notas del cliente sobre este item
  notes: {
    type: String,
    trim: true,
    maxlength: 200
  }
});

// Esquema principal del carrito
const CartSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Items del carrito
  items: [CartItemSchema],
  
  // Totales calculados
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  subtotal: {
    type: Number,
    default: 0,
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
  discounts: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Contadores
  itemCount: {
    type: Number,
    default: 0,
    min: 0
  },
  uniqueItems: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Información de descuentos y cupones
  coupons: [{
    code: {
      type: String,
      trim: true,
      uppercase: true
    },
    discount: {
      type: Number,
      min: 0
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Estado del carrito
  status: {
    type: String,
    enum: ['active', 'abandoned', 'converted', 'expired'],
    default: 'active'
  },
  
  // Información de sesión
  sessionId: {
    type: String,
    index: true
  },
  
  // Timestamps de actividad
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Información de abandono de carrito
  abandonedAt: {
    type: Date
  },
  remindersSent: {
    type: Number,
    default: 0
  },
  
  // Información de conversión
  convertedAt: {
    type: Date
  },
  orderId: {
    type: String
  },
  
  // Configuraciones del carrito
  settings: {
    saveForLater: {
      type: Boolean,
      default: true
    },
    autoRemoveExpired: {
      type: Boolean,
      default: true
    },
    maxItems: {
      type: Number,
      default: 50,
      min: 1
    }
  },
  
  // Información de envío (temporal)
  tempShippingInfo: {
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    method: {
      type: String,
      enum: ['standard', 'express', 'overnight', 'pickup']
    },
    cost: {
      type: Number,
      min: 0
    }
  },
  
  // Metadatos adicionales
  metadata: {
    userAgent: String,
    referrer: String,
    campaign: String,
    source: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para verificar si el carrito está vacío
CartSchema.virtual('isEmpty').get(function() {
  return this.items.length === 0;
});

// Virtual para verificar si el carrito ha expirado
CartSchema.virtual('isExpired').get(function() {
  const expirationTime = 30 * 24 * 60 * 60 * 1000; // 30 días
  const now = new Date();
  return (now - this.lastActivity) > expirationTime;
});

// Virtual para verificar si el carrito fue abandonado
CartSchema.virtual('isAbandoned').get(function() {
  const abandonmentTime = 24 * 60 * 60 * 1000; // 24 horas
  const now = new Date();
  return this.status === 'active' && (now - this.lastActivity) > abandonmentTime;
});

// Virtual para obtener el valor promedio por item
CartSchema.virtual('averageItemValue').get(function() {
  if (this.itemCount === 0) return 0;
  return Math.round((this.subtotal / this.itemCount) * 100) / 100;
});

// Virtual para obtener items próximos a vencer (basado en stock)
CartSchema.virtual('itemsWithLowStock').get(function() {
  return this.items.filter(item => item.stock && item.stock < 5);
});

// Middleware para calcular totales antes de guardar
CartSchema.pre('save', function(next) {
  // Calcular subtotal
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
  
  // Calcular descuentos aplicados
  this.discounts = this.items.reduce((sum, item) => {
    return sum + (item.discountApplied * item.quantity);
  }, 0);
  
  // Agregar descuentos de cupones
  if (this.coupons.length > 0) {
    const couponDiscount = this.coupons.reduce((sum, coupon) => {
      if (coupon.type === 'percentage') {
        return sum + (this.subtotal * coupon.discount / 100);
      } else {
        return sum + coupon.discount;
      }
    }, 0);
    this.discounts += couponDiscount;
  }
  
  // Calcular impuestos (ejemplo: 19% IVA en Colombia)
  const taxRate = 0.19;
  this.taxes = (this.subtotal - this.discounts) * taxRate;
  
  // Calcular total final
  this.total = this.subtotal + this.taxes + this.shipping - this.discounts;
  this.total = Math.max(0, Math.round(this.total * 100) / 100); // Evitar negativos y redondear
  
  // Actualizar contadores
  this.itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.uniqueItems = this.items.length;
  
  // Actualizar timestamp de última modificación
  this.lastUpdated = new Date();
  this.lastActivity = new Date();
  
  next();
});

// Método para limpiar items con cantidad 0 o inválidos
CartSchema.methods.cleanupItems = function() {
  this.items = this.items.filter(item => 
    item.quantity > 0 && 
    item.price >= 0 && 
    item.name && 
    item.productId
  );
  return this;
};

// Método para agregar item al carrito
CartSchema.methods.addItem = function(itemData) {
  // Validar datos del item
  if (!itemData.productId || !itemData.name || !itemData.price) {
    throw new Error('Datos de item incompletos');
  }
  
  // Buscar si el item ya existe
  const existingItemIndex = this.items.findIndex(
    item => item.productId === itemData.productId && 
            JSON.stringify(item.options) === JSON.stringify(itemData.options || {})
  );
  
  if (existingItemIndex !== -1) {
    // Actualizar cantidad si el item ya existe
    const newQuantity = this.items[existingItemIndex].quantity + (itemData.quantity || 1);
    
    // Verificar stock disponible
    if (itemData.stock && newQuantity > itemData.stock) {
      throw new Error(`Stock insuficiente. Disponible: ${itemData.stock}`);
    }
    
    this.items[existingItemIndex].quantity = newQuantity;
    this.items[existingItemIndex].updatedAt = new Date();
  } else {
    // Verificar límite de items únicos
    if (this.uniqueItems >= this.settings.maxItems) {
      throw new Error(`Máximo ${this.settings.maxItems} items diferentes permitidos`);
    }
    
    // Agregar nuevo item
    const newItem = {
      productId: itemData.productId,
      name: itemData.name,
      price: itemData.price,
      quantity: itemData.quantity || 1,
      image: itemData.image,
      category: itemData.category || 'otros',
      stock: itemData.stock,
      brand: itemData.brand,
      sku: itemData.sku,
      originalPrice: itemData.originalPrice || itemData.price,
      discountApplied: itemData.discountApplied || 0,
      options: itemData.options || {},
      notes: itemData.notes
    };
    
    // Verificar stock
    if (itemData.stock && newItem.quantity > itemData.stock) {
      throw new Error(`Stock insuficiente. Disponible: ${itemData.stock}`);
    }
    
    this.items.push(newItem);
  }
  
  return this.save();
};

// Método para actualizar cantidad de un item
CartSchema.methods.updateItemQuantity = function(productId, quantity, options = {}) {
  const itemIndex = this.items.findIndex(
    item => item.productId === productId && 
            JSON.stringify(item.options) === JSON.stringify(options)
  );
  
  if (itemIndex === -1) {
    throw new Error('Item no encontrado en el carrito');
  }
  
  if (quantity <= 0) {
    this.items.splice(itemIndex, 1);
  } else {
    // Verificar stock
    const item = this.items[itemIndex];
    if (item.stock && quantity > item.stock) {
      throw new Error(`Stock insuficiente. Disponible: ${item.stock}`);
    }
    
    this.items[itemIndex].quantity = quantity;
    this.items[itemIndex].updatedAt = new Date();
  }
  
  return this.save();
};

// Método para eliminar item del carrito
CartSchema.methods.removeItem = function(productId, options = {}) {
  const itemIndex = this.items.findIndex(
    item => item.productId === productId && 
            JSON.stringify(item.options) === JSON.stringify(options)
  );
  
  if (itemIndex !== -1) {
    this.items.splice(itemIndex, 1);
    return this.save();
  }
  
  throw new Error('Item no encontrado en el carrito');
};

// Método para aplicar cupón
CartSchema.methods.applyCoupon = function(couponCode, discount, type = 'percentage') {
  // Verificar si el cupón ya fue aplicado
  const existingCoupon = this.coupons.find(c => c.code === couponCode.toUpperCase());
  if (existingCoupon) {
    throw new Error('Este cupón ya fue aplicado');
  }
  
  this.coupons.push({
    code: couponCode.toUpperCase(),
    discount,
    type
  });
  
  return this.save();
};

// Método para remover cupón
CartSchema.methods.removeCoupon = function(couponCode) {
  this.coupons = this.coupons.filter(c => c.code !== couponCode.toUpperCase());
  return this.save();
};

// Método para vaciar carrito
CartSchema.methods.clear = function() {
  this.items = [];
  this.coupons = [];
  this.tempShippingInfo = {};
  return this.save();
};

// Método para marcar como abandonado
CartSchema.methods.markAsAbandoned = function() {
  this.status = 'abandoned';
  this.abandonedAt = new Date();
  return this.save();
};

// Método para marcar como convertido
CartSchema.methods.markAsConverted = function(orderId) {
  this.status = 'converted';
  this.convertedAt = new Date();
  this.orderId = orderId;
  return this.save();
};

// Método para actualizar información de envío temporal
CartSchema.methods.updateShippingInfo = function(shippingData) {
  this.tempShippingInfo = {
    ...this.tempShippingInfo,
    ...shippingData
  };
  
  if (shippingData.cost !== undefined) {
    this.shipping = shippingData.cost;
  }
  
  return this.save();
};

// Método estático para limpiar carritos expirados
CartSchema.statics.cleanupExpiredCarts = async function() {
  const expirationTime = 30 * 24 * 60 * 60 * 1000; // 30 días
  const expirationDate = new Date(Date.now() - expirationTime);
  
  const result = await this.updateMany(
    { 
      lastActivity: { $lt: expirationDate },
      status: 'active'
    },
    { 
      status: 'expired'
    }
  );
  
  return result;
};

// Método estático para encontrar carritos abandonados
CartSchema.statics.findAbandonedCarts = async function() {
  const abandonmentTime = 24 * 60 * 60 * 1000; // 24 horas
  const abandonmentDate = new Date(Date.now() - abandonmentTime);
  
  return this.find({
    lastActivity: { $lt: abandonmentDate },
    status: 'active',
    itemCount: { $gt: 0 }
  });
};

// Índices para optimización
CartSchema.index({ userId: 1 }, { unique: true });
CartSchema.index({ sessionId: 1 });
CartSchema.index({ lastActivity: 1 });
CartSchema.index({ status: 1 });
CartSchema.index({ 'items.productId': 1 });

const Cart = mongoose.model('Cart', CartSchema);

module.exports = Cart;