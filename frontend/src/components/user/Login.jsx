import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// Configuración
const API_URL = "http://localhost:5000/api";
const GOOGLE_CLIENT_ID = "503963971592-17vo21di0tjf249341l4ocscemath5p0.apps.googleusercontent.com";

function Login() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const navigate = useNavigate();

  // Inicializar Google Sign-In
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSuccess,
            auto_select: false,
            cancel_on_tap_outside: true,
            ux_mode: 'popup',
            use_fedcm_for_prompt: false
          });
          
          setGoogleReady(true);
          console.log('✅ Google Sign-In inicializado para login');
        } catch (error) {
          console.error('❌ Error inicializando Google Sign-In en login:', error);
          setGoogleReady(false);
        }
      }
    };

    const loadGoogleScript = () => {
      if (window.google) {
        initializeGoogleSignIn();
        return;
      }

      if (document.querySelector('script[src*="accounts.google.com"]')) {
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = initializeGoogleSignIn;
      script.onerror = () => setGoogleReady(false);
      
      document.head.appendChild(script);
    };

    loadGoogleScript();
  }, []);

  // Manejar cambios en inputs
  const handleChange = useCallback((e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    
    // Limpiar mensajes de error cuando el usuario comience a escribir
    if (showVerificationMessage) {
      setShowVerificationMessage(false);
    }
  }, [formData, showVerificationMessage]);

  // Manejar login tradicional
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setShowVerificationMessage(false);

    try {
      console.log('🔐 Intentando login para:', formData.email);

      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      console.log('📥 Respuesta de login:', data);

      if (res.ok) {
        // Login exitoso
        localStorage.setItem("token", data.tokens.accessToken);
        localStorage.setItem("refreshToken", data.tokens.refreshToken);
        localStorage.setItem("user", JSON.stringify(data.user));

        console.log('✅ Login exitoso para:', data.user.name);
        
        // Mostrar mensaje de bienvenida
        const welcomeMessage = data.user.authMethod === 'google' 
          ? `¡Bienvenido de vuelta ${data.user.name}!` 
          : `¡Hola ${data.user.name}! Sesión iniciada correctamente`;
        
        alert(welcomeMessage);

        // Redirigir según rol
        navigate(data.redirectTo || "/dashboard");

      } else {
        console.log('❌ Error en login:', data);
        
        // Manejar diferentes tipos de errores
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setShowVerificationMessage(true);
          setPendingEmail(data.email);
        } else if (data.code === 'INVALID_CREDENTIALS') {
          alert("❌ Email o contraseña incorrectos. Por favor, verifica tus datos.");
        } else if (data.code === 'ACCOUNT_DEACTIVATED') {
          alert("❌ Tu cuenta está desactivada. Contacta al administrador.");
        } else if (data.code === 'MISSING_CREDENTIALS') {
          alert("❌ Por favor, completa todos los campos.");
        } else {
          alert("❌ " + (data.error || "Error al iniciar sesión"));
        }
      }
    } catch (error) {
      console.error("⚠️ Error de conexión en login:", error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        alert("⚠️ No se pudo conectar al servidor. Verifica que esté corriendo en puerto 5000.");
      } else {
        alert("⚠️ Error de conexión con el servidor");
      }
    } finally {
      setLoading(false);
    }
  };

  // Manejar login con Google
  const handleGoogleSuccess = useCallback(async (credentialResponse) => {
    setGoogleLoading(true);
    
    try {
      console.log('📧 Procesando login con Google...');
      
      const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential: credentialResponse.credential
        }),
      });

      const data = await res.json();
      console.log('📥 Respuesta Google login:', data);

      if (res.ok) {
        if (data.requiresAdditionalInfo) {
          // Usuario nuevo con Google, redirigir a completar registro
          navigate("/google-complete-register", { 
            state: { 
              googleUser: data.googleUser,
              credential: credentialResponse.credential 
            }
          });
        } else {
          // Login exitoso
          localStorage.setItem("token", data.tokens.accessToken);
          localStorage.setItem("refreshToken", data.tokens.refreshToken);
          localStorage.setItem("user", JSON.stringify(data.user));
          
          console.log('✅ Google login exitoso para:', data.user.email);
          alert(data.message || `¡Bienvenido ${data.user.name}!`);
          navigate(data.redirectTo || "/dashboard");
        }
      } else {
        console.error('❌ Error en Google login:', data);
        
        if (data.code === 'INVALID_GOOGLE_TOKEN') {
          alert("❌ Token de Google inválido. Por favor, intenta de nuevo.");
        } else if (data.code === 'ACCOUNT_DEACTIVATED') {
          alert("❌ Tu cuenta está desactivada. Contacta al administrador.");
        } else {
          alert("❌ " + (data.error || "Error al iniciar sesión con Google"));
        }
      }
    } catch (error) {
      console.error('💥 Error en Google login:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        alert("❌ No se pudo conectar con el servidor para Google login.");
      } else {
        alert("❌ Error al iniciar sesión con Google. Intenta de nuevo.");
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [navigate]);

  // Manejar click del botón de Google
  const handleGoogleButtonClick = useCallback(() => {
    if (!googleReady || !window.google) {
      alert("Google Sign-In no está disponible. Por favor, recarga la página.");
      return;
    }

    setGoogleLoading(true);
    
    try {
      window.google.accounts.id.prompt((notification) => {
        setGoogleLoading(false);
        
        if (notification.isNotDisplayed()) {
          console.warn('Google prompt no disponible:', notification.getNotDisplayedReason());
          // Mostrar botón de respaldo
          showGoogleButton();
        } else if (notification.isSkippedMoment()) {
          console.log('Google prompt saltado por el usuario');
        }
      });
    } catch (error) {
      setGoogleLoading(false);
      console.error('❌ Error con Google prompt:', error);
      showGoogleButton();
    }
  }, [googleReady]);

  // Mostrar botón de respaldo de Google
  const showGoogleButton = () => {
    const buttonContainer = document.getElementById('google-fallback-login');
    if (buttonContainer && window.google) {
      buttonContainer.innerHTML = '';
      
      try {
        window.google.accounts.id.renderButton(buttonContainer, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          width: '100%',
          shape: 'rectangular'
        });
        buttonContainer.style.display = 'block';
      } catch (error) {
        console.error('Error renderizando botón de respaldo:', error);
      }
    }
  };

  // Reenviar email de verificación
  const reenviarVerificacion = async () => {
    if (!pendingEmail || resendingEmail) return;

    setResendingEmail(true);

    try {
      console.log('📧 Reenviando verificación para:', pendingEmail);
      
      const res = await fetch(`${API_URL}/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: pendingEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("✅ Email de verificación reenviado. Revisa tu bandeja de entrada y spam.");
      } else {
        if (data.code === 'RATE_LIMIT_EXCEEDED') {
          alert("❌ Debes esperar antes de solicitar otro email. Intenta en unos minutos.");
        } else if (data.code === 'USER_NOT_FOUND') {
          alert("❌ No se encontró una cuenta pendiente de verificación. Intenta registrarte de nuevo.");
        } else {
          alert("❌ " + (data.error || "Error al reenviar email"));
        }
      }
    } catch (error) {
      console.error('Error reenviando verificación:', error);
      alert("❌ Error de conexión al reenviar email de verificación");
    } finally {
      setResendingEmail(false);
    }
  };

  // Ir a página de verificación pendiente
  const irAVerificacionPendiente = () => {
    navigate("/verificacion-pendiente", {
      state: { 
        email: pendingEmail,
        mensaje: "Debes verificar tu email antes de iniciar sesión",
        fromLogin: true
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100 flex justify-center items-center px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-purple-700 mb-2">
            Iniciar Sesión
          </h2>
          <p className="text-gray-600">
            Bienvenido de vuelta a la clínica veterinaria
          </p>
        </div>

        {/* Mensaje de verificación pendiente */}
        {showVerificationMessage && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                  Email no verificado
                </h3>
                <p className="text-sm text-yellow-700 mb-3">
                  Debes verificar tu email <strong>{pendingEmail}</strong> antes de poder iniciar sesión. 
                  Revisa tu bandeja de entrada y carpeta de spam.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={irAVerificacionPendiente}
                    className="w-full text-sm bg-yellow-600 text-white py-2 px-3 rounded hover:bg-yellow-700 transition"
                  >
                    Ver instrucciones de verificación
                  </button>
                  <button
                    type="button"
                    onClick={reenviarVerificacion}
                    disabled={resendingEmail}
                    className="w-full text-sm border border-yellow-600 text-yellow-600 py-2 px-3 rounded hover:bg-yellow-50 transition disabled:opacity-50"
                  >
                    {resendingEmail ? 'Reenviando...' : 'Reenviar email de verificación'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botón de Google */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogleButtonClick}
            disabled={loading || googleLoading || !googleReady}
            className={`w-full py-3 rounded-lg transition flex items-center justify-center gap-3 shadow-sm ${
              loading || googleLoading || !googleReady
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
            }`}
          >
            {googleLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? "Iniciando sesión con Google..." : 
             !googleReady ? "Cargando Google Sign-In..." :
             "Iniciar sesión con Google"}
          </button>

          {/* Botón de respaldo de Google */}
          <div id="google-fallback-login" style={{display: 'none'}} className="mt-2"></div>
          
          <p className="text-xs text-center text-gray-500 mt-2">
            Acceso rápido y seguro con tu cuenta de Google
          </p>
        </div>

        {/* Separador */}
        <div className="flex items-center mb-6">
          <hr className="flex-1 border-gray-300" />
          <span className="px-3 text-gray-500 text-sm">o ingresa con tu email</span>
          <hr className="flex-1 border-gray-300" />
        </div>

        {/* Formulario tradicional */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              name="email"
              placeholder="ejemplo@correo.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
              required
              disabled={loading || googleLoading}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              placeholder="Tu contraseña"
              value={formData.password}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
              required
              disabled={loading || googleLoading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className={`w-full py-3 rounded-lg font-semibold text-white transition duration-300 ${
              loading || googleLoading
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-700 hover:transform hover:scale-105'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Iniciando sesión...
              </span>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        {/* Enlaces de navegación */}
        <div className="mt-6 space-y-3 text-center">
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium hover:underline transition"
            disabled={loading || googleLoading}
          >
            ¿Olvidaste tu contraseña?
          </button>
          
          <div className="border-t pt-4">
            <p className="text-sm text-gray-600">
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => navigate("/registro")}
                className="text-purple-600 hover:text-purple-700 font-semibold hover:underline transition"
                disabled={loading || googleLoading}
              >
                Regístrate aquí
              </button>
            </p>
          </div>
        </div>

        {/* Debug info en desarrollo */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600">
            <p><strong>Debug Info:</strong></p>
            <p>Google Ready: {googleReady ? '✅' : '❌'}</p>
            <p>API URL: {API_URL}</p>
            <p>Verificación pendiente: {showVerificationMessage ? '⚠️' : '✅'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;