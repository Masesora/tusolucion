# Ejemplo completo · qué recibe Claude y qué devuelve

Para que veas exactamente la conversación entre el cuestionario y la IA, con el caso real de **Roberto · despacho de abogados**.

---

## 1. Lo que el cuestionario captura del cliente

```json
{
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
    "vision": "Sabría en qué punto está cada caso sin pensarlo. Mis abogados podrían atender al cliente sin pasarme la pelota a mí.",
    "intensity": 4
  }
}
```

---

## 2. Lo que el backend calcula antes de llamar a Claude

```js
// Multiplicadores aplicados:
// 6-15 personas × 2.2
// Volumen 100-500 × 1.1
// Tiene CRM (HubSpot/ContaSimple) × 0.9

// Para pieza P4 (Operativa sin trazabilidad):
PRO     = 700  × 2.2 × 1.1 × 0.9 = 1.524 → redondeado a 1.500 €
PREMIUM = 1.600 × 2.2 × 1.1 × 0.9 = 3.484 → redondeado a 3.500 €

// Opciones a mostrar (perfil 6-15p): PRO + PREMIUM (LITE descartado)
```

---

## 3. EL SYSTEM PROMPT que recibe Claude

*(igual al de `generate-prd.js` constante `SYSTEM_PROMPT`)*

```
Formo parte del Equipo MASESORA · Constructores de Sistemas.
Recibo los datos de un diagnóstico adaptativo completado por una empresa cliente.
Mi objetivo es generar el PRD que se mostrará INMEDIATAMENTE en pantalla
al cliente, en streaming, con DOS alternativas adaptadas a su perfil real.

# REGLAS DE TONO
- Profesional, claro, dinámico. 2ª persona (tutéale).
- Voz de empresa seria que entiende de negocio hablando a otra empresa que decide.
- Sin jerga clínica, sin purismo arquitectónico, sin "vendedor de humos".
- El cliente lee y siente: "esta gente sabe construir".

[... resto del prompt — ver generate-prd.js para el texto completo ...]
```

---

## 4. EL USER MESSAGE que se inyecta · caso Roberto

```
DATOS DEL DIAGNÓSTICO ADAPTATIVO

## CONTEXTO DEL CLIENTE
- Nombre: Roberto
- Actividad: Despacho de abogados especializado en mercantil
- Sector: Servicios profesionales
- Tamaño: 6-15
- Volumen mensual: 100-500

## PIEZA ESTRUCTURAL DETECTADA POR EL MOTOR
- Código: P4
- Nombre: Operativa sin trazabilidad
- Causa raíz canónica: Sabes que tienes trabajos en marcha, pero al detalle quién está dónde, qué falta y qué se prometió cuándo solo lo sabe tu cabeza.

## RESPUESTA A LA PREGUNTA RAMIFICADA
Tengo que mirar varios sitios

## HERRAMIENTAS QUE USA HOY
contasimple, crm, whatsapp, sheets

## VISIÓN DEL CLIENTE
Sabría en qué punto está cada caso sin pensarlo. Mis abogados podrían atender al cliente sin pasarme la pelota a mí.

## INTENSIDAD (escala 1-5)
4 de 5

## OPCIONES A MOSTRAR (calculadas por el motor según perfil)
- Opción 1 (NO recomendada · etiqueta normal): PRO · precio: 1500 €
- Opción 2 (RECOMENDADA · debe llevar clase "recommended"): PREMIUM · precio: 3500 €

USA estos precios EXACTOS en el HTML. NO inventes otros.

Genera ahora el PRD MAS@FRAME® siguiendo la estructura obligatoria.
```

---

## 5. LA RESPUESTA que genera Claude (ejemplo orientativo)

```markdown
## Pieza que frena tu negocio · Operativa sin trazabilidad

Sabes que tienes trabajos en marcha, pero al detalle quién está dónde, qué falta y qué se prometió cuándo solo lo sabe tu cabeza. Tú lo dices con tus palabras: <em>"tengo que mirar varios sitios"</em>. Y ahí es donde se cuela la duda del cliente, los plazos que se mueven sin avisar, y las horas que dedicas a reconstruir el contexto cada vez.

## Dos caminos para resolverlo · adaptados a tu perfil

Estas son las dos opciones que **sí encajan** con un despacho de tu tamaño y volumen. Una más ligera para empezar limpio. Otra completa con asistencia IA pensada para escalar y delegar de verdad.

<div class="alt-grid">
  <div class="alt-card">
    <div class="alt-tag">PRO · El completo</div>
    <h3 class="alt-name">Tu cuadro de casos · trazabilidad real para tu despacho</h3>
    <p class="alt-desc">Un sistema que une a tus abogados con tu ContaSimple y tu HubSpot Free para que cualquiera del equipo sepa en qué punto está cada caso, sin pasarte la pelota.</p>
    <div class="alt-stack-label">Stack técnico</div>
    <ul class="alt-stack">
      <li><code>HTML personalizado</code> · interfaz sencilla, accesible desde móvil y ordenador</li>
      <li><code>ContaSimple</code> integrado · aprovechamos lo que ya tienes</li>
      <li><code>Google Sheets</code> · base de casos sincronizada con tu HubSpot</li>
      <li><code>WhatsApp Business</code> · plantillas para canalizar consultas sin que rompan tu día</li>
    </ul>
    <div class="alt-kpis-label">Lo que se mueve</div>
    <ul class="alt-kpis">
      <li>Tiempo para saber el estado de un caso: <strong>de minutos a &lt;10 segundos</strong></li>
      <li>Casos olvidados o duplicados: <strong>de varios al mes a 0</strong></li>
      <li>Tareas pendientes visibles para el equipo: <strong>100% en panel</strong></li>
      <li>Plazos prometidos vs cumplidos: <strong>+30%</strong></li>
    </ul>
    <p class="alt-roadmap"><strong>3 semanas</strong> · S1 auditoría · S2 construcción · S3 onboarding + ajustes</p>
    <div class="alt-price">
      <div class="alt-price-label">Inversión orientativa</div>
      <div class="alt-price-range"><span class="alt-price-from">Desde</span> <strong>1.500 €</strong></div>
      <div class="alt-price-detail">Cifra cerrada en sesión de validación · sin sorpresas</div>
    </div>
    <button class="alt-cta alt-cta-light" data-option="PRO" data-price="1500">Quiero la opción PRO →</button>
  </div>

  <div class="alt-card recommended">
    <div class="alt-tag">PREMIUM · El integrado con IA</div>
    <h3 class="alt-name">Tu cuadro de casos con asistente · delegar de verdad</h3>
    <p class="alt-desc">El sistema completo con asistente IA pensado para tu visión: que tus abogados atiendan al cliente sin pasarte la pelota. Integra todo lo que ya tienes y suma capa de inteligencia.</p>
    <div class="alt-stack-label">Stack técnico</div>
    <ul class="alt-stack">
      <li><code>Craft</code> como hub operativo · vistas por abogado y por caso</li>
      <li>Tu <code>HubSpot Free</code> integrado · capa <code>Make.com</code> de automatizaciones encima</li>
      <li><code>WhatsApp Business</code> · cola automatizada con cualificación previa</li>
      <li><code>Claude</code> como asistente · respuestas y borradores legales</li>
    </ul>
    <div class="alt-kpis-label">Lo que se mueve</div>
    <ul class="alt-kpis">
      <li>Estado de cada caso: <strong>tiempo real para todo el equipo</strong></li>
      <li>Alertas automáticas de bloqueos: <strong>configuradas</strong></li>
      <li>Predicción de retrasos: <strong>desde semana 3</strong></li>
      <li>Tasa de cumplimiento de plazos: <strong>+40%</strong></li>
    </ul>
    <p class="alt-roadmap"><strong>4 semanas</strong> · S1 auditoría · S2 Craft + WhatsApp · S3 automatizaciones + IA · S4 onboarding</p>
    <div class="alt-price">
      <div class="alt-price-label">Inversión orientativa</div>
      <div class="alt-price-range"><span class="alt-price-from">Desde</span> <strong>3.500 €</strong></div>
      <div class="alt-price-detail">Cifra cerrada en sesión de validación · sin sorpresas</div>
    </div>
    <button class="alt-cta alt-cta-recommended" data-option="PREMIUM" data-price="3500">Quiero la opción PREMIUM →</button>
  </div>
</div>

## Acompañamiento incluido en ambas opciones · 3 meses sin coste post-entrega

Trabajamos contigo después de la entrega hasta que el sistema sea natural en el día a día del despacho. Si en 30 días no está integrado en tu operativa, ajustamos sin coste hasta que lo esté.

## Una nota mía

Roberto, lo que cuentas — abogados pasándote la pelota porque no tienen visión completa del caso — es uno de los patrones más comunes en despachos de tu tamaño. Y lo que me dices que cambiaría — <em>"sabría en qué punto está cada caso sin pensarlo"</em> — es exactamente lo que va a pasar contigo cuando lo construyamos. Si quieres que hablemos, te atiendo yo. 20 minutos sin compromiso.

— Maite Cabezuelos · Equipo MASESORA · Constructores de Sistemas
```

---

## 6. Lo que el cliente ve en pantalla

El frontend renderiza el Markdown anterior y el HTML literal de las tarjetas, resultando en:

- Encabezado "Pieza que frena tu negocio · Operativa sin trazabilidad"
- Texto cinematográfico con la cita literal entre comillas
- **Dos tarjetas comparativas** PRO + PREMIUM (con la PREMIUM marcada como "Recomendado")
- Tarjeta de acompañamiento incluido (3 meses garantía)
- Nota personal firmada por Maite con la visión literal del cliente entre comillas
- Botón de descuento DESC-XXXX con countdown 2h
- Link plegado "pagar en cuotas" para perfiles ajustados

---

## 7. Lo que llega a `info@masesora.com` · email de notificación

**Asunto:** `📋 Nuevo PRD · Roberto · Operativa sin trazabilidad · código DESC-A8B3`

**Cuerpo:**
- Datos completos del cliente (nombre, actividad, sector, tamaño, email)
- Pieza detectada con su nombre canónico
- Respuesta a la pregunta ramificada
- Herramientas que ya tiene
- Visión literal del cliente
- Intensidad
- Opciones presentadas con precios calculados (`PRO 1500 €` · `PREMIUM 3500 €`)
- Código descuento generado + caducidad exacta en hora local
- PRD completo en HTML

Cuando Roberto reserve en Cal.com con `?discount=DESC-A8B3`, Maite cruza con este email y sabe exactamente:
- Quién es
- Qué le dijo el sistema
- Qué descuento aplicar
- Por dónde empezar la sesión

---

## 8. Cómo afinar el SYSTEM_PROMPT

Si después de algunas sesiones reales detectas patrones que no te encajan, edita estas zonas en `generate-prd.js`:

| Para cambiar... | Edita la zona... |
|---|---|
| Tono / vocabulario | Bloque `# REGLAS DE TONO` |
| Estructura del PRD | Bloque `# ESTRUCTURA OBLIGATORIA DEL PRD` |
| Stack técnico recomendado | Bloque `# REGLAS PARA EL STACK TÉCNICO POR NIVEL` |
| Causas raíz por pieza | Constante `PIECES` (campo `cause`) |
| Precios | Constante `PIECES` (campo `bases`) |
| Multiplicadores | Función `calculatePrice()` |

Tras editar → commit + push → Render redeploya en ~1 min → curl test.

---

## 9. Cómo probar variantes de modelo

Si quieres comparar Sonnet vs Opus vs Haiku:

```bash
# En Render, cambiar la env var:
ANTHROPIC_MODEL=claude-opus-4-6   # más calidad, más caro
# o
ANTHROPIC_MODEL=claude-haiku-4-5  # más barato, menos profundo
```

No requiere redeploy. Solo cambias la variable y los siguientes PRDs usan el modelo nuevo.
