/**
 * MASESORA · Endpoint de generación de PRD adaptativo en vivo con IA
 * ====================================================================
 * POST /api/generate-prd
 *
 * Cuestionario adaptativo de 7 preguntas (con ramificación según pieza).
 * Devuelve PRD en streaming SSE con DOS opciones (de 3 niveles posibles)
 * ajustadas al perfil real del cliente y precios calculados en vivo.
 *
 * Stack: Node.js + Express + OpenAI SDK
 * Coste estimado por sesión: ~0.05-0.20 EUR (modelo GPT-4o)
 */

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const DISCOUNT_PCT = parseInt(process.env.DISCOUNT_PERCENT || '15', 10);
const DISCOUNT_HOURS = parseInt(process.env.DISCOUNT_HOURS || '2', 10);

// ============================================================
// CATÁLOGO DE 8 PIEZAS · precios base (bajados 40% del original)
// ============================================================
const PIECES = {
  P1: { name: 'Pieza fundacional sin reemplazo', cause: 'Tu negocio funciona porque tú estás. Si no estás un día, todo se para. No es desorganización tuya — es ausencia de estructura paralela.', bases: { LITE: 500, PRO: 1500, PREMIUM: 3300 } },
  P2: { name: 'Embudo con fugas', cause: 'Las personas interesadas no son el problema. Lo que pasa entre que llegan y deciden es donde se enfrían.', bases: { LITE: 360, PRO: 1100, PREMIUM: 2700 } },
  P3: { name: 'Comunicación que se enfría', cause: 'Cierras un trabajo y el cliente desaparece de tu radar. Vuelves a captar desde cero cuando podrías estar volviendo a quien ya conoces.', bases: { LITE: 300, PRO: 900, PREMIUM: 2300 } },
  P4: { name: 'Operativa sin trazabilidad', cause: 'Sabes que tienes trabajos en marcha, pero al detalle quién está dónde, qué falta y qué se prometió cuándo solo lo sabe tu cabeza.', bases: { LITE: 420, PRO: 1300, PREMIUM: 3000 } },
  P5: { name: 'Caja opaca', cause: 'El dinero entra y sale, pero no sabes en tiempo real qué te queda, qué te deben ni qué te va a doler el mes que viene.', bases: { LITE: 480, PRO: 1400, PREMIUM: 3100 } },
  P6: { name: 'Cumplimiento a ciegas', cause: 'Las obligaciones fiscales/laborales se llevan por inercia. Si algo se cuela, te enteras tarde y caro.', bases: { LITE: 300, PRO: 800, PREMIUM: 2100 } },
  P7: { name: 'Cada cosa hecha de forma distinta', cause: 'El mismo trabajo se hace de tres formas según quién lo haga. No es desorden — es ausencia de estándar.', bases: { LITE: 420, PRO: 1200, PREMIUM: 2900 } },
  P8: { name: 'Sistema que ha tocado techo', cause: 'No es que falte demanda. Es que para atender más tendrías que hacer lo mismo más veces, y ya no caben más horas en el día.', bases: { LITE: 600, PRO: 1800, PREMIUM: 3900 } }
};

// ============================================================
// CÁLCULO DE PRECIO según perfil del cliente
// ============================================================
function calculatePrice(pieceCode, level, ctx) {
  const base = PIECES[pieceCode]?.bases?.[level];
  if (!base) return null;
  let price = base;

  if (ctx.size === '2-5') price *= 1.3;
  else if (ctx.size === '6-15') price *= 1.7;

  if (ctx.volume === '100-500') price *= 1.2;
  else if (ctx.volume === 'Más de 500') price *= 1.4;

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
// SYSTEM PROMPT MAS@FRAME®
// ============================================================
const SYSTEM_PROMPT = `
Formo parte del Equipo MASESORA · Constructores de Sistemas.
Recibo los datos de un diagnóstico adaptativo completado por una empresa cliente.
Mi objetivo es generar el PRD que se mostrará INMEDIATAMENTE en pantalla
al cliente, en streaming, con DOS alternativas adaptadas a su perfil real.

# REGLAS DE TONO
- Profesional, claro, dinámico. 2ª persona (tutéale).
- Voz de empresa seria que entiende de negocio hablando a otra empresa que decide.
- Sin jerga clínica, sin purismo arquitectónico, sin "vendedor de humos".
- El cliente lee y siente: "esta gente sabe construir".

# REGLAS DE FORMATO
- Devuelve el PRD en MARKDOWN (con HTML literal donde se indique).
- Usa H2 para las secciones.
- 900-1.400 palabras totales.
- Si el cliente no aporta una pieza de info, NO te la inventes — usa "se confirma en sesión".
- Las dos alternativas se renderizan con HTML literal (estructura indicada abajo).

# CONTEXTO ADAPTATIVO
El cuestionario captura:
- Nombre + actividad libre
- Sector + tamaño + volumen mensual
- Pieza estructural detectada (1 de 8)
- Respuesta a pregunta-clave ramificada según pieza
- Herramientas que usa hoy (multi-select)
- Visión libre opcional
- Intensidad del problema (1-5)

# OPCIONES SEGÚN PERFIL · NUNCA mostrar las 3, solo las 2 que encajan
- Autónomo → LITE + PRO
- 2-5 personas → PRO + PREMIUM
- 6-15 personas → PRO + PREMIUM (sin LITE)

El backend te pasará en el campo \`profile.options\` las dos opciones que toca mostrar
y en \`profile.prices\` los precios ya calculados según la fórmula.

# ESTRUCTURA OBLIGATORIA DEL PRD

## Pieza que frena tu negocio · [NOMBRE EXACTO DE LA PIEZA]
Una frase con la causa raíz canónica de la pieza (te la doy en el contexto).
Si el cliente proporcionó respuesta libre, citarla literalmente entre comillas con <em>.

## Dos caminos para resolverlo · adaptados a tu perfil
1-2 líneas explicando que son las DOS opciones que SÍ encajan con su tamaño y volumen.

A continuación renderiza EXACTAMENTE este HTML (NO en Markdown, HTML literal),
sustituyendo [PLACEHOLDERS] por contenido personalizado al cliente:

<div class="alt-grid">
  <div class="alt-card [añade clase 'recommended' a la 2ª opción]">
    <div class="alt-tag">[NIVEL · ETIQUETA]</div>
    <h3 class="alt-name">[NOMBRE PERSONALIZADO DEL SISTEMA PARA ESTE CLIENTE]</h3>
    <p class="alt-desc">[2-3 líneas describiendo qué hace para él, en lenguaje cercano]</p>
    <div class="alt-stack-label">Stack técnico</div>
    <ul class="alt-stack">
      [3-4 ítems con herramientas reales adaptadas a lo que ya tiene · usa <code> para nombres]
    </ul>
    <div class="alt-kpis-label">Lo que se mueve</div>
    <ul class="alt-kpis">
      [3-4 KPIs con valor actual → objetivo · usa <strong> para los números]
    </ul>
    <p class="alt-roadmap">[<strong>X semanas</strong> · breve descripción de fases]</p>
    <div class="alt-price">
      <div class="alt-price-label">Inversión orientativa</div>
      <div class="alt-price-range"><span class="alt-price-from">Desde</span> <strong>[PRECIO €]</strong></div>
      <div class="alt-price-detail">Cifra cerrada en sesión de validación · sin sorpresas</div>
    </div>
    <button class="alt-cta [alt-cta-light o alt-cta-recommended]" data-option="[NIVEL]" data-price="[PRECIO]">Quiero la opción [NIVEL] →</button>
  </div>

  <div class="alt-card [misma estructura para la 2ª opción]">
    [...]
  </div>
</div>

# REGLAS PARA EL STACK TÉCNICO POR NIVEL
- LITE: HTML5 + JS · Google Sheets · Apps Script · sin coste mensual
- PRO: HTML personalizado o Craft · ContaSimple (si ya lo tiene, integramos) · Google Sheets/Calendly · WhatsApp Business
- PREMIUM: Craft como hub · CRM existente integrado (HubSpot/Pipedrive/Brevo) o uno nuevo · Make.com · GPT-4o asistente
- NUNCA propongas Notion ni Trello (el cliente no los quiere)
- Si el cliente ya tiene una herramienta, dilo: "tu HubSpot integrado", "tu ContaSimple aprovechado"

# ACOMPAÑAMIENTO INCLUIDO (texto fijo tras las opciones)
"3 meses sin coste post-entrega. Trabajamos contigo hasta que el sistema sea natural en tu día a día. Si en 30 días no está integrado, ajustamos sin coste."

# UNA NOTA MÍA (firma personal)
3-4 líneas en 1ª persona, firmadas por Maite Cabezuelos.
Tono cercano. Recoger 1-2 detalles del cliente (su nombre, su actividad, su visión).
Si dejó visión, citarla entre comillas con <em>.

# FIRMA FINAL
— Maite Cabezuelos · Equipo MASESORA · Constructores de Sistemas
`.trim();

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

  return `
DATOS DEL DIAGNÓSTICO ADAPTATIVO

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

## RESPUESTA A LA PREGUNTA RAMIFICADA (la pregunta-clave de la pieza)
${diagnosis.branchAnswer || '(no proporcionada)'}

## HERRAMIENTAS QUE USA HOY (multi-select)
${(diagnosis.tools || []).join(', ') || 'Nada estructurado'}

## VISIÓN DEL CLIENTE
${diagnosis.vision || '(no proporcionada — la pediremos en la sesión)'}

## INTENSIDAD (escala 1-5)
${diagnosis.intensity || 'N/A'} de 5

## OPCIONES A MOSTRAR (calculadas por el motor según perfil)
- Opción 1: ${options[0]} · precio orientativo: ${prices[options[0]]} €
- Opción 2 (recomendada): ${options[1]} · precio orientativo: ${prices[options[1]]} €

USA estos precios EXACTOS en el HTML que generes. NO inventes otros.
La opción RECOMENDADA es siempre la 2ª (la más alta del par).

Genera ahora el PRD MAS@FRAME® siguiendo la estructura obligatoria.
`.trim();
}

// ============================================================
// Endpoint principal
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

  try {
    const userMessage = buildUserMessage(req.body);

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2500,
      stream: true
    });

    for await (const part of stream) {
      const chunk = part.choices[0]?.delta?.content || '';
      if (chunk) sendEvent('chunk', { markdown: chunk });
    }

    const code = generateDiscountCode();
    const validUntil = new Date(Date.now() + DISCOUNT_HOURS * 3600 * 1000).toISOString();

    sendEvent('discount', {
      code,
      valid_until: validUntil,
      discount_pct: DISCOUNT_PCT,
      cal_url: `https://cal.com/masesora/reunion?discount=${code}`
    });

    sendEvent('done', { ok: true });
    res.end();
  } catch (err) {
    console.error('[generate-prd] Error:', err);
    sendEvent('error', { message: 'No hemos podido construir tu PRD ahora. Reserva igualmente y lo construimos en la reunión.' });
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
    has_api_key: Boolean(process.env.OPENAI_API_KEY),
    pieces: Object.keys(PIECES).length
  });
});

// ============================================================
// Test endpoint · calcular precio sin llamar a OpenAI
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
  console.log(`[MASESORA] Modelo: ${MODEL} · Descuento: ${DISCOUNT_PCT}% / ${DISCOUNT_HOURS}h`);
  console.log(`[MASESORA] Catálogo: ${Object.keys(PIECES).length} piezas estructurales`);
  if (!process.env.OPENAI_API_KEY) console.warn('[MASESORA] ⚠ OPENAI_API_KEY no configurada');
});
