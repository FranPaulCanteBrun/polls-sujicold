# 🚀 Deploy en Railway - Instrucciones

## 📋 Pasos para hacer el deploy:

### 1. **Preparar el repositorio**

```bash
# Asegúrate de que todos los archivos estén committeados
git add .
git commit -m "Preparar para deploy en Railway"
git push origin main
```

### 2. **Crear proyecto en Railway**

1. Ve a [railway.app](https://railway.app)
2. Haz clic en "New Project"
3. Selecciona "Deploy from GitHub repo"
4. Conecta tu cuenta de GitHub
5. Selecciona el repositorio `twitch-overlay`

### 3. **Configurar variables de entorno**

En el dashboard de Railway, ve a "Variables" y agrega:

```
TWITCH_CLIENT_ID=tu_client_id_aqui
TWITCH_CLIENT_SECRET=tu_client_secret_aqui
TWITCH_REDIRECT_URI=https://tu-proyecto.railway.app/auth/callback
PORT=3000
NODE_ENV=production
```

### 4. **Configurar dominio personalizado (opcional)**

- Ve a "Settings" > "Domains"
- Agrega un dominio personalizado si lo deseas
- Railway te dará una URL automática como: `https://tu-proyecto.railway.app`

### 5. **Verificar el deploy**

- El deploy debería iniciarse automáticamente
- Ve a "Deployments" para ver el progreso
- Una vez completado, ve a "Settings" > "Domains" para obtener la URL

## 🔧 URLs importantes después del deploy:

- **Overlay para OBS**: `https://tu-proyecto.railway.app/overlay.html`
- **Panel de configuración**: `https://tu-proyecto.railway.app/config.html`
- **Test del overlay**: `https://tu-proyecto.railway.app/test-overlay`
- **Health check**: `https://tu-proyecto.railway.app/health`

## ⚠️ Importante:

1. **Actualiza la Redirect URI** en Twitch Developer Console con la nueva URL
2. **Prueba todas las funciones** antes de usar en producción
3. **Monitorea los logs** en Railway para detectar errores

## 🎯 Próximos pasos:

1. Hacer el deploy
2. Configurar variables de entorno
3. Probar el overlay
4. Configurar en OBS
5. ¡Disfrutar del overlay! 🎉
