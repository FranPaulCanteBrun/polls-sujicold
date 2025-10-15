// Cliente para autenticación OAuth 2.0 con Twitch
const axios = require('axios');
const { config } = require('./config');

class TwitchClient {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.broadcasterId = null;
    this.userInfo = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Genera la URL de autorización OAuth
   */
  getAuthUrl() {
    const state = this.generateState();
    const params = new URLSearchParams({
      client_id: config.twitch.clientId,
      redirect_uri: config.twitch.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: state
    });

    return `${config.twitch.authBaseUrl}/authorize?${params.toString()}`;
  }

  /**
   * Genera un estado aleatorio para seguridad OAuth
   */
  generateState() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Intercambia el código de autorización por tokens
   */
  async exchangeCodeForTokens(code, state) {
    try {
      console.log('🔄 Iniciando exchangeCodeForTokens...');
      console.log('🔑 Code recibido:', code ? 'Presente' : 'Ausente');
      console.log('🔑 State recibido:', state ? 'Presente' : 'Ausente');
      
      // Validar estado si es necesario (por seguridad)
      if (!code) {
        throw new Error('Código de autorización no proporcionado');
      }

      console.log('🌐 Enviando request a Twitch OAuth...');
      const response = await axios.post(`${config.twitch.authBaseUrl}/token`, 
        new URLSearchParams({
          client_id: config.twitch.clientId,
          client_secret: config.twitch.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: config.twitch.redirectUri
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log('✅ Respuesta de Twitch OAuth recibida:', response.data);
      const { access_token, refresh_token, expires_in, scope, token_type } = response.data;
      
      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      this.tokenExpiresAt = Date.now() + (expires_in * 1000);
      
      console.log('🔑 Tokens obtenidos:', {
        expiresIn: expires_in,
        scope: scope,
        tokenType: token_type
      });
      
      // Obtener información del usuario
      console.log('👤 Llamando a getUserInfo()...');
      try {
        console.log('🔍 ANTES de getUserInfo - Estado:', {
          hasAccessToken: !!this.accessToken,
          hasUserInfo: !!this.userInfo,
          hasBroadcasterId: !!this.broadcasterId
        });
        
        await this.getUserInfo();
        
        console.log('🔍 DESPUÉS de getUserInfo - Estado:', {
          hasAccessToken: !!this.accessToken,
          hasUserInfo: !!this.userInfo,
          hasBroadcasterId: !!this.broadcasterId,
          broadcasterId: this.broadcasterId
        });
        
        console.log('✅ getUserInfo() completado exitosamente');
      } catch (error) {
        console.error('❌ Error en getUserInfo():', error.message);
        console.error('❌ Stack trace:', error.stack);
        throw error; // Re-lanzar el error para que se maneje en el catch principal
      }
      
      console.log('✅ Autenticación exitosa con Twitch');
      console.log('📊 Estado final:', {
        hasUserInfo: !!this.userInfo,
        hasBroadcasterId: !!this.broadcasterId,
        broadcasterId: this.broadcasterId
      });
      
      return {
        success: true,
        user: this.userInfo,
        expiresIn: expires_in,
        scope: scope
      };
    } catch (error) {
      console.error('❌ Error en autenticación:', error.response?.data || error.message);
      console.error('❌ Stack trace:', error.stack);
      return {
        success: false,
        error: error.response?.data?.message || 'Error de autenticación'
      };
    }
  }

  /**
   * Obtiene información del usuario autenticado
   */
  async getUserInfo() {
    console.log('🔍 INICIO getUserInfo() - VERSIÓN DEBUG');
    
    try {
      // Verificar que tenemos los datos necesarios
      if (!this.accessToken) {
        console.error('❌ No hay access token disponible');
        throw new Error('No hay access token disponible');
      }
      
      if (!config.twitch.clientId) {
        console.error('❌ No hay client ID disponible');
        throw new Error('No hay client ID disponible');
      }
      
      console.log('🔑 Access Token:', this.accessToken.substring(0, 10) + '...');
      console.log('🔑 Client ID:', config.twitch.clientId);
      console.log('🔑 API Base URL:', config.twitch.apiBaseUrl);
      
      const url = `${config.twitch.apiBaseUrl}/users`;
      console.log('🌐 URL completa:', url);
      
      const headers = {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': config.twitch.clientId
      };
      console.log('📋 Headers:', headers);
      
      console.log('🌐 Haciendo request a Twitch API...');
      const response = await axios.get(url, { headers });

      console.log('📊 Respuesta recibida - Status:', response.status);
      console.log('📊 Respuesta recibida - Data:', JSON.stringify(response.data, null, 2));
      
      if (!response.data.data || response.data.data.length === 0) {
        console.error('❌ No se encontraron datos de usuario en la respuesta');
        throw new Error('No se encontraron datos de usuario en la respuesta');
      }

      const userData = response.data.data[0];
      console.log('👤 Datos del usuario extraídos:', userData);
      
      console.log('💾 Guardando datos del usuario...');
      this.userInfo = userData;
      this.broadcasterId = userData.id;
      
      console.log('✅ Datos guardados:');
      console.log('  - userInfo:', this.userInfo);
      console.log('  - broadcasterId:', this.broadcasterId);
      
      console.log('✅ getUserInfo() completado exitosamente');
      return this.userInfo;
    } catch (error) {
      console.error('❌ ERROR EN getUserInfo():');
      console.error('  - Message:', error.message);
      console.error('  - Response data:', error.response?.data);
      console.error('  - Response status:', error.response?.status);
      console.error('  - Stack trace:', error.stack);
      throw error;
    }
  }

  /**
   * Obtiene información completa del canal del usuario
   */
  async getChannelInfo() {
    if (!await this.validateToken()) {
      throw new Error('Token no válido');
    }

    if (!this.broadcasterId) {
      throw new Error('Broadcaster ID no disponible');
    }

    try {
      const response = await axios.get(`${config.twitch.apiBaseUrl}/channels`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': config.twitch.clientId
        },
        params: {
          broadcaster_id: this.broadcasterId
        }
      });

      const channelInfo = response.data.data[0];
      
      console.log('📺 Información del canal obtenida:', {
        broadcaster_id: channelInfo.broadcaster_id,
        broadcaster_login: channelInfo.broadcaster_login,
        broadcaster_name: channelInfo.broadcaster_name,
        title: channelInfo.title,
        game_name: channelInfo.game_name
      });
      
      return channelInfo;
    } catch (error) {
      console.error('❌ Error obteniendo info del canal:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene información completa del usuario y canal
   */
  async getCompleteUserInfo() {
    try {
      const userInfo = await this.getUserInfo();
      let channelInfo = null;
      
      // Intentar obtener información del canal solo si tenemos broadcaster_id
      if (this.broadcasterId) {
        try {
          channelInfo = await this.getChannelInfo();
        } catch (error) {
          console.warn('⚠️ No se pudo obtener información del canal:', error.message);
          // Continuar sin información del canal
        }
      }
      
      return {
        user: userInfo,
        channel: channelInfo,
        broadcasterId: this.broadcasterId
      };
    } catch (error) {
      console.error('❌ Error obteniendo información completa:', error.message);
      throw error;
    }
  }

  /**
   * Refresca el token de acceso
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      console.error('❌ No hay refresh token disponible');
      return false;
    }

    try {
      const response = await axios.post(`${config.twitch.authBaseUrl}/token`, 
        new URLSearchParams({
          client_id: config.twitch.clientId,
          client_secret: config.twitch.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token'
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      this.tokenExpiresAt = Date.now() + (expires_in * 1000);

      console.log('✅ Token refrescado exitosamente');
      return true;
    } catch (error) {
      console.error('❌ Error refrescando token:', error.response?.data || error.message);
      // Si falla el refresh, limpiar tokens
      this.clearTokens();
      return false;
    }
  }

  /**
   * Verifica si el token es válido y no ha expirado
   */
  async validateToken() {
    if (!this.accessToken) {
      return false;
    }

    // Verificar si el token ha expirado
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt) {
      console.log('⚠️ Token expirado, intentando refrescar...');
      return await this.refreshAccessToken();
    }

    try {
      const response = await axios.get(`${config.twitch.authBaseUrl}/validate`, {
        headers: {
          'Authorization': `OAuth ${this.accessToken}`
        }
      });
      
      // Actualizar información de expiración si es necesario
      if (response.data.expires_in) {
        this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
      }
      
      return true;
    } catch (error) {
      console.log('⚠️ Token inválido, intentando refrescar...');
      return await this.refreshAccessToken();
    }
  }

  /**
   * Limpia todos los tokens almacenados
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.broadcasterId = null;
    this.userInfo = null;
    this.tokenExpiresAt = null;
    console.log('🧹 Tokens limpiados');
  }


  /**
   * Verifica si el usuario tiene permisos para polls
   */
  async checkPollPermissions() {
    if (!await this.validateToken()) {
      return false;
    }

    if (!this.broadcasterId) {
      console.warn('⚠️ No hay broadcaster ID para verificar permisos');
      return false;
    }

    try {
      // Intentar obtener polls activas para verificar permisos
      const response = await axios.get(`${config.twitch.apiBaseUrl}/polls`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': config.twitch.clientId
        },
        params: {
          broadcaster_id: this.broadcasterId,
          first: 1
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Sin permisos para polls:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Obtiene el broadcaster ID del canal
   */
  getBroadcasterId() {
    return this.broadcasterId;
  }

  /**
   * Obtiene información del usuario
   */
  getUserInfo() {
    return this.userInfo;
  }

  /**
   * Verifica si está autenticado
   */
  isAuthenticated() {
    return !!(this.accessToken && this.userInfo);
  }
}

module.exports = TwitchClient;
