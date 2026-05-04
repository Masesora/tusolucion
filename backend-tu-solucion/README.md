# Backend · Tu Solución con IA en vivo

Endpoint de generación de PRD MAS@FRAME® en streaming con OpenAI GPT-4o.

---

## Qué hace

1. Recibe del frontend los datos del cuestionario *(7 micropreguntas)*
2. Inyecta esos datos en el prompt MAS@FRAME® definitivo
3. Llama a OpenAI con `stream: true`
4. Devuelve el PRD palabra por palabra al frontend usando **Server-Sent Events**
5. Al final, envía un evento extra con el código descuento personalizado

El cliente ve el PRD escribirse en pantalla en directo. Sensación: *"esta gente tiene una IA que está pensando en mí ahora mismo."*

---

## Setup paso a paso

### 1. Conseguir API key de OpenAI

- Ir a [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Crear cuenta si no la tienes
- Crear nueva clave secreta
- Cargar saldo *(con 10€ aguanta ~50-200 PRDs según largura)*

### 2. Configurar el proyecto

```bash
cd backend-tu-solucion
npm install
cp .env.example .env
# Editar .env y poner tu OPENAI_API_KEY
```

### 3. Probar local

```bash
npm start
```

Comprobar que arranca:
```bash
curl http://localhost:3001/api/health
# → {"ok":true,"model":"gpt-4o","discount_pct":15,"discount_hours":2,"has_api_key":true}
```

### 4. Probar el endpoint con un caso real

```bash
curl -N -X POST http://localhost:3001/api/generate-prd \
  -H "Content-Type: application/json" \
  -d '{
    "client": {
      "name": "María",
      "activity": "Reiki y jabones artesanos",
      "sector": "Salud y bienestar",
      "size": "Autónomo"
    },
    "diagnosis": {
      "areaId": 8,
      "areaName": "Continuidad del titular",
      "subareaId": "8.1",
      "subareaName": "Dependencia operativa",
      "observation": "Llevo dos negocios paralelos y la cabeza no me da",
      "vision": "Cerrar el día sabiendo que no se me ha escapado nadie",
      "intensity": 5
    }
  }'
```

Deberías ver el PRD streamearse en tu terminal.

---

## Despliegue

### Render.com *(igual que el resto de tus servicios)*

1. **Subir este folder** a un repo nuevo de GitHub *(ej: `masesora-backend`)*
2. **Render → New Web Service** → conectar al repo
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. **Variables de entorno:** copiar las de `.env.example` con valores reales
6. Deploy. Render te dará una URL del tipo `https://masesora-backend.onrender.com`

### Conectar con tu-solucion.html

En el frontend *(`tu-solucion.html`)*, cambiar la URL del fetch por la URL de Render:

```js
const API_BASE = 'https://masesora-backend.onrender.com';
const response = await fetch(`${API_BASE}/api/generate-prd`, { ... });
```

Yo te dejo cableado el código del frontend en cuanto valides el mockup v3.

---

## Coste estimado de OpenAI

| Modelo | Por sesión | Para 100 sesiones/mes | Para 1.000/mes |
|---|---|---|---|
| **gpt-4o** *(recomendado)* | ~0.10-0.20€ | ~10-20€ | ~100-200€ |
| **gpt-4o-mini** *(más barato)* | ~0.01-0.03€ | ~1-3€ | ~10-30€ |

OpenAI te avisa cuando el saldo baja. Puedes empezar con 20€ tranquilamente.

---

## Rangos de precio de los servicios (PRO / PREMIUM)

El prompt está configurado para que la IA proponga **dos alternativas** al cliente:

| Opción | Stack | Plazo | Precio orientativo |
|---|---|---|---|
| **PRO** · El esencial | HTML + Google Sheets + Apps Script | 2 semanas | **Desde 600 €** |
| **PREMIUM** · El completo | Notion + WhatsApp Business + Make.com + GPT-4o | 4 semanas | **Desde 1.800 €** |

**Para ajustar los precios**, edita los bloques `<div class="alt-price">` en el `SYSTEM_PROMPT` del archivo `generate-prd.js`. Cambia *"Desde 600 €"* y *"Desde 1.800 €"* por las cifras que decidas.

El descuento del 15% se aplica sobre la opción que el cliente elija al reservar (Cal.com recibe `?option=PRO` o `?option=PREMIUM` + el código).

---

## Estructura de eventos SSE que recibe el frontend

```
event: chunk
data: {"markdown":"## Pieza que frena tu negocio · "}

event: chunk
data: {"markdown":"Cuello de botella fundacional\n\nTu negocio funciona porque tú estás..."}

... más chunks ...

event: discount
data: {"code":"DESC-A8B3","valid_until":"2026-05-04T20:30:00.000Z","discount_pct":15,"cal_url":"https://cal.com/masesora/reunion?discount=DESC-A8B3"}

event: done
data: {"ok":true}
```

Si algo falla:
```
event: error
data: {"message":"No hemos podido construir tu PRD ahora. Reserva igualmente y lo construimos en la reunión."}
```

---

## Personalización del prompt

El prompt MAS@FRAME® está en `generate-prd.js`, constante `SYSTEM_PROMPT`.

Para afinarlo:
1. Editas el `SYSTEM_PROMPT` con el texto que quieras
2. `npm start` recarga
3. Pruebas con `curl` *(comando de arriba)*
4. Iteras hasta que la IA devuelva PRDs como tú quieres

**Recomendación:** prueba con 5-10 perfiles distintos de cliente *(autónomo, pyme, sector salud, sector comercio, etc.)* antes de poner en producción. Así detectas casos donde la IA inventa cosas raras.

---

## Próximos pasos *(opcionales)*

- **Persistir sesiones en BBDD** *(Mongo, Postgres)* — descomentar el `saveSessionToDB()` al final del handler
- **Webhook a Cal.com** cuando se aplique un código descuento — para que Maite vea automáticamente quién reservó con qué código
- **Email recordatorio a 1h** si el cliente no ha reservado todavía y le quedan 60 min de descuento
- **Rate limiting** *(express-rate-limit)* para evitar abuso
- **Logging** con Sentry / LogRocket para detectar fallos del prompt en producción

---

## Soporte

Si algo no funciona, revisa en este orden:
1. `curl http://localhost:3001/api/health` → ¿devuelve `has_api_key: true`?
2. ¿OpenAI tiene saldo?
3. Logs del servidor → ¿error de OpenAI? ¿timeout?
4. Si todo OK, abrir issue en el repo
