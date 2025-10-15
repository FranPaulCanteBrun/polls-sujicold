// Cliente WebSocket compartido para overlay y configuración
class SocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventHandlers = new Map();
  }

  /**
   * Conecta al servidor Socket.io
   */
  connect() {
    try {
      this.socket = io();
      
      this.socket.on('connect', () => {
        console.log('🔌 Conectado al servidor');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('socket_connected');
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Desconectado del servidor');
        this.isConnected = false;
        this.emit('socket_disconnected');
        this.handleReconnect();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Error de conexión:', error);
        this.isConnected = false;
        this.emit('socket_error', error);
      });

      // Escuchar eventos del servidor
      this.socket.on('server_status', (status) => {
        console.log('📊 Estado del servidor recibido:', status);
        this.emit('server_status', status);
      });

      this.socket.on('poll_event', (event) => {
        console.log('📊 Evento de encuesta recibido:', event);
        this.emit('poll_event', event);
      });

      // Manejar eventos personalizados
      this.socket.onAny((eventName, ...args) => {
        this.emit(eventName, ...args);
      });

    } catch (error) {
      console.error('❌ Error inicializando Socket.io:', error);
      this.handleReconnect();
    }
  }

  /**
   * Maneja la reconexión automática
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Máximo de intentos de reconexión alcanzado');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Emite un evento personalizado
   */
  emit(eventName, ...args) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`❌ Error en handler de ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Registra un handler para un evento
   */
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
  }

  /**
   * Remueve un handler de un evento
   */
  off(eventName, handler) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Envía un mensaje al servidor
   */
  send(eventName, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(eventName, data);
    } else {
      console.warn('⚠️ Socket no conectado, no se puede enviar:', eventName);
    }
  }

  /**
   * Solicita el estado del servidor
   */
  requestStatus() {
    this.send('get_status');
  }

  /**
   * Verifica si está conectado
   */
  isSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected;
  }

  /**
   * Desconecta el socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }
}

// Crear instancia global
window.socketClient = new SocketClient();

// Auto-conectar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  window.socketClient.connect();
});
