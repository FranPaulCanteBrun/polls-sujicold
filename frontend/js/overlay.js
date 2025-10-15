// Lógica principal del overlay de encuestas
class PollOverlay {
  constructor() {
    this.currentPoll = null;
    this.config = this.loadConfig();
    this.isVisible = false;
    this.hideTimeout = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.applyConfig();
  }

  /**
   * Inicializa los elementos del DOM
   */
  initializeElements() {
    this.container = document.getElementById('overlay-container');
    this.pollCard = document.getElementById('poll-card');
    this.pollTitle = document.getElementById('poll-title');
    this.pollTimer = document.getElementById('poll-timer');
    this.pollOptions = document.getElementById('poll-options');
    this.pollStatus = document.getElementById('poll-status');
    this.totalVotes = document.getElementById('total-votes');
    this.confettiCanvas = document.getElementById('confetti-canvas');
  }

  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    // Escuchar eventos del socket
    window.socketClient.on('poll_event', (event) => {
      this.handlePollEvent(event);
    });

    window.socketClient.on('server_status', (status) => {
      console.log('📊 Estado del servidor:', status);
    });

    // Escuchar cambios de configuración
    window.addEventListener('storage', (e) => {
      if (e.key === 'pollOverlayConfig') {
        this.config = JSON.parse(e.newValue);
        this.applyConfig();
      }
    });
  }

  /**
   * Maneja eventos de encuestas del servidor
   */
  handlePollEvent(event) {
    console.log('🗳️ Evento de encuesta recibido:', event.type);
    
    switch (event.type) {
      case 'poll_begin':
        this.showPoll(event.data);
        break;
      case 'poll_progress':
        this.updatePoll(event.data);
        break;
      case 'poll_end':
        this.endPoll(event.data);
        break;
    }
  }

  /**
   * Muestra una nueva encuesta
   */
  showPoll(pollData) {
    console.log('🎯 showPoll llamado con:', pollData);
    this.currentPoll = pollData;
    this.isVisible = true;
    
    // Limpiar timeout anterior
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    
    // Renderizar la encuesta
    this.renderPoll(pollData);
    
    // Mostrar con animación
    this.showWithAnimation();
    
    console.log('📺 Mostrando encuesta:', pollData.title);
    console.log('✅ showPoll completado - isVisible:', this.isVisible);
    console.log('✅ poll-card classes:', this.pollCard.className);
    console.log('✅ poll-card style display:', this.pollCard.style.display);
  }

  /**
   * Actualiza una encuesta en progreso
   */
  updatePoll(pollData) {
    if (!this.isVisible || !this.currentPoll) return;
    
    this.currentPoll = pollData;
    this.renderPoll(pollData);
    
    console.log('📈 Actualizando encuesta:', pollData.title);
  }

  /**
   * Finaliza una encuesta
   */
  endPoll(pollData) {
    if (!this.isVisible || !this.currentPoll) return;
    
    this.currentPoll = pollData;
    this.renderPoll(pollData);
    
    // Mostrar efecto de victoria
    this.showVictoryEffect();
    
    // Programar ocultación
    const hideDelay = this.config.hideDelay || 5;
    this.hideTimeout = setTimeout(() => {
      this.hideWithAnimation();
    }, hideDelay * 1000);
    
    console.log('🏁 Encuesta finalizada:', pollData.title);
  }

  /**
   * Renderiza los datos de la encuesta
   */
  renderPoll(pollData) {
    // Título
    this.pollTitle.textContent = pollData.title;
    
    // Timer
    this.updateTimer(pollData);
    
    // Opciones
    this.renderOptions(pollData.choices);
    
    // Estado y votos totales
    this.updateStatus(pollData);
  }

  /**
   * Actualiza el timer de la encuesta
   */
  updateTimer(pollData) {
    if (pollData.status === 'completed') {
      this.pollTimer.textContent = 'Finalizada';
      this.pollTimer.className = 'poll-timer text-red-500';
    } else {
      const now = new Date();
      const endTime = new Date(pollData.ends_at);
      const timeLeft = endTime - now;
      
      if (timeLeft > 0) {
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        this.pollTimer.textContent = `Tiempo restante: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        this.pollTimer.className = 'poll-timer text-blue-500';
      } else {
        this.pollTimer.textContent = 'Finalizando...';
        this.pollTimer.className = 'poll-timer text-orange-500';
      }
    }
  }

  /**
   * Renderiza las opciones de la encuesta
   */
  renderOptions(choices) {
    this.pollOptions.innerHTML = '';
    
    // Calcular total de votos
    const totalVotes = choices.reduce((sum, choice) => sum + choice.votes, 0);
    
    // Encontrar la opción ganadora
    const maxVotes = Math.max(...choices.map(c => c.votes));
    const winnerId = choices.find(c => c.votes === maxVotes && c.votes > 0)?.id;
    
    choices.forEach((choice, index) => {
      const percentage = totalVotes > 0 ? (choice.votes / totalVotes * 100) : 0;
      const isWinner = choice.id === winnerId && this.currentPoll.status === 'completed';
      
      const optionElement = this.createOptionElement(choice, percentage, index, isWinner);
      this.pollOptions.appendChild(optionElement);
    });
  }

  /**
   * Crea un elemento de opción
   */
  createOptionElement(choice, percentage, index, isWinner) {
    const optionDiv = document.createElement('div');
    optionDiv.className = `poll-option ${isWinner ? 'winner' : ''}`;
    
    optionDiv.innerHTML = `
      <div class="option-text">${choice.title}</div>
      <div class="progress-container">
        <div class="progress-bar ${isWinner ? 'winner' : ''}" 
             style="width: ${percentage}%"></div>
      </div>
      <div class="option-stats">
        <span>${choice.votes} voto${choice.votes !== 1 ? 's' : ''}</span>
        <span>${percentage.toFixed(1)}%</span>
      </div>
    `;
    
    return optionDiv;
  }

  /**
   * Actualiza el estado y votos totales
   */
  updateStatus(pollData) {
    const totalVotes = pollData.choices.reduce((sum, choice) => sum + choice.votes, 0);
    
    // Actualizar el estado del badge
    const statusBadge = this.pollStatus.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.innerHTML = `
        <div class="status-dot"></div>
        ${pollData.status === 'active' ? 'En vivo' : 'Finalizada'}
      `;
    }
    
    // Actualizar votos totales
    this.totalVotes.textContent = `Total: ${totalVotes} voto${totalVotes !== 1 ? 's' : ''}`;
  }

  /**
   * Muestra el overlay con animación
   */
  showWithAnimation() {
    console.log('🎬 showWithAnimation iniciado');
    console.log('🎬 poll-card antes de mostrar:', this.pollCard.className);
    
    this.pollCard.classList.remove('hidden');
    
    console.log('🎬 poll-card después de quitar hidden:', this.pollCard.className);
    console.log('🎬 poll-card visible:', this.pollCard.offsetWidth, 'x', this.pollCard.offsetHeight);
    
    // Animación de entrada con anime.js
    anime({
      targets: this.pollCard,
      opacity: [0, 1],
      scale: [0.8, 1],
      translateY: [-50, 0],
      duration: 800,
      easing: 'easeOutElastic(1, .8)',
      complete: () => {
        this.pollCard.classList.add('slide-in');
        console.log('🎬 Animación completada');
      }
    });
    
    // Animación de las opciones con delay
    const options = this.pollCard.querySelectorAll('.poll-option');
    console.log('🎬 Opciones encontradas:', options.length);
    
    anime({
      targets: options,
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 600,
      delay: anime.stagger(100),
      easing: 'easeOutQuart'
    });
  }

  /**
   * Oculta el overlay con animación
   */
  hideWithAnimation() {
    anime({
      targets: this.pollCard,
      opacity: [1, 0],
      scale: [1, 0.8],
      translateY: [0, -30],
      duration: 600,
      easing: 'easeInCubic',
      complete: () => {
        this.pollCard.classList.add('hidden');
        this.pollCard.classList.remove('slide-in');
        this.isVisible = false;
        this.currentPoll = null;
      }
    });
  }

  /**
   * Muestra el efecto de victoria
   */
  showVictoryEffect() {
    const effect = this.config.victoryEffect || 'confetti';
    
    switch (effect) {
      case 'confetti':
        this.showConfetti();
        break;
      case 'glow':
        this.showGlowEffect();
        break;
      case 'particles':
        this.showParticleEffect();
        break;
      case 'bounce':
        this.showBounceEffect();
        break;
    }
  }

  /**
   * Efecto de confeti
   */
  showConfetti() {
    if (typeof confetti !== 'undefined') {
      // Confetti principal
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFB6C1', '#FFC0CB', '#FFD700', '#FFA500', '#FF69B4', '#FF1493']
      });
      
      // Confetti secundario después de un delay
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 50,
          origin: { y: 0.4 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493']
        });
      }, 500);
    }
  }

  /**
   * Efecto de brillo
   */
  showGlowEffect() {
    const winnerOption = this.pollCard.querySelector('.poll-option.winner');
    if (winnerOption) {
      // Animación de pulso dorado
      anime({
        targets: winnerOption,
        scale: [1, 1.08, 1],
        duration: 1500,
        easing: 'easeInOutQuad',
        loop: 2
      });
      
      // Efecto de brillo en la barra de progreso
      const progressBar = winnerOption.querySelector('.progress-bar');
      if (progressBar) {
        anime({
          targets: progressBar,
          boxShadow: [
            '0 0 0px rgba(255, 215, 0, 0)',
            '0 0 20px rgba(255, 215, 0, 0.8)',
            '0 0 0px rgba(255, 215, 0, 0)'
          ],
          duration: 2000,
          easing: 'easeInOutQuad',
          loop: 2
        });
      }
    }
  }

  /**
   * Efecto de partículas
   */
  showParticleEffect() {
    // Implementación básica de partículas
    const canvas = this.confettiCanvas;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1
      });
    }
    
    const animateParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.02;
        
        if (particle.life > 0) {
          ctx.save();
          ctx.globalAlpha = particle.life;
          ctx.fillStyle = '#FFB3D9';
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
      
      if (particles.some(p => p.life > 0)) {
        requestAnimationFrame(animateParticles);
      }
    };
    
    animateParticles();
  }

  /**
   * Efecto de rebote
   */
  showBounceEffect() {
    const winnerOption = this.pollCard.querySelector('.poll-option.winner');
    if (winnerOption) {
      // Efecto de rebote múltiple
      anime({
        targets: winnerOption,
        scale: [1, 1.15, 0.95, 1.1, 1],
        duration: 1200,
        easing: 'easeOutElastic(1, .6)',
        complete: () => {
          // Segundo rebote más suave
          anime({
            targets: winnerOption,
            scale: [1, 1.05, 1],
            duration: 400,
            easing: 'easeOutQuad'
          });
        }
      });
      
      // Efecto en el texto de la opción
      const optionText = winnerOption.querySelector('.option-text');
      if (optionText) {
        anime({
          targets: optionText,
          color: ['#374151', '#FFD700', '#374151'],
          duration: 1200,
          easing: 'easeInOutQuad'
        });
      }
    }
  }

  /**
   * Aplica la configuración cargada
   */
  applyConfig() {
    // Posición
    this.container.className = `overlay-container position-${this.config.position || 'center'}`;
    
    // Padding
    this.container.style.padding = `${this.config.padding || 50}px`;
    
    // Opacidad del fondo
    const bgOpacity = this.config.backgroundOpacity || 80;
    this.pollCard.style.setProperty('--bg-primary', `rgba(255, 255, 255, ${bgOpacity / 100})`);
    
    // Tamaño de fuente
    const fontSize = this.config.fontSize || 18;
    this.pollCard.style.fontSize = `${fontSize}px`;
  }

  /**
   * Carga la configuración desde localStorage
   */
  loadConfig() {
    const defaultConfig = {
      position: 'center',
      padding: 50,
      backgroundOpacity: 80,
      animationDuration: 1,
      victoryEffect: 'confetti',
      hideDelay: 5,
      fontSize: 18,
      colorPreset: 'pastel'
    };
    
    try {
      const saved = localStorage.getItem('pollOverlayConfig');
      return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
    } catch (error) {
      console.error('❌ Error cargando configuración:', error);
      return defaultConfig;
    }
  }
}

// Inicializar el overlay cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  window.pollOverlay = new PollOverlay();
});
