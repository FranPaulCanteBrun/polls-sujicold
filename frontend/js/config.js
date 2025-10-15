// Panel de configuración del overlay
class ConfigPanel {
  constructor() {
    this.config = this.loadConfig();
    this.isConnected = false;
    this.userInfo = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.loadUI();
    this.updateConnectionStatus();
  }

  /**
   * Inicializa los elementos del DOM
   */
  initializeElements() {
    this.elements = {
      connectionStatus: document.getElementById('connection-status'),
      statusContent: document.getElementById('status-content'),
      twitchAuthSection: document.getElementById('twitch-auth-section'),
      overlayUrl: document.getElementById('overlay-url'),
      copyUrlBtn: document.getElementById('copy-url'),
      saveConfigBtn: document.getElementById('save-config'),
      resetConfigBtn: document.getElementById('reset-config'),
      previewBtn: document.getElementById('preview-overlay')
    };
  }

  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    // Socket events
    window.socketClient.on('server_status', (status) => {
      console.log('📊 Panel recibió estado del servidor:', status);
      this.updateServerStatus(status);
    });

    window.socketClient.on('socket_connected', () => {
      this.updateConnectionStatus();
    });

    window.socketClient.on('socket_disconnected', () => {
      this.updateConnectionStatus();
    });

    window.socketClient.on('auth_success', (data) => {
      console.log('✅ Autenticación exitosa:', data);
      this.isConnected = true;
      this.userInfo = data.user;
      this.serverStatus = {
        ...this.serverStatus,
        hasPollPermissions: data.hasPollPermissions
      };
      this.updateTwitchAuthSection();
      this.showNotification(`✅ Conectado como ${data.user.display_name}`, 'success');
    });

    window.socketClient.on('auth_disconnected', () => {
      console.log('🔌 Desconectado de Twitch');
      this.isConnected = false;
      this.userInfo = null;
      this.serverStatus = null;
      this.updateTwitchAuthSection();
      this.showNotification('🔌 Desconectado de Twitch', 'info');
    });

    // Botones de acción
    this.elements.saveConfigBtn.addEventListener('click', () => {
      this.saveConfig();
    });

    this.elements.resetConfigBtn.addEventListener('click', () => {
      this.resetConfig();
    });

    this.elements.copyUrlBtn.addEventListener('click', () => {
      this.copyOverlayUrl();
    });

    this.elements.previewBtn.addEventListener('click', () => {
      this.previewOverlay();
    });

    // Event listeners para controles de configuración
    this.setupConfigEventListeners();

    // Configuración de colores
    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectColorPreset(e.target.closest('.color-preset'));
      });
    });

    // Sliders
    this.setupSliders();

    // Radio buttons
    document.querySelectorAll('input[name="position"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.config.position = e.target.value;
      });
    });

    // Checkboxes
    document.getElementById('enable-confetti').addEventListener('change', (e) => {
      this.config.enableConfetti = e.target.checked;
    });
  }

  /**
   * Configura los sliders
   */
  setupSliders() {
    const sliders = [
      { id: 'background-opacity', key: 'backgroundOpacity', display: 'opacity-value', suffix: '%' },
      { id: 'padding', key: 'padding', display: 'padding-value', suffix: 'px' },
      { id: 'animation-duration', key: 'animationDuration', display: 'duration-value', suffix: 's' },
      { id: 'hide-delay', key: 'hideDelay', display: 'delay-value', suffix: 's' },
      { id: 'font-size', key: 'fontSize', display: 'font-size-value', suffix: 'px' }
    ];

    sliders.forEach(slider => {
      const element = document.getElementById(slider.id);
      const display = document.getElementById(slider.display);
      
      element.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        this.config[slider.key] = value;
        display.textContent = `${value}${slider.suffix}`;
      });
    });
  }

  /**
   * Actualiza el estado de conexión
   */
  updateConnectionStatus() {
    const isConnected = window.socketClient.isSocketConnected();
    
    if (isConnected) {
      this.elements.statusContent.innerHTML = `
        <div class="flex items-center text-green-600">
          <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
          <span class="font-medium">Conectado al servidor</span>
        </div>
      `;
    } else {
      this.elements.statusContent.innerHTML = `
        <div class="flex items-center text-red-600">
          <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
          <span class="font-medium">Desconectado del servidor</span>
        </div>
      `;
    }
  }

  /**
   * Actualiza el estado del servidor
   */
  updateServerStatus(status) {
    console.log('📊 Actualizando estado del servidor:', status);
    this.serverStatus = status;
    this.isConnected = status.authenticated;
    this.userInfo = status.user;
    
    this.updateTwitchAuthSection();
    this.updateConnectionStatus();
  }

  /**
   * Actualiza la sección de autenticación de Twitch
   */
  updateTwitchAuthSection() {
    if (this.isConnected && this.userInfo) {
      const hasPollPermissions = this.serverStatus?.hasPollPermissions || false;
      const eventSubConnected = this.serverStatus?.eventSubConnected || false;
      const channelInfo = this.serverStatus?.channel || null;
      const broadcasterId = this.serverStatus?.broadcasterId || null;
      
      this.elements.twitchAuthSection.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center text-green-600">
            <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span class="font-medium">Conectado como: ${this.userInfo.display_name}</span>
          </div>
          <div class="text-sm text-gray-600">
            Usuario: ${this.userInfo.login}
          </div>
          ${channelInfo ? `
            <div class="text-sm text-gray-600">
              Canal: ${channelInfo.broadcaster_name}
            </div>
            <div class="text-sm text-gray-600">
              Título: ${channelInfo.title || 'Sin título'}
            </div>
            <div class="text-sm text-gray-600">
              Juego: ${channelInfo.game_name || 'Sin juego'}
            </div>
          ` : ''}
          ${broadcasterId ? `
            <div class="text-sm text-gray-500 font-mono">
              ID: ${broadcasterId}
            </div>
          ` : ''}
          <div class="text-sm ${hasPollPermissions ? 'text-green-600' : 'text-red-600'}">
            Permisos de encuestas: ${hasPollPermissions ? '✅ Autorizado' : '❌ Sin permisos'}
          </div>
          <div class="text-sm ${eventSubConnected ? 'text-green-600' : 'text-orange-600'}">
            EventSub: ${eventSubConnected ? '✅ Conectado' : '⚠️ Conectando...'}
          </div>
          ${!hasPollPermissions ? `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p class="text-sm text-yellow-800">
                <strong>⚠️ Sin permisos:</strong> Tu cuenta no tiene permisos para gestionar encuestas. 
                Asegúrate de ser moderador o el dueño del canal.
              </p>
            </div>
          ` : ''}
          <button id="disconnect-twitch" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm">
            Desconectar
          </button>
        </div>
      `;
      
      // Event listener para desconectar
      document.getElementById('disconnect-twitch').addEventListener('click', () => {
        this.disconnectTwitch();
      });
    } else {
      this.elements.twitchAuthSection.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center text-red-600">
            <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span class="font-medium">No conectado a Twitch</span>
          </div>
          <p class="text-sm text-gray-600">
            Conecta tu cuenta de Twitch para sincronizar las encuestas automáticamente.
          </p>
          <a href="/auth/twitch" class="inline-block px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm">
            🔗 Conectar con Twitch
          </a>
        </div>
      `;
    }
  }

  /**
   * Desconecta de Twitch
   */
  async disconnectTwitch() {
    try {
      console.log('🔌 Desconectando de Twitch...');
      
      const response = await fetch('/auth/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.showNotification('✅ Desconectado exitosamente', 'success');
        // Actualizar estado local
        this.isConnected = false;
        this.userInfo = null;
        this.serverStatus = null;
        this.updateTwitchAuthSection();
      } else {
        this.showNotification('❌ Error desconectando: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('❌ Error desconectando:', error);
      this.showNotification('❌ Error desconectando', 'error');
    }
  }

  /**
   * Selecciona una paleta de colores
   */
  selectColorPreset(button) {
    const preset = button.dataset.preset;
    const colors = JSON.parse(button.dataset.colors);
    
    this.config.colorPreset = preset;
    this.config.customColors = colors;
    
    // Actualizar UI
    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.classList.remove('ring-2', 'ring-blue-500');
    });
    button.classList.add('ring-2', 'ring-blue-500');
    
    console.log('🎨 Paleta seleccionada:', preset);
  }

  /**
   * Guarda la configuración
   */
  saveConfig() {
    try {
      localStorage.setItem('pollOverlayConfig', JSON.stringify(this.config));
      
      // Mostrar notificación de éxito
      this.showNotification('✅ Configuración guardada', 'success');
      
      // Actualizar overlay si está abierto
      if (window.pollOverlay) {
        window.pollOverlay.config = this.config;
        window.pollOverlay.applyConfig();
      }
      
      console.log('💾 Configuración guardada:', this.config);
    } catch (error) {
      console.error('❌ Error guardando configuración:', error);
      this.showNotification('❌ Error guardando configuración', 'error');
    }
  }

  /**
   * Restablece la configuración
   */
  resetConfig() {
    if (confirm('¿Estás seguro de que quieres restablecer toda la configuración?')) {
      localStorage.removeItem('pollOverlayConfig');
      this.config = this.loadConfig();
      this.loadUI();
      this.showNotification('🔄 Configuración restablecida', 'info');
    }
  }

  /**
   * Copia la URL del overlay
   */
  copyOverlayUrl() {
    const url = `${window.location.origin}/overlay`;
    this.elements.overlayUrl.value = url;
    
    navigator.clipboard.writeText(url).then(() => {
      this.showNotification('📋 URL copiada al portapapeles', 'success');
    }).catch(() => {
      // Fallback para navegadores que no soportan clipboard API
      this.elements.overlayUrl.select();
      document.execCommand('copy');
      this.showNotification('📋 URL copiada al portapapeles', 'success');
    });
  }

  /**
   * Muestra una vista previa del overlay
   */
  previewOverlay() {
    // Guardar configuración temporalmente
    this.saveConfig();
    
    // Abrir overlay en nueva ventana
    const overlayUrl = `${window.location.origin}/overlay`;
    const previewWindow = window.open(overlayUrl, 'preview', 'width=800,height=600');
    
    if (previewWindow) {
      // Simular una encuesta después de un momento
      setTimeout(() => {
        previewWindow.postMessage({
          type: 'simulate_poll',
          data: {
            id: 'preview-poll',
            title: '¿Cuál es tu color favorito?',
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
        }, '*');
      }, 1000);
    }
  }

  /**
   * Muestra una notificación
   */
  showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-white font-medium z-50 ${
      type === 'success' ? 'bg-green-500' :
      type === 'error' ? 'bg-red-500' :
      type === 'warning' ? 'bg-yellow-500' :
      'bg-blue-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    anime({
      targets: notification,
      translateX: [100, 0],
      opacity: [0, 1],
      duration: 300,
      easing: 'easeOutCubic'
    });
    
    // Remover después de 3 segundos
    setTimeout(() => {
      anime({
        targets: notification,
        translateX: [0, 100],
        opacity: [1, 0],
        duration: 300,
        easing: 'easeInCubic',
        complete: () => {
          document.body.removeChild(notification);
        }
      });
    }, 3000);
  }

  /**
   * Carga la UI con la configuración actual
   */
  loadUI() {
    // Cargar valores de los sliders
    document.getElementById('background-opacity').value = this.config.backgroundOpacity || 95;
    document.getElementById('opacity-value').textContent = `${this.config.backgroundOpacity || 95}%`;
    
    document.getElementById('padding').value = this.config.padding || 50;
    document.getElementById('padding-value').textContent = `${this.config.padding || 50}px`;
    
    document.getElementById('overlay-size').value = this.config.overlaySize || 1.0;
    document.getElementById('size-value').textContent = `${Math.round((this.config.overlaySize || 1.0) * 100)}%`;
    
    document.getElementById('max-width').value = this.config.maxWidth || 500;
    document.getElementById('max-width-value').textContent = `${this.config.maxWidth || 500}px`;
    
    document.getElementById('animation-duration').value = this.config.animationDuration || 0.8;
    document.getElementById('duration-value').textContent = `${this.config.animationDuration || 0.8}s`;
    
    document.getElementById('effect-intensity').value = this.config.effectIntensity || 3;
    const intensityLabels = ['', 'Suave', 'Normal', 'Intenso', 'Muy Intenso', 'Extremo'];
    document.getElementById('intensity-value').textContent = intensityLabels[this.config.effectIntensity || 3];
    
    document.getElementById('hide-delay').value = this.config.hideDelay || 5;
    document.getElementById('delay-value').textContent = `${this.config.hideDelay || 5}s`;
    
    document.getElementById('font-size').value = this.config.fontSize || 18;
    document.getElementById('font-size-value').textContent = `${this.config.fontSize || 18}px`;
    
    document.getElementById('border-radius').value = this.config.borderRadius || 24;
    document.getElementById('border-radius-value').textContent = `${this.config.borderRadius || 24}px`;
    
    // Cargar posición
    const positionRadio = document.querySelector(`input[name="position"][value="${this.config.position || 'center'}"]`);
    if (positionRadio) positionRadio.checked = true;
    
    // Cargar tema
    const themeRadio = document.querySelector(`input[name="theme"][value="${this.config.theme || 'light'}"]`);
    if (themeRadio) themeRadio.checked = true;
    
    // Cargar efectos de entrada
    const enterEffectRadio = document.querySelector(`input[name="enter-effect"][value="${this.config.enterEffect || 'fade'}"]`);
    if (enterEffectRadio) enterEffectRadio.checked = true;
    
    // Cargar efecto de victoria
    const victoryEffectRadio = document.querySelector(`input[name="victory-effect"][value="${this.config.victoryEffect || 'confetti'}"]`);
    if (victoryEffectRadio) victoryEffectRadio.checked = true;
    
    // Cargar checkboxes
    document.getElementById('enable-confetti').checked = this.config.enableConfetti !== false;
    document.getElementById('enable-sound').checked = this.config.enableSound === true;
    document.getElementById('enable-shake').checked = this.config.enableShake === true;
    document.getElementById('show-timer').checked = this.config.showTimer !== false;
    document.getElementById('show-total-votes').checked = this.config.showTotalVotes !== false;
    document.getElementById('auto-hide').checked = this.config.autoHide !== false;
    document.getElementById('enable-notifications').checked = this.config.enableNotifications === true;
    
    // Cargar paleta de colores
    const colorPreset = document.querySelector(`[data-preset="${this.config.colorPreset || 'pastel'}"]`);
    if (colorPreset) {
      colorPreset.classList.add('ring-2', 'ring-pink-500');
    }
    
    // Cargar colores personalizados
    document.getElementById('primary-color').value = this.config.primaryColor || '#FFB6C1';
    document.getElementById('secondary-color').value = this.config.secondaryColor || '#B3D9FF';
    document.getElementById('text-color').value = this.config.textColor || '#374151';
    document.getElementById('border-color').value = this.config.borderColor || '#FFB6C1';
    
    // Actualizar URL del overlay
    this.elements.overlayUrl.value = `${window.location.origin}/overlay.html`;
    
    // Aplicar configuración al preview
    this.updatePreview();
  }

  /**
   * Carga la configuración cargada
   */
  loadConfig() {
    const defaultConfig = {
      // Posición y tamaño
      position: 'center',
      padding: 50,
      overlaySize: 1.0,
      maxWidth: 500,
      
      // Colores y tema
      backgroundOpacity: 95,
      colorPreset: 'pastel',
      primaryColor: '#FFB6C1',
      secondaryColor: '#B3D9FF',
      textColor: '#374151',
      borderColor: '#FFB6C1',
      theme: 'light',
      
      // Animaciones
      animationDuration: 0.8,
      enterEffect: 'fade',
      victoryEffect: 'confetti',
      effectIntensity: 3,
      enableConfetti: true,
      enableSound: false,
      enableShake: false,
      
      // Avanzado
      hideDelay: 5,
      fontSize: 18,
      borderRadius: 24,
      showTimer: true,
      showTotalVotes: true,
      autoHide: true,
      enableNotifications: false,
      
      // Colores personalizados (legacy)
      customColors: ['#FFB3D9', '#B3D9FF', '#D9B3FF', '#B3FFD9', '#FFDAB3']
    };
    
    try {
      const saved = localStorage.getItem('pollOverlayConfig');
      return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
    } catch (error) {
      console.error('❌ Error cargando configuración:', error);
      return defaultConfig;
    }
  }

  /**
   * Maneja parámetros URL para mostrar mensajes
   */
  handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const message = urlParams.get('message');
    const user = urlParams.get('user');

    if (success) {
      switch (success) {
        case 'auth_complete':
          this.showNotification(`✅ Autenticación exitosa${user ? ` como ${user}` : ''}`, 'success');
          break;
        default:
          this.showNotification('✅ Operación exitosa', 'success');
      }
    }

    if (error) {
      let errorMessage = '❌ Error desconocido';
      
      switch (error) {
        case 'auth_failed':
          errorMessage = '❌ Error en autenticación';
          break;
        case 'no_code':
          errorMessage = '❌ No se recibió código de autorización';
          break;
        case 'no_permissions':
          errorMessage = '❌ Sin permisos para encuestas';
          break;
        case 'auth_error':
          errorMessage = '❌ Error de autenticación';
          break;
        case 'callback_error':
          errorMessage = '❌ Error interno del servidor';
          break;
        case 'no_broadcaster_id':
          errorMessage = '❌ No se pudo obtener información del canal';
          break;
      }
      
      if (message) {
        errorMessage += ': ' + decodeURIComponent(message);
      }
      
      this.showNotification(errorMessage, 'error');
    }

    // Limpiar parámetros URL
    if (success || error) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }

  /**
   * Configura los event listeners para los controles de configuración
   */
  setupConfigEventListeners() {
    // Sliders con actualización en tiempo real
    const sliders = [
      'background-opacity', 'padding', 'overlay-size', 'max-width',
      'animation-duration', 'effect-intensity', 'hide-delay', 'font-size', 'border-radius'
    ];
    
    sliders.forEach(id => {
      const slider = document.getElementById(id);
      if (slider) {
        slider.addEventListener('input', () => {
          this.updateSliderValue(id);
          this.updatePreview();
        });
      }
    });

    // Radio buttons
    ['position', 'theme', 'enter-effect', 'victory-effect'].forEach(name => {
      document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
        radio.addEventListener('change', () => {
          this.updatePreview();
        });
      });
    });

    // Checkboxes
    const checkboxes = [
      'enable-confetti', 'enable-sound', 'enable-shake',
      'show-timer', 'show-total-votes', 'auto-hide', 'enable-notifications'
    ];
    
    checkboxes.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          this.updatePreview();
        });
      }
    });

    // Color pickers
    ['primary-color', 'secondary-color', 'text-color', 'border-color'].forEach(id => {
      const picker = document.getElementById(id);
      if (picker) {
        picker.addEventListener('change', () => {
          this.updatePreview();
        });
      }
    });

    // Botones de preview
    document.getElementById('preview-begin')?.addEventListener('click', () => {
      this.simulatePollEvent('begin');
    });
    
    document.getElementById('preview-progress')?.addEventListener('click', () => {
      this.simulatePollEvent('progress');
    });
    
    document.getElementById('preview-end')?.addEventListener('click', () => {
      this.simulatePollEvent('end');
    });
  }

  /**
   * Actualiza el valor mostrado de un slider
   */
  updateSliderValue(sliderId) {
    const slider = document.getElementById(sliderId);
    const valueElement = document.getElementById(sliderId.replace('-', '-') + '-value');
    
    if (!slider || !valueElement) return;
    
    const value = parseFloat(slider.value);
    
    switch (sliderId) {
      case 'background-opacity':
        valueElement.textContent = `${Math.round(value)}%`;
        break;
      case 'padding':
        valueElement.textContent = `${Math.round(value)}px`;
        break;
      case 'overlay-size':
        valueElement.textContent = `${Math.round(value * 100)}%`;
        break;
      case 'max-width':
        valueElement.textContent = `${Math.round(value)}px`;
        break;
      case 'animation-duration':
        valueElement.textContent = `${value.toFixed(1)}s`;
        break;
      case 'effect-intensity':
        const intensityLabels = ['', 'Suave', 'Normal', 'Intenso', 'Muy Intenso', 'Extremo'];
        valueElement.textContent = intensityLabels[Math.round(value)] || 'Normal';
        break;
      case 'hide-delay':
        valueElement.textContent = `${Math.round(value)}s`;
        break;
      case 'font-size':
        valueElement.textContent = `${Math.round(value)}px`;
        break;
      case 'border-radius':
        valueElement.textContent = `${Math.round(value)}px`;
        break;
    }
  }

  /**
   * Simula un evento de poll en el preview
   */
  simulatePollEvent(type) {
    const preview = document.getElementById('overlay-preview');
    if (!preview) return;
    
    const card = preview.querySelector('.poll-card-preview');
    if (!card) return;
    
    // Aplicar animación según el tipo
    switch (type) {
      case 'begin':
        anime({
          targets: card,
          scale: [0.8, 1],
          opacity: [0, 1],
          duration: 600,
          easing: 'easeOutElastic(1, .8)'
        });
        break;
      case 'progress':
        anime({
          targets: card,
          scale: [1, 1.05, 1],
          duration: 300,
          easing: 'easeInOutQuad'
        });
        break;
      case 'end':
        anime({
          targets: card,
          scale: [1, 1.1, 1],
          duration: 800,
          easing: 'easeOutElastic(1, .6)'
        });
        
        // Mostrar confetti si está habilitado
        if (typeof confetti !== 'undefined' && this.config.enableConfetti !== false) {
          confetti({
            particleCount: 100,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#FFB6C1', '#FFC0CB', '#FFD700', '#FFA500', '#FF69B4', '#FF1493']
          });
        }
        break;
    }
  }

  /**
   * Actualiza la vista previa del overlay
   */
  updatePreview() {
    const preview = document.getElementById('overlay-preview');
    if (!preview) return;
    
    const card = preview.querySelector('.poll-card-preview');
    if (!card) return;
    
    // Aplicar posición
    const position = this.config.position || 'center';
    preview.className = 'absolute inset-0 flex';
    
    switch (position) {
      case 'top-left':
        preview.className += ' items-start justify-start';
        break;
      case 'top':
        preview.className += ' items-start justify-center';
        break;
      case 'top-right':
        preview.className += ' items-start justify-end';
        break;
      case 'left':
        preview.className += ' items-center justify-start';
        break;
      case 'center':
        preview.className += ' items-center justify-center';
        break;
      case 'right':
        preview.className += ' items-center justify-end';
        break;
      case 'bottom-left':
        preview.className += ' items-end justify-start';
        break;
      case 'bottom':
        preview.className += ' items-end justify-center';
        break;
      case 'bottom-right':
        preview.className += ' items-end justify-end';
        break;
    }
    
    // Aplicar tamaño
    const scale = this.config.overlaySize || 1.0;
    card.style.transform = `scale(${scale})`;
    
    // Aplicar ancho máximo
    const maxWidth = this.config.maxWidth || 500;
    card.style.maxWidth = `${maxWidth}px`;
    
    // Aplicar padding
    const padding = this.config.padding || 50;
    preview.style.padding = `${padding}px`;
    
    // Aplicar colores
    const primaryColor = this.config.primaryColor || '#FFB6C1';
    const secondaryColor = this.config.secondaryColor || '#B3D9FF';
    const textColor = this.config.textColor || '#374151';
    const borderColor = this.config.borderColor || '#FFB6C1';
    
    // Aplicar opacidad del fondo
    const opacity = (this.config.backgroundOpacity || 95) / 100;
    card.style.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
    
    // Aplicar redondez de bordes
    const borderRadius = this.config.borderRadius || 24;
    card.style.borderRadius = `${borderRadius}px`;
    
    // Aplicar tema
    if (this.config.theme === 'dark') {
      card.style.backgroundColor = `rgba(31, 41, 55, ${opacity})`;
      card.style.color = '#F9FAFB';
    }
  }

  /**
   * Guarda la configuración actual
   */
  saveConfig() {
    // Recopilar todos los valores del formulario
    const newConfig = {
      // Posición y tamaño
      position: document.querySelector('input[name="position"]:checked')?.value || 'center',
      padding: parseInt(document.getElementById('padding').value) || 50,
      overlaySize: parseFloat(document.getElementById('overlay-size').value) || 1.0,
      maxWidth: parseInt(document.getElementById('max-width').value) || 500,
      
      // Colores y tema
      backgroundOpacity: parseInt(document.getElementById('background-opacity').value) || 95,
      colorPreset: document.querySelector('.color-preset.ring-2')?.dataset.preset || 'pastel',
      primaryColor: document.getElementById('primary-color').value || '#FFB6C1',
      secondaryColor: document.getElementById('secondary-color').value || '#B3D9FF',
      textColor: document.getElementById('text-color').value || '#374151',
      borderColor: document.getElementById('border-color').value || '#FFB6C1',
      theme: document.querySelector('input[name="theme"]:checked')?.value || 'light',
      
      // Animaciones
      animationDuration: parseFloat(document.getElementById('animation-duration').value) || 0.8,
      enterEffect: document.querySelector('input[name="enter-effect"]:checked')?.value || 'fade',
      victoryEffect: document.querySelector('input[name="victory-effect"]:checked')?.value || 'confetti',
      effectIntensity: parseInt(document.getElementById('effect-intensity').value) || 3,
      enableConfetti: document.getElementById('enable-confetti').checked,
      enableSound: document.getElementById('enable-sound').checked,
      enableShake: document.getElementById('enable-shake').checked,
      
      // Avanzado
      hideDelay: parseInt(document.getElementById('hide-delay').value) || 5,
      fontSize: parseInt(document.getElementById('font-size').value) || 18,
      borderRadius: parseInt(document.getElementById('border-radius').value) || 24,
      showTimer: document.getElementById('show-timer').checked,
      showTotalVotes: document.getElementById('show-total-votes').checked,
      autoHide: document.getElementById('auto-hide').checked,
      enableNotifications: document.getElementById('enable-notifications').checked
    };
    
    // Guardar en localStorage
    try {
      localStorage.setItem('pollOverlayConfig', JSON.stringify(newConfig));
      this.config = newConfig;
      
      // Mostrar notificación
      this.showNotification('✅ Configuración guardada exitosamente', 'success');
      
      // Actualizar preview
      this.updatePreview();
      
      // Enviar configuración al overlay
      this.sendConfigToOverlay();
      
    } catch (error) {
      console.error('❌ Error guardando configuración:', error);
      this.showNotification('❌ Error guardando configuración', 'error');
    }
  }

  /**
   * Envía la configuración al overlay
   */
  sendConfigToOverlay() {
    // Emitir evento de configuración actualizada
    window.dispatchEvent(new CustomEvent('configUpdated', { 
      detail: this.config 
    }));
  }

  /**
   * Restablece la configuración a los valores por defecto
   */
  resetConfig() {
    if (confirm('¿Estás seguro de que quieres restablecer toda la configuración?')) {
      localStorage.removeItem('pollOverlayConfig');
      this.config = this.loadConfig();
      this.loadUI();
      this.showNotification('🔄 Configuración restablecida', 'info');
    }
  }
}

// Inicializar el panel de configuración
document.addEventListener('DOMContentLoaded', () => {
  window.configPanel = new ConfigPanel();
  // Manejar parámetros URL después de la inicialización
  setTimeout(() => {
    window.configPanel.handleUrlParams();
  }, 100);
});
