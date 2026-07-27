const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const pin = event.headers["x-app-pin"];
  if (!process.env.APP_PIN || pin !== process.env.APP_PIN) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "PIN incorrecto.",
        debug: {
          envSet: Boolean(process.env.APP_PIN),
          envLen: process.env.APP_PIN ? process.env.APP_PIN.length : 0,
          receivedLen: pin ? pin.length : 0,
          receivedType: typeof pin,
        },
      }),
    };
  }

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
