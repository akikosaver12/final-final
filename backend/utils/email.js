const nodemailer = require('nodemailer');
const crypto = require('crypto');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Rate limiting para emails - Mejorado con Map más eficiente
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

// Crear transporter de nodemailer con mejor manejo de errores
const createTransporter = () => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn('⚠️ EMAIL_USER o EMAIL_PASS no configurados. Funcionalidad de email deshabilitada.');
    return null;
  }
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true para 465, false para otros puertos
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    // Configuración adicional para mejor rendimiento
    pool: true, // usar pooled connections
    maxConnections: 5, // máximo 5 conexiones simultáneas
    maxMessages: 100, // máximo 100 mensajes por conexión
    rateDelta: 1000, // 1 segundo entre emails
    rateLimit: 5 // máximo 5 emails por segundo
  });

  // Verificar configuración con mejor logging
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Error en configuración de email:', error.message);
      if (error.code === 'EAUTH') {
        console.error('   💡 Verifica que EMAIL_USER y EMAIL_PASS sean correctos');
        console.error('   💡 Para Gmail, usa una "App Password" en lugar de tu contraseña normal');
      }
    } else {
      console.log('✅ Servidor de email configurado correctamente');
      console.log(`📧 Enviando emails desde: ${EMAIL_USER}`);
    }
  });

  return transporter;
};

let transporter = createTransporter();

// Generar token de verificación seguro
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Plantilla base para emails mejorada con mejor diseño
const baseEmailTemplate = (title, content, actionButton = null) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
        
        @media only screen and (max-width: 600px) {
            .container { width: 95% !important; padding: 15px !important; }
            .content { padding: 20px !important; }
            .button { padding: 12px 20px !important; font-size: 14px !important; }
            .logo { font-size: 24px !important; }
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .email-wrapper {
            padding: 40px 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: url('data:image/svg+xml,<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(%23grid)"/></svg>');
            animation: float 20s ease-in-out infinite;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        .logo {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 12px;
            position: relative;
            z-index: 1;
        }
        
        .header-subtitle {
            font-size: 16px;
            opacity: 0.9;
            position: relative;
            z-index: 1;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            color: white !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            margin: 25px 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
            border: none;
            cursor: pointer;
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(124, 58, 237, 0.4);
            background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        }
        
        .footer {
            background: #f8fafc;
            padding: 30px 20px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        
        .footer-text {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.5;
            margin: 5px 0;
        }
        
        .alert {
            padding: 16px 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid;
        }
        
        .warning {
            background: #fef2f2;
            border-left-color: #ef4444;
            color: #7f1d1d;
        }
        
        .success {
            background: #f0fdf4;
            border-left-color: #22c55e;
            color: #14532d;
        }
        
        .info {
            background: #eff6ff;
            border-left-color: #3b82f6;
            color: #1e3a8a;
        }
        
        .code-block {
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            word-break: break-all;
            color: #475569;
            margin: 15px 0;
        }
        
        .feature-list {
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .feature-list ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .feature-list li {
            margin: 8px 0;
            color: #4b5563;
        }
        
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
            margin: 30px 0;
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="container">
            <div class="header">
                <div class="logo">🐾 Clínica Veterinaria</div>
                <div class="header-subtitle">${title}</div>
            </div>
            
            <div class="content">
                ${content}
                ${actionButton || ''}
            </div>
            
            <div class="footer">
                <p class="footer-text"><strong>Clínica Veterinaria</strong></p>
                <p class="footer-text">Este email fue enviado de forma automática, por favor no respondas a este correo</p>
                <p class="footer-text">Si no solicitaste esta acción, puedes ignorar este mensaje de forma segura</p>
                <div class="divider"></div>
                <p class="footer-text">© ${new Date().getFullYear()} Clínica Veterinaria. Todos los derechos reservados.</p>
            </div>
        </div>
    </div>
</body>
</html>
`;

// Email de verificación de cuenta mejorado
const sendVerificationEmail = async (email, name, token) => {
  if (!transporter) {
    console.warn('⚠️ Servicio de email no configurado, simulando envío exitoso');
    return { success: true, simulated: true };
  }

  if (!checkEmailRateLimit(email, 1)) {
    return { success: false, error: 'Debes esperar 1 minuto antes de solicitar otro email' };
  }

  try {
    const verificationUrl = `${FRONTEND_URL}/verificar-email?token=${token}`;
    
    const content = `
      <h2 style="color: #7c3aed; margin-bottom: 24px; font-weight: 600;">¡Hola ${name}!</h2>
      
      <p style="font-size: 16px; margin-bottom: 20px;">
        Gracias por registrarte en nuestra clínica veterinaria. Solo necesitas verificar tu email para activar tu cuenta y comenzar a disfrutar de todos nuestros servicios.
      </p>
      
      <div style="text-align: center; margin: 35px 0;">
          <a href="${verificationUrl}" class="button">
              ✅ Verificar mi correo electrónico
          </a>
      </div>
      
      <p style="margin-bottom: 15px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <div class="code-block">
          ${verificationUrl}
      </div>
      
      <div class="alert warning">
          <strong>⚠️ Importante:</strong> Este enlace expira en 24 horas por seguridad.
      </div>
      
      <div class="feature-list">
          <h4 style="color: #374151; margin-bottom: 15px;">🎉 Una vez verificado podrás:</h4>
          <ul>
              <li><strong>🐕 Registrar tus mascotas:</strong> Crea perfiles completos con fotos y datos médicos</li>
              <li><strong>📅 Agendar citas:</strong> Programa consultas veterinarias online</li>
              <li><strong>🛒 Comprar productos:</strong> Accede a nuestro catálogo de productos para mascotas</li>
              <li><strong>📋 Historial médico:</strong> Mantén registro completo de vacunas y tratamientos</li>
              <li><strong>💬 Soporte especializado:</strong> Consulta con nuestros veterinarios</li>
          </ul>
      </div>
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
    console.log('✅ Email de verificación enviado a:', email, '- ID:', result.messageId);
    
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando email de verificación:', error);
    return { success: false, error: error.message };
  }
};

// Email de bienvenida mejorado
const sendWelcomeEmail = async (email, name) => {
  if (!transporter) {
    console.warn('⚠️ Servicio de email no configurado, simulando envío de bienvenida');
    return { success: true, simulated: true };
  }

  try {
    const content = `
      <h2 style="color: #7c3aed; margin-bottom: 24px;">¡Bienvenido ${name}! 🎉</h2>
      
      <p style="font-size: 16px; margin-bottom: 20px;">
        Tu cuenta ha sido verificada exitosamente. Ya puedes disfrutar de todos nuestros servicios para el cuidado de tus mascotas.
      </p>
      
      <div class="alert success">
          <strong>✅ Cuenta activada exitosamente</strong><br>
          Tu email ha sido verificado correctamente y tu cuenta está completamente activa.
      </div>
      
      <div class="feature-list">
          <h3 style="color: #374151; margin-bottom: 20px;">🚀 ¿Qué puedes hacer ahora?</h3>
          <ul>
              <li><strong>📱 Panel de control:</strong> Accede a tu dashboard personalizado</li>
              <li><strong>🐾 Mascotas:</strong> Registra a todos tus compañeros peludos</li>
              <li><strong>📅 Citas médicas:</strong> Agenda consultas veterinarias</li>
              <li><strong>🛍️ Tienda online:</strong> Compra productos especializados</li>
              <li><strong>📊 Historiales:</strong> Consulta el historial médico de tus mascotas</li>
              <li><strong>💊 Recordatorios:</strong> Recibe alertas de vacunas y medicamentos</li>
          </ul>
      </div>
      
      <div class="alert info">
          <strong>💡 Tip:</strong> Te recomendamos completar el perfil de tus mascotas para una atención más personalizada.
      </div>
      
      <div style="text-align: center; margin: 35px 0;">
          <a href="${FRONTEND_URL}/dashboard" class="button">
              🎯 Ir a mi panel de control
          </a>
      </div>
      
      <p style="text-align: center; color: #6b7280; font-style: italic;">
        Si tienes alguna pregunta, nuestro equipo está aquí para ayudarte 24/7
      </p>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: '🎉 ¡Bienvenido a la Clínica Veterinaria! Tu cuenta está activa',
      html: baseEmailTemplate('¡Cuenta Activada!', content)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email de bienvenida enviado a:', email, '- ID:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando email de bienvenida:', error);
    return { success: false, error: error.message };
  }
};

// Email de recordatorio de cita mejorado
const sendAppointmentReminder = async (email, name, appointment) => {
  if (!transporter) {
    return { success: true, simulated: true };
  }

  try {
    const appointmentDate = new Date(appointment.fecha).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const appointmentTime = appointment.hora;

    const content = `
      <h2 style="color: #7c3aed; margin-bottom: 24px;">Recordatorio de Cita 📅</h2>
      
      <p style="font-size: 16px; margin-bottom: 24px;">
        Hola ${name}, este es un recordatorio amigable de tu próxima cita veterinaria:
      </p>
      
      <div class="alert info">
          <h3 style="margin-top: 0; color: #1e3a8a;">📋 Detalles de tu Cita</h3>
          <p><strong>🐾 Mascota:</strong> ${appointment.mascota.nombre}</p>
          <p><strong>🏥 Tipo de consulta:</strong> ${appointment.tipo}</p>
          <p><strong>📅 Fecha:</strong> ${appointmentDate}</p>
          <p><strong>🕐 Hora:</strong> ${appointmentTime}</p>
          <p><strong>📝 Motivo:</strong> ${appointment.motivo}</p>
          ${appointment.veterinario ? `<p><strong>👨‍⚕️ Veterinario:</strong> Dr. ${appointment.veterinario}</p>` : ''}
      </div>
      
      ${appointment.instruccionesPreparacion ? `
        <div class="alert warning">
            <h4 style="margin-top: 0;">⚠️ Instrucciones importantes de preparación:</h4>
            <p>${appointment.instruccionesPreparacion}</p>
        </div>
      ` : ''}
      
      <div class="feature-list">
          <h4 style="color: #374151;">📝 Recordatorios importantes:</h4>
          <ul>
              <li>Llega 15 minutos antes de tu cita</li>
              <li>Trae la cartilla de vacunación de tu mascota</li>
              <li>Si necesitas cancelar, hazlo con al menos 2 horas de anticipación</li>
              <li>Trae una lista de preguntas que quieras hacer al veterinario</li>
          </ul>
      </div>
      
      <div style="text-align: center; margin: 35px 0;">
          <a href="${FRONTEND_URL}/citas" class="button">
              📋 Ver todas mis citas
          </a>
      </div>
      
      <p style="text-align: center; color: #6b7280;">
        Te esperamos puntualmente. El bienestar de tu mascota es nuestra prioridad ❤️
      </p>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: `🔔 Recordatorio: Cita de ${appointment.mascota.nombre} - ${appointmentDate}`,
      html: baseEmailTemplate('Recordatorio de Cita', content)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Recordatorio de cita enviado a:', email, '- ID:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando recordatorio de cita:', error);
    return { success: false, error: error.message };
  }
};

// Email de confirmación de pago mejorado
const sendPaymentConfirmation = async (email, name, order) => {
  if (!transporter) {
    return { success: true, simulated: true };
  }

  try {
    const itemsList = order.items.map(item => 
      `<li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
        <strong>${item.name}</strong> x${item.quantity} - 
        <span style="color: #059669; font-weight: 600;">$${(item.price * item.quantity).toLocaleString()} COP</span>
      </li>`
    ).join('');

    const content = `
      <h2 style="color: #7c3aed; margin-bottom: 24px;">¡Pago Confirmado! ✅</h2>
      
      <p style="font-size: 16px; margin-bottom: 24px;">
        Hola ${name}, hemos recibido tu pago exitosamente. Tu pedido está siendo procesado.
      </p>
      
      <div class="alert success">
          <h4 style="margin-top: 0;">✅ Detalles del Pago</h4>
          <p><strong>🆔 ID de Orden:</strong> ${order._id}</p>
          <p><strong>💰 Total pagado:</strong> $${order.total.toLocaleString()} COP</p>
          <p><strong>💳 Método de pago:</strong> ${order.paymentInfo.method}</p>
          <p><strong>📅 Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
      </div>
      
      <h3 style="color: #374151; margin: 30px 0 20px 0;">📦 Productos comprados:</h3>
      <ul style="list-style: none; padding: 0; background: #f8fafc; border-radius: 8px; padding: 20px;">
          ${itemsList}
      </ul>
      
      <div class="alert info">
          <h4 style="margin-top: 0;">📋 Próximos pasos:</h4>
          <ul style="margin: 10px 0;">
              <li>✅ Procesaremos tu pedido en 1-2 días hábiles</li>
              <li>📦 Te notificaremos cuando esté listo para envío</li>
              <li>🚚 Recibirás un número de seguimiento por email</li>
              <li>📞 Si tienes dudas, contáctanos al 📱 +57 300 123 4567</li>
          </ul>
      </div>
      
      <div style="text-align: center; margin: 35px 0;">
          <a href="${FRONTEND_URL}/orders/${order._id}" class="button">
              📋 Ver detalles completos de la orden
          </a>
      </div>
      
      <p style="text-align: center; color: #6b7280; font-style: italic;">
        Gracias por confiar en nosotros para el cuidado de tus mascotas 🐾
      </p>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: `✅ Pago confirmado - Orden #${order._id}`,
      html: baseEmailTemplate('Pago Confirmado', content)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Confirmación de pago enviada a:', email, '- ID:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando confirmación de pago:', error);
    return { success: false, error: error.message };
  }
};

// Email de recuperación de contraseña mejorado
const sendPasswordResetEmail = async (email, name, resetToken) => {
  if (!transporter) {
    return { success: true, simulated: true };
  }

  if (!checkEmailRateLimit(email, 5)) {
    return { success: false, error: 'Debes esperar 5 minutos antes de solicitar otro reset' };
  }

  try {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const content = `
      <h2 style="color: #7c3aed; margin-bottom: 24px;">Recuperar Contraseña 🔑</h2>
      
      <p style="font-size: 16px; margin-bottom: 20px;">
        Hola ${name}, recibimos una solicitud para restablecer tu contraseña de acceso a tu cuenta.
      </p>
      
      <div class="alert info">
          <p><strong>🔐 Solicitud de cambio de contraseña</strong></p>
          <p>Si fuiste tú quien solicitó este cambio, haz clic en el botón de abajo para crear una nueva contraseña segura.</p>
      </div>
      
      <div style="text-align: center; margin: 35px 0;">
          <a href="${resetUrl}" class="button">
              🔑 Crear nueva contraseña
          </a>
      </div>
      
      <p style="margin-bottom: 15px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <div class="code-block">
          ${resetUrl}
      </div>
      
      <div class="alert warning">
          <h4 style="margin-top: 0;">⚠️ Información importante de seguridad:</h4>
          <ul style="margin: 10px 0;">
              <li><strong>⏰ Tiempo límite:</strong> Este enlace expira en 1 hora</li>
              <li><strong>🔒 Un solo uso:</strong> El enlace solo funciona una vez</li>
              <li><strong>❓ ¿No fuiste tú?</strong> Si no solicitaste este cambio, ignora este email</li>
              <li><strong>🛡️ Seguridad:</strong> Nunca compartamos este enlace con nadie</li>
          </ul>
      </div>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            <strong>🛡️ Consejo de seguridad:</strong><br>
            Usa una contraseña fuerte que incluya mayúsculas, minúsculas, números y símbolos
          </p>
      </div>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: '🔑 Recuperar contraseña - Clínica Veterinaria',
      html: baseEmailTemplate('Recuperar Contraseña', content)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email de reset de contraseña enviado a:', email, '- ID:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando email de reset:', error);
    return { success: false, error: error.message };
  }
};

// Email de carrito abandonado mejorado
const sendAbandonedCartEmail = async (email, name, cart) => {
  if (!transporter) {
    return { success: true, simulated: true };
  }

  try {
    const itemsList = cart.items.slice(0, 3).map(item => 
      `<li style="padding: 8px 0; display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb;">
        <span>${item.name}</span>
        <strong style="color: #059669;">$${item.price.toLocaleString()}</strong>
      </li>`
    ).join('');

    const moreItems = cart.items.length > 3 ? 
      `<li style="padding: 8px 0; font-style: italic; color: #6b7280;">
        ... y ${cart.items.length - 3} productos más
      </li>` : '';

    const content = `
      <h2 style="color: #7c3aed; margin-bottom: 24px;">¿Olvidaste algo? 🛒</h2>
      
      <p style="font-size: 16px; margin-bottom: 20px;">
        Hola ${name}, notamos que dejaste algunos productos geniales en tu carrito. 
        ¡No dejes que se escapen estos productos para el cuidado de tus mascotas!
      </p>
      
      <div class="alert info">
          <h4 style="margin-top: 0;">🛍️ Productos en tu carrito:</h4>
          <ul style="list-style: none; padding: 0; margin: 15px 0;">
              ${itemsList}
              ${moreItems}
          </ul>
          <div style="border-top: 2px solid #3b82f6; padding-top: 12px; margin-top: 15px;">
              <p style="margin: 0;"><strong style="font-size: 18px; color: #059669;">
                Total: $${cart.total.toLocaleString()} COP
              </strong></p>
          </div>
      </div>
      
      <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
          <h3 style="margin: 0 0 10px 0; color: #92400e;">⚡ ¡Oferta especial!</h3>
          <p style="margin: 0; color: #92400e;">
            Completa tu compra en las próximas 24 horas y obtén <strong>envío gratis</strong>
          </p>
      </div>
      
      <div style="text-align: center; margin: 35px 0;">
          <a href="${FRONTEND_URL}/cart" class="button">
              🛒 Completar mi compra
          </a>
      </div>
      
      <div class="feature-list">
          <h4 style="color: #374151;">🌟 ¿Por qué elegir nuestros productos?</h4>
          <ul>
              <li>✅ Productos veterinarios certificados</li>
              <li>🚚 Envío rápido y seguro</li>
              <li>💰 Mejores precios del mercado</li>
              <li>🛡️ Garantía de calidad</li>
              <li>📞 Soporte especializado 24/7</li>
          </ul>
      </div>
      
      <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 30px;">
        Si ya no estás interesado en estos productos, puedes ignorar este mensaje.
      </p>
    `;

    const mailOptions = {
      from: { name: 'Clínica Veterinaria', address: EMAIL_USER },
      to: email,
      subject: '🛒 Productos esperándote + Envío gratis por tiempo limitado',
      html: baseEmailTemplate('Carrito Abandonado', content)
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email de carrito abandonado enviado a:', email, '- ID:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error('❌ Error enviando email de carrito abandonado:', error);
    return { success: false, error: error.message };
  }
};

// Limpiar tokens expirados del rate limit automáticamente
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [email, timestamp] of emailRateLimit.entries()) {
    if (now - timestamp > oneHour) {
      emailRateLimit.delete(email);
    }
  }
  
  // Log de limpieza solo si hay elementos limpiados
  const sizeBefore = emailRateLimit.size;
  if (sizeBefore > 0) {
    console.log(`🧹 Rate limit limpiado. Entries activos: ${emailRateLimit.size}`);
  }
}, 60 * 60 * 1000); // Cada hora

// Verificar estado del servicio de email con más detalles
const getEmailServiceStatus = () => {
  const status = {
    configured: !!transporter,
    emailUser: EMAIL_USER || 'No configurado',
    hasEmailPass: !!(EMAIL_PASS && EMAIL_PASS !== 'tu-password-de-aplicacion'),
    rateLimitEntries: emailRateLimit.size,
    frontendUrl: FRONTEND_URL,
    nodeEnv: process.env.NODE_ENV || 'development'
  };

  // Verificar si las credenciales parecen válidas
  if (EMAIL_USER) {
    status.emailUserValid = EMAIL_USER.includes('@') && EMAIL_USER.includes('.');
  }

  if (EMAIL_PASS) {
    status.emailPassLength = EMAIL_PASS.length;
    status.looksLikeAppPassword = EMAIL_PASS.length >= 16; // App passwords son típicamente 16+ caracteres
  }

  return status;
};

// Función para probar la configuración de email
const testEmailConfiguration = async () => {
  if (!transporter) {
    return { success: false, error: 'Transporter no configurado' };
  }

  try {
    await transporter.verify();
    return { success: true, message: 'Configuración de email válida' };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
  createTransporter,
  testEmailConfiguration
};