// Manejador de EventSub WebSocket para polls de Twitch
const WebSocket = require('ws');
const { config } = require('./config');

class EventSubHandler {
  constructor(socketIo) {
    this.socketIo = socketIo;
    this.ws = null;
    this.sessionId = null;
    this.pendingBroadcasterId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 segundo
    this.isConnected = false;
  }

  /**
   * Conecta al EventSub WebSocket de Twitch
   */
  async connect() {
    try {
      console.log('🔌 Conectando a Twitch EventSub WebSocket...');
      
      this.ws = new WebSocket(config.twitch.eventSubWebSocketUrl);
      
      this.ws.on('open', () => {
        console.log('✅ Conectado a Twitch EventSub WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 Conexión cerrada: ${code} - ${reason}`);
        this.isConnected = false;
        this.handleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('❌ Error en WebSocket:', error.message);
        this.isConnected = false;
      });

    } catch (error) {
      console.error('❌ Error conectando a EventSub:', error.message);
      this.handleReconnect();
    }
  }

  /**
   * Maneja los mensajes recibidos del WebSocket
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.metadata.message_type) {
        case 'session_welcome':
          this.handleSessionWelcome(message);
          break;
        case 'session_keepalive':
          // Mantener conexión viva
          break;
        case 'notification':
          this.handleNotification(message);
          break;
        case 'session_reconnect':
          this.handleReconnect(message.payload.session.reconnect_url);
          break;
        default:
          console.log('📨 Mensaje no manejado:', message.metadata.message_type);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje:', error.message);
    }
  }

  /**
   * Maneja el mensaje de bienvenida de la sesión
   */
  handleSessionWelcome(message) {
    this.sessionId = message.payload.session.id;
    console.log(`🎉 Sesión EventSub iniciada: ${this.sessionId}`);
    
    // Si hay un broadcaster ID pendiente, suscribirse ahora
    if (this.pendingBroadcasterId) {
      console.log(`📡 Suscribiéndose con broadcaster ID pendiente: ${this.pendingBroadcasterId}`);
      this.subscribeToPollEvents(this.pendingBroadcasterId);
      this.pendingBroadcasterId = null;
    } else {
    }
  }

  /**
   * Suscribe a los eventos de polls
   */
  async subscribeToPollEvents(broadcasterId = null) {
    if (!this.sessionId) {
      return;
    }

    if (!broadcasterId) {
      return;
    }

    const events = [
      'channel.poll.begin',
      'channel.poll.progress', 
      'channel.poll.end'
    ];

    console.log(`📡 Suscribiéndose a eventos de polls para broadcaster: ${broadcasterId}`);

    for (const eventType of events) {
      await this.subscribeToEvent(eventType, broadcasterId);
    }
  }

  /**
   * Suscribe a un evento específico
   */
  async subscribeToEvent(eventType, broadcasterId) {
    try {
      const subscription = {
        type: eventType,
        version: '1',
        condition: {
          broadcaster_user_id: broadcasterId
        },
        transport: {
          method: 'websocket',
          session_id: this.sessionId
        }
      };

      // Enviar suscripción
      this.ws.send(JSON.stringify({
        type: 'session.subscribe',
        data: subscription
      }));

      console.log(`📡 Suscrito a evento: ${eventType} para broadcaster: ${broadcasterId}`);
    } catch (error) {
      console.error(`❌ Error suscribiéndose a ${eventType}:`, error.message);
    }
  }

  /**
   * Maneja las notificaciones de eventos
   */
  handleNotification(message) {
    const { subscription, event } = message.payload;
    
    console.log(`📊 Evento recibido: ${subscription.type}`);
    
    // Procesar según el tipo de evento
    switch (subscription.type) {
      case 'channel.poll.begin':
        this.handlePollBegin(event);
        break;
      case 'channel.poll.progress':
        this.handlePollProgress(event);
        break;
      case 'channel.poll.end':
        this.handlePollEnd(event);
        break;
    }
  }

  /**
   * Maneja el inicio de una encuesta
   */
  handlePollBegin(event) {
    const pollData = {
      type: 'poll_begin',
      data: {
        id: event.id,
        title: event.title,
        choices: event.choices.map(choice => ({
          id: choice.id,
          title: choice.title,
          votes: choice.votes
        })),
        started_at: event.started_at,
        ends_at: event.ends_at,
        status: 'active'
      }
    };

    console.log('🗳️ Nueva encuesta iniciada:', event.title);
    this.socketIo.emit('poll_event', pollData);
  }

  /**
   * Maneja el progreso de una encuesta
   */
  handlePollProgress(event) {
    const pollData = {
      type: 'poll_progress',
      data: {
        id: event.id,
        title: event.title,
        choices: event.choices.map(choice => ({
          id: choice.id,
          title: choice.title,
          votes: choice.votes
        })),
        started_at: event.started_at,
        ends_at: event.ends_at,
        status: 'active'
      }
    };

    console.log('📈 Progreso de encuesta actualizado:', event.title);
    this.socketIo.emit('poll_event', pollData);
  }

  /**
   * Maneja el final de una encuesta
   */
  handlePollEnd(event) {
    const pollData = {
      type: 'poll_end',
      data: {
        id: event.id,
        title: event.title,
        choices: event.choices.map(choice => ({
          id: choice.id,
          title: choice.title,
          votes: choice.votes
        })),
        started_at: event.started_at,
        ends_at: event.ends_at,
        status: 'completed'
      }
    };

    console.log('🏁 Encuesta finalizada:', event.title);
    this.socketIo.emit('poll_event', pollData);
  }

  /**
   * Maneja la reconexión
   */
  handleReconnect(reconnectUrl = null) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Máximo de intentos de reconexión alcanzado');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (reconnectUrl) {
        this.connectToUrl(reconnectUrl);
      } else {
        this.connect();
      }
    }, delay);
  }

  /**
   * Conecta a una URL específica de reconexión
   */
  connectToUrl(url) {
    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('❌ Error en reconexión:', error.message);
      this.handleReconnect();
    }
  }

  /**
   * Configura los manejadores de eventos del WebSocket
   */
  setupEventHandlers() {
    this.ws.on('open', () => {
      console.log('✅ Reconectado a Twitch EventSub');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`🔌 Conexión cerrada: ${code} - ${reason}`);
      this.isConnected = false;
      this.handleReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('❌ Error en WebSocket:', error.message);
      this.isConnected = false;
    });
  }

  /**
   * Actualiza el broadcaster ID para las suscripciones
   */
  async updateBroadcasterId(broadcasterId) {
    if (!broadcasterId) {
      console.error('❌ No se proporcionó broadcaster ID');
      return;
    }

    console.log(`🔄 Actualizando broadcaster ID: ${broadcasterId}`);
    
    // Si ya tenemos una sesión activa, suscribirse inmediatamente
    if (this.sessionId && this.isConnected) {
      await this.subscribeToPollEvents(broadcasterId);
    } else {
      // Guardar para cuando se conecte la sesión
      this.pendingBroadcasterId = broadcasterId;
    }
  }

  /**
   * Verifica si está conectado
   */
  isConnectedToEventSub() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Cierra la conexión
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.isConnected = false;
    }
  }
}

module.exports = EventSubHandler;
