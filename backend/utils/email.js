const nodemailer = require('nodemailer');
const crypto = require('crypto');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Rate limiting para emails
const emailRateLimit = new Map();

// Verificar rate limiting
const checkEmailRateLimit = (email, limitMinutes = 1) => {
  const now = Date.now();
  const lastSent = emailRateLimit.get(email);
  const limitMs = limitMinutes * 60 * 1000;
  
  if (lastSent && (now - lastSent) < limitMs) {
    return false;
  }
  
  emailRateLimit.set(email, now);
  return true;
};

// Crear transporter de nodemailer
const createTransporter = () => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn('⚠️ EMAIL_USER o EMAIL_PASS no configurados');
    return null;
  }
  
 const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Verificar configuración
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Error en configuración de email:', error.message);
    } else {
      console.log('✅ Servidor de email configurado correctamente');
    }
  });

  return transporter;
};

let transporter = createTransporter();

// Generar token de verificación
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Plantilla base para emails
const baseEmailTemplate = (title, content, actionButton = null) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        @media only screen and (max-width: 600px) {
            .container { width: 95% !important; padding: 15px !important; }
            .content { padding: 20px !important; }
            .button { padding: 12px 20px !important; font-size: 14px !important; }
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .content {
            padding: 30px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            color: white !important;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(124, 58, 237, 0.3);
        }
        .footer {
            background: #f8fafc;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
        }
        .warning {
            background: #fef2f2;
            border-left: 4px solid #dc2626;
            padding: 16px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .success {
            background: #f0fdf4;
            border-left: 4px solid #16a34a;
            padding: 16px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .info {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🐾 Clínica Veterinaria</div>
            <p>${title}</p>
        </div>
        
        <div class="content">
            ${content}
            ${actionButton || ''}
        </div>
        
        <div class="footer">
            <p>Este email fue enviado desde Clínica Veterinaria</p>
            <p>Si no solicitaste esta acción, puedes ignorar este mensaje</p>
            <p>© ${new Date().getFullYear()} Clínica Veterinaria. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
`;

// Email de verificación de cuenta
const sendVerificationEmail = async (email, name, token) => {
  if (!transporter) {
    return { success: false, error: 'Servicio de email no configurado' };
  }

  if (!checkEmailRateLimit(email)) {
    return { success: false, error: 'Debes esperar 1 minuto antes de solicitar otro email' };
  }

  try {
    const verificationUrl = `${FRONTEND_URL}/verificar-email?token=${token}`;
    
    const content = `
      <h2 style="color: #7c3aed; margin-bottom: 20px;">¡Hola ${name}!</h2>
      
      <p>Gracias por registrarte en nuestra clínica veterinaria. Solo necesitas verificar tu email para activar tu cuenta.</p>
      
      <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" class="button">
              ✅ Verificar mi correo
          </a>
      </div>
      
      <p>Si el botón no funciona, copia este enlace en tu navegador:</p>
      <p style="word-break: break-all; background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px;">
          ${verificationUrl}
      </p>
      
      <div class="warning">
          <strong>⚠️ Importante:</strong> Este enlace expira en 24 horas.
      </div>
      
      <p><strong>Una vez verificado podrás:</strong></p>
      <ul style="color: #64748b;">
          <li>Registrar tus mascotas</li>
          <li>Agendar citas veterinarias</li>
          <li>Acceder a nuestros productos</li>
          <li>Gestionar tu perfil y carrito</li>
      </ul>
    `;

    const mailOptions = {
      from: {
        name: 'Clínica Veterinaria',
        address: EMAIL_USER
      },
      to: email,
      subject: '🐾 Verificar tu cuenta - Clínica Veterinaria',
      html: baseEmailTemplate('Verificación de Cuenta', content)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email de verificación enviado a:', email);
    
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando email de verificación:', error);
    return { success: false, error: error.message };
  }
};

// Email de bienvenida
const sendWelcomeEmail = async (email, name) => {
  if (!transporter) return { success: false, error: 'Servicio no configurado' };

  try {
    const content = `
      <h2 style="color: #7c3aed;">¡Bienvenido ${name}!</h2>
      
      <p>Tu cuenta ha sido verificada exitosamente. Ya puedes disfrutar de todos nuestros servicios.</p>
      
      <div class="success">
          <strong>✅ Cuenta activada:</strong> Tu email ha sido verificado correctamente.
      </div>
      
      <h3>¿Qué puedes hacer ahora?</h3>
      <ul>
          <li><strong>Registrar mascotas:</strong> Crea perfiles completos para tus compañeros</li>
          <li><strong>Agendar citas:</strong> Programa consultas con nuestros veterinarios</li>
          <li><strong>Comprar productos:</strong> Explora nuestro catálogo de productos</li>
          <li><strong>Gestionar historial:</strong> Mantén registro de vacunas y tratamientos</li>
      </ul>
      
      <div style="text-align: center; margin: 30px 0;">
          <a href="${FRONTEND_URL}/dashboard" class="button">
              🎉 Comenzar ahora
          </a>
      </div>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: '🎉 ¡Bienvenido a la Clínica Veterinaria!',
      html: baseEmailTemplate('¡Bienvenido!', content)
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando email de bienvenida:', error);
    return { success: false, error: error.message };
  }
};

// Email de recordatorio de cita
const sendAppointmentReminder = async (email, name, appointment) => {
  if (!transporter) return { success: false, error: 'Servicio no configurado' };

  try {
    const appointmentDate = new Date(appointment.fecha).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const content = `
      <h2 style="color: #7c3aed;">Recordatorio de Cita</h2>
      
      <p>Hola ${name}, este es un recordatorio de tu próxima cita veterinaria:</p>
      
      <div class="info">
          <h3>📅 Detalles de la Cita</h3>
          <p><strong>Mascota:</strong> ${appointment.mascota.nombre}</p>
          <p><strong>Tipo:</strong> ${appointment.tipo}</p>
          <p><strong>Fecha:</strong> ${appointmentDate}</p>
          <p><strong>Hora:</strong> ${appointment.hora}</p>
          <p><strong>Motivo:</strong> ${appointment.motivo}</p>
      </div>
      
      ${appointment.instruccionesPreparacion ? `
        <div class="warning">
            <h4>⚠️ Instrucciones importantes:</h4>
            <p>${appointment.instruccionesPreparacion}</p>
        </div>
      ` : ''}
      
      <p>Te esperamos puntualmente. Si necesitas reprogramar o cancelar, hazlo con al menos 2 horas de anticipación.</p>
      
      <div style="text-align: center; margin: 30px 0;">
          <a href="${FRONTEND_URL}/citas" class="button">
              📋 Ver mis citas
          </a>
      </div>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: `🔔 Recordatorio: Cita para ${appointment.mascota.nombre}`,
      html: baseEmailTemplate('Recordatorio de Cita', content)
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando recordatorio de cita:', error);
    return { success: false, error: error.message };
  }
};

// Email de confirmación de pago
const sendPaymentConfirmation = async (email, name, order) => {
  if (!transporter) return { success: false, error: 'Servicio no configurado' };

  try {
    const itemsList = order.items.map(item => 
      `<li>${item.name} x${item.quantity} - $${(item.price * item.quantity).toLocaleString()}</li>`
    ).join('');

    const content = `
      <h2 style="color: #7c3aed;">¡Pago Confirmado!</h2>
      
      <p>Hola ${name}, hemos recibido tu pago exitosamente.</p>
      
      <div class="success">
          <h4>✅ Pago procesado</h4>
          <p><strong>ID de Orden:</strong> ${order._id}</p>
          <p><strong>Total pagado:</strong> $${order.total.toLocaleString()} COP</p>
          <p><strong>Método de pago:</strong> ${order.paymentInfo.method}</p>
      </div>
      
      <h3>📦 Productos comprados:</h3>
      <ul>
          ${itemsList}
      </ul>
      
      <div class="info">
          <h4>📋 Próximos pasos:</h4>
          <p>• Procesaremos tu pedido en 1-2 días hábiles</p>
          <p>• Te notificaremos cuando esté listo para envío</p>
          <p>• Recibirás un número de seguimiento</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
          <a href="${FRONTEND_URL}/orders/${order._id}" class="button">
              📋 Ver orden completa
          </a>
      </div>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: `✅ Pago confirmado - Orden ${order._id}`,
      html: baseEmailTemplate('Pago Confirmado', content)
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando confirmación de pago:', error);
    return { success: false, error: error.message };
  }
};

// Email de recuperación de contraseña
const sendPasswordResetEmail = async (email, name, resetToken) => {
  if (!transporter) return { success: false, error: 'Servicio no configurado' };

  if (!checkEmailRateLimit(email, 5)) { // 5 minutos para reset de password
    return { success: false, error: 'Debes esperar 5 minutos antes de solicitar otro reset' };
  }

  try {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const content = `
      <h2 style="color: #7c3aed;">Recuperar Contraseña</h2>
      
      <p>Hola ${name}, recibimos una solicitud para restablecer tu contraseña.</p>
      
      <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" class="button">
              🔑 Crear nueva contraseña
          </a>
      </div>
      
      <p>Si el botón no funciona, copia este enlace:</p>
      <p style="word-break: break-all; background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace;">
          ${resetUrl}
      </p>
      
      <div class="warning">
          <strong>⚠️ Importante:</strong>
          <ul>
              <li>Este enlace expira en 1 hora</li>
              <li>Solo funciona una vez</li>
              <li>Si no solicitaste esto, ignora este email</li>
          </ul>
      </div>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: '🔑 Recuperar contraseña - Clínica Veterinaria',
      html: baseEmailTemplate('Recuperar Contraseña', content)
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando email de reset:', error);
    return { success: false, error: error.message };
  }
};

// Email de carrito abandonado
const sendAbandonedCartEmail = async (email, name, cart) => {
  if (!transporter) return { success: false, error: 'Servicio no configurado' };

  try {
    const itemsList = cart.items.slice(0, 3).map(item => 
      `<li>${item.name} - $${item.price.toLocaleString()}</li>`
    ).join('');

    const moreItems = cart.items.length > 3 ? `<li>... y ${cart.items.length - 3} productos más</li>` : '';

    const content = `
      <h2 style="color: #7c3aed;">¿Olvidaste algo? 🛒</h2>
      
      <p>Hola ${name}, notamos que dejaste algunos productos en tu carrito:</p>
      
      <div class="info">
          <h4>🛍️ Productos en tu carrito:</h4>
          <ul>
              ${itemsList}
              ${moreItems}
          </ul>
          <p><strong>Total:</strong> $${cart.total.toLocaleString()} COP</p>
      </div>
      
      <p>¡Completa tu compra antes de que se agoten!</p>
      
      <div style="text-align: center; margin: 30px 0;">
          <a href="${FRONTEND_URL}/cart" class="button">
              🛒 Completar compra
          </a>
      </div>
      
      <p style="font-size: 12px; color: #666;">
          Si ya no estás interesado, puedes ignorar este mensaje.
      </p>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: '🛒 Tienes productos esperándote',
      html: baseEmailTemplate('Carrito Abandonado', content)
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando email de carrito abandonado:', error);
    return { success: false, error: error.message };
  }
};

// Limpiar tokens expirados del rate limit
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [email, timestamp] of emailRateLimit.entries()) {
    if (now - timestamp > oneHour) {
      emailRateLimit.delete(email);
    }
  }
}, 60 * 60 * 1000); // Cada hora

// Verificar estado del servicio de email
const getEmailServiceStatus = () => {
  return {
    configured: !!transporter,
    emailUser: EMAIL_USER || 'No configurado',
    hasEmailPass: !!(EMAIL_PASS && EMAIL_PASS !== 'tu-password-de-aplicacion'),
    rateLimitEntries: emailRateLimit.size
  };
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendAppointmentReminder,
  sendPaymentConfirmation,
  sendPasswordResetEmail,
  sendAbandonedCartEmail,
  generateVerificationToken,
  checkEmailRateLimit,
  getEmailServiceStatus,
  createTransporter
};