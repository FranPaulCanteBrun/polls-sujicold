# 🎨 Overlay de Encuestas para Twitch

Un overlay sincronizado automáticamente con las encuestas nativas de Twitch (`/poll`) que se actualiza en tiempo real usando EventSub WebSocket.

## ✨ Características

- 🔄 **Sincronización automática** con encuestas nativas de Twitch
- 🎨 **Diseño cute/chill** con colores pasteles y animaciones suaves
- ⚙️ **Panel de configuración** completo y fácil de usar
- 🎭 **Efectos especiales** al finalizar encuestas (confeti, brillo, partículas)
- 📱 **Responsive** y optimizado para OBS
- 🚀 **Deploy fácil** en Railway

## 🛠️ Tecnologías

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML5 + Tailwind CSS + Anime.js
- **Twitch API**: EventSub WebSocket + OAuth 2.0
- **Hosting**: Railway
- **Animaciones**: Anime.js + Canvas Confetti

## 📋 Requisitos Previos

1. **Cuenta de Twitch Developer**

   - Ve a [https://dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
   - Inicia sesión con tu cuenta de Twitch
   - Crea una nueva aplicación

2. **Credenciales necesarias**:
   - Client ID
   - Client Secret
   - Redirect URI (se configura automáticamente)

## 🚀 Instalación Local

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd twitch-overlay
```

### 2. Instalar dependencias

```bash
npm run install-all
```

### 3. Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp env.example .env

# Editar .env con tus credenciales
TWITCH_CLIENT_ID=tu_client_id_aqui
TWITCH_CLIENT_SECRET=tu_client_secret_aqui
TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000
NODE_ENV=development
```

### 4. Ejecutar en modo desarrollo

```bash
npm run dev
```

El servidor estará disponible en:

- 🌐 **Aplicación**: http://localhost:3000
- ⚙️ **Configuración**: http://localhost:3000/config
- 📺 **Overlay**: http://localhost:3000/overlay

## 🌐 Deploy en Railway

### 1. Preparar el proyecto

1. Sube tu código a GitHub
2. Ve a [Railway](https://railway.app)
3. Conecta tu repositorio de GitHub

### 2. Configurar variables de entorno

En Railway, agrega estas variables:

```
TWITCH_CLIENT_ID=tu_client_id_aqui
TWITCH_CLIENT_SECRET=tu_client_secret_aqui
TWITCH_REDIRECT_URI=https://tu-app.railway.app/auth/callback
NODE_ENV=production
```

### 3. Deploy automático

Railway detectará automáticamente el `railway.json` y desplegará tu aplicación.

## 🎮 Configuración en OBS

### 1. Agregar Browser Source

1. En OBS, agrega una nueva fuente
2. Selecciona **"Browser Source"**
3. Configura:
   - **URL**: `https://tu-app.railway.app/overlay`
   - **Ancho**: `1920`
   - **Alto**: `1080`
   - ✅ **Shutdown source when not visible**
   - ✅ **Refresh browser when scene becomes active**

### 2. Configuración recomendada

- **FPS**: 30
- **CSS personalizado**: (opcional, para ajustes específicos)

## ⚙️ Panel de Configuración

Accede a `/config` para personalizar:

### 🎨 Estilo Visual

- **Paletas de colores**: Pastel, Vibrante, Atardecer, Océano
- **Color personalizado**: Selector de color
- **Opacidad del fondo**: 0-100%

### 📍 Posición

- **Posición vertical**: Arriba, Centro, Abajo
- **Padding**: Espaciado desde los bordes

### ✨ Animaciones

- **Duración**: 0.5s - 2.0s
- **Efecto de victoria**: Brillo, Confeti, Partículas, Rebote
- **Habilitar confeti**: Toggle

### ⚙️ Avanzado

- **Tiempo antes de ocultar**: 3-10 segundos
- **Tamaño de fuente**: 14-24px

## 🎯 Uso

### 1. Conectar con Twitch

1. Ve a `/config`
2. Haz clic en **"Conectar con Twitch"**
3. Autoriza la aplicación
4. ¡Listo! El overlay se sincronizará automáticamente

### 2. Crear encuestas

En tu chat de Twitch, usa el comando nativo:

```
/poll ¿Cuál es tu color favorito? Rosa Azul Verde Morado
```

### 3. Ver el overlay

El overlay aparecerá automáticamente cuando:

- ✅ Inicies una encuesta con `/poll`
- ✅ Los viewers voten (actualización en tiempo real)
- ✅ La encuesta termine (con efectos especiales)

## 🔧 Estructura del Proyecto

```
twitch-overlay/
├── backend/
│   ├── src/
│   │   ├── server.js          # Servidor Express + Socket.io
│   │   ├── twitchClient.js    # Autenticación OAuth + API
│   │   ├── eventSubHandler.js # EventSub WebSocket
│   │   └── config.js          # Configuración y validación
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── overlay.html           # Overlay para OBS
│   ├── config.html            # Panel de configuración
│   ├── css/styles.css         # Estilos personalizados
│   ├── js/
│   │   ├── overlay.js         # Lógica del overlay
│   │   ├── config.js          # Panel de configuración
│   │   └── socket-client.js   # Cliente WebSocket
│   └── assets/
├── .env
├── .gitignore
├── package.json
├── railway.json
└── README.md
```

## 🐛 Troubleshooting

### ❌ "No se puede conectar al servidor"

**Solución**:

1. Verifica que el servidor esté ejecutándose
2. Revisa la consola del navegador para errores
3. Asegúrate de que las variables de entorno estén configuradas

### ❌ "Error de autenticación con Twitch"

**Solución**:

1. Verifica que tu Client ID y Secret sean correctos
2. Asegúrate de que la Redirect URI coincida exactamente
3. Revisa que tu aplicación de Twitch tenga los scopes correctos

### ❌ "EventSub no conecta"

**Solución**:

1. Verifica que estés autenticado con Twitch
2. Revisa los logs del servidor
3. Asegúrate de que tu canal tenga permisos para polls

### ❌ "El overlay no aparece en OBS"

**Solución**:

1. Verifica que la URL sea correcta
2. Asegúrate de que el overlay esté visible (no oculto)
3. Revisa que las dimensiones sean 1920x1080
4. Prueba refrescar el browser source

## 📚 API Reference

### Eventos de Socket.io

#### Cliente → Servidor

- `get_status`: Solicita el estado del servidor

#### Servidor → Cliente

- `server_status`: Estado del servidor y autenticación
- `poll_event`: Eventos de encuestas (begin, progress, end)

### Estructura de datos de encuestas

```javascript
{
  type: 'poll_begin' | 'poll_progress' | 'poll_end',
  data: {
    id: string,
    title: string,
    choices: [
      { id: string, title: string, votes: number }
    ],
    started_at: timestamp,
    ends_at: timestamp,
    status: 'active' | 'completed'
  }
}
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🙏 Agradecimientos

- [Twitch API](https://dev.twitch.tv/) por la documentación y APIs
- [Railway](https://railway.app/) por el hosting gratuito
- [Tailwind CSS](https://tailwindcss.com/) por el framework de estilos
- [Anime.js](https://animejs.com/) por las animaciones
- [Canvas Confetti](https://github.com/catdad/canvas-confetti) por los efectos especiales

---

**¿Necesitas ayuda?** Abre un issue en GitHub o contacta al desarrollador.

**¡Disfruta streaming!** 🎮✨
