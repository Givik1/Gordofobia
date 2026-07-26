(function () {
  "use strict";

  const GET_ENTRIES_URL = "/.netlify/functions/get-entries";
  const SAVE_ENTRY_URL = "/.netlify/functions/save-entry";
  const STORAGE_KEY = "peso-diario:persona";
  const PERSONAS = ["cristobal", "teresa"];
  const NOMBRES = { cristobal: "Cristóbal", teresa: "Teresa" };

  const state = {
    currentPersona: null,
    entries: [],
  };

  const els = {
    btnCristobal: document.getElementById("btn-cristobal"),
    btnTeresa: document.getElementById("btn-teresa"),
    form: document.getElementById("form-registro"),
    inputFecha: document.getElementById("input-fecha"),
    inputPeso: document.getElementById("input-peso"),
    inputNota: document.getElementById("input-nota"),
    btnGuardar: document.getElementById("btn-guardar"),
    mensaje: document.getElementById("mensaje"),
    chartContainer: document.getElementById("chart-container"),
  };

  let mensajeTimeout = null;

  function todayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatPeso(num) {
    const rounded = Math.round(num * 10) / 10;
    return String(rounded).replace(".", ",");
  }

  function parsePeso(str) {
    if (typeof str !== "string") return NaN;
    const normalizado = str.trim().replace(",", ".");
    return Number(normalizado);
  }

  function formatFechaCorta(iso) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  function formatFechaDisplay(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function mostrarMensaje(texto, tipo) {
    if (mensajeTimeout) {
      clearTimeout(mensajeTimeout);
      mensajeTimeout = null;
    }
    els.mensaje.textContent = texto;
    els.mensaje.className = "mensaje" + (tipo ? ` mensaje--${tipo}` : "");
    if (tipo === "ok") {
      mensajeTimeout = setTimeout(() => {
        els.mensaje.textContent = "";
        els.mensaje.className = "mensaje";
      }, 3000);
    }
  }

  function actualizarBotonPersona() {
    els.btnCristobal.classList.toggle("is-active", state.currentPersona === "cristobal");
    els.btnCristobal.setAttribute("aria-pressed", String(state.currentPersona === "cristobal"));
    els.btnTeresa.classList.toggle("is-active", state.currentPersona === "teresa");
    els.btnTeresa.setAttribute("aria-pressed", String(state.currentPersona === "teresa"));

    els.btnGuardar.classList.toggle("persona-teresa", state.currentPersona === "teresa");
    els.btnGuardar.disabled = !state.currentPersona;
  }

  function buscarRegistroActual() {
    if (!state.currentPersona || !els.inputFecha.value) return null;
    return (
      state.entries.find(
        (e) => e.persona === state.currentPersona && e.fecha === els.inputFecha.value
      ) || null
    );
  }

  function precargarFormulario() {
    const registro = buscarRegistroActual();
    if (registro) {
      els.inputPeso.value = formatPeso(registro.peso);
      els.inputNota.value = registro.nota || "";
    } else {
      els.inputPeso.value = "";
      els.inputNota.value = "";
    }
  }

  function seleccionarPersona(persona) {
    if (!PERSONAS.includes(persona)) return;
    state.currentPersona = persona;
    localStorage.setItem(STORAGE_KEY, persona);
    actualizarBotonPersona();
    precargarFormulario();
  }

  async function cargarRegistros() {
    try {
      const res = await fetch(GET_ENTRIES_URL);
      if (!res.ok) throw new Error("Respuesta no válida");
      const data = await res.json();
      state.entries = Array.isArray(data) ? data : [];
      renderChart();
      precargarFormulario();
    } catch (err) {
      state.entries = [];
      renderChart();
      mostrarMensaje("No se pudieron cargar los datos del gráfico.", "error");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!state.currentPersona) {
      mostrarMensaje("Elige primero quién eres.", "error");
      return;
    }
    const fecha = els.inputFecha.value;
    if (!fecha) {
      mostrarMensaje("Elige una fecha.", "error");
      return;
    }
    const peso = parsePeso(els.inputPeso.value);
    if (!Number.isFinite(peso) || peso <= 0 || peso > 400) {
      mostrarMensaje("Introduce un peso válido, p. ej. 78,4", "error");
      return;
    }
    const nota = els.inputNota.value.trim();

    els.btnGuardar.disabled = true;
    els.btnGuardar.textContent = "Guardando…";

    try {
      const res = await fetch(SAVE_ENTRY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, persona: state.currentPersona, peso, nota }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Error al guardar");
      }
      const registro = await res.json();

      const index = state.entries.findIndex(
        (e) => e.persona === registro.persona && e.fecha === registro.fecha
      );
      if (index >= 0) {
        state.entries[index] = registro;
      } else {
        state.entries.push(registro);
      }
      renderChart();

      mostrarMensaje(`Guardado: ${formatFechaDisplay(fecha)} · ${formatPeso(peso)} kg`, "ok");
    } catch (err) {
      mostrarMensaje("No se pudo guardar. Inténtalo de nuevo.", "error");
    } finally {
      els.btnGuardar.disabled = !state.currentPersona;
      els.btnGuardar.textContent = "Guardar";
    }
  }

  function renderChart() {
    const entries = state.entries;

    if (!entries.length) {
      els.chartContainer.innerHTML = '<p class="chart-vacio">Todavía no hay registros.</p>';
      return;
    }

    const width = 600;
    const height = 300;
    const margin = { top: 16, right: 16, bottom: 30, left: 42 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const pesos = entries.map((e) => e.peso);
    let minPeso = Math.min(...pesos);
    let maxPeso = Math.max(...pesos);
    if (minPeso === maxPeso) {
      minPeso -= 1;
      maxPeso += 1;
    } else {
      const pad = (maxPeso - minPeso) * 0.15;
      minPeso -= pad;
      maxPeso += pad;
    }

    const toTime = (iso) => new Date(iso + "T00:00:00").getTime();
    const tiempos = entries.map((e) => toTime(e.fecha));
    let minT = Math.min(...tiempos);
    let maxT = Math.max(...tiempos);
    if (minT === maxT) {
      const oneDay = 24 * 60 * 60 * 1000;
      minT -= oneDay;
      maxT += oneDay;
    }

    const xScale = (iso) => margin.left + ((toTime(iso) - minT) / (maxT - minT)) * innerW;
    const yScale = (peso) => margin.top + innerH - ((peso - minPeso) / (maxPeso - minPeso)) * innerH;

    let gridSvg = "";
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const val = minPeso + ((maxPeso - minPeso) * i) / yTicks;
      const y = yScale(val);
      gridSvg += `<line class="chart-grid-line" x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(width - margin.right).toFixed(1)}" y2="${y.toFixed(1)}" />`;
      gridSvg += `<text class="chart-axis-text" x="${margin.left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${formatPeso(val)}</text>`;
    }

    const fechasUnicas = [...new Set(entries.map((e) => e.fecha))].sort();
    let xTicksSvg = "";
    if (fechasUnicas.length === 1) {
      const x = xScale(fechasUnicas[0]);
      xTicksSvg += `<text class="chart-axis-text" x="${x.toFixed(1)}" y="${height - margin.bottom + 16}" text-anchor="middle">${formatFechaCorta(fechasUnicas[0])}</text>`;
    } else {
      const nTicks = Math.min(4, fechasUnicas.length);
      for (let i = 0; i < nTicks; i++) {
        const idx = Math.round((i * (fechasUnicas.length - 1)) / (nTicks - 1));
        const fecha = fechasUnicas[idx];
        const x = xScale(fecha);
        xTicksSvg += `<text class="chart-axis-text" x="${x.toFixed(1)}" y="${height - margin.bottom + 16}" text-anchor="middle">${formatFechaCorta(fecha)}</text>`;
      }
    }

    function buildSeries(persona) {
      const puntos = entries
        .filter((e) => e.persona === persona)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      if (!puntos.length) return "";
      const pathD = puntos
        .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.fecha).toFixed(1)} ${yScale(p.peso).toFixed(1)}`)
        .join(" ");
      const circles = puntos
        .map(
          (p) =>
            `<circle class="chart-point-${persona}" cx="${xScale(p.fecha).toFixed(1)}" cy="${yScale(p.peso).toFixed(1)}" r="3.5"><title>${formatFechaDisplay(p.fecha)}: ${formatPeso(p.peso)} kg</title></circle>`
        )
        .join("");
      return `<path class="chart-line-${persona}" d="${pathD}" fill="none" stroke-width="2" />${circles}`;
    }

    els.chartContainer.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gráfico de evolución de peso">
        ${gridSvg}
        ${xTicksSvg}
        ${buildSeries("cristobal")}
        ${buildSeries("teresa")}
      </svg>
    `;
  }

  function init() {
    els.inputFecha.value = todayIso();

    els.btnCristobal.addEventListener("click", () => seleccionarPersona("cristobal"));
    els.btnTeresa.addEventListener("click", () => seleccionarPersona("teresa"));
    els.inputFecha.addEventListener("change", precargarFormulario);
    els.form.addEventListener("submit", handleSubmit);

    const guardada = localStorage.getItem(STORAGE_KEY);
    if (PERSONAS.includes(guardada)) {
      state.currentPersona = guardada;
    }
    actualizarBotonPersona();

    cargarRegistros();
  }

  init();
})();
