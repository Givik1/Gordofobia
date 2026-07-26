const { getStore } = require("@netlify/blobs");

const PERSONAS = new Set(["cristobal", "teresa"]);
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Método no permitido." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "JSON inválido." }),
    };
  }

  const { fecha, persona, peso, nota } = payload;

  if (typeof fecha !== "string" || !FECHA_RE.test(fecha)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Fecha inválida." }),
    };
  }
  if (!PERSONAS.has(persona)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Persona inválida." }),
    };
  }
  const pesoNum = Number(peso);
  if (!Number.isFinite(pesoNum) || pesoNum <= 0 || pesoNum > 400) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Peso inválido." }),
    };
  }
  const notaLimpia = typeof nota === "string" ? nota.trim().slice(0, 200) : "";

  try {
    const store = getStore({
      name: "peso-diario",
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN,
    });
    const entries = (await store.get("entries", { type: "json" })) || [];

    const index = entries.findIndex((e) => e.fecha === fecha && e.persona === persona);
    const registro = { fecha, persona, peso: pesoNum, nota: notaLimpia };

    if (index >= 0) {
      entries[index] = registro;
    } else {
      entries.push(registro);
    }

    entries.sort((a, b) => a.fecha.localeCompare(b.fecha));

    await store.setJSON("entries", entries);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registro),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "No se pudo guardar el registro." }),
    };
  }
};
