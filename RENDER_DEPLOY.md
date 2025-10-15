# 🚀 Deploy en Render - Instrucciones Completas

## 📋 Pasos para hacer el deploy:

### 1. **Preparar el repositorio**

```bash
# Asegúrate de que todos los archivos estén committeados
git add .
git commit -m "Preparar para deploy en Render"
git push origin main
```

### 2. **Crear cuenta en Render**

1. Ve a [render.com](https://render.com)
2. Haz clic en "Get Started for Free"
3. Conecta tu cuenta de GitHub
4. Autoriza el acceso a tu repositorio

### 3. **Crear nuevo servicio**

1. Haz clic en "New +"
2. Selecciona "Web Service"
3. Conecta tu repositorio `twitch-overlay`
4. Configura el servicio:

**Configuración del servicio:**

- **Name**: `twitch-poll-overlay`
- **Environment**: `Node`
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`
- **Instance Type**: `Free`

### 4. **Configurar variables de entorno**

En la sección "Environment Variables", agrega:

```
TWITCH_CLIENT_ID=tu_client_id_aqui
TWITCH_CLIENT_SECRET=tu_client_secret_aqui
TWITCH_REDIRECT_URI=https://tu-proyecto.onrender.com/auth/callback
NODE_ENV=production
```

### 5. **Configurar dominio personalizado (opcional)**

- Ve a "Settings" > "Custom Domains"
- Agrega un dominio personalizado si lo deseas
- Render te dará una URL automática como: `https://tu-proyecto.onrender.com`

### 6. **Verificar el deploy**

- El deploy debería iniciarse automáticamente
- Ve a "Logs" para ver el progreso
- Una vez completado, obtén la URL en "Settings" > "Custom Domains"

## 🔧 URLs importantes después del deploy:

- **Overlay para OBS**: `https://tu-proyecto.onrender.com/overlay.html`
- **Panel de configuración**: `https://tu-proyecto.onrender.com/config.html`
- **Test del overlay**: `https://tu-proyecto.onrender.com/test-overlay`
- **Health check**: `https://tu-proyecto.onrender.com/health`

## ⚠️ Importante:

1. **Actualiza la Redirect URI** en Twitch Developer Console con la nueva URL
2. **Prueba todas las funciones** antes de usar en producción
3. **Monitorea los logs** en Render para detectar errores
4. **El plan gratuito tiene limitaciones** pero es suficiente para uso personal

## 🎯 Próximos pasos:

1. Hacer el deploy
2. Configurar variables de entorno
3. Probar el overlay
4. Configurar en OBS
5. ¡Disfrutar del overlay! 🎉

## 💡 Notas sobre Render:

- **Plan gratuito**: 750 horas/mes (suficiente para uso personal)
- **Sleep mode**: Se duerme después de 15 min de inactividad
- **Wake up**: Se despierta automáticamente cuando recibe tráfico
- **WebSockets**: Completamente soportados
- **SSL**: Incluido automáticamente
