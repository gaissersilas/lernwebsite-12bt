/* Lernwebsite 12BT – statisch, ohne Build. Daten: data/termine.json, data/faecher.json, data/aufgaben/<slug>.json */
(function () {
  "use strict";
  var TZ = "Europe/Berlin";
  var LN_TYPEN = ["schulaufgabe", "kurzarbeit", "stegreifaufgabe", "referat", "pruefung", "abitur"];
  var GEWICHT = { abitur: 3, schulaufgabe: 3, pruefung: 2, kurzarbeit: 2, referat: 1.5, stegreifaufgabe: 1 };
  var TYP_LABEL = { schulaufgabe: "Schulaufgabe", kurzarbeit: "Kurzarbeit", stegreifaufgabe: "Stegreifaufgabe", referat: "Referat", pruefung: "Prüfung", abitur: "Fachabitur", ferien: "Ferien", feiertag: "Feiertag", veranstaltung: "Veranstaltung", sonstiges: "Sonstiges" };
  var WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  var S = { termine: null, faecher: [], aufgaben: {}, readme: null };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function heuteISO() {
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
    return o.year + "-" + o.month + "-" + o.day;
  }
  function tage(a, b) { return Math.round((Date.UTC.apply(null, ymd(b)) - Date.UTC.apply(null, ymd(a))) / 864e5); }
  function ymd(s) { var p = s.split("-").map(Number); return [p[0], p[1] - 1, p[2]]; }
  function wd(s) { return WD[new Date(Date.UTC.apply(null, ymd(s))).getUTCDay()]; }
  function de(s) { if (!s) return ""; var p = s.split("-"); return p[2] + "." + p[1] + "." + p[0]; }
  function datumText(t) {
    if (!t.datum_von) return "Termin folgt";
    if (t.datum_bis && t.datum_bis !== t.datum_von) return de(t.datum_von) + " – " + de(t.datum_bis);
    return wd(t.datum_von) + " " + de(t.datum_von);
  }
  function countdown(t, heute) {
    if (!t.datum_von) return "Termin folgt";
    var bis = t.datum_bis || t.datum_von;
    if (t.datum_von <= heute && bis >= heute) return t.datum_von === bis ? "heute" : "läuft";
    var n = tage(heute, t.datum_von);
    if (n === 1) return "morgen";
    return "in " + n + " Tagen";
  }
  function fachById(k) { for (var i = 0; i < S.faecher.length; i++) if (S.faecher[i].kuerzel === k) return S.faecher[i]; return null; }
  function fachBySlug(s) { for (var i = 0; i < S.faecher.length; i++) if (S.faecher[i].slug === s) return S.faecher[i]; return null; }
  function fachName(k) { var f = fachById(k); return f ? f.name : (k || "–"); }
  function fachLink(k, txt) { var f = fachById(k); return f ? '<a href="#/fach/' + encodeURIComponent(f.slug) + '">' + esc(txt || f.name) + "</a>" : esc(txt || k || "–"); }
  function uhrzeit(t) { return t.uhrzeit ? esc(t.uhrzeit.replace("-", "–")) : ""; }
  function alleTermine() { return (S.termine && Array.isArray(S.termine.termine)) ? S.termine.termine : []; }
  function istFest(t) { return t.status !== "termin_offen" && !!t.datum_von; }

  function passendeAufgaben(t) {
    var liste = S.aufgaben[t.fach] || [];
    var themen = (t.themen || []).map(function (x) { return String(x).toLowerCase(); });
    return liste.filter(function (a) {
      if ((a.termin_ids || []).indexOf(t.id) >= 0) return true;
      if (!themen.length || !a.thema) return false;
      var th = String(a.thema).toLowerCase();
      return themen.some(function (x) { return x && (th.indexOf(x) >= 0 || x.indexOf(th) >= 0); });
    });
  }

  /* ---------- Laden ---------- */
  function getJSON(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(url + ": " + r.status); return r.json(); }); }
  function laden() {
    return Promise.all([getJSON("data/termine.json"), getJSON("data/faecher.json")]).then(function (res) {
      S.termine = res[0] || {};
      S.faecher = (res[1] && res[1].faecher) || [];
      return Promise.all(S.faecher.map(function (f) {
        if (f.aufgaben_vorhanden === false) { S.aufgaben[f.kuerzel] = []; return null; }
        return getJSON(f.aufgaben_datei).then(function (d) { S.aufgaben[f.kuerzel] = (d && Array.isArray(d.aufgaben)) ? d.aufgaben : []; })
          .catch(function () { S.aufgaben[f.kuerzel] = []; });
      }));
    });
  }

  /* ---------- Navigation ---------- */
  function nav(aktiv) {
    var items = [{ h: "#/", t: "Start", k: "start" }].concat(S.faecher.map(function (f) { return { h: "#/fach/" + encodeURIComponent(f.slug), t: f.kuerzel, k: f.slug, title: f.name }; }), [{ h: "#/ueber", t: "Über", k: "ueber" }]);
    document.getElementById("nav-list").innerHTML = items.map(function (i) {
      return '<li><a href="' + i.h + '"' + (i.title ? ' title="' + esc(i.title) + '"' : "") + (i.k === aktiv ? ' aria-current="page"' : "") + ">" + esc(i.t) + (i.title ? '<span class="sr-only"> – ' + esc(i.title) + "</span>" : "") + "</a></li>";
    }).join("");
  }

  /* ---------- Startseite ---------- */
  function terminKarte(t, heute, mitAufgaben) {
    var auf = mitAufgaben ? passendeAufgaben(t) : [];
    var f = fachById(t.fach);
    var cls = "prio prio-" + esc(t.typ) + " fach-" + esc(f ? f.slug : "x");
    var h = '<article class="' + cls + '"><div class="prio-count" aria-label="Countdown">' + esc(countdown(t, heute)) + "</div>";
    h += "<h3>" + fachLink(t.fach, fachName(t.fach)) + " · " + esc(TYP_LABEL[t.typ] || t.typ) + "</h3>";
    h += '<p class="meta">' + esc(t.titel || "") + "</p>";
    h += '<p class="meta"><strong>' + esc(datumText(t)) + "</strong>" + (t.uhrzeit ? " · " + uhrzeit(t) + " Uhr" : "") + (t.raum ? " · Raum " + esc(t.raum) : "") + "</p>";
    if (t.themen && t.themen.length) h += '<p class="themen">Themen: ' + t.themen.map(esc).join(", ") + "</p>";
    if (mitAufgaben) {
      if (auf.length && f) h += '<p class="aufg"><a href="#/fach/' + encodeURIComponent(f.slug) + "/" + encodeURIComponent(auf[0].id) + '">' + auf.length + (auf.length === 1 ? " passende Aufgabe" : " passende Aufgaben") + " im Lernraum üben →</a></p>";
      else h += '<p class="aufg muted">Aufgaben folgen.</p>';
    }
    if (t.offene_fragen && t.offene_fragen.length) h += '<p class="hinweis">Einzelheiten werden noch geklärt.</p>';
    return h + "</article>";
  }
  function tabelle(rows, kopf) {
    if (!rows.length) return '<p class="muted">Keine Einträge.</p>';
    return '<div class="table-wrap"><table><thead><tr>' + kopf.map(function (k) { return '<th scope="col">' + esc(k) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
  }
  function start() {
    var heute = heuteISO();
    var T = alleTermine();
    var ln = T.filter(function (t) { return LN_TYPEN.indexOf(t.typ) >= 0 && istFest(t) && (t.datum_bis || t.datum_von) >= heute; });
    ln.forEach(function (t) { var d = Math.max(0, tage(heute, t.datum_von)); t._score = (d + 1) / (GEWICHT[t.typ] || 1); });
    var prio = ln.slice().sort(function (a, b) { return a._score - b._score || (a.datum_von < b.datum_von ? -1 : 1); }).slice(0, 6);
    var chrono = ln.slice().sort(function (a, b) { return a.datum_von < b.datum_von ? -1 : a.datum_von > b.datum_von ? 1 : 0; });
    var offen = T.filter(function (t) { return t.status === "termin_offen" || !t.datum_von; });
    var frei = T.filter(function (t) { return (t.typ === "ferien" || t.typ === "feiertag") && t.datum_von && (t.datum_bis || t.datum_von) >= heute; });
    var aus = (S.termine.stundenplan_ausnahmen || []).filter(function (a) { return (a.art === "entfall" || a.art === "aenderung") && a.datum_von && (a.datum_bis || a.datum_von) >= heute; });
    var abi = T.filter(function (t) { return t.typ === "abitur" && t.datum_von; });

    var h = '<section class="hero"><h1>Aktuelle Prioritäten</h1><p>Stand heute: <strong>' + esc(wd(heute) + " " + de(heute)) + "</strong>. Sortiert nach Nähe und Gewicht (Schulaufgabe/Fachabitur vor Kurzarbeit).</p></section>";
    h += '<section aria-labelledby="h-prio"><h2 id="h-prio" class="sr-only">Nächste Leistungsnachweise</h2><div class="prio-grid">' + (prio.length ? prio.map(function (t) { return terminKarte(t, heute, true); }).join("") : '<p class="muted">Keine anstehenden Leistungsnachweise.</p>') + "</div></section>";
    if (offen.length) h += '<section aria-labelledby="h-offen"><h2 id="h-offen">Angekündigt – Termin folgt</h2><ul class="clean">' + offen.map(function (t) { return "<li>" + fachLink(t.fach, fachName(t.fach)) + ": " + esc(t.titel || TYP_LABEL[t.typ]) + ' <span class="badge">Termin folgt</span></li>'; }).join("") + "</ul></section>";
    h += '<section aria-labelledby="h-alle"><h2 id="h-alle">Alle kommenden Leistungsnachweise</h2>' + tabelle(chrono.map(function (t) {
      return "<tr><td>" + esc(datumText(t)) + "</td><td>" + (uhrzeit(t) || "–") + "</td><td>" + fachLink(t.fach, fachName(t.fach)) + "</td><td>" + esc(TYP_LABEL[t.typ] || t.typ) + (t.titel ? " (" + esc(t.titel) + ")" : "") + "</td><td>" + esc(t.raum || "–") + "</td><td>" + esc(countdown(t, heute)) + "</td></tr>";
    }), ["Datum", "Uhrzeit", "Fach", "Art", "Raum", "Countdown"]) + "</section>";
    h += '<section aria-labelledby="h-frei"><h2 id="h-frei">Ferien und freie Tage</h2><ul class="clean">' + (frei.length ? frei.map(function (t) { return "<li><strong>" + esc(datumText(t)) + "</strong> – " + esc(t.titel) + " (" + esc(countdown(t, heute)) + ")</li>"; }).join("") : '<li class="muted">Keine Einträge.</li>') + "</ul></section>";
    h += '<section aria-labelledby="h-aus"><h2 id="h-aus">Stundenplan-Änderungen</h2><ul class="clean">' + (aus.length ? aus.map(function (a) { return "<li><strong>" + esc(wd(a.datum_von) + " " + de(a.datum_von)) + "</strong> – " + esc(a.art === "entfall" ? "Entfall" : "Änderung") + ": " + esc(a.beschreibung) + (a.offen ? ' <span class="badge">unbestätigt</span>' : "") + "</li>"; }).join("") : '<li class="muted">Keine bekannten Änderungen.</li>') + "</ul></section>";
    h += '<section aria-labelledby="h-abi"><h2 id="h-abi">Fachabitur 2027</h2>' + tabelle(abi.map(function (t) { return "<tr><td>" + esc(datumText(t)) + "</td><td>" + esc(t.titel) + "</td><td>" + esc(countdown(t, heute)) + "</td></tr>"; }), ["Datum", "Prüfung", "Countdown"]);
    var q = abi.length ? (abi[0].quelle || "") : "";
    var m = q.match(/https:\/\/www\.verkuendung-bayern\.de\/[^\s;]+/);
    h += '<p class="quelle">Quelle: Bekanntmachung des Bayerischen Kultusministeriums vom 23.07.2025' + (m ? ' – <a href="' + esc(m[0]) + '" rel="noopener">BayMBl. 2025 Nr. 320</a>' : "") + "</p></section>";
    return h;
  }

  /* ---------- Lernraum ---------- */
  function aufgabeHTML(a, i) {
    var id = "a-" + String(a.id || i).replace(/[^A-Za-z0-9_-]/g, "_");
    var opts = Array.isArray(a.antwortoptionen) ? a.antwortoptionen : [];
    var h = '<article class="aufgabe" id="' + esc(id) + '" data-aid="' + esc(a.id) + '"><header><h3>' + esc(a.aufgabe_nr || ("Aufgabe " + (i + 1))) + "</h3>";
    h += '<p class="meta">' + esc(a.thema || "") + "</p>";
    var b = [a.buch, a.seite ? "S. " + a.seite : ""].filter(Boolean).join(", ");
    if (b) h += '<p class="meta small">' + esc(b) + "</p>";
    h += '</header><p class="wortlaut">' + esc(a.wortlaut || "") + "</p>";
    if (opts.length) {
      h += '<form class="quiz" data-richtig="' + esc(a.richtige_option || "") + '"><fieldset><legend>Antwort wählen</legend>';
      opts.forEach(function (o, j) { h += '<label class="opt"><input type="radio" name="' + esc(id) + '" value="' + esc(o) + '"> <span>' + esc(o) + "</span></label>"; });
      h += '</fieldset><button type="submit">Prüfen</button><p class="feedback" role="status" aria-live="polite"></p></form>';
    }
    if (a.loesung || a.loesung_quelle) h += "<details><summary>Lösung anzeigen</summary>" + (a.loesung ? '<p class="loesung">' + esc(a.loesung) + "</p>" : "") + (a.loesung_quelle ? '<p class="quelle">Quelle: ' + esc(a.loesung_quelle) + "</p>" : "") + "</details>";
    return h + "</article>";
  }
  function fach(slug, aufgabeId) {
    var f = fachBySlug(slug);
    if (!f) return '<h1>Nicht gefunden</h1><p><a href="#/">Zur Startseite</a></p>';
    var heute = heuteISO();
    var T = alleTermine().filter(function (t) { return t.fach === f.kuerzel; });
    var komm = T.filter(function (t) { return istFest(t) && (t.datum_bis || t.datum_von) >= heute; }).sort(function (a, b) { return a.datum_von < b.datum_von ? -1 : 1; });
    var verg = T.filter(function (t) { return istFest(t) && (t.datum_bis || t.datum_von) < heute; }).sort(function (a, b) { return a.datum_von < b.datum_von ? 1 : -1; });
    var offen = T.filter(function (t) { return !istFest(t); });
    var auf = S.aufgaben[f.kuerzel] || [];
    var h = '<section class="room-hero"><p class="kicker">Lernraum</p><h1>' + esc(f.name) + ' <span class="kz">' + esc(f.kuerzel) + "</span></h1>";
    if (f.lehrer_kuerzel && f.lehrer_kuerzel.length) h += '<p class="meta">Lehrkraft (Kürzel): ' + f.lehrer_kuerzel.map(esc).join(", ") + "</p>";
    h += "</section>";
    h += '<section aria-labelledby="h-ft"><h2 id="h-ft">Termine</h2>';
    if (!komm.length && !offen.length) h += '<p class="muted">Keine kommenden Termine bekannt.</p>';
    h += '<ul class="clean">' + komm.map(function (t) { return "<li><strong>" + esc(datumText(t)) + "</strong>" + (t.uhrzeit ? ", " + uhrzeit(t) + " Uhr" : "") + (t.raum ? ", Raum " + esc(t.raum) : "") + " – " + esc(TYP_LABEL[t.typ] || t.typ) + (t.titel ? " (" + esc(t.titel) + ")" : "") + ' <span class="badge">' + esc(countdown(t, heute)) + "</span></li>"; }).join("")
      + offen.map(function (t) { return "<li>" + esc(t.titel || TYP_LABEL[t.typ]) + ' <span class="badge">Termin folgt</span></li>'; }).join("") + "</ul>";
    if (verg.length) h += "<details><summary>Vergangene Termine (" + verg.length + ")</summary><ul class=\"clean\">" + verg.map(function (t) { return "<li>" + esc(datumText(t)) + " – " + esc(TYP_LABEL[t.typ] || t.typ) + (t.titel ? " (" + esc(t.titel) + ")" : "") + "</li>"; }).join("") + "</ul></details>";
    h += "</section>";
    h += '<section aria-labelledby="h-auf"><h2 id="h-auf">Übungsaufgaben</h2>';
    h += auf.length ? '<p class="meta">' + auf.length + " Aufgaben. Antwort wählen, prüfen, dann Lösung und Quelle aufklappen.</p>" + auf.map(aufgabeHTML).join("") : '<p class="leer">Aufgaben folgen – hier erscheinen bald Übungen für ' + esc(f.name) + ".</p>";
    return h + "</section>";
  }

  /* ---------- Über (Markdown) ---------- */
  function inline(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, function (m, t, u) { return /drive\.google|docs\.google/.test(u) ? t : '<a href="' + u + '" rel="noopener">' + t + "</a>"; })
      .replace(/(^|[\s(])(https:\/\/gaissersilas\.github\.io\/[^\s<*]*)/g, '$1<a href="$2">$2</a>');
  }
  function md(src) {
    var L = src.replace(/\r/g, "").split("\n"), out = [], i = 0;
    while (i < L.length) {
      var l = L[i];
      if (/^\s*$/.test(l)) { i++; continue; }
      var m = l.match(/^(#{1,4})\s+(.*)$/);
      if (m) { var n = Math.min(m[1].length + 1, 4); out.push("<h" + n + ">" + inline(m[2]) + "</h" + n + ">"); i++; continue; }
      if (/^---+\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
      if (/^\|/.test(l)) {
        var rows = []; while (i < L.length && /^\|/.test(L[i])) { rows.push(L[i]); i++; }
        var cells = function (r) { return r.replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
        var head = cells(rows[0]), body = rows.slice(/^\|[\s:-]+\|/.test(rows[1] || "") ? 2 : 1);
        out.push('<div class="table-wrap"><table><thead><tr>' + head.map(function (c) { return '<th scope="col">' + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + body.map(function (r) { return "<tr>" + cells(r).map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>");
        continue;
      }
      if (/^\s*[-*]\s+/.test(l)) { var it = []; while (i < L.length && /^\s*[-*]\s+/.test(L[i])) { it.push("<li>" + inline(L[i].replace(/^\s*[-*]\s+/, "")) + "</li>"); i++; } out.push('<ul>' + it.join("") + "</ul>"); continue; }
      var p = []; while (i < L.length && !/^\s*$/.test(L[i]) && !/^(#{1,4}\s|\||---|\s*[-*]\s)/.test(L[i])) { p.push(L[i]); i++; }
      out.push("<p>" + inline(p.join(" ")) + "</p>");
    }
    return out.join("\n");
  }
  function ueber() {
    var c = '<section class="room-hero"><p class="kicker">Über</p><h1>Über diese Seite</h1></section>';
    if (S.readme === null) {
      fetch("docs/README.md", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.text(); })
        .then(function (t) { S.readme = t; route(); }).catch(function () { S.readme = ""; route(); });
      return c + '<p class="loading">Lade …</p>';
    }
    return c + (S.readme ? '<div class="md">' + md(S.readme) + "</div>" : '<p class="muted">README konnte nicht geladen werden.</p>');
  }

  /* ---------- Router ---------- */
  function route() {
    var hash = location.hash.replace(/^#\/?/, "");
    var teile = hash.split("/").map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    var main = document.getElementById("main"), html, aktiv = "start", theme = "start", ziel = null;
    if (teile[0] === "fach" && teile[1]) { aktiv = theme = teile[1]; html = fach(teile[1]); ziel = teile[2] || null; }
    else if (teile[0] === "ueber") { aktiv = theme = "ueber"; html = ueber(); }
    else html = start();
    document.body.className = "theme-" + theme.replace(/[^A-Za-z0-9_-]/g, "_");
    nav(aktiv);
    main.innerHTML = html;
    var f = fachBySlug(theme);
    document.title = (f ? f.name + " – " : aktiv === "ueber" ? "Über – " : "") + "Lernwebsite 12BT";
    document.getElementById("nav").classList.remove("open");
    document.querySelector(".nav-toggle").setAttribute("aria-expanded", "false");
    if (ziel) {
      var el = document.getElementById("a-" + ziel.replace(/[^A-Za-z0-9_-]/g, "_"));
      if (el) { el.classList.add("ziel"); el.scrollIntoView(); el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true }); return; }
    }
    if (route._done) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
    route._done = true;
  }

  document.addEventListener("submit", function (e) {
    var form = e.target; if (!form.classList || !form.classList.contains("quiz")) return;
    e.preventDefault();
    var sel = form.querySelector("input[type=radio]:checked"), fb = form.querySelector(".feedback"), richtig = form.getAttribute("data-richtig");
    form.querySelectorAll(".opt").forEach(function (o) { o.classList.remove("ok", "falsch"); });
    if (!sel) { fb.textContent = "Bitte zuerst eine Antwort wählen."; fb.className = "feedback"; return; }
    if (!richtig) { fb.textContent = "Für diese Aufgabe ist keine richtige Option hinterlegt – vergleiche mit der Lösung."; fb.className = "feedback"; return; }
    var ok = sel.value === richtig;
    sel.closest(".opt").classList.add(ok ? "ok" : "falsch");
    fb.textContent = ok ? "Richtig! ✓" : "Leider falsch – versuch es noch einmal oder öffne die Lösung.";
    fb.className = "feedback " + (ok ? "ok" : "falsch");
  });
  document.querySelector(".nav-toggle").addEventListener("click", function () {
    var n = document.getElementById("nav"), o = n.classList.toggle("open"); this.setAttribute("aria-expanded", o ? "true" : "false");
  });
  window.addEventListener("hashchange", route);
  laden().then(function () {
    var st = S.termine.aktualisiert; if (st) document.getElementById("stand").textContent = "Daten-Stand: " + de(st) + ".";
    route();
  }).catch(function (err) {
    document.getElementById("main").innerHTML = '<h1>Fehler beim Laden</h1><p>Die Daten konnten nicht geladen werden. Bitte später erneut versuchen.</p>';
    if (window.console) console.error(err);
  });
})();
