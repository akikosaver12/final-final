const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Importar modelo de Mascota
const Mascota = require('../models/Mascota');

// Middleware de verificación de token
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Acceso denegado. Token requerido." });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    console.error('❌ Error verificando token:', error);
    res.status(401).json({ error: "Token inválido" });
  }
};

// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, "mascota-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, gif, webp)"));
    }
  },
});

// 🐾 RUTAS DE MASCOTAS

// Obtener todas las mascotas del usuario
router.get("/", verifyToken, async (req, res) => {
  try {
    console.log('🔍 Usuario solicitando mascotas:', req.user.id);
    
    // Buscar mascotas del usuario
    const mascotas = await Mascota.find({ usuario: req.user.id }).sort({ createdAt: -1 });
    
    console.log(`📋 Encontradas ${mascotas.length} mascotas para el usuario`);
    
    res.json(mascotas);
  } catch (error) {
    console.error('❌ Error obteniendo mascotas:', error);
    res.status(500).json({ 
      error: "Error interno del servidor al obtener mascotas",
      details: error.message 
    });
  }
});

// Obtener una mascota específica por ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Buscando mascota:', id, 'para usuario:', req.user.id);

    const mascota = await Mascota.findOne({ 
      _id: id, 
      usuario: req.user.id 
    });

    if (!mascota) {
      return res.status(404).json({ error: "Mascota no encontrada" });
    }

    console.log('✅ Mascota encontrada:', mascota.nombre);
    res.json(mascota);
  } catch (error) {
    console.error('❌ Error obteniendo mascota:', error);
    res.status(500).json({ 
      error: "Error interno del servidor al obtener mascota",
      details: error.message 
    });
  }
});

// Crear nueva mascota
router.post("/", verifyToken, upload.single("imagen"), async (req, res) => {
  try {
    const { nombre, especie, raza, edad, genero, estado, enfermedades, historial } = req.body;

    console.log('🆕 Creando nueva mascota:', { nombre, especie, raza, edad, genero, estado });

    // Validaciones obligatorias
    if (!nombre || !especie || !raza || !edad || !genero || !estado) {
      const faltantes = [];
      if (!nombre) faltantes.push("nombre");
      if (!especie) faltantes.push("especie");
      if (!raza) faltantes.push("raza");
      if (!edad) faltantes.push("edad");
      if (!genero) faltantes.push("genero");
      if (!estado) faltantes.push("estado");

      return res.status(400).json({
        error: "Faltan campos obligatorios",
        campos: faltantes,
      });
    }

    const edadNum = parseInt(edad);
    if (isNaN(edadNum) || edadNum < 0 || edadNum > 30) {
      return res.status(400).json({ error: "La edad debe ser un número entre 0 y 30" });
    }

    if (!["Macho", "Hembra"].includes(genero)) {
      return res.status(400).json({ error: "El género debe ser 'Macho' o 'Hembra'" });
    }

    const nuevaMascota = new Mascota({
      nombre: nombre.trim(),
      especie: especie.trim(),
      raza: raza.trim(),
      edad: edadNum,
      genero,
      estado: estado.trim(),
      enfermedades: enfermedades ? enfermedades.trim() : "",
      historial: historial ? historial.trim() : "",
      imagen: req.file
        ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        : "",
      usuario: req.user.id,
    });

    await nuevaMascota.save();
    console.log('✅ Mascota registrada:', nuevaMascota.nombre, 'para usuario:', req.user.id);
    res.status(201).json({ msg: "Mascota registrada", mascota: nuevaMascota });
  } catch (err) {
    console.error("❌ Error creando mascota:", err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      res.status(400).json({ msg: "Error de validación", errors });
    } else {
      res.status(500).json({ msg: "Error en el servidor", error: err.message });
    }
  }
});

// Actualizar mascota
router.put("/:id", verifyToken, upload.single("imagen"), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, especie, raza, edad, genero, estado, enfermedades, historial } = req.body;

    console.log('🔄 Actualizando mascota:', id);

    const mascota = await Mascota.findOne({ _id: id, usuario: req.user.id });

    if (!mascota) {
      return res.status(404).json({ error: "Mascota no encontrada" });
    }

    // Actualizar campos
    if (nombre) mascota.nombre = nombre.trim();
    if (especie) mascota.especie = especie.trim();
    if (raza) mascota.raza = raza.trim();
    if (edad) {
      const edadNum = parseInt(edad);
      if (isNaN(edadNum) || edadNum < 0 || edadNum > 30) {
        return res.status(400).json({ error: "La edad debe ser un número entre 0 y 30" });
      }
      mascota.edad = edadNum;
    }
    if (genero && ["Macho", "Hembra"].includes(genero)) {
      mascota.genero = genero;
    }
    if (estado) mascota.estado = estado.trim();
    if (enfermedades !== undefined) mascota.enfermedades = enfermedades.trim();
    if (historial !== undefined) mascota.historial = historial.trim();

    // Actualizar imagen si se subió una nueva
    if (req.file) {
      mascota.imagen = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

    await mascota.save();
    console.log('✅ Mascota actualizada:', mascota.nombre);
    res.json({ msg: "Mascota actualizada", mascota });
  } catch (error) {
    console.error('❌ Error actualizando mascota:', error);
    res.status(500).json({ 
      error: "Error interno del servidor al actualizar mascota",
      details: error.message 
    });
  }
});

// Eliminar mascota
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Eliminando mascota:', id);

    const mascota = await Mascota.findOneAndDelete({ _id: id, usuario: req.user.id });

    if (!mascota) {
      return res.status(404).json({ error: "Mascota no encontrada" });
    }

    console.log('✅ Mascota eliminada:', mascota.nombre);
    res.json({ msg: "Mascota eliminada", mascota });
  } catch (error) {
    console.error('❌ Error eliminando mascota:', error);
    res.status(500).json({ 
      error: "Error interno del servidor al eliminar mascota",
      details: error.message 
    });
  }
});

module.exports = router;