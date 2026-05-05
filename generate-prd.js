/**
 * MASESORA · Endpoint de generación de Tu Solución adaptativa en vivo con Claude
 * ========================================================================
 * POST /api/generate-prd
 *
 * Cuestionario adaptativo de 7 preguntas con ramificación según pieza.
 * Devuelve Tu Solución en streaming SSE con DOS opciones (de 3 niveles posibles)
 * ajustadas al perfil real del cliente y precios calculados en vivo.
 * Tras cerrar el streaming, envía email a info@masesora.com con todo.
 *
 * Stack: Node.js + Express + Anthropic Claude SDK + nodemailer (SMTP Gmail)
 * Modelo recomendado: claude-sonnet-4-6
 * Coste estimado por sesión: ~0.05-0.20 EUR
 */

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const DISCOUNT_PCT = parseInt(process.env.DISCOUNT_PERCENT || '15', 10);
const DISCOUNT_HOURS = parseInt(process.env.DISCOUNT_HOURS || '2', 10);
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'info@masesora.com';

// SMTP · auto-detección SSL/STARTTLS según puerto
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpTransporter = (process.env.SMTP_HOST && process.env.SMTP_USER)
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,  // true para SSL (465) · false para STARTTLS (587)
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false }  // tolerante con certificados de proveedores no-Big-Tech (Nominalia, Strato, etc.)
    })
  : null;

// ============================================================
// CATÁLOGO DE 8 PIEZAS · precios base (bajados 25% adicional)
// ============================================================
const PIECES = {
  P1: { name: 'Pieza fundacional sin reemplazo', cause: 'Tu negocio funciona porque tú estás. Si no estás un día, todo se para. No es desorganización tuya — es ausencia de estructura paralela.', bases: { LITE: 350, PRO: 800, PREMIUM: 1800 } },
  P2: { name: 'Embudo con fugas', cause: 'Las personas interesadas no son el problema. Lo que pasa entre que llegan y deciden es donde se enfrían.', bases: { LITE: 250, PRO: 600, PREMIUM: 1400 } },
  P3: { name: 'Comunicación que se enfría', cause: 'Cierras un trabajo y el cliente desaparece de tu radar. Vuelves a captar desde cero cuando podrías estar volviendo a quien ya conoces.', bases: { LITE: 220, PRO: 500, PREMIUM: 1250 } },
  P4: { name: 'Operativa sin trazabilidad', cause: 'Sabes que tienes trabajos en marcha, pero al detalle quién está dónde, qué falta y qué se prometió cuándo solo lo sabe tu cabeza.', bases: { LITE: 300, PRO: 700, PREMIUM: 1600 } },
  P5: { name: 'Caja opaca', cause: 'El dinero entra y sale, pero no sabes en tiempo real qué te queda, qué te deben ni qué te va a doler el mes que viene.', bases: { LITE: 320, PRO: 750, PREMIUM: 1700 } },
  P6: { name: 'Cumplimiento a ciegas', cause: 'Las obligaciones fiscales/laborales se llevan por inercia. Si algo se cuela, te enteras tarde y caro.', bases: { LITE: 220, PRO: 450, PREMIUM: 1150 } },
  P7: { name: 'Cada cosa hecha de forma distinta', cause: 'El mismo trabajo se hace de tres formas según quién lo haga. No es desorden — es ausencia de estándar.', bases: { LITE: 300, PRO: 650, PREMIUM: 1600 } },
  P8: { name: 'Sistema que ha tocado techo', cause: 'No es que falte demanda. Es que para atender más tendrías que hacer lo mismo más veces, y ya no caben más horas en el día.', bases: { LITE: 400, PRO: 1000, PREMIUM: 2150 } }
};

// ============================================================
// CÁLCULO DE PRECIO con multiplicadores ajustados
// ============================================================
function calculatePrice(pieceCode, level, ctx) {
  const base = PIECES[pieceCode]?.bases?.[level];
  if (!base) return null;
  let price = base;

  // Multiplicador tamaño (más fuerte)
  if (ctx.size === '2-5') price *= 1.5;
  else if (ctx.size === '6-15') price *= 2.2;

  // Multiplicador volumen (más suave)
  if (ctx.volume === '100-500') price *= 1.1;
  else if (ctx.volume === 'Más de 500') price *= 1.3;

  // Ajustes por herramientas
  const tools = ctx.tools || [];
  const hasCRM = tools.includes('crm') || tools.includes('contasimple');
  const hasSectorial = tools.includes('sectorial');
  const onlyNada = tools.length === 1 && tools[0] === 'nada';

  if (hasCRM) price *= 0.9;
  if (hasSectorial) price *= 1.15;
  if (onlyNada) price *= 0.95;

  return Math.round(price / 50) * 50;
}

// ============================================================
// QUÉ OPCIONES MOSTRAR según perfil
// ============================================================
function getOptionsForProfile(ctx) {
  if (ctx.size === 'Autónomo') return ['LITE', 'PRO'];
  if (ctx.size === '6-15') return ['PRO', 'PREMIUM'];
  return ['PRO', 'PREMIUM']; // 2-5
}

// ============================================================
// SYSTEM PROMPT TU SOLUCIÓN
// ============================================================
const SYSTEM_PROMPT = `Formo parte del Equipo MASESORA · Constructores de Sistemas.
Recibo los datos de un diagnóstico adaptativo completado por una empresa cliente.
Mi objetivo es generar Tu Solución, que se mostrará INMEDIATAMENTE en pantalla
al cliente, en streaming, con DOS alternativas adaptadas a su perfil real.

# REGLAS DE TONO
- Profesional, claro, dinámico. 2ª persona (tutéale).
- Voz de empresa seria que entiende de negocio hablando a otra empresa que decide.
- Sin jerga clínica, sin purismo arquitectónico, sin "vendedor de humos".
- El cliente lee y siente: "esta gente sabe construir".

# REGLAS DE FORMATO
- Devuelve Tu Solución en MARKDOWN (con HTML literal donde se indique).
- Usa H2 para las secciones.
- 900-1.400 palabras totales.
- Si el cliente no aporta info, NO te la inventes — usa "se confirma en sesión".
- NUNCA menciones marcas comerciales en Tu Solución (ni Notion, ni Trello, ni Make.com, ni HubSpot, ni Airtable, ni Sheets...). Usa categorías abstractas.
- NUNCA menciones nombres concretos de herramientas en Tu Solución que ve el cliente · usa categorías abstractas (la construcción técnica detallada se afina en la sesión).

# OPCIONES SEGÚN PERFIL · NUNCA mostrar las 3, solo las 2 que encajan
- Autónomo → LITE + PRO
- 2-5 personas → PRO + PREMIUM
- 6-15 personas → PRO + PREMIUM

El backend te pasa en el contexto las dos opciones que tocan + los precios calculados.
USA EXACTAMENTE esos precios. NO inventes.

# ESTRUCTURA OBLIGATORIA DE TU SOLUCIÓN

## Pieza que frena tu negocio · [NOMBRE EXACTO DE LA PIEZA]
Una frase con la causa raíz canónica de la pieza (te la doy en el contexto).
Si el cliente proporcionó respuesta libre, citarla literalmente entre comillas con <em>.

## Dos caminos para resolverlo · adaptados a tu perfil
1-2 líneas explicando que son las DOS opciones que SÍ encajan con su tamaño y volumen.

A continuación renderiza EXACTAMENTE este HTML (NO en Markdown, HTML literal),
sustituyendo [PLACEHOLDERS] por contenido personalizado:

<div class="alt-grid">
  <div class="alt-card">
    <div class="alt-tag">[NIVEL · ETIQUETA]</div>
    <h3 class="alt-name">[NOMBRE PERSONALIZADO DEL SISTEMA PARA ESTE CLIENTE]</h3>
    <p class="alt-desc">[2-3 líneas describiendo qué hace para él]</p>
    <div class="alt-stack-label">Lo que vamos a construir</div>
    <ul class="alt-stack">
      [3-4 ítems con CATEGORÍAS ABSTRACTAS · sin nombres comerciales · ej: "hub central operativo · automatizaciones de mensajes · agenda sincronizada · asistente IA conversacional" · NO uses <code>]
    </ul>
    <div class="alt-kpis-label">Lo que se mueve</div>
    <ul class="alt-kpis">
      [3-4 KPIs con valor actual → objetivo · usa <strong> para los números]
    </ul>
    <p class="alt-roadmap">[<strong>X semanas</strong> · 2-3 FASES abstractas tipo "Fase 1 · Mapeo · Fase 2 · Construcción · Fase 3 · Onboarding" · NUNCA describas qué pasa cada semana]</p>
    <div class="alt-price">
      <div class="alt-price-label">Inversión orientativa</div>
      <div class="alt-price-range"><span class="alt-price-from">Desde</span> <strong>[PRECIO €]</strong></div>
      <div class="alt-price-detail">Cifra cerrada en sesión de validación · sin sorpresas</div>
    </div>
    <button class="alt-cta alt-cta-light" data-option="[NIVEL]" data-price="[PRECIO]">Quiero la opción [NIVEL] →</button>
  </div>

  <div class="alt-card recommended">
    [misma estructura para la 2ª opción · el botón usa "alt-cta-recommended"]
  </div>
</div>

# REGLAS PARA LA DESCRIPCIÓN DEL STACK · IMPORTANTE
NO menciones nombres exactos de herramientas tecnológicas en Tu Solución que ve el cliente.
La construcción técnica concreta (qué herramienta, qué reglas, qué integraciones) se afina
en la sesión de validación de 20 minutos. Tu Solución da DIRECCIÓN, no plan de implementación.

Usa categorías abstractas según nivel:

- LITE: "Mini-app personalizada en navegador · base de datos en cuenta del cliente · automatizaciones ligeras · sin coste mensual"
- PRO: "Hub central operativo · gestor de facturación integrado (aprovechando lo que ya tiene si aplica) · canal de mensajería automatizada · agenda sincronizada"
- PREMIUM: "Hub operativo central · CRM integrado (existente o nuevo según caso) · capa de automatizaciones encadenadas · asistente IA conversacional"

Cuando el cliente diga que YA tiene una herramienta concreta, RECONOCE la categoría sin mencionar
el nombre técnico: en vez de "tu HubSpot Free integrado", di "tu CRM actual aprovechado e integrado".

# REGLAS PARA EL ROADMAP · SUSTITUIR DETALLE SEMANAL POR FASES
NO des roadmap semana a semana detallado. Usa fases abstractas:

- LITE: "Fase 1 · Mapeo del flujo actual · Fase 2 · Construcción y entrega"
- PRO: "Fase 1 · Diagnóstico operativo · Fase 2 · Construcción del sistema · Fase 3 · Onboarding y ajuste"
- PREMIUM: "Fase 1 · Mapeo y arquitectura · Fase 2 · Construcción modular · Fase 3 · Capa de IA y automatizaciones · Fase 4 · Onboarding 1:1"

Indica plazos GENERALES ("2 semanas", "3-5 semanas", "5-8 semanas") sin detallar qué pasa
en cada semana concreta. Eso se aterriza en la sesión.

## Acompañamiento incluido en ambas opciones · 3 meses sin coste post-entrega
"Trabajamos contigo después de la entrega hasta que el sistema sea natural en tu día a día. Si en 30 días no está integrado en tu operativa, ajustamos sin coste."

## Una nota mía
3-4 líneas en 1ª persona, firmadas por Maite Cabezuelos.
Tono cercano. Recoger 1-2 detalles del cliente (su nombre, su actividad, su visión).
Si dejó visión, citarla entre comillas con <em>.

# FIRMA FINAL
— Maite Cabezuelos · Equipo MASESORA · Constructores de Sistemas`;

// ============================================================
// Helpers
// ============================================================
function generateDiscountCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = 'DESC-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function buildUserMessage(payload) {
  const { client = {}, diagnosis = {} } = payload;
  const ctx = {
    size: client.size,
    volume: client.volume,
    tools: diagnosis.tools || []
  };
  const piece = PIECES[diagnosis.piece] || PIECES.P4;
  const options = getOptionsForProfile(ctx);

  const prices = {};
  options.forEach(level => prices[level] = calculatePrice(diagnosis.piece || 'P4', level, ctx));

  return `DATOS DEL DIAGNÓSTICO ADAPTATIVO

## CONTEXTO DEL CLIENTE
- Nombre: ${client.name || '(no proporcionado)'}
- Actividad: ${client.activity || '(no proporcionada)'}
- Sector: ${client.sector || '(no proporcionado)'}
- Tamaño: ${client.size || '(no proporcionado)'}
- Volumen mensual: ${client.volume || '(no proporcionado)'}

## PIEZA ESTRUCTURAL DETECTADA POR EL MOTOR
- Código: ${diagnosis.piece || 'P4'}
- Nombre: ${piece.name}
- Causa raíz canónica: ${piece.cause}

## RESPUESTA A LA PREGUNTA RAMIFICADA
${diagnosis.branchAnswer || '(no proporcionada)'}

## HERRAMIENTAS QUE USA HOY
${(diagnosis.tools || []).join(', ') || 'Nada estructurado'}

## VISIÓN DEL CLIENTE
${diagnosis.vision || '(no proporcionada — la pediremos en la sesión)'}

## INTENSIDAD (escala 1-5)
${diagnosis.intensity || 'N/A'} de 5

## OPCIONES A MOSTRAR (calculadas por el motor según perfil)
- Opción 1 (NO recomendada · etiqueta normal): ${options[0]} · precio: ${prices[options[0]]} €
- Opción 2 (RECOMENDADA · debe llevar clase "recommended"): ${options[1]} · precio: ${prices[options[1]]} €

USA estos precios EXACTOS en el HTML. NO inventes otros.

Genera ahora Tu Solución siguiendo la estructura obligatoria.`;
}

// ============================================================
// Email a info@masesora.com con todo el registro
// ============================================================
async function sendNotificationEmail({ payload, prdMarkdown, code, expiresAt }) {
  if (!smtpTransporter) {
    console.warn('[notify] SMTP no configurado · email no enviado');
    return;
  }

  const { client = {}, diagnosis = {} } = payload;
  const ctx = { size: client.size, volume: client.volume, tools: diagnosis.tools || [] };
  const options = getOptionsForProfile(ctx);
  const prices = {};
  options.forEach(level => prices[level] = calculatePrice(diagnosis.piece || 'P4', level, ctx));

  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#1A1A1A;line-height:1.6">
  <h2 style="color:#0F1A35;border-bottom:2px solid #B89D52;padding-bottom:8px">📋 Nueva Tu Solución generada · MASESORA</h2>

  <h3 style="color:#0F1A35">Cliente</h3>
  <ul>
    <li><strong>Nombre:</strong> ${client.name || '—'}</li>
    <li><strong>Actividad:</strong> ${client.activity || '—'}</li>
    <li><strong>Sector:</strong> ${client.sector || '—'} · ${client.size || '—'} · ${client.volume || '—'} clientes/mes</li>
    <li><strong>Email/WhatsApp:</strong> ${client.email || client.phone || 'no proporcionado'}</li>
  </ul>

  <h3 style="color:#0F1A35">Diagnóstico</h3>
  <ul>
    <li><strong>Pieza detectada:</strong> ${diagnosis.piece || 'P4'} · ${PIECES[diagnosis.piece || 'P4']?.name}</li>
    <li><strong>Respuesta ramificada:</strong> ${diagnosis.branchAnswer || '—'}</li>
    <li><strong>Herramientas actuales:</strong> ${(diagnosis.tools || []).join(', ') || 'Nada estructurado'}</li>
    <li><strong>Visión:</strong> <em>${diagnosis.vision || '—'}</em></li>
    <li><strong>Intensidad:</strong> ${diagnosis.intensity || '—'}/5</li>
  </ul>

  <h3 style="color:#0F1A35">Opciones presentadas + precios calculados</h3>
  <ul>
    ${options.map(lv => `<li><strong>${lv}:</strong> ${prices[lv]} €</li>`).join('')}
  </ul>

  <h3 style="color:#0F1A35">🎁 Código descuento generado</h3>
  <div style="background:#FAF7F2;border:1.5px dashed #B89D52;padding:14px 20px;border-radius:10px;margin:10px 0">
    <div style="font-family:monospace;font-size:1.4rem;font-weight:800;color:#B89D52;letter-spacing:.1em">${code}</div>
    <div style="font-size:.9rem;color:#4A4A4A;margin-top:6px">Válido hasta: <strong>${new Date(expiresAt).toLocaleString('es-ES', { timeZone:'Europe/Madrid' })}</strong> · ${DISCOUNT_PCT}% descuento</div>
  </div>

  <h3 style="color:#0F1A35">📄 Tu Solución generada por la IA</h3>
  <div style="background:#FAF7F2;padding:20px;border-radius:10px;border-left:4px solid #B89D52">
${prdMarkdown.replace(/\n/g, '<br>')}
  </div>

  <hr style="margin:30px 0;border:none;border-top:1px solid #E5DFD3">
  <p style="font-size:.85rem;color:#999">
    Generado automáticamente por <strong>tusolucion.onrender.com</strong> el ${new Date().toLocaleString('es-ES', { timeZone:'Europe/Madrid' })}.<br>
    Cuando el cliente reserve en Cal.com con el código <strong>${code}</strong>, podrás cruzarlo con este email.
  </p>
</body></html>
  `;

  try {
    await smtpTransporter.sendMail({
      from: `"Tu Solución · MASESORA" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `📋 Nueva Tu Solución · ${client.name || 'cliente'} · ${PIECES[diagnosis.piece || 'P4']?.name} · código ${code}`,
      html
    });
    console.log(`[notify] Email enviado a ${NOTIFY_EMAIL} · código ${code}`);
  } catch (err) {
    console.error('[notify] Error enviando email:', err.message);
  }
}

// ============================================================
// Endpoint principal · streaming SSE con Claude
// ============================================================
app.post('/api/generate-prd', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let fullText = '';

  try {
    const userMessage = buildUserMessage(req.body);

    // Streaming con Claude
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const chunk = event.delta.text;
        fullText += chunk;
        sendEvent('chunk', { markdown: chunk });
      }
    }

    const code = generateDiscountCode();
    const expiresAt = Date.now() + DISCOUNT_HOURS * 3600 * 1000;

    sendEvent('discount', {
      code,
      valid_until: new Date(expiresAt).toISOString(),
      discount_pct: DISCOUNT_PCT,
      cal_url: `https://cal.com/masesora/reunion?discount=${code}`
    });

    sendEvent('done', { ok: true });
    res.end();

    // Notificación email · async, no bloquea respuesta al cliente
    sendNotificationEmail({
      payload: req.body,
      prdMarkdown: fullText,
      code,
      expiresAt
    }).catch(err => console.error('[notify] Failed:', err));

  } catch (err) {
    console.error('[generate-prd] Error:', err);
    sendEvent('error', { message: 'No hemos podido construir Tu Solución ahora. Reserva igualmente y la construimos en la reunión.' });
    res.end();
  }
});

// ============================================================
// Health check
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    discount_pct: DISCOUNT_PCT,
    discount_hours: DISCOUNT_HOURS,
    has_anthropic_key: Boolean(process.env.ANTHROPIC_API_KEY),
    has_smtp: Boolean(smtpTransporter),
    notify_email: NOTIFY_EMAIL,
    pieces: Object.keys(PIECES).length
  });
});

// ============================================================
// Test endpoint · calcular precio sin llamar a Claude
// ============================================================
app.post('/api/calculate-price', (req, res) => {
  const { client = {}, diagnosis = {} } = req.body;
  const ctx = { size: client.size, volume: client.volume, tools: diagnosis.tools || [] };
  const options = getOptionsForProfile(ctx);
  const prices = {};
  options.forEach(level => prices[level] = calculatePrice(diagnosis.piece || 'P4', level, ctx));
  res.json({
    piece: diagnosis.piece || 'P4',
    pieceName: PIECES[diagnosis.piece || 'P4'].name,
    options,
    prices
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[MASESORA] generate-prd corriendo en puerto ${PORT}`);
  console.log(`[MASESORA] Modelo: ${MODEL}`);
  console.log(`[MASESORA] Descuento: ${DISCOUNT_PCT}% válido ${DISCOUNT_HOURS}h`);
  console.log(`[MASESORA] Email notificación: ${NOTIFY_EMAIL} · SMTP ${smtpTransporter ? 'activo' : '⚠ NO configurado'}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('[MASESORA] ⚠ ANTHROPIC_API_KEY no configurada');
});
