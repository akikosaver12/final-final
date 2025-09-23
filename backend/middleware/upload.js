const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear carpeta uploads si no existe
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Crear subcarpetas por tipo de archivo
    let subfolder = '';
    
    switch (file.fieldname) {
      case 'imagen':
      case 'image':
        subfolder = 'productos';
        break;
      case 'mascotaImagen':
        subfolder = 'mascotas';
        break;
      case 'documentos':
      case 'documento':
        subfolder = 'documentos';
        break;
      case 'vacunaImagen':
        subfolder = 'vacunas';
        break;
      case 'operacionImagen':
        subfolder = 'operaciones';
        break;
      case 'profilePicture':
        subfolder = 'perfiles';
        break;
      default:
        subfolder = 'otros';
    }
    
    const finalPath = path.join(uploadsDir, subfolder);
    if (!fs.existsSync(finalPath)) {
      fs.mkdirSync(finalPath, { recursive: true });
    }
    
    cb(null, finalPath);
  },
  filename: (req, file, cb) => {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    
    // Limpiar el nombre base de caracteres especiales
    const cleanBaseName = baseName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-zA-Z0-9]/g, '_')    // Reemplazar caracteres especiales
      .substring(0, 50);                // Limitar longitud
    
    cb(null, `${cleanBaseName}_${uniqueSuffix}${extension}`);
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  console.log(`📁 Subiendo archivo: ${file.originalname}, Tipo: ${file.mimetype}`);
  
  // Tipos de archivo permitidos
  const allowedImageTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  const allowedDocumentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  const allAllowedTypes = [...allowedImageTypes, ...allowedDocumentTypes];
  
  // Verificar si el tipo de archivo está permitido
  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Tipo de archivo no permitido: ${file.mimetype}`);
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Configuración básica de multer
const uploadConfig = {
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
    files: 5 // máximo 5 archivos
  }
};

// Middleware básico para un solo archivo
const upload = multer(uploadConfig);

// Middlewares específicos para diferentes tipos de archivos
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err) {
        console.error(`❌ Error subiendo archivo ${fieldName}:`, err);
        
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              return res.status(400).json({
                error: 'Archivo demasiado grande',
                message: 'El archivo no puede superar los 10MB',
                code: 'FILE_TOO_LARGE'
              });
            case 'LIMIT_FILE_COUNT':
              return res.status(400).json({
                error: 'Demasiados archivos',
                message: 'Máximo 5 archivos permitidos',
                code: 'TOO_MANY_FILES'
              });
            case 'LIMIT_UNEXPECTED_FILE':
              return res.status(400).json({
                error: 'Campo de archivo inesperado',
                message: `Campo '${err.field}' no esperado`,
                code: 'UNEXPECTED_FIELD'
              });
            default:
              return res.status(400).json({
                error: 'Error de subida',
                message: err.message,
                code: 'UPLOAD_ERROR'
              });
          }
        } else if (err.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({
            error: 'Tipo de archivo no válido',
            message: 'Solo se permiten imágenes (JPG, PNG, GIF, WEBP) y documentos (PDF, DOC, DOCX, TXT)',
            code: 'INVALID_FILE_TYPE'
          });
        }
        
        return res.status(500).json({
          error: 'Error interno de subida',
          message: 'Error procesando el archivo',
          code: 'INTERNAL_UPLOAD_ERROR'
        });
      }
      
      // Log exitoso
      if (req.file) {
        console.log(`✅ Archivo subido exitosamente: ${req.file.filename}`);
        
        // Agregar URL completa al request
        req.file.url = `${req.protocol}://${req.get('host')}/uploads/${path.basename(path.dirname(req.file.path))}/${req.file.filename}`;
      }
      
      next();
    });
  };
};

// Middleware para múltiples archivos
const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (err) => {
      if (err) {
        console.error(`❌ Error subiendo archivos ${fieldName}:`, err);
        
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              return res.status(400).json({
                error: 'Archivo demasiado grande',
                message: 'Ningún archivo puede superar los 10MB',
                code: 'FILE_TOO_LARGE'
              });
            case 'LIMIT_FILE_COUNT':
              return res.status(400).json({
                error: 'Demasiados archivos',
                message: `Máximo ${maxCount} archivos permitidos`,
                code: 'TOO_MANY_FILES'
              });
            default:
              return res.status(400).json({
                error: 'Error de subida múltiple',
                message: err.message,
                code: 'UPLOAD_ERROR'
              });
          }
        }
        
        return res.status(500).json({
          error: 'Error interno de subida múltiple',
          code: 'INTERNAL_UPLOAD_ERROR'
        });
      }
      
      // Log exitoso y agregar URLs
      if (req.files && req.files.length > 0) {
        console.log(`✅ ${req.files.length} archivos subidos exitosamente`);
        
        req.files = req.files.map(file => ({
          ...file,
          url: `${req.protocol}://${req.get('host')}/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`
        }));
      }
      
      next();
    });
  };
};

// Middleware para campos múltiples con diferentes nombres
const uploadFields = (fields) => {
  return (req, res, next) => {
    const fieldsUpload = upload.fields(fields);
    
    fieldsUpload(req, res, (err) => {
      if (err) {
        console.error('❌ Error subiendo campos múltiples:', err);
        
        if (err instanceof multer.MulterError) {
          return res.status(400).json({
            error: 'Error de subida',
            message: err.message,
            code: 'UPLOAD_ERROR'
          });
        }
        
        return res.status(500).json({
          error: 'Error interno de subida',
          code: 'INTERNAL_UPLOAD_ERROR'
        });
      }
      
      // Procesar archivos y agregar URLs
      if (req.files) {
        Object.keys(req.files).forEach(fieldName => {
          req.files[fieldName] = req.files[fieldName].map(file => ({
            ...file,
            url: `${req.protocol}://${req.get('host')}/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`
          }));
        });
        
        console.log(`✅ Archivos subidos en múltiples campos:`, Object.keys(req.files));
      }
      
      next();
    });
  };
};

// Función para eliminar archivo
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    // Si la ruta es una URL completa, extraer solo la parte del archivo
    let actualPath = filePath;
    if (filePath.includes('/uploads/')) {
      const uploadsIndex = filePath.indexOf('/uploads/');
      const relativePath = filePath.substring(uploadsIndex + 1);
      actualPath = path.join(__dirname, '../', relativePath);
    }
    
    fs.unlink(actualPath, (err) => {
      if (err) {
        console.error(`❌ Error eliminando archivo ${actualPath}:`, err);
        reject(err);
      } else {
        console.log(`✅ Archivo eliminado: ${actualPath}`);
        resolve();
      }
    });
  });
};

// Middleware para limpiar archivos huérfanos
const cleanupOrphanedFiles = async (req, res, next) => {
  // Este middleware se puede ejecutar periódicamente
  // para limpiar archivos que no están referenciados en la base de datos
  next();
};

// Función para validar imagen
const validateImage = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB para imágenes
  
  return {
    isValid: allowedTypes.includes(file.mimetype) && file.size <= maxSize,
    error: !allowedTypes.includes(file.mimetype) 
      ? 'Tipo de imagen no válido' 
      : file.size > maxSize 
      ? 'Imagen demasiado grande (máximo 5MB)'
      : null
  };
};

// Función para validar documento
const validateDocument = (file) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  const maxSize = 10 * 1024 * 1024; // 10MB para documentos
  
  return {
    isValid: allowedTypes.includes(file.mimetype) && file.size <= maxSize,
    error: !allowedTypes.includes(file.mimetype) 
      ? 'Tipo de documento no válido' 
      : file.size > maxSize 
      ? 'Documento demasiado grande (máximo 10MB)'
      : null
  };
};

// Middleware para validar archivos después de subirlos
const validateUploadedFiles = (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);
  
  for (const file of files) {
    let validation;
    
    if (file.mimetype.startsWith('image/')) {
      validation = validateImage(file);
    } else {
      validation = validateDocument(file);
    }
    
    if (!validation.isValid) {
      // Eliminar archivo inválido
      deleteFile(file.path).catch(console.error);
      
      return res.status(400).json({
        error: 'Archivo inválido',
        message: validation.error,
        filename: file.originalname,
        code: 'INVALID_FILE'
      });
    }
  }
  
  next();
};

// Middleware de limpieza automática de archivos temporales
const autoCleanup = (maxAge = 24 * 60 * 60 * 1000) => { // 24 horas por defecto
  return (req, res, next) => {
    // Ejecutar limpieza de archivos viejos de forma asíncrona
    setImmediate(async () => {
      try {
        const now = Date.now();
        const directories = ['productos', 'mascotas', 'documentos', 'vacunas', 'operaciones', 'perfiles', 'otros'];
        
        for (const dir of directories) {
          const dirPath = path.join(uploadsDir, dir);
          if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            
            for (const file of files) {
              const filePath = path.join(dirPath, file);
              const stats = fs.statSync(filePath);
              
              if (now - stats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Archivo temporal eliminado: ${file}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error en limpieza automática:', error);
      }
    });
    
    next();
  };
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  deleteFile,
  cleanupOrphanedFiles,
  validateImage,
  validateDocument,
  validateUploadedFiles,
  autoCleanup
};