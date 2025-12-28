
class PresenceReplayPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._inited) {
      this._inited = true;
      this._config = null;
      this._running = false;
      this._render();
      this._init();
    } else {
      this._refreshEntities();
      this._drawLists();
    }
  }
  async _init() {
    await this._loadConfig();
    await this._loadStatus();
    this._refreshEntities();
    this._bind();
    this._drawAll();
  }
  _defaults() {
    return { entities: [], reference_days: 14, random_seconds: 45, min_event_gap: 120,
      time_windows: [{start:"06:30",end:"09:00"},{start:"17:00",end:"22:30"}] };
  }
  async _loadConfig() {
    try { const res = await this._hass.callApi("GET","presence_replay/config"); this._config = res?.config || this._defaults(); }
    catch(e){ this._config = this._defaults(); this._toast("Konfiguration konnte nicht geladen werden."); }
  }
  async _saveConfig() {
    try { await this._hass.callApi("POST","presence_replay/config",{config:this._config}); this._toast("Gespeichert"); }
    catch(e){ this._toast("Speichern fehlgeschlagen"); }
  }
  async _loadStatus() {
    try { const res = await this._hass.callApi("GET","presence_replay/status"); this._running = !!res.running; }
    catch(e){ this._running = false; }
    this._setPill();
  }
  _eligible(eid){ return eid.startsWith("light.")||eid.startsWith("switch.")||eid.startsWith("cover."); }
  _icon(eid){ return eid.startsWith("light.")?"mdi:lightbulb-outline":eid.startsWith("switch.")?"mdi:toggle-switch-outline":"mdi:window-shutter"; }
  _name(eid){ return this._hass.states[eid]?.attributes?.friendly_name || eid; }
  _refreshEntities(){ this._all = Object.keys(this._hass.states||{}).filter(e=>this._eligible(e)).sort(); }
  _toast(msg){ const t=this.querySelector("#toast"); t.textContent=msg; t.style.display="block"; clearTimeout(this._toastTimer); this._toastTimer=setTimeout(()=>t.style.display="none",2200); }
  _render(){
    this.innerHTML = `
    <style>
      .wrap{padding:24px;max-width:1280px;margin:0 auto;display:grid;gap:18px}
      .top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
      .h1{font-size:22px;font-weight:650}
      .sub{font-size:13px;opacity:.65;margin-top:4px}
      .btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
      button{border:0;border-radius:14px;padding:9px 14px;font-weight:600;cursor:pointer}
      button.primary{background:var(--primary-color);color:var(--text-primary-color)}
      button.secondary{background:transparent;border:1px solid var(--divider-color);color:var(--primary-text-color)}
      button.danger{background:transparent;border:1px solid var(--divider-color);color:var(--error-color)}
      .grid{display:grid;grid-template-columns:1.2fr 1fr;gap:18px}
      @media (max-width:980px){.grid{grid-template-columns:1fr}}
      .card{background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:12px}
      .ct{display:flex;align-items:center;gap:10px;font-weight:650}
      .pill{margin-left:auto;font-size:12px;border:1px solid var(--divider-color);border-radius:999px;padding:4px 10px;opacity:.85}
      .row{display:flex;gap:12px;flex-wrap:wrap}
      .field{display:flex;flex-direction:column;gap:6px;min-width:160px}
      .label{font-size:12px;opacity:.7}
      input{background:transparent;border:1px solid var(--divider-color);border-radius:12px;padding:8px 10px;color:var(--primary-text-color)}
      .split{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      @media (max-width:980px){.split{grid-template-columns:1fr}}
      .list{border-top:1px solid var(--divider-color);padding-top:8px;max-height:360px;overflow:auto}
      .item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;border-radius:14px}
      .item:hover{background:rgba(255,255,255,.03)}
      .left{display:flex;align-items:center;gap:12px;min-width:0}
      .t{min-width:0}
      .n{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .id{font-size:11px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .muted{opacity:.65;font-size:13px}
      .tw{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--divider-color);border-radius:14px;margin-top:8px}
      .tw input{min-width:90px}
      .timeline{display:flex;flex-direction:column;gap:10px}
      .ev{display:grid;grid-template-columns:70px 1fr;gap:12px;padding:10px;border-radius:16px;border:1px solid var(--divider-color);background:rgba(255,255,255,.02)}
      .time{font-family:ui-monospace, Menlo, Monaco, Consolas, "Courier New", monospace;opacity:.7}
      .meta{font-size:12px;opacity:.65}
      .toast{position:fixed;right:20px;bottom:20px;background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:14px;padding:10px 12px;box-shadow:0 6px 20px rgba(0,0,0,.2);display:none}
    </style>
    <div class="wrap">
      <div class="top">
        <div><div class="h1">Presence Replay</div><div class="sub">Historie → Simulation mit Zeitfenstern & Anti‑Pattern.</div></div>
        <div class="btns">
          <button class="secondary" id="preview">Vorschau</button>
          <button class="secondary" id="save">Speichern</button>
          <button class="primary" id="start">Start</button>
          <button class="danger" id="stop">Stop</button>
        </div>
      </div>
      <div class="grid">
        <div class="card">
          <div class="ct"><ha-icon icon="mdi:cog"></ha-icon>Konfiguration<span class="pill" id="pill">—</span></div>
          <div class="row">
            <div class="field"><div class="label">Referenztage</div><input id="ref" type="number" min="1" max="60"></div>
            <div class="field"><div class="label">Random (Sek.)</div><input id="rnd" type="number" min="0" max="600"></div>
            <div class="field"><div class="label">Mindestabstand (Sek.)</div><input id="gap" type="number" min="30" max="900"></div>
          </div>
          <div class="split">
            <div>
              <div class="ct"><ha-icon icon="mdi:format-list-bulleted"></ha-icon>Entitäten</div>
              <div class="muted">„+“ fügt zur Playlist hinzu.</div>
              <div class="list" id="all"></div>
            </div>
            <div>
              <div class="ct"><ha-icon icon="mdi:playlist-plus"></ha-icon>Playlist
                <button class="secondary" id="clear" style="margin-left:auto;padding:7px 12px;border-radius:12px">Leeren</button>
              </div>
              <div class="muted">Covers nur open/close.</div>
              <div class="list" id="sel"></div>
              <div class="ct" style="margin-top:12px"><ha-icon icon="mdi:calendar-clock"></ha-icon>Zeitfenster
                <button class="secondary" id="addw" style="margin-left:auto;padding:7px 12px;border-radius:12px">+</button>
              </div>
              <div id="wins"></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="ct"><ha-icon icon="mdi:timeline-clock-outline"></ha-icon>Vorschau Timeline</div>
          <div class="muted">Dry‑Run – ohne Schalten.</div>
          <div class="timeline" id="tl"><div class="muted">Noch keine Vorschau.</div></div>
        </div>
      </div>
    </div>
    <div id="toast" class="toast"></div>`;
  }
  _bind(){
    this.querySelector("#save").onclick = ()=>this._saveConfig();
    this.querySelector("#preview").onclick = ()=>this._preview();
    this.querySelector("#start").onclick = ()=>this._start();
    this.querySelector("#stop").onclick = ()=>this._stop();
    this.querySelector("#clear").onclick = ()=>{ this._config.entities=[]; this._drawLists(); };
    this.querySelector("#addw").onclick = ()=>{ (this._config.time_windows ||= []).push({start:"18:00",end:"22:00"}); this._drawWindows(); };
    const ref=this.querySelector("#ref"), rnd=this.querySelector("#rnd"), gap=this.querySelector("#gap");
    ref.value=this._config.reference_days??14; rnd.value=this._config.random_seconds??45; gap.value=this._config.min_event_gap??120;
    ref.onchange=e=>this._config.reference_days=Number(e.target.value||14);
    rnd.onchange=e=>this._config.random_seconds=Number(e.target.value||45);
    gap.onchange=e=>this._config.min_event_gap=Number(e.target.value||120);
  }
  _setPill(){ const p=this.querySelector("#pill"); if(p) p.textContent=this._running?"läuft":"bereit"; }
  _drawAll(){ this._drawLists(); this._drawWindows(); this._setPill(); }
  _drawLists(){
    const all=this.querySelector("#all"), sel=this.querySelector("#sel");
    const selected=new Set(this._config.entities||[]);
    all.innerHTML="";
    for(const eid of (this._all||[])){
      const row=document.createElement("div"); row.className="item";
      row.innerHTML=`<div class="left"><ha-icon icon="${this._icon(eid)}"></ha-icon><div class="t"><div class="n">${this._name(eid)}</div><div class="id">${eid}</div></div></div>
        <button class="secondary" style="padding:7px 12px;border-radius:12px">${selected.has(eid)?"✓":"+"}</button>`;
      row.querySelector("button").onclick=()=>{ if(selected.has(eid)) this._config.entities=this._config.entities.filter(x=>x!==eid); else this._config.entities=[...(this._config.entities||[]),eid]; this._drawLists(); };
      all.appendChild(row);
    }
    sel.innerHTML="";
    for(const eid of (this._config.entities||[])){
      const row=document.createElement("div"); row.className="item";
      row.innerHTML=`<div class="left"><ha-icon icon="${this._icon(eid)}"></ha-icon><div class="t"><div class="n">${this._name(eid)}</div><div class="id">${eid}</div></div></div>
        <button class="secondary" style="padding:7px 12px;border-radius:12px">–</button>`;
      row.querySelector("button").onclick=()=>{ this._config.entities=this._config.entities.filter(x=>x!==eid); this._drawLists(); };
      sel.appendChild(row);
    }
  }
  _drawWindows(){
    const host=this.querySelector("#wins"); host.innerHTML="";
    const wins=this._config.time_windows||[];
    if(!wins.length){ host.innerHTML=`<div class="muted" style="margin-top:8px">Keine Zeitfenster – Planung ganztägig.</div>`; return; }
    wins.forEach((w,idx)=>{
      const row=document.createElement("div"); row.className="tw";
      row.innerHTML=`<div style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="label">Start</div><input type="time" value="${w.start||"18:00"}"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="label">Ende</div><input type="time" value="${w.end||"22:00"}"></div>
        <button class="secondary" style="padding:7px 12px;border-radius:12px">✕</button>`;
      const ins=row.querySelectorAll("input");
      ins[0].onchange=e=>wins[idx].start=e.target.value;
      ins[1].onchange=e=>wins[idx].end=e.target.value;
      row.querySelector("button").onclick=()=>{ wins.splice(idx,1); this._config.time_windows=wins; this._drawWindows(); };
      host.appendChild(row);
    });
  }
  async _preview(){
    const tl=this.querySelector("#tl");
    tl.innerHTML=`<div class="muted">Berechne Timeline…</div>`;
    try{
      const events=await this._hass.callApi("POST","presence_replay/preview",this._config);
      if(!events?.length){ tl.innerHTML=`<div class="muted">Keine Events (Zeitfenster / Historie).</div>`; return; }
      tl.innerHTML="";
      events.forEach(ev=>{
        const d=new Date(ev.time); const time=d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
        const div=document.createElement("div"); div.className="ev";
        div.innerHTML=`<div class="time">${time}</div><div><div style="display:flex;align-items:center;gap:8px"><ha-icon icon="${this._icon(ev.entity_id)}"></ha-icon>
          <div style="font-weight:650">${this._name(ev.entity_id)}</div></div><div class="meta">${ev.entity_id} → ${ev.state}</div></div>`;
        tl.appendChild(div);
      });
    }catch(e){ tl.innerHTML=`<div class="muted">Vorschau fehlgeschlagen.</div>`; }
  }
  async _start(){ await this._saveConfig(); try{ await this._hass.callService("presence_replay","start",{}); await this._loadStatus(); this._toast("Simulation gestartet"); }catch(e){ this._toast("Start fehlgeschlagen"); } }
  async _stop(){ try{ await this._hass.callService("presence_replay","stop",{}); await this._loadStatus(); this._toast("Simulation gestoppt"); }catch(e){ this._toast("Stop fehlgeschlagen"); } }
}
customElements.define("presence-replay-panel", PresenceReplayPanel);
