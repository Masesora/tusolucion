# Backend · Tu Solución MASESORA · v2 (Claude + email)

Endpoint de generación de PRD adaptativo en streaming con **Claude (Anthropic)** + notificación por email a `info@masesora.com` con cada PRD generado.

---

## Qué hace

```
Cliente termina cuestionario adaptativo (7 preguntas)
        ↓
POST /api/generate-prd
        ↓
Backend inyecta datos en SYSTEM_PROMPT MAS@FRAME®
        ↓
Llama a Claude Sonnet 4.6 con stream=true
        ↓
Devuelve PRD palabra por palabra al frontend (SSE)
        ↓
Genera código descuento DESC-XXXX (15% · 2h validez)
        ↓
Envía email a info@masesora.com con:
  · Datos cliente · pieza detectada · opciones · precios
  · Código descuento + caducidad
  · PRD completo en HTML
```

---

## Setup paso a paso · ~30-45 min

### 1. Anthropic API key

1. Crear cuenta en [console.anthropic.com](https://console.anthropic.com)
2. Cargar saldo (con 10€ aguantas ~50-200 PRDs)
3. Ir a [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
4. Crear nueva clave secreta (empieza por `sk-ant-`)
5. **Cópiala y guárdala** — solo se ve una vez

### 2. App Password de Gmail (para `info@masesora.com`)

Esto solo funciona si la cuenta tiene **Verificación en 2 pasos** activada.

1. Activar 2FA en [myaccount.google.com/security](https://myaccount.google.com/security) si no está
2. Ir a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Crear nueva: nombre *"MASESORA backend"*
4. Google te da una contraseña de **16 caracteres** (sin espacios)
5. **Cópiala y guárdala** — solo se ve una vez

### 3. Subir el backend a tu repo

Si ya tienes repo en GitHub para el backend:

```bash
cd backend-tu-solucion
git init
git add .
git commit -m "v2 backend con Claude + email"
git remote add origin <tu-repo-url>
git push -u origin main
```

Si no, créalo nuevo en GitHub con los 5 archivos:
- `generate-prd.js`
- `package.json`
- `.env.example` *(no subas `.env` real al repo)*
- `README.md`
- `EJEMPLO-COMPLETO.md`

### 4. Conectar a Render

1. En Render dashboard → **New +** → **Web Service**
2. Conecta el repo de GitHub
3. Configura:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Region:** Frankfurt (más rápido para España)
   - **Plan:** Free (suficiente para empezar)

### 5. Variables de entorno en Render

En el panel del Web Service → **Environment** → **Add Environment Variable**:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-XXX...` *(de paso 1)* |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
| `DISCOUNT_PERCENT` | `15` |
| `DISCOUNT_HOURS` | `2` |
| `NOTIFY_EMAIL` | `info@masesora.com` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `info@masesora.com` |
| `SMTP_PASS` | `xxxxxxxxxxxxxxxx` *(de paso 2 · 16 chars sin espacios)* |
| `PORT` | `3001` |

### 6. Deploy

Render compila y despliega solo. Te da una URL del tipo:

```
https://masesora-backend.onrender.com
```

### 7. Verificar que funciona

```bash
curl https://masesora-backend.onrender.com/api/health
```

Esperado:
```json
{
  "ok": true,
  "model": "claude-sonnet-4-6",
  "discount_pct": 15,
  "discount_hours": 2,
  "has_anthropic_key": true,
  "has_smtp": true,
  "notify_email": "info@masesora.com",
  "pieces": 8
}
```

Si todo es `true` y `pieces: 8` → **arriba**.

---

## Probar la generación de un PRD

```bash
curl -N -X POST https://masesora-backend.onrender.com/api/generate-prd \
  -H "Content-Type: application/json" \
  -d '{
    "client": {
      "name": "Roberto",
      "activity": "Despacho de abogados especializado en mercantil",
      "sector": "Servicios profesionales",
      "size": "6-15",
      "volume": "100-500",
      "email": "roberto@ejemplo.com"
    },
    "diagnosis": {
      "piece": "P4",
      "branchAnswer": "Tengo que mirar varios sitios",
      "tools": ["contasimple", "crm", "whatsapp", "sheets"],
      "vision": "Sabría en qué punto está cada caso sin pensarlo",
      "intensity": 4
    }
  }'
```

Deberías ver:
1. PRD streameándose en el terminal
2. Email llegando a `info@masesora.com` con todo el detalle

---

## Coste por sesión

| Modelo | Por sesión | 100/mes | 1.000/mes |
|---|---|---|---|
| **claude-sonnet-4-6** *(recomendado)* | ~0.05-0.20 € | ~5-20 € | ~50-200 € |
| **claude-opus-4-6** *(más calidad)* | ~0.30-1.00 € | ~30-100 € | ~300-1.000 € |
| **claude-haiku-4-5** *(más barato)* | ~0.005-0.02 € | ~0.5-2 € | ~5-20 € |

Cambiar modelo: solo edita `ANTHROPIC_MODEL` en Render.

---

## Endpoints disponibles

| Método | Endpoint | Para qué |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio + check de configuración |
| `POST` | `/api/generate-prd` | Genera PRD streaming (SSE) + envía email |
| `POST` | `/api/calculate-price` | Calcula solo el precio sin llamar a Claude *(útil para previews internos)* |

---

## Estructura de eventos SSE que recibe el frontend

```
event: chunk
data: {"markdown":"## Pieza que frena tu negocio · Operativa..."}

event: chunk
data: {"markdown":"...sin trazabilidad\n\nSabes que tienes..."}

... más chunks ...

event: discount
data: {"code":"DESC-A8B3","valid_until":"2026-05-04T20:30:00.000Z","discount_pct":15,"cal_url":"https://cal.com/masesora/reunion?discount=DESC-A8B3"}

event: done
data: {"ok":true}
```

Si algo falla:
```
event: error
data: {"message":"No hemos podido construir tu PRD ahora..."}
```

---

## Personalización del prompt

`SYSTEM_PROMPT` está en `generate-prd.js`. Para ajustarlo:

1. Edita el bloque `const SYSTEM_PROMPT = ...`
2. Commit + push
3. Render redeploya solo en ~1 min
4. Probar con `curl` el ejemplo de Roberto
5. Iterar hasta que la voz/contenido te encajen

**Recomendación:** prueba con 5-10 perfiles distintos antes de poner en producción.

---

## Tabla de precios (8 piezas × 3 niveles)

Está en `generate-prd.js` constante `PIECES`. Para ajustar precios:

```js
P1: { ..., bases: { LITE: 350, PRO: 800, PREMIUM: 1800 } }
//          ↑ edita estos números
```

Multiplicadores (función `calculatePrice`):
- 2-5p × 1.5 · 6-15p × 2.2
- Volumen 100-500 × 1.1 · >500 × 1.3
- Tiene CRM −10% · Sectorial +15% · Solo nada −5%

Redondeo final a 50€.

---

## Estructura de archivos

```
backend-tu-solucion/
├── generate-prd.js       ← código principal
├── package.json          ← dependencias
├── .env.example          ← plantilla env vars (NO subir .env real)
├── README.md             ← este archivo
└── EJEMPLO-COMPLETO.md   ← ejemplo del prompt + payload + respuesta
```

---

## Soporte

Si algo no funciona, revisa en este orden:
1. `curl /api/health` → ¿`has_anthropic_key: true` y `has_smtp: true`?
2. ¿Anthropic tiene saldo? ([console.anthropic.com](https://console.anthropic.com))
3. Logs del servicio en Render → ¿error de Anthropic? ¿error SMTP?
4. ¿El App Password de Gmail está bien (16 chars sin espacios)?
5. ¿Está activada la 2FA en la cuenta de Gmail?

---

## Próximos pasos (después de tener esto arriba)

- [ ] Webhook de Cal.com → backend recibe la reserva con código y cierra el círculo automático
- [ ] Persistir sesiones en Mongo/Postgres si quieres analítica
- [ ] Rate limiting para evitar abuso
- [ ] Logging con Sentry para detectar fallos del prompt en producción
- [ ] A/B test de modelo *(Sonnet vs Opus)* para ver cuál convierte mejor
