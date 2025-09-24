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
  const errors = [];
  
  if (!password) {
    errors.push('Contraseña es requerida');
  } else {
    if (password.length < 6) {
      errors.push('Contraseña debe tener al menos 6 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Contraseña debe tener al menos una mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Contraseña debe tener al menos una minúscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Contraseña debe tener al menos un número');
    }
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null
  };
};

// Validar teléfono
const validatePhone = (phone) => {
  if (!phone) return { isValid: true, message: null }; // Teléfono es opcional
  
  const phoneRegex = /^\+?[\d\s\-\(\)]{7,15}$/;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  const isValid = phoneRegex.test(phone) && cleanPhone.length >= 7 && cleanPhone.length <= 15;
  
  return {
    isValid,
    message: isValid ? null : 'Formato de teléfono inválido'
  };
};

// Validar dirección
const validateAddress = (address) => {
  const errors = [];
  
  if (!address || typeof address !== 'object') {
    errors.push('Dirección es requerida');
    return {
      isValid: false,
      message: errors.join(', ')
    };
  }
  
  if (!address.calle || address.calle.trim().length < 5) {
    errors.push('Calle debe tener al menos 5 caracteres');
  }
  
  if (!address.ciudad || address.ciudad.trim().length < 2) {
    errors.push('Ciudad debe tener al menos 2 caracteres');
  }
  
  if (!address.estado || address.estado.trim().length < 2) {
    errors.push('Estado/departamento debe tener al menos 2 caracteres');
  }
  
  if (!address.pais || address.pais.trim().length < 2) {
    errors.push('País debe tener al menos 2 caracteres');
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
      message: `Tipo de archivo no permitido. Tipos permitidos: ${allowedTypes.join(', ')}`
    };
  }

  // Validar tamaño de archivo (máximo 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size && file.size > maxSize) {
    return {
      isValid: false,
      message: 'Archivo demasiado grande. Máximo 5MB'
    };
  }
  
  return {
    isValid: true,
    message: null
  };
};

// Validar datos de producto
const validateProductData = (productData) => {
  const errors = [];
  const { nombre, descripcion, precio, categoria, stock } = productData;
  
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    errors.push('Nombre del producto debe tener al menos 2 caracteres');
  }
  
  if (!descripcion || typeof descripcion !== 'string' || descripcion.trim().length < 10) {
    errors.push('Descripción debe tener al menos 10 caracteres');
  }
  
  if (!precio || isNaN(precio) || precio <= 0) {
    errors.push('Precio debe ser un número mayor a 0');
  }
  
  if (!categoria || typeof categoria !== 'string' || categoria.trim().length === 0) {
    errors.push('Categoría es requerida');
  }
  
  if (stock === undefined || isNaN(stock) || stock < 0) {
    errors.push('Stock debe ser un número mayor o igual a 0');
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null,
    errors
  };
};

// Validar datos de mascota
const validateMascotaData = (mascotaData) => {
  const errors = [];
  const { nombre, especie, edad, peso } = mascotaData;
  
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    errors.push('Nombre de la mascota debe tener al menos 2 caracteres');
  }
  
  if (!especie || typeof especie !== 'string' || especie.trim().length === 0) {
    errors.push('Especie es requerida');
  }
  
  if (edad !== undefined && (isNaN(edad) || edad < 0 || edad > 30)) {
    errors.push('Edad debe ser un número entre 0 y 30 años');
  }
  
  if (peso !== undefined && (isNaN(peso) || peso <= 0 || peso > 200)) {
    errors.push('Peso debe ser un número entre 0.1 y 200 kg');
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null,
    errors
  };
};

// Validar datos de usuario
const validateUserData = (userData) => {
  const errors = [];
  const { name, email, password } = userData;
  
  // Validar nombre
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Nombre debe tener al menos 2 caracteres');
  }
  
  // Validar email
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    errors.push(emailValidation.message);
  }
  
  // Validar contraseña si está presente (para registro)
  if (password) {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.push(passwordValidation.message);
    }
  }
  
  // Validar teléfono si está presente
  if (userData.telefono) {
    const phoneValidation = validatePhone(userData.telefono);
    if (!phoneValidation.isValid) {
      errors.push(phoneValidation.message);
    }
  }
  
  // Validar dirección si está presente
  if (userData.direccion) {
    const addressValidation = validateAddress(userData.direccion);
    if (!addressValidation.isValid) {
      errors.push(addressValidation.message);
    }
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors.join(', ') : null,
    errors
  };
};

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateAddress,
  validatePaymentData,
  validateObjectId,
  validateDateRange,
  sanitizeString,
  validateFileFormat,
  validateProductData,
  validateMascotaData,
  validateUserData
};