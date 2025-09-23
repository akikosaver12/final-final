// Utilidades de validación para la aplicación veterinaria

// Validar email
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    isValid: emailRegex.test(email),
    message: emailRegex.test(email) ? null : 'Email inválido'
  };
};

// Validar contraseña
const validatePassword = (password) => {
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  
  const errors = [];
  
  if (!password || password.length < minLength) {
    errors.push(`Mínimo ${minLength} caracteres`);
  }
  
  if (!hasUpperCase) {
    errors.push('Al menos una mayúscula');
  }
  
  if (!hasLowerCase) {
    errors.push('Al menos una minúscula');
  }
  
  if (!hasNumbers) {
    errors.push('Al menos un número');
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? `Contraseña debe tener: ${errors.join(', ')}` : null,
    strength: calculatePasswordStrength(password)
  };
};

// Calcular fuerza de contraseña
const calculatePasswordStrength = (password) => {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score <= 2) return 'débil';
  if (score <= 4) return 'media';
  return 'fuerte';
};

// Validar teléfono
const validatePhone = (phone) => {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const phoneRegex = /^\+?[\d]{7,15}$/;
  
  return {
    isValid: phoneRegex.test(cleanPhone),
    message: phoneRegex.test(cleanPhone) ? null : 'Teléfono inválido (7-15 dígitos)'
  };
};

// Validar dirección
const validateAddress = (address) => {
  const errors = [];
  
  if (!address || typeof address !== 'object') {
    return {
      isValid: false,
      message: 'Dirección es requerida'
    };
  }
  
  const { calle, ciudad, estado, pais } = address;
  
  if (!calle || calle.trim().length < 5) {
    errors.push('Calle debe tener al menos 5 caracteres');
  }
  
  if (!ciudad || ciudad.trim().length < 2) {
    errors.push('Ciudad debe tener al menos 2 caracteres');
  }
  
  if (!estado || estado.trim().length < 2) {
    errors.push('Estado debe tener al menos 2 caracteres');
  }
  
  if (pais && pais.trim().length < 2) {
    errors.push('País debe tener al menos 2 caracteres');
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null
  };
};

// Validar datos de mascota
const validatePetData = (petData) => {
  const errors = [];
  const { nombre, especie, raza, edad, genero, estado } = petData;
  
  if (!nombre || nombre.trim().length < 1) {
    errors.push('Nombre de la mascota es requerido');
  }
  
  if (!especie || !['Perro', 'Gato', 'Ave', 'Reptil', 'Pez', 'Roedor', 'Otro'].includes(especie)) {
    errors.push('Especie inválida');
  }
  
  if (!raza || raza.trim().length < 2) {
    errors.push('Raza es requerida (mínimo 2 caracteres)');
  }
  
  if (!edad || isNaN(edad) || edad < 0 || edad > 30) {
    errors.push('Edad debe ser un número entre 0 y 30');
  }
  
  if (!genero || !['Macho', 'Hembra'].includes(genero)) {
    errors.push('Género debe ser Macho o Hembra');
  }
  
  if (!estado || !['Saludable', 'Enfermo', 'En tratamiento', 'Recuperándose', 'Crítico'].includes(estado)) {
    errors.push('Estado de salud inválido');
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null,
    errors
  };
};

// Validar datos de producto
const validateProductData = (productData) => {
  const errors = [];
  const { nombre, descripcion, precio, categoria, stock } = productData;
  
  if (!nombre || nombre.trim().length < 2) {
    errors.push('Nombre del producto es requerido (mínimo 2 caracteres)');
  }
  
  if (!descripcion || descripcion.trim().length < 10) {
    errors.push('Descripción es requerida (mínimo 10 caracteres)');
  }
  
  if (precio === undefined || isNaN(precio) || precio < 0) {
    errors.push('Precio debe ser un número válido mayor o igual a 0');
  }
  
  const validCategories = ['alimento', 'juguetes', 'medicamentos', 'accesorios', 'higiene', 'otros'];
  if (categoria && !validCategories.includes(categoria)) {
    errors.push('Categoría inválida');
  }
  
  if (stock !== undefined && (isNaN(stock) || stock < 0)) {
    errors.push('Stock debe ser un número mayor o igual a 0');
  }
  
  // Validar descuento si existe
  if (productData.descuento && productData.descuento.tiene) {
    const descuentoValidation = validateDiscount(productData.descuento);
    if (!descuentoValidation.isValid) {
      errors.push(descuentoValidation.message);
    }
  }
  
  // Validar garantía si existe
  if (productData.garantia && productData.garantia.tiene) {
    const garantiaValidation = validateWarranty(productData.garantia);
    if (!garantiaValidation.isValid) {
      errors.push(garantiaValidation.message);
    }
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null,
    errors
  };
};

// Validar descuento
const validateDiscount = (discount) => {
  const errors = [];
  
  if (discount.tiene && (!discount.porcentaje || discount.porcentaje <= 0 || discount.porcentaje > 100)) {
    errors.push('Porcentaje de descuento debe estar entre 1 y 100');
  }
  
  if (discount.fechaInicio && discount.fechaFin) {
    if (new Date(discount.fechaInicio) >= new Date(discount.fechaFin)) {
      errors.push('Fecha de inicio debe ser anterior a fecha de fin');
    }
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null
  };
};

// Validar garantía
const validateWarranty = (warranty) => {
  const errors = [];
  
  if (warranty.tiene && (!warranty.meses || warranty.meses <= 0)) {
    errors.push('Meses de garantía deben ser mayor a 0');
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null
  };
};

// Validar datos de cita
const validateAppointmentData = (appointmentData) => {
  const errors = [];
  const { mascotaId, tipo, fecha, hora, motivo } = appointmentData;
  
  if (!mascotaId) {
    errors.push('ID de mascota es requerido');
  }
  
  const validTypes = ['consulta', 'operacion', 'vacunacion', 'emergencia', 'control', 'limpieza_dental', 'esterilizacion', 'revision'];
  if (!tipo || !validTypes.includes(tipo)) {
    errors.push('Tipo de cita inválido');
  }
  
  if (!fecha) {
    errors.push('Fecha es requerida');
  } else if (!isValidDate(fecha)) {
    errors.push('Fecha inválida');
  }
  
  if (!hora) {
    errors.push('Hora es requerida');
  } else if (!isValidTime(hora)) {
    errors.push('Hora inválida (formato HH:MM)');
  }
  
  if (!motivo || motivo.trim().length < 10) {
    errors.push('Motivo es requerido (mínimo 10 caracteres)');
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null,
    errors
  };
};

// Validar fecha
const isValidDate = (dateString) => {
  try {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // No permitir fechas pasadas
    if (date < today) return false;
    
    // No permitir domingos (0 = domingo)
    if (date.getDay() === 0) return false;
    
    return true;
  } catch (error) {
    return false;
  }
};

// Validar hora
const isValidTime = (timeString) => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(timeString)) return false;
  
  const [hours, minutes] = timeString.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;
  
  // Horarios permitidos: 7:00 AM - 12:00 PM y 2:00 PM - 6:00 PM
  const morningStart = 7 * 60; // 420
  const morningEnd = 12 * 60; // 720
  const afternoonStart = 14 * 60; // 840
  const afternoonEnd = 18 * 60; // 1080
  
  return (timeInMinutes >= morningStart && timeInMinutes <= morningEnd) ||
         (timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd);
};

// Validar datos de carrito
const validateCartData = (cartData) => {
  const errors = [];
  const { userId, items } = cartData;
  
  if (!userId) {
    errors.push('ID de usuario es requerido');
  }
  
  if (!items || !Array.isArray(items)) {
    errors.push('Items debe ser un array');
  } else if (items.length === 0) {
    errors.push('El carrito no puede estar vacío');
  } else {
    items.forEach((item, index) => {
      const itemValidation = validateCartItem(item, index);
      if (!itemValidation.isValid) {
        errors.push(itemValidation.message);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null,
    errors
  };
};

// Validar item de carrito
const validateCartItem = (item, index = 0) => {
  const errors = [];
  
  if (!item.productId && !item.id) {
    errors.push(`Item ${index + 1}: ID de producto es requerido`);
  }
  
  if (!item.name) {
    errors.push(`Item ${index + 1}: Nombre es requerido`);
  }
  
  if (!item.price || isNaN(item.price) || item.price <= 0) {
    errors.push(`Item ${index + 1}: Precio inválido`);
  }
  
  if (!item.quantity || isNaN(item.quantity) || item.quantity <= 0 || !Number.isInteger(Number(item.quantity))) {
    errors.push(`Item ${index + 1}: Cantidad debe ser un número entero mayor a 0`);
  }
  
  if (item.stock !== undefined && (isNaN(item.stock) || item.stock < 0)) {
    errors.push(`Item ${index + 1}: Stock inválido`);
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null
  };
};

// Validar datos de pago
const validatePaymentData = (paymentData) => {
  const errors = [];
  const { items, userId, total } = paymentData;
  
  if (!userId) {
    errors.push('ID de usuario es requerido');
  }
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('Items de pago son requeridos');
  }
  
  if (!total || isNaN(total) || total <= 0) {
    errors.push('Total debe ser un número mayor a 0');
  }
  
  // Validar que el total calculado coincida
  if (items && Array.isArray(items)) {
    const calculatedTotal = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
    
    if (Math.abs(calculatedTotal - total) > 0.01) {
      errors.push('El total no coincide con la suma de los items');
    }
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null,
    errors
  };
};

// Validar ObjectId de MongoDB
const validateObjectId = (id) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return {
    isValid: objectIdRegex.test(id),
    message: objectIdRegex.test(id) ? null : 'ID inválido'
  };
};

// Validar rango de fechas
const validateDateRange = (startDate, endDate) => {
  const errors = [];
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
      errors.push('Fecha de inicio inválida');
    }
    
    if (isNaN(end.getTime())) {
      errors.push('Fecha de fin inválida');
    }
    
    if (start >= end) {
      errors.push('Fecha de inicio debe ser anterior a fecha de fin');
    }
    
    // Límite máximo de rango (por ejemplo, 1 año)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 año en ms
    if ((end - start) > maxRange) {
      errors.push('Rango de fechas no puede ser mayor a 1 año');
    }
    
  } catch (error) {
    errors.push('Error procesando fechas');
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null
  };
};

// Sanitizar string (remover HTML y caracteres especiales)
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/<[^>]*>/g, '') // Remover HTML
    .replace(/[<>'"&]/g, '') // Remover caracteres especiales
    .trim();
};

// Validar formato de archivo
const validateFileFormat = (file, allowedTypes = []) => {
  if (!file || !file.mimetype) {
    return {
      isValid: false,
      message: 'Archivo inválido'
    };
  }
  
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
    return {
      isValid: false,
      message: `Tipo de archivo no permitido. Permitidos: ${allowedTypes.join(', ')}`
    };
  }
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      message: 'Archivo demasiado grande (máximo 10MB)'
    };
  }
  
  return {
    isValid: true,
    message: null
  };
};

// Validar límites de paginación
const validatePagination = (page, limit) => {
  const parsedPage = parseInt(page) || 1;
  const parsedLimit = parseInt(limit) || 10;
  
  return {
    page: Math.max(1, parsedPage),
    limit: Math.min(Math.max(1, parsedLimit), 100), // Máximo 100 elementos por página
    skip: (Math.max(1, parsedPage) - 1) * Math.min(Math.max(1, parsedLimit), 100)
  };
};

// Validar filtros de búsqueda
const validateSearchFilters = (filters) => {
  const allowedFilters = ['categoria', 'precio_min', 'precio_max', 'estado', 'activo'];
  const cleanFilters = {};
  
  Object.keys(filters).forEach(key => {
    if (allowedFilters.includes(key) && filters[key] !== undefined && filters[key] !== '') {
      cleanFilters[key] = sanitizeString(filters[key].toString());
    }
  });
  
  return cleanFilters;
};

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateAddress,
  validatePetData,
  validateProductData,
  validateDiscount,
  validateWarranty,
  validateAppointmentData,
  validateCartData,
  validateCartItem,
  validatePaymentData,
  validateObjectId,
  validateDateRange,
  validateFileFormat,
  validatePagination,
  validateSearchFilters,
  sanitizeString,
  isValidDate,
  isValidTime,
  calculatePasswordStrength
};