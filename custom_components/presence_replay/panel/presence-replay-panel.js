
class PresenceReplayPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._loaded) {
      this._loaded = true;
      this._config = {
        entities: [],
        reference_days: 14,
        random_seconds: 45,
        min_event_gap: 120,
        time_windows: [
          { start: "06:30", end: "09:00" },
          { start: "17:00", end: "22:30" }
        ]
      };
      this._render();
    }
  }

  _render() {
    this.innerHTML = `
    <style>
      .page{padding:24px;max-width:1280px;margin:auto}
      .header{display:flex;justify-content:space-between;align-items:center}
      .title{font-size:22px;font-weight:600}
      .grid{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;margin-top:24px}
      .card{background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:16px;padding:16px}
      .card h3{margin:0 0 12px 0;font-size:16px}
      .timeline .event{padding:10px;border-bottom:1px solid var(--divider-color)}
      button{padding:8px 14px;border-radius:12px;border:none;background:var(--primary-color);color:white}
    </style>
    <div class="page">
      <div class="header">
        <div class="title">Presence Replay – Premium</div>
        <div>
          <button id="preview">Vorschau</button>
          <button id="start">Start</button>
        </div>
      </div>
      <div class="grid">
        <div class="card">
          <h3>Konfiguration</h3>
          <p>Premium Anwesenheitssimulation</p>
        </div>
        <div class="card timeline">
          <h3>Timeline Vorschau</h3>
          <div id="timeline">Keine Vorschau geladen</div>
        </div>
      </div>
    </div>`;

    this.querySelector("#preview").onclick = () => this._preview();
    this.querySelector("#start").onclick = () => {
      this._hass.callService("presence_replay", "start", this._config);
    };
  }

  async _preview() {
    const el = this.querySelector("#timeline");
    el.innerHTML = "Berechne…";
    const events = await this._hass.callApi("POST","presence_replay/preview",this._config);
    el.innerHTML = "";
    events.forEach(ev=>{
      const d=document.createElement("div");
      d.className="event";
      d.innerText = new Date(ev.time).toLocaleTimeString()+" – "+ev.entity_id+" → "+ev.state;
      el.appendChild(d);
    });
  }
}
customElements.define("presence-replay-panel", PresenceReplayPanel);
