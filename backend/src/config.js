// Configuración y validación de variables de entorno
require('dotenv').config();

const config = {
  // Twitch API Configuration
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    redirectUri: process.env.TWITCH_REDIRECT_URI,
    apiBaseUrl: 'https://api.twitch.tv/helix',
    authBaseUrl: 'https://id.twitch.tv/oauth2',
    eventSubWebSocketUrl: 'wss://eventsub.wss.twitch.tv/ws'
  },
  
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  
  // OAuth Scopes needed for polls
  scopes: [
    'channel:read:polls',
    'channel:manage:polls'
  ]
};

// Validación de configuración requerida
function validateConfig() {
  const required = [
    'TWITCH_CLIENT_ID',
    'TWITCH_CLIENT_SECRET',
    'TWITCH_REDIRECT_URI'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missing.join(', '));
    console.error('📝 Copia env.example como .env y completa las credenciales');
    process.exit(1);
  }
  
  console.log('✅ Configuración validada correctamente');
}

module.exports = {
  config,
  validateConfig
};
