const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  try {
    const store = getStore("peso-diario");
    const entries = (await store.get("entries", { type: "json" })) || [];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entries),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "No se pudieron leer los registros.", debug: String(error && error.stack || error) }),
    };
  }
};
