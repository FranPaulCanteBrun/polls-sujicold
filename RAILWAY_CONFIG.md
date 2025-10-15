# Railway Configuration

## 🚀 Variables de Entorno Requeridas

Configura estas variables en el dashboard de Railway:

### **Variables Obligatorias:**

```
TWITCH_CLIENT_ID=tu_client_id_de_twitch
TWITCH_CLIENT_SECRET=tu_client_secret_de_twitch
TWITCH_REDIRECT_URI=https://tu-proyecto.railway.app/auth/callback
```

### **Variables Opcionales:**

```
PORT=3000
NODE_ENV=production
```

## 📋 Pasos para configurar:

1. **Ve a tu proyecto en Railway**
2. **Haz clic en "Variables"**
3. **Agrega cada variable** con su valor correspondiente
4. **Guarda los cambios**

## ⚠️ Importante:

- **TWITCH_REDIRECT_URI** debe usar la URL de tu proyecto Railway
- **No incluyas espacios** alrededor del signo `=`
- **Las variables son sensibles** - no las compartas públicamente

## 🔧 Obtener credenciales de Twitch:

1. Ve a [Twitch Developer Console](https://dev.twitch.tv/console)
2. Crea una nueva aplicación
3. Copia el Client ID y Client Secret
4. Configura la Redirect URI con tu URL de Railway
