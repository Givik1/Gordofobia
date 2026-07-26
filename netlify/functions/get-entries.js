const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  try {
    const store = getStore({
      name: "peso-diario",
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN,
    });
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
      body: JSON.stringify({ error: "No se pudieron leer los registros." }),
    };
  }
};
