// Servidor principal Express + Socket.io
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');

const { config, validateConfig } = require('./config');
const TwitchClient = require('./twitchClient');
const EventSubHandler = require('./eventSubHandler');

class Server {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' ? 
          [`https://${process.env.RENDER_EXTERNAL_URL?.replace('https://', '')}`, 'https://obs.twitch.tv'] : "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });
    
    this.twitchClient = new TwitchClient();
    this.eventSubHandler = new EventSubHandler(this.io);
    this.connectedClients = new Map();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupErrorHandling();
  }

  /**
   * Configura middleware
   */
  setupMiddleware() {
    // Seguridad
    this.app.use(helmet({
      contentSecurityPolicy: false, // Necesario para servir archivos estáticos
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' ? 
        [`https://${process.env.RENDER_EXTERNAL_URL?.replace('https://', '')}`, 'https://obs.twitch.tv'] : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    // Parseo de JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Logging de requests (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
      });
    }
    
    // Servir archivos estáticos del frontend
    this.app.use(express.static(path.join(__dirname, '../../frontend'), {
      maxAge: '1d',
      etag: true
    }));
  }

  /**
   * Configura las rutas
   */
  setupRoutes() {
    // Ruta principal - redirige a configuración
    this.app.get('/', (req, res) => {
      res.redirect('/config.html');
    });

    // Ruta del overlay
    this.app.get('/overlay', (req, res) => {
      res.sendFile(path.join(__dirname, '../../frontend/overlay.html'));
    });

    // Ruta de configuración
    this.app.get('/config', (req, res) => {
      res.sendFile(path.join(__dirname, '../../frontend/config.html'));
    });

    // Rutas de autenticación con Twitch
    this.app.get('/auth/twitch', (req, res) => {
      const authUrl = this.twitchClient.getAuthUrl();
      res.redirect(authUrl);
    });

    this.app.get('/auth/callback', async (req, res) => {
      const { code, error, state } = req.query;
      
      if (error) {
        console.error('❌ Error en callback OAuth:', error);
        return res.redirect('/config.html?error=auth_failed&message=' + encodeURIComponent(error));
      }

      if (!code) {
        console.error('❌ No se recibió código de autorización');
        return res.redirect('/config.html?error=no_code');
      }

      try {
        const result = await this.twitchClient.exchangeCodeForTokens(code, state);
        
        if (result.success) {
          console.log('🔍 OBTENIENDO DATOS DEL USUARIO DIRECTAMENTE...');
          
          // Obtener datos del usuario directamente aquí para evitar el problema
          const accessToken = this.twitchClient.accessToken;
          const clientId = config.twitch.clientId;
          
          console.log('🔑 Access Token:', accessToken ? accessToken.substring(0, 10) + '...' : 'Ausente');
          console.log('🔑 Client ID:', clientId);
          
          if (!accessToken || !clientId) {
            throw new Error('Faltan credenciales para obtener datos del usuario');
          }
          
          // Hacer request directo a Twitch API
          const response = await axios.get(`${config.twitch.apiBaseUrl}/users`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Client-Id': clientId
            }
          });
          
          console.log('📊 Respuesta directa de Twitch:', response.data);
          
          if (!response.data.data || response.data.data.length === 0) {
            throw new Error('No se encontraron datos de usuario');
          }
          
          const userData = response.data.data[0];
          console.log('👤 Datos del usuario obtenidos:', userData);
          
          // Guardar datos directamente en twitchClient
          this.twitchClient.userInfo = userData;
          this.twitchClient.broadcasterId = userData.id;
          
          console.log('✅ Datos guardados directamente:', {
            userInfo: this.twitchClient.userInfo,
            broadcasterId: this.twitchClient.broadcasterId
          });
          
          // Obtener información completa del usuario y canal
          const completeInfo = await this.twitchClient.getCompleteUserInfo();
          
          // Verificar permisos para polls (solo si tenemos broadcaster_id)
          let hasPollPermissions = false;
          if (completeInfo.broadcasterId) {
            hasPollPermissions = await this.twitchClient.checkPollPermissions();
            
            if (!hasPollPermissions) {
              console.warn('⚠️ Usuario sin permisos para polls');
              return res.redirect('/config.html?error=no_permissions&message=' + 
                encodeURIComponent('Tu cuenta no tiene permisos para gestionar encuestas. Verifica que seas moderador o el dueño del canal.'));
            }
          } else {
            console.warn('⚠️ No se pudo obtener broadcaster ID');
            return res.redirect('/config.html?error=no_broadcaster_id&message=' + 
              encodeURIComponent('No se pudo obtener la información del canal. Intenta nuevamente.'));
          }
          
          // Actualizar broadcaster ID en EventSub
          const broadcasterId = this.twitchClient.getBroadcasterId();
          await this.eventSubHandler.updateBroadcasterId(broadcasterId);
          
          // Notificar a todos los clientes conectados
          this.io.emit('auth_success', {
            user: completeInfo.user,
            channel: completeInfo.channel,
            broadcasterId: completeInfo.broadcasterId,
            hasPollPermissions: hasPollPermissions
          });
          
          console.log('✅ Usuario autenticado completamente:', {
            user: completeInfo.user.display_name,
            channel: completeInfo.channel?.broadcaster_name || 'N/A',
            broadcasterId: completeInfo.broadcasterId
          });
          
          res.redirect('/config.html?success=auth_complete&user=' + 
            encodeURIComponent(result.user.display_name));
        } else {
          res.redirect('/config.html?error=auth_error&message=' + 
            encodeURIComponent(result.error));
        }
      } catch (error) {
        console.error('❌ Error procesando callback:', error.message);
        res.redirect('/config.html?error=callback_error&message=' + 
          encodeURIComponent('Error interno del servidor'));
      }
    });

    this.app.get('/auth/status', async (req, res) => {
      try {
        const isAuthenticated = this.twitchClient.isAuthenticated();
        const userInfo = this.twitchClient.getUserInfo();
        const tokenValid = isAuthenticated ? await this.twitchClient.validateToken() : false;
        const hasPollPermissions = tokenValid ? await this.twitchClient.checkPollPermissions() : false;
        
        let completeInfo = null;
        if (isAuthenticated && tokenValid) {
          try {
            completeInfo = await this.twitchClient.getCompleteUserInfo();
          } catch (error) {
            console.warn('⚠️ Error obteniendo información completa:', error.message);
          }
        }
        
        res.json({
          authenticated: isAuthenticated && tokenValid,
          user: userInfo,
          channel: completeInfo?.channel || null,
          broadcasterId: completeInfo?.broadcasterId || null,
          eventSubConnected: this.eventSubHandler.isConnectedToEventSub(),
          hasPollPermissions: hasPollPermissions,
          tokenExpired: isAuthenticated && !tokenValid
        });
      } catch (error) {
        console.error('❌ Error obteniendo estado de auth:', error.message);
        res.status(500).json({
          authenticated: false,
          error: 'Error interno del servidor'
        });
      }
    });

    this.app.post('/auth/disconnect', (req, res) => {
      try {
        this.twitchClient.clearTokens();
        
        // Notificar a todos los clientes conectados
        this.io.emit('auth_disconnected');
        
        res.json({ success: true, message: 'Desconectado exitosamente' });
      } catch (error) {
        console.error('❌ Error desconectando:', error.message);
        res.status(500).json({ success: false, error: 'Error desconectando' });
      }
    });

    // Ruta de salud del servidor
    this.app.get('/health', async (req, res) => {
      try {
        const isAuthenticated = this.twitchClient.isAuthenticated();
        const tokenValid = isAuthenticated ? await this.twitchClient.validateToken() : false;
        
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          twitchAuthenticated: isAuthenticated && tokenValid,
          eventSubConnected: this.eventSubHandler.isConnectedToEventSub(),
          connectedClients: this.connectedClients.size,
          version: require('../package.json').version
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Ruta para obtener estadísticas
    this.app.get('/stats', (req, res) => {
      res.json({
        connectedClients: this.connectedClients.size,
        clients: Array.from(this.connectedClients.values()),
        eventSubConnected: this.eventSubHandler.isConnectedToEventSub(),
        twitchAuthenticated: this.twitchClient.isAuthenticated(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });

    // Ruta para simular encuesta (solo en desarrollo)
    this.app.post('/simulate-poll', (req, res) => {
      if (config.server.nodeEnv !== 'development') {
        return res.status(403).json({ error: 'Solo disponible en desarrollo' });
      }
      
      this.io.emit('poll_event', {
        type: 'poll_begin',
        data: {
          id: 'simulation-' + Date.now(),
          title: req.body.title || '¿Cuál es tu color favorito? (Simulación)',
          choices: req.body.choices || [
            { id: '1', title: 'Rosa', votes: 45 },
            { id: '2', title: 'Azul', votes: 32 },
            { id: '3', title: 'Verde', votes: 28 },
            { id: '4', title: 'Morado', votes: 15 }
          ],
          started_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 300000).toISOString(),
          status: 'active'
        }
      });
      
      res.json({ success: true, message: 'Encuesta simulada enviada' });
    });

    // Ruta para test simple del overlay
    this.app.get('/test-simple', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Test Simple Overlay</title>
            <script src="/socket.io/socket.io.js"></script>
            <style>
              body {
                font-family: Arial, sans-serif;
                background: #f0f0f0;
                margin: 0;
                padding: 20px;
              }
              .test-container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              }
              .overlay-test {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 255, 255, 0.95);
                border: 2px solid #ec4899;
                border-radius: 20px;
                padding: 30px;
                max-width: 400px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                z-index: 1000;
              }
              .overlay-test.hidden {
                display: none;
              }
              .poll-title {
                font-size: 24px;
                font-weight: bold;
                color: #374151;
                margin-bottom: 20px;
                text-align: center;
              }
              .poll-option {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 15px;
                margin-bottom: 10px;
              }
              .option-text {
                font-weight: 600;
                margin-bottom: 8px;
              }
              .progress-bar {
                background: #ec4899;
                height: 8px;
                border-radius: 4px;
                margin-bottom: 5px;
                transition: width 0.5s ease;
              }
              .option-stats {
                display: flex;
                justify-content: space-between;
                font-size: 14px;
                color: #6b7280;
              }
              button {
                background: #ec4899;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                margin: 10px;
              }
              button:hover {
                background: #be185d;
              }
            </style>
          </head>
          <body>
            <div class="test-container">
              <h1>🧪 Test Simple del Overlay</h1>
              <p>Esta es una versión simplificada para diagnosticar problemas:</p>
              <button onclick="showTestPoll()">🚀 Mostrar Encuesta de Prueba</button>
              <button onclick="hideTestPoll()">❌ Ocultar Overlay</button>
              <button onclick="simulateRealPoll()">🎮 Simular Encuesta Real</button>
              <div id="logs" style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; font-family: monospace; font-size: 12px;">
                <strong>Logs:</strong><br />
                <div id="log-content"></div>
              </div>
            </div>
            <div id="test-overlay" class="overlay-test hidden">
              <div class="poll-title" id="test-title">¿Cuál es tu color favorito?</div>
              <div id="test-options">
                <div class="poll-option">
                  <div class="option-text">Rosa</div>
                  <div class="progress-bar" style="width: 45%"></div>
                  <div class="option-stats">
                    <span>45 votos</span>
                    <span>45%</span>
                  </div>
                </div>
                <div class="poll-option">
                  <div class="option-text">Azul</div>
                  <div class="progress-bar" style="width: 32%"></div>
                  <div class="option-stats">
                    <span>32 votos</span>
                    <span>32%</span>
                  </div>
                </div>
                <div class="poll-option">
                  <div class="option-text">Verde</div>
                  <div class="progress-bar" style="width: 28%"></div>
                  <div class="option-stats">
                    <span>28 votos</span>
                    <span>28%</span>
                  </div>
                </div>
              </div>
            </div>
            <script>
              const socket = io();
              const logContent = document.getElementById("log-content");
              const testOverlay = document.getElementById("test-overlay");
              function log(message) {
                const timestamp = new Date().toLocaleTimeString();
                logContent.innerHTML += \`[\${timestamp}] \${message}<br>\`;
                logContent.scrollTop = logContent.scrollHeight;
                console.log(message);
              }
              function showTestPoll() {
                log("🚀 Mostrando encuesta de prueba...");
                testOverlay.classList.remove("hidden");
                log("✅ Overlay visible");
              }
              function hideTestPoll() {
                log("❌ Ocultando overlay...");
                testOverlay.classList.add("hidden");
                log("✅ Overlay oculto");
              }
              function simulateRealPoll() {
                log("🎮 Simulando encuesta real...");
                fetch("/simulate-poll", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "begin" }),
                })
                  .then((response) => response.json())
                  .then((data) => {
                    log("✅ Simulación enviada: " + JSON.stringify(data));
                  })
                  .catch((error) => {
                    log("❌ Error: " + error.message);
                  });
              }
              socket.on("connect", () => {
                log("🔌 Conectado al servidor");
              });
              socket.on("disconnect", () => {
                log("🔌 Desconectado del servidor");
              });
              socket.on("poll_event", (event) => {
                log("📊 Evento recibido: " + event.type);
                log("📊 Datos: " + JSON.stringify(event.data, null, 2));
              });
              socket.on("server_status", (status) => {
                log("📡 Estado del servidor: " + JSON.stringify(status));
              });
              log("🧪 Test Simple iniciado");
            </script>
          </body>
        </html>
      `);
    });

    // Ruta para probar el overlay directamente
    this.app.get('/test-overlay', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Overlay</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px; 
              background: #f0f0f0;
            }
            .test-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            button {
              background: #ec4899;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              margin: 10px;
              font-size: 16px;
            }
            button:hover {
              background: #be185d;
            }
            iframe {
              width: 100%;
              height: 600px;
              border: 2px solid #ec4899;
              border-radius: 10px;
              margin-top: 20px;
              background: #1a1a1a;
            }
            .overlay-preview {
              position: relative;
              background: #1a1a1a;
              border-radius: 10px;
              overflow: hidden;
            }
          </style>
        </head>
        <body>
          <div class="test-container">
            <h1>🎮 Test del Overlay de Encuestas</h1>
            <p>Haz clic en los botones para simular diferentes eventos de encuesta:</p>
            
            <button onclick="simulatePoll('begin')">🚀 Iniciar Encuesta</button>
            <button onclick="simulatePoll('progress')">📊 Actualizar Votos</button>
            <button onclick="simulatePoll('end')">🏆 Finalizar Encuesta</button>
            <button onclick="simulatePoll('full')">🎬 Ciclo Completo</button>
            
            <div class="overlay-preview">
              <iframe id="overlay-frame" src="/overlay.html"></iframe>
            </div>
          </div>
          
          <script>
            function simulatePoll(type) {
              fetch('/simulate-poll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: type })
              })
              .then(response => response.json())
              .then(data => {
                console.log('Simulación enviada:', data);
              })
              .catch(error => {
                console.error('Error:', error);
              });
            }
            
            // Simular ciclo completo automáticamente cada 30 segundos
            setInterval(() => {
              console.log('🔄 Simulando ciclo completo automático...');
              simulatePoll('full');
            }, 30000);
          </script>
        </body>
        </html>
      `);
    });

    // Endpoint de prueba para diagnosticar Twitch API
    this.app.get('/test-twitch', async (req, res) => {
      try {
        console.log('🧪 Iniciando prueba de Twitch API...');
        
        // Verificar si tenemos tokens
        if (!this.twitchClient.accessToken) {
          return res.json({ 
            error: 'No hay token de acceso disponible',
            authenticated: false 
          });
        }
        
        console.log('🔑 Token disponible:', this.twitchClient.accessToken ? 'Sí' : 'No');
        console.log('🔑 Client ID:', config.twitch.clientId ? 'Sí' : 'No');
        console.log('👤 User Info actual:', this.twitchClient.userInfo);
        console.log('🆔 Broadcaster ID actual:', this.twitchClient.broadcasterId);
        
        // Probar getUserInfo directamente
        console.log('🧪 Probando getUserInfo() directamente...');
        try {
          await this.twitchClient.getUserInfo();
          console.log('✅ getUserInfo() ejecutado exitosamente');
          console.log('👤 User Info después:', this.twitchClient.userInfo);
          console.log('🆔 Broadcaster ID después:', this.twitchClient.broadcasterId);
        } catch (error) {
          console.error('❌ Error en getUserInfo():', error.message);
          console.error('❌ Stack trace:', error.stack);
        }
        
        // Hacer una llamada directa a la API de Twitch
        const axios = require('axios');
        const response = await axios.get(`${config.twitch.apiBaseUrl}/users`, {
          headers: {
            'Authorization': `Bearer ${this.twitchClient.accessToken}`,
            'Client-Id': config.twitch.clientId
          }
        });
        
        console.log('📊 Respuesta de Twitch API:', response.data);
        
        // También intentar guardar los datos como lo haría getUserInfo()
        if (response.data.data && response.data.data.length > 0) {
          this.twitchClient.userInfo = response.data.data[0];
          this.twitchClient.broadcasterId = response.data.data[0].id;
          console.log('💾 Datos guardados en twitchClient:', {
            userInfo: this.twitchClient.userInfo,
            broadcasterId: this.twitchClient.broadcasterId
          });
        }
        
        res.json({
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers,
          savedToClient: {
            userInfo: this.twitchClient.userInfo,
            broadcasterId: this.twitchClient.broadcasterId
          }
        });
        
      } catch (error) {
        console.error('❌ Error en prueba de Twitch API:', error.response?.data || error.message);
        console.error('❌ Status:', error.response?.status);
        console.error('❌ Headers:', error.response?.headers);
        
        res.json({
          success: false,
          error: error.response?.data || error.message,
          status: error.response?.status,
          headers: error.response?.headers
        });
      }
    });
  }

  /**
   * Configura los manejadores de Socket.io
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('🔌 Cliente conectado:', socket.id);
      
      // Registrar cliente
      this.connectedClients.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
      });
      
      // Enviar estado actual al cliente
      this.sendServerStatus(socket);
      
      // Manejar eventos del cliente
      socket.on('get_status', () => {
        this.sendServerStatus(socket);
      });

      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      socket.on('request_poll_simulation', () => {
        this.simulatePollEvent(socket);
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 Cliente desconectado:', socket.id, 'Razón:', reason);
        this.connectedClients.delete(socket.id);
      });

      socket.on('error', (error) => {
        console.error('❌ Error en socket:', socket.id, error);
      });
    });

    // Manejar errores de Socket.io
    this.io.on('error', (error) => {
      console.error('❌ Error de Socket.io:', error);
    });
  }

  /**
   * Envía el estado del servidor a un socket específico
   */
  async sendServerStatus(socket) {
    try {
      const isAuthenticated = this.twitchClient.isAuthenticated();
      const userInfo = this.twitchClient.getUserInfo();
      const tokenValid = isAuthenticated ? await this.twitchClient.validateToken() : false;
      const hasPollPermissions = tokenValid ? await this.twitchClient.checkPollPermissions() : false;
      
      let completeInfo = null;
      if (isAuthenticated && tokenValid) {
        try {
          completeInfo = await this.twitchClient.getCompleteUserInfo();
        } catch (error) {
          console.warn('⚠️ Error obteniendo información completa:', error.message);
        }
      }
      
      const status = {
        authenticated: isAuthenticated && tokenValid,
        user: userInfo,
        channel: completeInfo?.channel || null,
        broadcasterId: completeInfo?.broadcasterId || null,
        eventSubConnected: this.eventSubHandler.isConnectedToEventSub(),
        hasPollPermissions: hasPollPermissions,
        tokenExpired: isAuthenticated && !tokenValid,
        connectedClients: this.connectedClients.size,
        serverTime: new Date().toISOString()
      };
      
      socket.emit('server_status', status);
    } catch (error) {
      console.error('❌ Error enviando estado del servidor:', error.message);
      socket.emit('server_error', { error: 'Error interno del servidor' });
    }
  }

  /**
   * Simula un evento de encuesta para testing
   */
  simulatePollEvent(socket) {
    const mockPoll = {
      type: 'poll_begin',
      data: {
        id: 'simulation-' + Date.now(),
        title: '¿Cuál es tu color favorito? (Simulación)',
        choices: [
          { id: '1', title: 'Rosa', votes: 45 },
          { id: '2', title: 'Azul', votes: 32 },
          { id: '3', title: 'Verde', votes: 28 },
          { id: '4', title: 'Morado', votes: 15 }
        ],
        started_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 300000).toISOString(),
        status: 'active'
      }
    };

    console.log('🎭 Simulando evento de encuesta para:', socket.id);
    socket.emit('poll_event', mockPoll);
    
    // Simular progreso después de 2 segundos
    setTimeout(() => {
      const progressPoll = {
        type: 'poll_progress',
        data: {
          ...mockPoll.data,
          choices: [
            { id: '1', title: 'Rosa', votes: 67 },
            { id: '2', title: 'Azul', votes: 45 },
            { id: '3', title: 'Verde', votes: 38 },
            { id: '4', title: 'Morado', votes: 22 }
          ]
        }
      };
      socket.emit('poll_event', progressPoll);
    }, 2000);

    // Simular finalización después de 5 segundos
    setTimeout(() => {
      const endPoll = {
        type: 'poll_end',
        data: {
          ...mockPoll.data,
          choices: [
            { id: '1', title: 'Rosa', votes: 89 },
            { id: '2', title: 'Azul', votes: 67 },
            { id: '3', title: 'Verde', votes: 54 },
            { id: '4', title: 'Morado', votes: 34 }
          ],
          status: 'completed'
        }
      };
      socket.emit('poll_event', endPoll);
    }, 5000);
  }

  /**
   * Configura el manejo de errores
   */
  setupErrorHandling() {
    // Manejo de errores 404
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint no encontrado',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Manejo de errores generales
    this.app.use((error, req, res, next) => {
      console.error('❌ Error del servidor:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: config.server.nodeEnv === 'development' ? error.message : 'Algo salió mal',
        timestamp: new Date().toISOString()
      });
    });

    // Manejo de errores no capturados
    process.on('uncaughtException', (error) => {
      console.error('❌ Excepción no capturada:', error);
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Promesa rechazada no manejada:', reason);
      this.gracefulShutdown();
    });
  }

  /**
   * Cierre graceful del servidor
   */
  async gracefulShutdown() {
    console.log('🛑 Iniciando cierre graceful del servidor...');
    
    // Cerrar EventSub
    this.eventSubHandler.close();
    
    // Cerrar Socket.io
    this.io.close();
    
    // Cerrar servidor HTTP
    this.server.close(() => {
      console.log('✅ Servidor cerrado correctamente');
      process.exit(0);
    });
    
    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      console.error('❌ Forzando cierre del servidor');
      process.exit(1);
    }, 10000);
  }

  /**
   * Inicia el servidor
   */
  async start() {
    try {
      // Validar configuración
      validateConfig();
      
      // Conectar a EventSub
      await this.eventSubHandler.connect();
      
      // Iniciar servidor
      const port = process.env.PORT || config.server.port;
      this.server.listen(port, '0.0.0.0', () => {
        console.log('🚀 Servidor iniciado exitosamente');
        console.log('═'.repeat(60));
        console.log(`📡 Puerto: ${port}`);
        console.log(`🌐 URL Principal: http://localhost:${port}`);
        console.log(`⚙️ Panel Configuración: http://localhost:${port}/config`);
        console.log(`📺 Overlay OBS: http://localhost:${port}/overlay`);
        console.log(`🏥 Health Check: http://localhost:${port}/health`);
        console.log(`📊 Estadísticas: http://localhost:${port}/stats`);
        console.log('═'.repeat(60));
        console.log('📋 Configuración para OBS:');
        console.log(`   • Tipo: Browser Source`);
        console.log(`   • URL: http://localhost:${port}/overlay`);
        console.log(`   • Dimensiones: 1920x1080`);
        console.log(`   • FPS: 30`);
        console.log(`   • Marcar: "Shutdown source when not visible"`);
        console.log('═'.repeat(60));
        console.log('🎮 Para probar:');
        console.log(`   • Conecta con Twitch en: http://localhost:${port}/config`);
        console.log(`   • Usa el comando /poll en tu chat de Twitch`);
        console.log(`   • El overlay se actualizará automáticamente`);
        console.log('═'.repeat(60));
      });
      
    } catch (error) {
      console.error('❌ Error iniciando servidor:', error.message);
      process.exit(1);
    }
  }

  /**
   * Cierra el servidor
   */
  async stop() {
    await this.gracefulShutdown();
  }
}

// Manejo de señales del sistema
process.on('SIGINT', async () => {
  console.log('\n🛑 Recibida señal SIGINT (Ctrl+C)');
  if (global.server) {
    await global.server.stop();
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recibida señal SIGTERM');
  if (global.server) {
    await global.server.stop();
  }
});

process.on('SIGHUP', async () => {
  console.log('\n🔄 Recibida señal SIGHUP (reload)');
  // En producción, podrías implementar reload sin cerrar
  if (global.server) {
    await global.server.stop();
  }
});

// Crear e iniciar servidor
const server = new Server();
global.server = server;
server.start();

module.exports = Server;
