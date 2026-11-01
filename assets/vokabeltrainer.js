/* Vokabeltrainer – allgemein für Fremdsprachen-Lernräume.
   Aktiv, wenn in data/faecher.json beim Fach vokabeln_vorhanden: true steht.
   Daten: data/vokabeln/<slug>.json (Schema siehe README). Fortschritt: localStorage. */
(function () {
  "use strict";
  var CACHE = {};
  var RUNDEN = [10, 20, 50, 0];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function mischen(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function norm(s) {
    return String(s || "").normalize("NFC").toLowerCase().replace(/[’‘`´]/g, "'").replace(/[«»„“”"]/g, "")
      .replace(/…|\.\.\./g, "").replace(/\s+/g, " ").replace(/^[\s¡¿]+|[\s!?.;:]+$/g, "").replace(/\s+([!?;:])/g, "$1").trim();
  }
  function varianten(txt) {
    var v = {}, basis = [txt, txt.replace(/\([^)]*\)/g, " ")];
    basis.forEach(function (b) {
      v[norm(b)] = 1;
      b.split(/[\/;,]/).forEach(function (t) { var n = norm(t); if (n.length >= 3) v[n] = 1; });
    });
    delete v[""];
    return v;
  }

  function Trainer(el, fach) {
    this.el = el; this.f = fach;
    this.key = "lw12bt-vokabeln-" + fach.slug;
    this.kurz = fach.vokabeln_sprache_kurz || fach.kuerzel;
    this.lang = fach.vokabeln_sprache || "";
    this.p = this.ladeFortschritt();
  }
  Trainer.prototype.ladeFortschritt = function () {
    try { var p = JSON.parse(localStorage.getItem(this.key) || "null"); if (p && p.v === 1) return p; } catch (e) { }
    return { v: 1, w: {}, e: {} };
  };
  Trainer.prototype.speichern = function () { try { localStorage.setItem(this.key, JSON.stringify(this.p)); } catch (e) { } };
  Trainer.prototype.box = function (id) { var w = this.p.w[id]; return w ? w[0] : -1; };
  Trainer.prototype.sicher = function (id) { return this.box(id) >= 2; };

  Trainer.prototype.start = function () {
    var self = this, url = this.f.vokabeln_datei || ("data/vokabeln/" + this.f.slug + ".json");
    this.el.innerHTML = '<p class="loading">Lade Vokabeln …</p>';
    (CACHE[url] ? Promise.resolve(CACHE[url]) : fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }))
      .then(function (d) {
        CACHE[url] = d; self.d = d;
        self.alle = d.eintraege || [];
        self.byId = {}; self.hinweise = {}; self.proPrompt = { fd: {}, df: {} };
        self.alle.forEach(function (e) {
          self.byId[e.id] = e;
          if (e.abfragbar === false) { if (e.hinweis_zu) (self.hinweise[e.hinweis_zu] = self.hinweise[e.hinweis_zu] || []).push(e); return; }
          (self.proPrompt.fd[e.ausdruck] = self.proPrompt.fd[e.ausdruck] || []).push(e);
          (self.proPrompt.df[e.uebersetzung] = self.proPrompt.df[e.uebersetzung] || []).push(e);
        });
        self.lektionen = (d.lektionen || []).map(function (l) { return l.name; });
        self.setup();
      })
      .catch(function () { self.el.innerHTML = '<p class="leer">Vokabeln konnten nicht geladen werden.</p>'; });
  };
  Trainer.prototype.woerter = function (lek) { return this.alle.filter(function (e) { return e.abfragbar !== false && (!lek || lek.indexOf(e.lektion) >= 0); }); };

  /* ---------- Einstellungen ---------- */
  Trainer.prototype.setup = function () {
    var self = this, e = this.p.e, K = this.kurz;
    var gew = e.lek && e.lek.length ? e.lek : [this.lektionen[0]];
    var h = '<div class="vt-panel"><p class="meta">Quelle: ausschließlich der Vokabelteil von <em>' + esc(this.d.buch) + "</em> (" + this.woerter().length + " Wörter in " + this.lektionen.length + " Lektionen). „Sicher“ heißt: zuletzt zweimal in Folge richtig.</p>";
    h += '<form class="vt-setup"><fieldset><legend>Lektionen</legend><div class="vt-lek">';
    this.lektionen.forEach(function (n, i) {
      var w = self.woerter([n]), s = w.filter(function (x) { return self.sicher(x.id); }).length, pr = w.length ? Math.round(100 * s / w.length) : 0;
      var l0 = self.d.lektionen[i];
      h += '<label class="vt-lk"><input type="checkbox" name="lek" value="' + esc(n) + '"' + (gew.indexOf(n) >= 0 ? " checked" : "") + '><span class="vt-lk-t"><strong>' + esc(n) + '</strong> <span class="small muted">S. ' + esc(l0.seite_von) + (l0.seite_bis !== l0.seite_von ? "–" + esc(l0.seite_bis) : "") + '</span><span class="vt-bar" aria-hidden="true"><span style="width:' + pr + '%"></span></span><span class="small muted">' + s + " / " + w.length + " sicher</span></span></label>";
    });
    h += '</div><p class="vt-alle"><button type="button" class="vt-link" data-act="alle">alle wählen</button> · <button type="button" class="vt-link" data-act="keine">keine</button></p></fieldset>';
    function radio(name, wert, txt, def) { return '<label class="vt-r"><input type="radio" name="' + name + '" value="' + wert + '"' + (def === wert ? " checked" : "") + "> " + txt + "</label>"; }
    h += '<fieldset><legend>Richtung</legend>' + radio("ri", "fd", K + " → DE", e.ri || "fd") + radio("ri", "df", "DE → " + K, e.ri || "fd") + radio("ri", "mix", "gemischt", e.ri || "fd") + "</fieldset>";
    h += '<fieldset><legend>Antworten</legend>' + radio("mo", "mc", "anklicken (4 Möglichkeiten)", e.mo || "mc") + radio("mo", "tip", "eintippen", e.mo || "mc") + "</fieldset>";
    h += '<fieldset><legend>Auswahl</legend>' + radio("fi", "offen", "nur noch nicht sichere", e.fi || "offen") + radio("fi", "alle", "alle Wörter", e.fi || "offen")
      + '<label class="vt-r">Rundenlänge <select name="n">' + RUNDEN.map(function (n) { return '<option value="' + n + '"' + (String(e.n || 20) === String(n) ? " selected" : "") + ">" + (n ? n + " Wörter" : "alle") + "</option>"; }).join("") + "</select></label></fieldset>";
    h += '<p class="vt-fehler feedback falsch" role="alert"></p><button type="submit">Runde starten</button> <button type="button" class="vt-link" data-act="reset">Fortschritt zurücksetzen</button></form></div>';
    this.el.innerHTML = h;
    var form = this.el.querySelector("form");
    form.addEventListener("click", function (ev) {
      var a = ev.target.getAttribute && ev.target.getAttribute("data-act"); if (!a) return;
      if (a === "alle" || a === "keine") form.querySelectorAll("input[name=lek]").forEach(function (c) { c.checked = a === "alle"; });
      if (a === "reset" && window.confirm("Fortschritt für diesen Vokabeltrainer auf diesem Gerät löschen?")) { self.p.w = {}; self.speichern(); self.setup(); }
    });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var lek = [].map.call(form.querySelectorAll("input[name=lek]:checked"), function (c) { return c.value; });
      var cfg = { lek: lek, ri: form.ri.value, mo: form.mo.value, fi: form.fi.value, n: +form.n.value };
      if (!lek.length) { form.querySelector(".vt-fehler").textContent = "Bitte mindestens eine Lektion wählen."; return; }
      var pool = self.woerter(lek);
      if (cfg.fi === "offen") pool = pool.filter(function (x) { return !self.sicher(x.id); });
      if (!pool.length) { form.querySelector(".vt-fehler").textContent = "In diesen Lektionen ist schon alles sicher. Wähle „alle Wörter“ oder weitere Lektionen."; return; }
      self.p.e = cfg; self.speichern();
      pool = mischen(pool).sort(function (a, b) { return self.box(a.id) - self.box(b.id); });
      self.runde(mischen(cfg.n ? pool.slice(0, cfg.n) : pool), cfg);
    });
  };

  /* ---------- Abfrage ---------- */
  Trainer.prototype.runde = function (liste, cfg) {
    this.cfg = cfg; this.liste = liste; this.i = 0; this.ok = 0; this.falsch = [];
    this.frage();
  };
  Trainer.prototype.frage = function () {
    var self = this, e = this.liste[this.i], cfg = this.cfg, K = this.kurz;
    var ri = cfg.ri === "mix" ? (Math.random() < 0.5 ? "fd" : "df") : cfg.ri;
    var prompt = ri === "fd" ? e.ausdruck : e.uebersetzung;
    var gleiche = this.proPrompt[ri][prompt] || [e];
    var richtig = gleiche.map(function (x) { return ri === "fd" ? x.uebersetzung : x.ausdruck; });
    this.q = { e: e, ri: ri, richtig: richtig, beantwortet: false };
    var h = '<div class="vt-karte" lang="de"><div class="vt-kopf"><span class="badge">' + (this.i + 1) + " / " + this.liste.length + '</span> <span class="small muted">' + (ri === "fd" ? K + " → DE" : "DE → " + K) + "</span>"
      + '<button type="button" class="vt-link vt-ende" data-act="ende">Runde beenden</button></div>';
    h += '<p class="vt-prompt"' + (ri === "fd" && this.lang ? ' lang="' + esc(this.lang) + '"' : "") + ">" + esc(prompt) + "</p>";
    h += '<p class="quelle vt-quelle">' + esc(this.quelleText(e)) + "</p>";
    if (cfg.mo === "mc") {
      var opts = mischen([richtig[0]].concat(this.ablenker(e, ri, richtig)));
      h += '<div class="vt-opts" role="group" aria-label="Antwort wählen">' + opts.map(function (o, j) { return '<button type="button" class="vt-opt" data-wert="' + esc(o) + '"' + (ri === "df" && self.lang ? ' lang="' + esc(self.lang) + '"' : "") + '><span class="vt-nr" aria-hidden="true">' + (j + 1) + "</span><span class=\"vt-txt\">" + esc(o) + "</span></button>"; }).join("") + "</div>";
    } else {
      h += '<form class="vt-tip"><label class="sr-only" for="vt-in">Deine Antwort</label><input id="vt-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"' + (ri === "df" && this.lang ? ' lang="' + esc(this.lang) + '"' : "") + ' placeholder="Antwort eintippen"><button type="submit">Prüfen</button>'
        + (ri === "df" && this.lang === "fr" ? '<span class="vt-zeichen" aria-label="Sonderzeichen">' + ["é", "è", "ê", "à", "â", "ç", "ô", "î", "ù", "û", "ë", "ï", "œ", "’"].map(function (c) { return '<button type="button" class="vt-z" data-z="' + c + '">' + c + "</button>"; }).join("") + "</span>" : "") + "</form>";
    }
    h += '<div class="vt-auswertung" role="status" aria-live="polite"></div></div>';
    this.el.innerHTML = h;
    var inp = this.el.querySelector("#vt-in");
    if (inp) inp.focus({ preventScroll: true });
    this.el.querySelector("[data-act=ende]").onclick = function () { self.ende(); };
    this.el.querySelectorAll(".vt-opt").forEach(function (b) { b.onclick = function () { self.antwortMC(b); }; });
    var f = this.el.querySelector(".vt-tip");
    if (f) {
      f.onsubmit = function (ev) { ev.preventDefault(); if (!self.q.beantwortet) self.antwortTip(inp.value); };
      f.querySelectorAll(".vt-z").forEach(function (b) { b.onclick = function () { var s = inp.selectionStart || inp.value.length; inp.value = inp.value.slice(0, s) + b.getAttribute("data-z") + inp.value.slice(inp.selectionEnd || s); inp.focus(); inp.setSelectionRange(s + 1, s + 1); }; });
    }
  };
  Trainer.prototype.quelleText = function (e) { return (this.d.buch_kurz || String(this.d.buch).split(" – ")[0]) + ", S. " + e.seite + ", " + e.lektion; };
  Trainer.prototype.ablenker = function (e, ri, richtig) {
    var self = this, feld = ri === "fd" ? "uebersetzung" : "ausdruck", nein = {};
    richtig.forEach(function (r) { nein[norm(r)] = 1; });
    function sammeln(pool) {
      var out = [];
      mischen(pool).forEach(function (x) { var t = x[feld], n = norm(t); if (out.length < 3 && !nein[n]) { nein[n] = 1; out.push(t); } });
      return out;
    }
    var o = sammeln(this.woerter([e.lektion]));
    if (o.length < 3) o = o.concat(sammeln(this.woerter())).slice(0, 3);
    return o;
  };
  Trainer.prototype.antwortMC = function (btn) {
    if (this.q.beantwortet) return;
    var ok = this.q.richtig.indexOf(btn.getAttribute("data-wert")) >= 0;
    var self = this;
    this.el.querySelectorAll(".vt-opt").forEach(function (b) {
      b.disabled = true;
      if (self.q.richtig.indexOf(b.getAttribute("data-wert")) >= 0) b.classList.add("ok");
    });
    if (!ok) btn.classList.add("falsch");
    this.werten(ok, false);
  };
  Trainer.prototype.antwortTip = function (wert) {
    var n = norm(wert);
    if (!n) return;
    var ok = this.q.richtig.some(function (r) { return varianten(r)[n]; });
    var inp = this.el.querySelector("#vt-in"); inp.readOnly = true; inp.classList.add(ok ? "ok" : "falsch");
    this.el.querySelector(".vt-tip button[type=submit]").disabled = true;
    this.werten(ok, true);
  };
  Trainer.prototype.werten = function (ok, tip) {
    var self = this, q = this.q, e = q.e;
    q.beantwortet = true; q.ok = ok;
    this.buchen(e.id, ok, false);
    if (ok) this.ok++; else this.falsch.push(e);
    var K = this.kurz;
    var h = '<p class="feedback ' + (ok ? "ok" : "falsch") + '">' + (ok ? "Richtig! ✓" : "Leider falsch.") + "</p>";
    var gleiche = this.proPrompt[q.ri][q.ri === "fd" ? e.ausdruck : e.uebersetzung] || [e];
    h += '<dl class="vt-loes">' + gleiche.map(function (x) {
      return '<div><dt lang="' + esc(self.lang) + '">' + esc(x.ausdruck) + '</dt><dd lang="de">' + esc(x.uebersetzung) + "</dd></div>";
    }).join("") + "</dl>";
    var notiz = [];
    gleiche.forEach(function (x) {
      (x.beispiele || []).forEach(function (b) { notiz.push(b); });
      (self.hinweise[x.id] || []).forEach(function (hx) { notiz.push(hx.ausdruck + " – " + hx.uebersetzung + (hx.beispiel_anmerkung ? " | " + hx.beispiel_anmerkung : "")); });
    });
    if (notiz.length) h += '<div class="vt-notiz"><p class="vt-notiz-t">Beispiel / Anmerkung aus dem Buch</p><ul>' + notiz.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" + (notiz.some(function (b) { return /^[EI] /.test(b) || / – [EI] /.test(b); }) ? '<p class="small muted">E = verwandtes Wort im Englischen, I = im Italienischen.</p>' : "") + "</div>";
    h += '<p class="vt-aktion">' + (tip && !ok ? '<button type="button" class="vt-link" data-act="doch">Ich hatte es richtig</button> ' : "") + '<button type="button" class="vt-weiter" data-act="weiter">' + (this.i + 1 < this.liste.length ? "Weiter →" : "Auswertung") + "</button></p>";
    var aw = this.el.querySelector(".vt-auswertung"); aw.innerHTML = h;
    var w = aw.querySelector("[data-act=weiter]"); w.focus({ preventScroll: true });
    w.onclick = function () { self.weiter(); };
    var d = aw.querySelector("[data-act=doch]");
    if (d) d.onclick = function () {
      self.buchen(e.id, true, true); self.ok++; self.falsch.pop();
      aw.querySelector(".feedback").className = "feedback ok"; aw.querySelector(".feedback").textContent = "Als richtig gewertet ✓";
      self.el.querySelector("#vt-in").className = "ok"; d.remove();
    };
    w.scrollIntoView({ block: "nearest" });
  };
  /* Leitner-Stufe: richtig +1 (max. 5), falsch -> 0. korrektur: falsche Wertung zuruecknehmen und als richtig buchen. */
  Trainer.prototype.buchen = function (id, ok, korrektur) {
    var w = korrektur && this.q.vorher ? this.q.vorher.slice() : (this.p.w[id] || [0, 0, 0, 0]).slice();
    if (!korrektur) this.q.vorher = w.slice();
    if (ok) { w[0] = Math.min(5, w[0] + 1); w[1]++; } else { w[0] = 0; w[2]++; }
    w[3] = Date.now();
    this.p.w[id] = w; this.speichern();
  };
  Trainer.prototype.weiter = function () { this.i++; if (this.i < this.liste.length) this.frage(); else this.ende(); };
  Trainer.prototype.ende = function () {
    var self = this, n = this.i + (this.q && this.q.beantwortet ? 1 : 0); n = Math.min(n, this.liste.length);
    var h = '<div class="vt-karte"><h3>Runde beendet</h3><p class="vt-score"><strong>' + this.ok + " von " + n + "</strong> richtig.</p>";
    if (this.falsch.length) h += '<details open><summary>Falsch beantwortet (' + this.falsch.length + ")</summary><ul class=\"vt-falsch\">" + this.falsch.map(function (e) { return '<li><span lang="' + esc(self.lang) + '">' + esc(e.ausdruck) + "</span> – " + esc(e.uebersetzung) + ' <span class="small muted">(' + esc(self.quelleText(e)) + ")</span></li>"; }).join("") + "</ul></details>";
    h += '<p class="vt-aktion">' + (this.falsch.length ? '<button type="button" class="vt-weiter" data-act="wdh">Falsche wiederholen</button> ' : "") + '<button type="button" class="vt-weiter" data-act="neu">Neue Runde / Einstellungen</button></p></div>';
    this.el.innerHTML = h;
    var w = this.el.querySelector("[data-act=wdh]"); if (w) w.onclick = function () { self.runde(mischen(self.falsch), self.cfg); };
    this.el.querySelector("[data-act=neu]").onclick = function () { self.setup(); };
    this.el.querySelector(".vt-aktion button").focus({ preventScroll: true });
  };

  document.addEventListener("keydown", function (ev) {
    var t = window.__vt; if (!t || !t.q || !document.body.contains(t.el) || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var tag = (ev.target.tagName || "").toLowerCase();
    if (!t.q.beantwortet && /^[1-4]$/.test(ev.key) && tag !== "input" && tag !== "select") {
      var b = t.el.querySelectorAll(".vt-opt")[+ev.key - 1]; if (b) { ev.preventDefault(); b.click(); }
    }
  });

  window.Vokabeltrainer = {
    mount: function (el, fach) { if (!el || !fach) return; var t = new Trainer(el, fach); window.__vt = t; t.start(); }
  };
})();
