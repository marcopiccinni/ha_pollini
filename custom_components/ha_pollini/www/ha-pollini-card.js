/*
 * ha-pollini-card
 * Lovelace card for the "3BMeteo Pollini" integration (ha_pollini).
 *
 * Shows the current level of a pollen family (or the overall index) with a
 * coloured badge, the sub-species breakdown and a 7-day forecast strip, using
 * the attributes exposed by the integration.
 * UI strings are localised (IT/EN) from `hass.locale.language` and can be
 * overridden with the `language` option.
 *
 * No build step: plain custom element, auto-registered by the integration.
 */

const LEVEL_ORDER = ["Assente", "Basso", "Medio", "Alto"];

const PALETTES = {
  default: {
    Assente: "#2e7d32",
    Basso: "#f9a825",
    Medio: "#ef6c00",
    Alto: "#c62828",
  },
  colorblind: {
    Assente: "#999999",
    Basso: "#56B4E9",
    Medio: "#E69F00",
    Alto: "#D55E00",
  },
};

const FONT_SCALES = {
  small: 0.85,
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
};

const LEVEL_I18N = {
  it: {},
  en: {
    Assente: "None",
    Basso: "Low",
    Medio: "Medium",
    Alto: "High",
  },
};

const I18N = {
  it: {
    notFound: (e) => `Entità non trovata: ${e}`,
    unavailable: "Non disponibile",
    moreInfo: "Mostra lo storico",
    highest: "Pollini più presenti",
    updated: "Agg.",
    now: "adesso",
    minAgo: (n) => `${n} min fa`,
    hAgo: (n) => `${n} h fa`,
    dAgo: (n) => `${n} g fa`,
    inSeason: "In stagione",
    trendSu: "In peggioramento",
    trendGiu: "In miglioramento",
    trendStabile: "Stabile",
  },
  en: {
    notFound: (e) => `Entity not found: ${e}`,
    unavailable: "Unavailable",
    moreInfo: "Show history",
    highest: "Most present pollen",
    updated: "Upd.",
    now: "now",
    minAgo: (n) => `${n} min ago`,
    hAgo: (n) => `${n} h ago`,
    dAgo: (n) => `${n} d ago`,
    inSeason: "In season",
    trendSu: "Worsening",
    trendGiu: "Improving",
    trendStabile: "Steady",
  },
};

const IT_MONTHS = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
};

const CARD_VERSION = "0.3.0";

class HaPolliniCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._selectedDay = 0;
    this._focusDay = null;
    this._holdTimer = null;
    this._holdFired = false;
    this._tapTimer = null;
    this._tick = null;
    this._bound = false;
  }

  connectedCallback() {
    this._bindGestures();
    if (!this._tick) {
      this._tick = window.setInterval(() => {
        if (this._config && this._hass && this._config.relative_time !== false) {
          this._render();
        }
      }, 60000);
    }
  }

  disconnectedCallback() {
    if (this._tick) {
      window.clearInterval(this._tick);
      this._tick = null;
    }
  }

  _bindGestures() {
    if (this._bound) return;
    this._bound = true;
    const root = this.shadowRoot;
    root.addEventListener("click", (ev) => this._onClick(ev));
    root.addEventListener("dblclick", (ev) => this._onDblClick(ev));
    root.addEventListener("pointerdown", (ev) => this._onPointerDown(ev));
    root.addEventListener("pointerup", () => this._clearHold());
    root.addEventListener("pointercancel", () => this._clearHold());
    root.addEventListener("pointerleave", () => this._clearHold());
    root.addEventListener("contextmenu", (ev) => this._onContextMenu(ev));
    root.addEventListener("keydown", (ev) => this._onKeyDown(ev));
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("È richiesto 'entity' (un sensore ha_pollini).");
    }
    this._config = { ...config };
    // Defaults: only an explicit `false` hides a block; unset stays visible.
    this._config.show_subs = this._config.show_subs !== false;
    this._config.show_forecast = this._config.show_forecast !== false;
    this._config.show_badge_name = this._config.show_badge_name !== false;
    this._config.font_size = this._config.font_size || "normal";
    this._config.variant = ["gauge", "bar", "bars"].includes(this._config.variant)
      ? this._config.variant
      : "gauge";
    this._config.color_scheme = PALETTES[this._config.color_scheme]
      ? this._config.color_scheme
      : "default";
    this._config.show_title = this._config.show_title !== false;
    this._config.compact = this._config.compact === true;
    this._config.relative_time = this._config.relative_time !== false;
    this._config.language = ["it", "en"].includes(this._config.language)
      ? this._config.language
      : "auto";
    this._config.tap_action = this._config.tap_action || { action: "more-info" };
    this._config.hold_action = this._config.hold_action || { action: "none" };
    this._config.double_tap_action =
      this._config.double_tap_action || { action: "none" };
    this._selectedDay = 0;
    if (this._hass) this._render();
  }

  _lang() {
    const cfg = this._config && this._config.language;
    if (cfg === "it" || cfg === "en") return cfg;
    const loc =
      this._hass && this._hass.locale && this._hass.locale.language
        ? this._hass.locale.language
        : "it";
    return String(loc).slice(0, 2) === "en" ? "en" : "it";
  }

  _t(key, arg) {
    const table = I18N[this._lang()] || I18N.it;
    const fn = table[key];
    if (typeof fn === "function") return fn(arg);
    if (fn == null) return I18N.it[key] != null ? I18N.it[key] : key;
    return fn;
  }

  _lvl(name) {
    if (!name) return "";
    const table = LEVEL_I18N[this._lang()] || {};
    return table[name] || name;
  }

  _palette() {
    return PALETTES[this._config.color_scheme] || PALETTES.default;
  }

  _scale() {
    return FONT_SCALES[this._config.font_size] || 1;
  }

  _limitForecast(forecast) {
    const n = Number(this._config.forecast_days);
    if (!this._config.forecast_days || Number.isNaN(n) || n <= 0) return forecast;
    return forecast.slice(0, n);
  }

  _selectDay(day) {
    const forecast = this._lastForecast || [];
    if (!forecast.length) return;
    const idx = Math.max(0, Math.min(forecast.length - 1, day));
    if (idx === this._selectedDay) return;
    this._selectedDay = idx;
    this._focusDay = idx;
    this._render();
  }

  _onClick(ev) {
    const dayEl = ev.target.closest ? ev.target.closest("[data-day]") : null;
    if (dayEl) {
      const day = Number(dayEl.dataset.day);
      if (!Number.isNaN(day)) this._selectDay(day);
      return;
    }
    if (this._holdFired) {
      this._holdFired = false;
      return;
    }
    const infoEl = ev.target.closest ? ev.target.closest("[data-more-info]") : null;
    if (infoEl) {
      this._moreInfo(infoEl.dataset.moreInfoEntity || undefined);
      return;
    }
    const dbl = this._config.double_tap_action;
    if (dbl && dbl.action && dbl.action !== "none") {
      if (this._tapTimer) window.clearTimeout(this._tapTimer);
      this._tapTimer = window.setTimeout(() => {
        this._tapTimer = null;
        this._handleAction(this._config.tap_action);
      }, 250);
      return;
    }
    this._handleAction(this._config.tap_action);
  }

  _onDblClick(ev) {
    const onDay = ev.target.closest && ev.target.closest("[data-day]");
    const onInfo = ev.target.closest && ev.target.closest("[data-more-info]");
    if (onDay || onInfo) return;
    const dbl = this._config.double_tap_action;
    if (!dbl || !dbl.action || dbl.action === "none") return;
    if (this._tapTimer) {
      window.clearTimeout(this._tapTimer);
      this._tapTimer = null;
    }
    this._handleAction(dbl);
  }

  _onPointerDown(ev) {
    const onDay = ev.target.closest && ev.target.closest("[data-day]");
    const onInfo = ev.target.closest && ev.target.closest("[data-more-info]");
    if (onDay || onInfo || ev.button > 0) return;
    const hold = this._config.hold_action;
    if (!hold || !hold.action || hold.action === "none") return;
    this._clearHold();
    this._holdFired = false;
    this._holdTimer = window.setTimeout(() => {
      this._holdFired = true;
      this._holdTimer = null;
      this._handleAction(hold);
    }, 500);
  }

  _clearHold() {
    if (this._holdTimer) {
      window.clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  _onContextMenu(ev) {
    const onDay = ev.target.closest && ev.target.closest("[data-day]");
    const onInfo = ev.target.closest && ev.target.closest("[data-more-info]");
    const hold = this._config.hold_action;
    if (!onDay && !onInfo && hold && hold.action && hold.action !== "none") {
      ev.preventDefault();
    }
  }

  _onKeyDown(ev) {
    const dayEl = ev.target.closest ? ev.target.closest("[data-day]") : null;
    if (dayEl) {
      const day = Number(dayEl.dataset.day);
      if (Number.isNaN(day)) return;
      if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
        ev.preventDefault();
        this._selectDay(day);
      } else if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
        ev.preventDefault();
        this._selectDay(day + (ev.key === "ArrowRight" ? 1 : -1));
      }
      return;
    }
    if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
    ev.preventDefault();
    this._handleAction(this._config.tap_action);
  }

  _moreInfo(entity) {
    const target = entity || (this._config && this._config.entity);
    if (!target) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: target },
        bubbles: true,
        composed: true,
      })
    );
  }

  _handleAction(cfg) {
    if (!cfg || !this._hass) return;
    switch (cfg.action) {
      case "none":
      case undefined:
      case null:
        return;
      case "toggle": {
        const entity = cfg.entity || this._config.entity;
        if (entity) {
          this._hass.callService("homeassistant", "toggle", { entity_id: entity });
        }
        return;
      }
      case "navigate": {
        if (!cfg.navigation_path) return;
        if (cfg.navigation_replace) {
          history.replaceState(null, "", cfg.navigation_path);
        } else {
          history.pushState(null, "", cfg.navigation_path);
        }
        window.dispatchEvent(
          new CustomEvent("location-changed", {
            detail: { replace: !!cfg.navigation_replace },
            bubbles: true,
            composed: true,
          })
        );
        return;
      }
      case "url": {
        if (cfg.url_path) {
          window.open(cfg.url_path, cfg.new_tab ? "_blank" : "_self");
        }
        return;
      }
      case "perform-action":
      case "call-service": {
        const call = cfg.perform_action || cfg.service || "";
        const parts = call.split(".");
        if (parts.length < 2) return;
        this._hass.callService(
          parts[0],
          parts.slice(1).join("."),
          cfg.data || cfg.service_data || {},
          cfg.target
        );
        return;
      }
      case "more-info":
      default:
        this._moreInfo(cfg.entity);
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass.states).find(
      (e) => e.startsWith("sensor.") && hass.states[e].attributes.famiglia !== undefined
    );
    return { entity: entity || "sensor.pollini_esempio_composite" };
  }

  static getConfigElement() {
    return document.createElement("ha-pollini-card-editor");
  }

  _state(entityId) {
    return this._hass && this._hass.states[entityId];
  }

  _render() {
    if (!this._config || !this._hass) return;
    const stateObj = this._state(this._config.entity);
    if (!stateObj) {
      this.shadowRoot.innerHTML = `<ha-card><div class="empty">${this._t(
        "notFound",
        this._config.entity
      )}</div></ha-card>`;
      return;
    }
    const attrs = stateObj.attributes;
    const title =
      this._config.title || attrs.friendly_name || stateObj.entity_id;
    const name = attrs.nome || attrs.famiglia || "";
    const header = this._config.show_title
      ? `<div class="header">
            <span class="title">${title}</span>
            <span class="updated">${this._updatedText(attrs)}</span>
          </div>`
      : "";

    if (stateObj.state === "unavailable" || stateObj.state === "unknown") {
      this.shadowRoot.innerHTML = `
        <style>${HaPolliniCard._css()}</style>
        <ha-card>
          <div class="content${this._config.compact ? " compact" : ""}" style="font-size:${this._scale()}em">
            ${header}
            <div class="unavailable">${this._t("unavailable")}</div>
          </div>
        </ha-card>`;
      return;
    }

    const isSummary = !!attrs.famiglie_piu_presenti;
    const forecast = this._limitForecast(attrs.previsioni || attrs.giorni || []);
    this._lastForecast = forecast;
    const selected = forecast.length
      ? Math.min(this._selectedDay, forecast.length - 1)
      : 0;
    const day = forecast[selected] || null;
    const level =
      selected === 0
        ? attrs.livello || stateObj.state || ""
        : day
          ? day.livello || ""
          : "";
    const subs = day ? day.sottospecie || [] : attrs.sottospecie || [];
    const summaryList =
      selected > 0 && day
        ? day.famiglie_piu_presenti || []
        : attrs.famiglie_piu_presenti || [];
    const rows = this._rowsForSelected(attrs, day);
    const trend = this._trendBadge(attrs);
    const extras = (this._config.entities || [])
      .map((id) => this._state(id))
      .filter(Boolean);

    let visual;
    if (this._config.variant === "bars") {
      visual = this._barsList(rows, trend);
    } else if (this._config.variant === "bar") {
      visual = this._bar(level, name);
    } else {
      visual = this._badge(level, name);
    }

    this.shadowRoot.innerHTML = `
      <style>${HaPolliniCard._css()}</style>
      <ha-card>
        <div class="content${this._config.compact ? " compact" : ""}" style="font-size:${this._scale()}em" tabindex="0">
          ${header}
          ${visual}
          ${this._seasonBadge(attrs)}
          ${
            isSummary && this._config.variant !== "bars"
              ? this._summaryList(summaryList)
              : ""
          }
          ${this._config.show_subs && subs.length ? this._subs(subs) : ""}
          ${
            this._config.show_forecast
              ? this._forecast(forecast, selected)
              : ""
          }
          ${extras.length ? this._extras(extras) : ""}
        </div>
      </ha-card>`;

    if (this._focusDay != null) {
      const el = this.shadowRoot.querySelector(`[data-day="${this._focusDay}"]`);
      this._focusDay = null;
      if (el) el.focus();
    }
  }

  _rowsForSelected(attrs, day) {
    if (day && Array.isArray(day.famiglie) && day.famiglie.length) {
      return day.famiglie;
    }
    if (Array.isArray(attrs.famiglie) && attrs.famiglie.length) {
      return attrs.famiglie;
    }
    return [];
  }

  _updatedText(attrs) {
    if (this._config.relative_time !== false && attrs.aggiornamento) {
      const rel = _relativeAggiornamento(attrs.aggiornamento, this);
      if (rel) return `${this._t("updated")} ${rel}`;
    }
    if (attrs.aggiornamento) {
      return `${this._t("updated")} ${_fmtAggiornamento(attrs.aggiornamento)}`;
    }
    return attrs.provincia || "";
  }

  _trendBadge(attrs) {
    const dir = attrs.trend;
    const map = {
      su: { s: "▲", c: "#c62828", k: "trendSu" },
      giu: { s: "▼", c: "#2e7d32", k: "trendGiu" },
      stabile: { s: "▬", c: "var(--secondary-text-color)", k: "trendStabile" },
    };
    const m = map[dir];
    if (!m) return "";
    const label = this._t(m.k);
    return `<span class="trend" style="color:${m.c}" role="img" aria-label="${label}" title="${label}">${m.s}</span>`;
  }

  _seasonBadge(attrs) {
    if (attrs.in_stagione !== true) return "";
    const label = this._t("inSeason");
    return `<div class="season" role="img" aria-label="${label}" title="${label}">🌱 ${label}</div>`;
  }

  _summaryList(list) {
    if (!list.length) return "";
    const items = list
      .map((row) => {
        const color = this._palette()[row.livello] || "#999";
        return `<div class="sum-row">
            <span class="s-name">${row.nome || row.chiave || ""}</span>
            <span class="s-lvl" style="color:${color}">${this._lvl(row.livello)}</span>
          </div>`;
      })
      .join("");
    return `<div class="summary"><div class="sum-title">${this._t(
      "highest"
    )}</div>${items}</div>`;
  }

  _badge(level, name) {
    const color = this._palette()[level] || "#999";
    const label = this._config.show_badge_name
      ? `<span class="bl-name">${name}</span>`
      : "";
    return `
      <div class="badge">
        <div class="badge-level" style="background:${color}" data-more-info="1" role="img" tabindex="0" aria-label="${name} ${this._lvl(level)}" title="${this._t("moreInfo")}">
          ${label}
          <span class="bl-value">${this._lvl(level) || "—"}</span>
        </div>
      </div>`;
  }

  _bar(level, name) {
    const colors = this._palette();
    const segs = LEVEL_ORDER.map((lv, i) => {
      const left = (i * 100) / LEVEL_ORDER.length;
      const width = 100 / LEVEL_ORDER.length;
      return `<span class="bar-seg" style="left:${left}%;width:${width}%;background:${colors[lv]}"></span>`;
    }).join("");
    const idx = LEVEL_ORDER.indexOf(level);
    let marker = "";
    if (idx >= 0) {
      const pct = ((idx + 0.5) * 100) / LEVEL_ORDER.length;
      marker = `<span class="bar-marker" style="left:${pct}%"></span>`;
    }
    const label = this._config.show_badge_name
      ? `<span class="bl-name">${name}</span>`
      : "";
    return `
      <div class="badge">
        <div class="badge-bar" data-more-info="1" role="img" tabindex="0" aria-label="${name} ${this._lvl(level)}" title="${this._t("moreInfo")}">
          ${label}
          <div class="bar-track">${segs}${marker}</div>
          <span class="bl-value" style="color:${colors[level] || "inherit"}">${this._lvl(level) || "—"}</span>
        </div>
      </div>`;
  }

  _barsList(rows, trend = "") {
    if (!rows.length) {
      return `<div class="bars-empty">—</div>`;
    }
    const items = rows
      .map((row) => {
        const idx = row.indice != null ? Number(row.indice) : 0;
        const clamped = Math.max(0, Math.min(100, (idx / LEVEL_ORDER.length) * 100));
        const color = this._palette()[row.livello] || row.colore || "#999";
        const lvl = this._lvl(row.livello);
        const aria = `${row.nome || row.chiave}: ${lvl}`;
        return `<div class="bar-row" data-more-info="1" role="img" tabindex="0" aria-label="${aria}">
            <span class="br-name">${row.nome || row.chiave || ""}</span>
            <span class="br-track" aria-hidden="true">
              <span class="br-fill" style="width:${clamped}%;background:${color}"></span>
            </span>
            <span class="br-cat" style="color:${color}">${lvl}</span>
          </div>`;
      })
      .join("");
    return `<div class="bars">${items}${trend ? `<div class="bars-trend">${trend}</div>` : ""}</div>`;
  }

  _subs(subs) {
    const items = subs
      .map((s) => {
        const color = this._palette()[s.livello] || "#999";
        return `<div class="sub">
            <span class="s-name">${s.nome}</span>
            <span class="s-level" style="color:${color}">${this._lvl(s.livello)}</span>
          </div>`;
      })
      .join("");
    return `<div class="subs">${items}</div>`;
  }

  _forecast(forecast, selected = 0) {
    if (!forecast.length) return "";
    const items = forecast
      .map((d, i) => {
        const color = this._palette()[d.livello] || "#999";
        const sel = i === selected ? " selected" : "";
        const name = d.giorno || "";
        return `<div class="day${sel}" data-day="${i}" role="button" tabindex="0" aria-label="${name} ${this._lvl(d.livello)}" aria-pressed="${i === selected}">
            <span class="d-name">${name}</span>
            <span class="d-dot" style="background:${color}"></span>
            <span class="d-level" style="color:${color}">${this._lvl(d.livello)}</span>
          </div>`;
      })
      .join("");
    return `<div class="forecast" role="group">${items}</div>`;
  }

  _extras(list) {
    const items = list
      .map((s) => {
        const attrs = s.attributes;
        const name = attrs.nome || attrs.famiglia || attrs.friendly_name || s.entity_id;
        const level = attrs.livello || s.state || "";
        const color = this._palette()[level] || "#999";
        return `<div class="extra">
            <span class="e-dot" style="background:${color}"></span>
            <span class="e-name">${name}</span>
            <span class="e-level" style="color:${color}">${this._lvl(level)}</span>
          </div>`;
      })
      .join("");
    return `<div class="extras">${items}</div>`;
  }

  static _css() {
    return `
      ha-card { overflow: hidden; }
      .content { padding: 16px; }
      .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; gap: 8px; }
      .title { font-size: 1.1rem; font-weight: 600; color: var(--primary-text-color); }
      .updated { font-size: .8rem; color: var(--secondary-text-color); text-align: right; }
      .badge { display: flex; flex-direction: column; align-items: center; gap: 8px; }
      .badge-level { display: flex; flex-direction: column; align-items: center; border-radius: 12px; padding: 12px 28px; color: #fff; min-width: 50%; cursor: pointer; }
      .badge-bar { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; cursor: pointer; }
      .badge-bar .bl-name { color: var(--primary-text-color); opacity: 1; }
      .bar-track { position: relative; display: block; width: 100%; max-width: 300px; height: 18px; border-radius: 9px; overflow: hidden; }
      .bar-seg { position: absolute; top: 0; bottom: 0; }
      .bar-marker { position: absolute; top: -3px; width: 3px; height: 24px; background: var(--primary-text-color, #333); border-radius: 2px; transform: translateX(-50%); box-shadow: 0 0 0 2px var(--card-background-color, #fff); }
      .unavailable { text-align: center; padding: 24px 0; color: var(--secondary-text-color); font-size: 1rem; }
      .bl-name { font-size: .8rem; opacity: .9; }
      .bl-value { font-size: 1.6rem; font-weight: 700; }
      .trend { font-size: .6em; margin-left: .3em; vertical-align: middle; }
      .season { text-align: center; font-size: .8em; color: var(--secondary-text-color); margin-top: 6px; }
      .bars { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
      .bars-trend { text-align: right; }
      .bars-empty { text-align: center; color: var(--secondary-text-color); padding: 12px 0; }
      .bar-row { display: grid; grid-template-columns: minmax(76px, 1fr) 2fr auto; gap: 8px; align-items: center; font-size: .85em; cursor: pointer; border-radius: 6px; padding: 1px 2px; }
      .br-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .br-track { position: relative; display: block; height: 10px; border-radius: 5px; background: var(--secondary-background-color, rgba(128,128,128,.2)); overflow: hidden; }
      .br-fill { display: block; height: 100%; border-radius: 5px; }
      .br-cat { font-weight: 600; min-width: 4.6em; text-align: right; }
      .subs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .sub { display: flex; gap: 6px; align-items: baseline; font-size: .85em; background: var(--secondary-background-color, #f4f4f4); border-radius: 8px; padding: 3px 8px; }
      .s-name { color: var(--primary-text-color); }
      .s-level { font-weight: 600; }
      .summary { margin-top: 12px; border-top: 1px solid var(--divider-color); padding-top: 8px; }
      .sum-title { font-size: .72em; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 4px; }
      .sum-row { display: flex; gap: 8px; align-items: baseline; font-size: .85em; padding: 2px 0; }
      .sum-row .s-name { font-weight: 600; }
      .sum-row .s-lvl { margin-left: auto; font-weight: 600; }
      .forecast { display: flex; gap: 6px; margin-top: 12px; overflow-x: auto; }
      .day { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 48px; flex: 1; cursor: pointer; border-radius: 8px; padding: 3px 0; }
      .day.selected { background: var(--secondary-background-color, rgba(128,128,128,.14)); }
      .d-name { font-size: .7em; color: var(--secondary-text-color); }
      .d-dot { width: 14px; height: 14px; border-radius: 50%; }
      .d-level { font-size: .65em; font-weight: 600; }
      .extras { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; border-top: 1px solid var(--divider-color); padding-top: 10px; }
      .extra { display: flex; gap: 6px; align-items: center; font-size: .85rem; }
      .e-dot { width: 10px; height: 10px; border-radius: 50%; }
      .e-name { font-weight: 600; }
      .e-level { font-weight: 600; }
      .empty { padding: 16px; color: var(--secondary-text-color); }
      .content.compact { padding: 10px 12px; }
      .content.compact .summary, .content.compact .subs, .content.compact .extras { margin-top: 8px; }
      .content.compact .forecast, .content.compact .bars { margin-top: 8px; }
      .content:focus { outline: none; }
      .day:focus-visible, .badge-level:focus-visible, .badge-bar:focus-visible, .bar-row:focus-visible {
        outline: 2px solid var(--primary-color, #03a9f4);
        outline-offset: 2px;
      }
    `;
  }
}

// Compact form of the site's "16 ottobre alle ore 12:11" -> "16/10 12:11".
function _fmtAggiornamento(value) {
  if (!value) return "";
  const m = String(value).match(
    /(\d{1,2})\s+([a-zàèéìòù]+)\s+alle\s+ore\s+(\d{1,2}):(\d{2})/i
  );
  if (m) {
    const mo = IT_MONTHS[m[2].toLowerCase()];
    if (mo) {
      return `${m[1].padStart(2, "0")}/${String(mo).padStart(2, "0")} ${m[3].padStart(2, "0")}:${m[4]}`;
    }
  }
  return value;
}

// Parse the site's "16 ottobre alle ore 12:11" into a Date (best effort).
function _parseAggiornamento(value) {
  if (!value) return null;
  const m = String(value).match(
    /(\d{1,2})\s+([a-zàèéìòù]+)\s+alle\s+ore\s+(\d{1,2}):(\d{2})/i
  );
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const mo = IT_MONTHS[m[2].toLowerCase()];
  if (!mo) return null;
  const now = new Date();
  let d = new Date(
    now.getFullYear(),
    mo - 1,
    Number(m[1]),
    Number(m[3]),
    Number(m[4])
  );
  if (d.getTime() > now.getTime() + 86400000) {
    d = new Date(
      now.getFullYear() - 1,
      mo - 1,
      Number(m[1]),
      Number(m[3]),
      Number(m[4])
    );
  }
  return d;
}

function _relativeDate(d, card) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return card._t("now");
  if (min < 60) return card._t("minAgo", min);
  const h = Math.floor(min / 60);
  if (h < 24) return card._t("hAgo", h);
  return card._t("dAgo", Math.floor(h / 24));
}

function _relativeAggiornamento(value, card) {
  const d = _parseAggiornamento(value);
  return d ? _relativeDate(d, card) : "";
}

const EDITOR_TAG = "ha-pollini-card-editor";

const EDITOR_LABELS = {
  it: {
    entity: "Entità principale",
    title: "Titolo (opzionale)",
    entities: "Altre famiglie (opzionale)",
    show_subs: "Mostra le sottospecie",
    show_forecast: "Mostra le previsioni",
    show_badge_name: "Mostra il nome nello stato",
    forecast_days: "Giorni di previsione da mostrare",
    font_size: "Dimensione del testo",
    variant: "Visualizzazione",
    color_scheme: "Palette colori",
    language: "Lingua",
    show_title: "Mostra intestazione",
    compact: "Layout compatto",
    relative_time: "Ultimo aggiornamento relativo",
    tap_action: "Azione al tocco",
    hold_action: "Azione alla pressione prolungata",
    double_tap_action: "Azione al doppio tocco",
  },
  en: {
    entity: "Main entity",
    title: "Title (optional)",
    entities: "More families (optional)",
    show_subs: "Show sub-species",
    show_forecast: "Show forecast",
    show_badge_name: "Show name in the badge",
    forecast_days: "Forecast days to show",
    font_size: "Text size",
    variant: "Layout",
    color_scheme: "Colour palette",
    language: "Language",
    show_title: "Show header",
    compact: "Compact layout",
    relative_time: "Relative last-updated",
    tap_action: "Tap action",
    hold_action: "Hold action",
    double_tap_action: "Double-tap action",
  },
};

class HaPolliniCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._form = null;
  }

  setConfig(config) {
    this._config = { ...HaPolliniCardEditor._defaults(), ...(config || {}) };
    this._render();
  }

  static _defaults() {
    return {
      show_subs: true,
      show_forecast: true,
      show_badge_name: true,
      forecast_days: 7,
      font_size: "normal",
      variant: "gauge",
      color_scheme: "default",
      language: "auto",
      show_title: true,
      compact: false,
      relative_time: true,
      tap_action: { action: "more-info" },
      hold_action: { action: "none" },
      double_tap_action: { action: "none" },
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _labels() {
    return EDITOR_LABELS[haLang(this._hass, this._config)] || EDITOR_LABELS.it;
  }

  _render() {
    if (!this._hass) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._config = ev.detail.value;
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
          })
        );
      });
      this.shadowRoot.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      {
        name: "entity",
        required: true,
        selector: { entity: { domain: "sensor", integration: "ha_pollini" } },
      },
      { name: "title", selector: { text: {} } },
      {
        name: "entities",
        selector: {
          entity: { domain: "sensor", integration: "ha_pollini", multiple: true },
        },
      },
      { name: "show_subs", selector: { boolean: {} } },
      { name: "show_forecast", selector: { boolean: {} } },
      { name: "show_badge_name", selector: { boolean: {} } },
      {
        name: "forecast_days",
        selector: { number: { min: 1, max: 7, mode: "box", step: 1 } },
      },
      {
        name: "variant",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "gauge", label: "Badge" },
              { value: "bar", label: "Barra" },
              { value: "bars", label: "Barre per famiglia" },
            ],
          },
        },
      },
      {
        name: "color_scheme",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "default", label: "Predefinita" },
              { value: "colorblind", label: "Colorblind" },
            ],
          },
        },
      },
      {
        name: "language",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "auto", label: "Auto" },
              { value: "it", label: "Italiano" },
              { value: "en", label: "English" },
            ],
          },
        },
      },
      {
        name: "font_size",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "small", label: "Piccolo" },
              { value: "normal", label: "Normale" },
              { value: "large", label: "Grande" },
              { value: "xlarge", label: "Molto grande" },
            ],
          },
        },
      },
      { name: "show_title", selector: { boolean: {} } },
      { name: "compact", selector: { boolean: {} } },
      { name: "relative_time", selector: { boolean: {} } },
      { name: "tap_action", selector: { ui_action: {} } },
      { name: "hold_action", selector: { ui_action: {} } },
      { name: "double_tap_action", selector: { ui_action: {} } },
    ];
    this._form.computeLabel = (schema) => this._labels()[schema.name] || schema.name;
  }
}

function haLang(hass, config) {
  if (config && (config.language === "it" || config.language === "en")) {
    return config.language;
  }
  const loc = hass && hass.locale && hass.locale.language ? hass.locale.language : "it";
  return String(loc).slice(0, 2) === "en" ? "en" : "it";
}

const CARD_TAG = "ha-pollini-card";

const defineCard = () => {
  for (const [tag, cls] of [
    [CARD_TAG, HaPolliniCard],
    [EDITOR_TAG, HaPolliniCardEditor],
  ]) {
    try {
      if (!customElements.get(tag)) {
        customElements.define(tag, cls);
      }
    } catch (_err) {
      // Already registered in this registry.
    }
  }
};

// Home Assistant replaces window.customElements with a scoped registry while
// booting, after modules loaded via frontend.add_extra_js_url() may already
// have run. An element defined on the previous registry is not visible on the
// new one, which makes the card disappear from the card picker and the
// dashboard. Register now and again once the swap is observed.
const initialRegistry = globalThis.customElements;
defineCard();
if (globalThis.customElements === initialRegistry) {
  const swapWatcher = window.setInterval(() => {
    if (globalThis.customElements === initialRegistry) return;
    window.clearInterval(swapWatcher);
    defineCard();
  }, 200);
  window.setTimeout(() => window.clearInterval(swapWatcher), 30000);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "3BMeteo Pollini",
  description: "Livello pollini, sottospecie e previsioni 7 giorni",
  version: CARD_VERSION,
  preview: false,
});
