/* ==========================================================================
   Acute Stroke Guide — application logic
   No dependencies, no network calls. Everything works offline.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('asg:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('asg:' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------------------------------------------------------------- theme */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btn = $('#themeBtn');
    if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#161b23' : '#ffffff');
  }
  var savedTheme = store.get('theme', null);
  applyTheme(savedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  /* -------------------------------------------------------------- routing */
  var sections = $$('.section');
  var navLinks = $$('.sidebar a[href^="#"], .quickbar a[href^="#"]');

  function show(id, opts) {
    var target = document.getElementById(id);
    if (!target || !target.classList.contains('section')) { id = 'start'; target = document.getElementById('start'); }
    sections.forEach(function (s) { s.classList.toggle('active', s === target); });
    navLinks.forEach(function (a) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var t = target.getAttribute('data-title');
    document.title = (t ? t + ' — ' : '') + 'Acute Stroke Guide';
    if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
    if (id === 'start' || id === 'tools') syncTiles();
    closeNav();
    if (opts && opts.focusText) highlightText(target, opts.focusText);
  }

  function route(opts) { show((location.hash || '#start').slice(1), opts); }
  window.addEventListener('hashchange', function () {
    var id = (location.hash || '').slice(1);
    var target = document.getElementById(id);
    /* The skip link targets <main>, not a routed section.  Leave native
       fragment navigation alone instead of replacing the current page with
       the start section. */
    if (target && !target.classList.contains('section')) { closeNav(); return; }
    route();
  });

  /* ------------------------------------------------- Guide & Tools indexes */
  /* The bottom bar routes to #guide and #tools like any other section — no
     drawer, no sheet, no overlay.  #guide is generated from the sidebar's own
     <h4>/<a> list so sections are declared once, in the markup, and cannot
     drift.  #tools is its own list because a tool row also carries a live
     value, which a plain nav link has no room for. */
  var TOOLS = [
    { href: '#nihss',    label: 'NIHSS calculator',      sub: '15 items, copy to note',    src: '#nihssTotal' },
    { href: '#aspects',  label: 'ASPECTS & PC-ASPECTS',  sub: 'anterior and posterior',    src: '#aspectsScore' },
    { href: '#dosing',   label: 'Dose calculator',       sub: 'tenecteplase and alteplase', src: '#doseOut' },
    { href: '#clock',    label: 'Last known well clock', sub: 'elapsed time and windows',  src: '#clockOut' },
    { href: '#ichscore', label: 'ICH score',             sub: 'Hemphill 2001',             src: '#ichScore' },
    { href: '#mrs',      label: 'Modified Rankin Scale', sub: 'prestroke and outcome',     value: '0–6' },
    { href: '#trials',   label: 'Trial library',         sub: 'every trial cited here',    count: '#trials tbody tr' }
  ];

  function buildGuide() {
    var out = [], current = null;
    Array.prototype.forEach.call($('#sidebar').children, function (el) {
      if (el.tagName === 'H4') {
        /* Tools have their own screen; Home is the screen you came from. */
        current = el.textContent === 'Tools' ? null : { title: el.textContent, links: [] };
        if (current) out.push(current);
      } else if (el.tagName === 'A' && current && el.getAttribute('href') !== '#start') {
        current.links.push({ href: el.getAttribute('href'), text: el.textContent });
      }
    });
    $('#guideBody').innerHTML = out.map(function (g) {
      return '<h4 class="homehead">' + esc(g.title) + '</h4><nav class="decisions">' +
        g.links.map(function (l) {
          return '<a href="' + esc(l.href) + '">' + esc(l.text) + '</a>';
        }).join('') + '</nav>';
    }).join('');

    $('#toolsBody').innerHTML = TOOLS.map(function (t) {
      return '<a href="' + esc(t.href) + '">' +
        '<span class="toollist__t">' + esc(t.label) + '<span>' + esc(t.sub) + '</span></span>' +
        '<span class="toollist__v" data-src="' + esc(t.src || '') + '">' +
        esc(t.value || (t.count ? String($$(t.count).length) : '')) + '</span></a>';
    }).join('');

    /* Generated links participate in current-section highlighting. */
    navLinks = navLinks.concat($$('#guideBody a[href^="#"], #toolsBody a[href^="#"]'));
  }

  /* Routing calls this when a section opens; nothing to dismiss any more. */
  function closeNav() {}

  $('#themeBtn').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    store.set('theme', next); applyTheme(next);
  });

  /* --------------------------------------------------------------- search */
  var index = [];
  function buildIndex() {
    sections.forEach(function (sec) {
      var secTitle = sec.getAttribute('data-title') || sec.id;
      var blocks = $$('h1, h2, h3, p, li, td, th, .note__t, summary', sec);
      var currentHeading = secTitle;
      blocks.forEach(function (el) {
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length < 3) return;
        if (/^H[123]$/.test(el.tagName)) currentHeading = text;
        index.push({ id: sec.id, section: secTitle, heading: currentHeading, text: text, low: text.toLowerCase() });
      });
    });
  }

  function score(entry, terms) {
    var s = 0;
    for (var i = 0; i < terms.length; i++) {
      var pos = entry.low.indexOf(terms[i]);
      if (pos === -1) return -1;
      s += 10 - Math.min(9, pos / 12);
      if (entry.heading.toLowerCase().indexOf(terms[i]) !== -1) s += 6;
      if (entry.section.toLowerCase().indexOf(terms[i]) !== -1) s += 3;
    }
    return s;
  }

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function snippet(text, terms) {
    var low = text.toLowerCase(), at = low.indexOf(terms[0]);
    var start = Math.max(0, at - 45);
    var frag = (start > 0 ? '…' : '') + text.slice(start, start + 165) + (text.length > start + 165 ? '…' : '');
    var out = esc(frag);
    terms.forEach(function (t) {
      out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    });
    return out;
  }

  var overlay = $('#searchOverlay'), input = $('#searchInput'), results = $('#searchResults');
  var sel = 0, current = [];

  function openSearch() {
    if (!index.length) buildIndex();
    overlay.hidden = false; input.value = ''; results.innerHTML = '';
    renderResults('');
    input.focus();
  }
  function closeSearch() { overlay.hidden = true; }

  /* Clinicians type abbreviations and US spellings; the content is en-GB prose. */
  var ALIASES = {
    tpa: 'alteplase', 'r-tpa': 'alteplase', rtpa: 'alteplase', 't-pa': 'alteplase',
    tnk: 'tenecteplase', lytic: 'thrombolysis', lytics: 'thrombolysis',
    thrombolytic: 'thrombolysis', ivt: 'thrombolysis',
    evt: 'thrombectomy', mt: 'thrombectomy', ecr: 'thrombectomy',
    sbp: 'blood pressure', dbp: 'blood pressure', bp: 'blood pressure',
    noac: 'doac', hemorrhage: 'haemorrhage', hemorrhagic: 'haemorrhagic',
    hemicrani: 'hemicraniectomy', craniectomy: 'craniectomy',
    edema: 'oedema', anesthesia: 'anaesthesia', ischemic: 'ischaemic',
    lvo: 'large vessel occlusion', lkw: 'last known well', sich: 'sICH',
    dapt: 'dual antiplatelet', vte: 'venous thromboembolism'
  };

  function renderResults(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean)
      .map(function (t) { return ALIASES[t] || t; });
    if (!terms.length) {
      current = [];
      results.innerHTML = '<div class="searchfoot">Try: <b>tenecteplase dose</b> · <b>ASPECTS</b> · <b>basilar</b> · <b>angioedema</b> · <b>DOAC</b> · <b>hemicraniectomy</b></div>';
      return;
    }
    var scored = [];
    var seen = {};
    for (var i = 0; i < index.length; i++) {
      var sc = score(index[i], terms);
      if (sc < 0) continue;
      var key = index[i].id + '|' + index[i].text.slice(0, 60);
      if (seen[key]) continue;
      seen[key] = 1;
      scored.push({ e: index[i], s: sc });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    current = scored.slice(0, 40);
    sel = 0;
    if (!current.length) { results.innerHTML = '<div class="searchfoot">No matches.</div>'; return; }
    results.innerHTML = current.map(function (r, i) {
      return '<button class="result' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '">' +
        '<div class="result__crumb">' + esc(r.e.section) + ' › ' + esc(r.e.heading) + '</div>' +
        '<div class="result__snip">' + snippet(r.e.text, terms) + '</div></button>';
    }).join('');
  }

  function pick(i) {
    var r = current[i]; if (!r) return;
    closeSearch();
    var focusText = r.e.text.slice(0, 80);
    if (location.hash === '#' + r.e.id) show(r.e.id, { focusText: focusText });
    else { location.hash = '#' + r.e.id; setTimeout(function () { highlightText(document.getElementById(r.e.id), focusText); }, 60); }
  }

  function highlightText(scope, text) {
    if (!scope || !text) return;
    var needle = text.replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase();
    var els = $$('h1,h2,h3,p,li,td,th,summary,.note__t', scope);
    for (var i = 0; i < els.length; i++) {
      if ((els[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().indexOf(needle) === 0) {
        var host = els[i].closest('details');
        if (host) host.open = true;
        els[i].scrollIntoView({ block: 'center' });
        els[i].style.transition = 'background-color .4s';
        els[i].style.backgroundColor = 'var(--amber-bg)';
        setTimeout(function (el) { return function () { el.style.backgroundColor = ''; }; }(els[i]), 2200);
        return;
      }
    }
  }

  input.addEventListener('input', function () { renderResults(input.value); });
  results.addEventListener('click', function (e) {
    var b = e.target.closest('.result'); if (b) pick(parseInt(b.getAttribute('data-i'), 10));
  });
  overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeSearch(); });
  $('#searchBtn').addEventListener('click', openSearch);
  var quickSearch = $('#quickSearch');
  if (quickSearch) quickSearch.addEventListener('click', openSearch);

  document.addEventListener('keydown', function (e) {
    var typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!overlay.hidden) {
      if (e.key === 'Escape') { closeSearch(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var nodes = $$('.result', results); if (!nodes.length) return;
        nodes[sel].classList.remove('sel');
        sel = (sel + (e.key === 'ArrowDown' ? 1 : nodes.length - 1)) % nodes.length;
        nodes[sel].classList.add('sel'); nodes[sel].scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); pick(sel); return; }
      return;
    }
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openSearch(); }
  });

  /* ------------------------------------------------------------ tab groups */
  $$('[data-tabs]').forEach(function (group) {
    var tabs = $$('.tab', group);
    tabs.forEach(function (tab) {
      tab.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var i = (tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
        tabs[i].focus(); tabs[i].click();
      });
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
      });
    });
  });

  /* -------------------------------------------------------- copy to clipboard */
  function copy(text, btn) {
    var done = function () {
      if (!btn) return;
      var old = btn.textContent; btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else { fallback(text); done(); }
  }
  function fallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  /* ------------------------------------------------------- thrombolytic dose */
  function doseCalc() {
    var raw = parseFloat($('#wt').value);
    var unit = $('#wtUnit').value;
    var agent = $('#agent').value;
    var out = $('#doseOut'), vol = $('#volOut'), note = $('#doseNote');
    if (isNaN(raw) || raw <= 0) { out.textContent = '—'; vol.textContent = '—'; note.textContent = ''; return; }
    var kg = unit === 'lb' ? raw / 2.2046226 : raw;
    var msg = [];
    if (unit === 'lb') msg.push(kg.toFixed(1) + ' kg');

    if (agent === 'tnk') {
      var band = kg < 60 ? 15 : kg < 70 ? 17.5 : kg < 80 ? 20 : kg < 90 ? 22.5 : 25;
      out.textContent = band + ' mg';
      vol.textContent = (band / 5).toFixed(1) + ' mL';
      msg.push('10-kg band dosing (AHA 2026 Table 7); single IV bolus over 5 s');
      var perKg = Math.min(kg * 0.25, 25);
      msg.push('0.25 mg/kg exact = ' + perKg.toFixed(1) + ' mg');
      if (kg < 50) msg.push('⚠ <50 kg: if an accurate weight is known, 1-kg-band dosing may be used');
      if (kg * 0.25 > 25) msg.push('⚠ capped at the 25 mg maximum');
    } else {
      var total = Math.min(kg * 0.9, 90);
      var bolus = total * 0.1;
      out.textContent = total.toFixed(1) + ' mg';
      vol.textContent = bolus.toFixed(1) + ' mg bolus';
      msg.push('0.9 mg/kg (max 90 mg): 10% as a bolus over 1 min, remainder infused over 60 min');
      msg.push('Infusion = ' + (total - bolus).toFixed(1) + ' mg over 60 min');
      if (kg * 0.9 > 90) msg.push('⚠ capped at the 90 mg maximum');
    }
    note.innerHTML = msg.join(' · ');
  }
  var weight = $('#wt'), weightUnit = $('#wtUnit'), agent = $('#agent');
  if (weight) weight.addEventListener('input', doseCalc);
  /* Select controls reliably emit change; input is not consistently fired for
     select elements in older mobile browsers. */
  if (weightUnit) weightUnit.addEventListener('change', doseCalc);
  if (agent) agent.addEventListener('change', doseCalc);
  if ($('#wt')) doseCalc();

  /* ---------------------------------------------------------------- NIHSS */
  var NIHSS_ITEMS = ['1a', '1b', '1c', '2', '3', '4', '5a', '5b', '6a', '6b', '7', '8', '9', '10', '11'];
  var NIHSS_LABELS = {
    '1a': 'LOC', '1b': 'LOC questions', '1c': 'LOC commands', '2': 'Gaze', '3': 'Visual fields',
    '4': 'Facial palsy', '5a': 'Motor arm L', '5b': 'Motor arm R', '6a': 'Motor leg L', '6b': 'Motor leg R',
    '7': 'Limb ataxia', '8': 'Sensory', '9': 'Language', '10': 'Dysarthria', '11': 'Extinction/inattention'
  };
  function nihssUpdate() {
    var total = 0, parts = [];
    NIHSS_ITEMS.forEach(function (k) {
      var checked = $('input[name="n' + k + '"]:checked');
      var v = checked ? parseInt(checked.value, 10) : 0;
      if (checked && checked.value === 'UN') v = 0;
      total += v;
      parts.push(k + '=' + (checked ? checked.value : '0'));
      var badge = $('.badge[data-k="' + k + '"]');
      if (badge) { badge.textContent = checked ? checked.value : '0'; badge.classList.toggle('hot', v > 0); }
    });
    $('#nihssTotal').textContent = total;
    var sev = total === 0 ? 'No stroke symptoms' : total <= 4 ? 'Minor (1–4)' : total <= 15 ? 'Moderate (5–15)' :
      total <= 20 ? 'Moderate–severe (16–20)' : 'Severe (21–42)';
    $('#nihssSeverity').textContent = sev;
    $('#nihssTotal').setAttribute('data-summary',
      'NIHSS ' + total + ' (' + sev + '). Items: ' + parts.join(', ') + '.');
  }
  if ($('#nihssTotal')) {
    $$('input[name^="n"]').forEach(function (i) { i.addEventListener('change', nihssUpdate); });
    $('#nihssReset').addEventListener('click', function () {
      NIHSS_ITEMS.forEach(function (k) {
        var z = $('input[name="n' + k + '"][value="0"]'); if (z) z.checked = true;
      });
      nihssUpdate();
    });
    $('#nihssCopy').addEventListener('click', function () {
      var lines = ['NIHSS = ' + $('#nihssTotal').textContent + ' (' + $('#nihssSeverity').textContent + ')'];
      NIHSS_ITEMS.forEach(function (k) {
        var c = $('input[name="n' + k + '"]:checked');
        lines.push('  ' + k + '. ' + NIHSS_LABELS[k] + ': ' + (c ? c.value : '0'));
      });
      copy(lines.join('\n'), this);
    });
    $('#nihssExpand').addEventListener('click', function () {
      var anyClosed = $$('.nihss-item').some(function (d) { return !d.open; });
      $$('.nihss-item').forEach(function (d) { d.open = anyClosed; });
      this.textContent = anyClosed ? 'Collapse all' : 'Expand all';
    });
    nihssUpdate();
  }

  /* ------------------------------------------------------------- ICH score */
  function ichUpdate() {
    var gcs = parseInt($('#ichGcs').value, 10);          // 0,1,2
    var vol = parseInt($('#ichVol').value, 10);          // 0,1
    var ivh = parseInt($('#ichIvh').value, 10);          // 0,1
    var inf = parseInt($('#ichInf').value, 10);          // 0,1
    var age = parseInt($('#ichAge').value, 10);          // 0,1
    var s = gcs + vol + ivh + inf + age;
    var mort = { 0: '0%', 1: '13%', 2: '26%', 3: '72%', 4: '97%', 5: '100%', 6: '100%' }[s];
    $('#ichScore').textContent = s;
    $('#ichMort').textContent = mort + ' 30-day mortality in the Hemphill 2001 derivation cohort' + (s >= 6 ? ' (no score-6 patients were observed; 100% is extrapolated)' : '');
  }
  if ($('#ichScore')) {
    ['#ichGcs', '#ichVol', '#ichIvh', '#ichInf', '#ichAge'].forEach(function (s) { $(s).addEventListener('change', ichUpdate); });
    ichUpdate();
  }

  /* ------------------------------------------------------------ ASPECTS */
  function aspectsUpdate() {
    var boxes = $$('.aspects-region');
    var lost = boxes.filter(function (b) { return b.checked; }).length;
    var score = 10 - lost;
    $('#aspectsScore').textContent = score;
    var band = score >= 6 ? 'ASPECTS ≥6 — standard-core pathway' :
      score >= 3 ? 'ASPECTS 3–5 — large-core pathway' : 'ASPECTS 0–2 — very large core';
    $('#aspectsBand').textContent = band;
    $('#aspectsRegions').textContent = lost ? boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }).join(', ') : 'none';
  }
  if ($('#aspectsScore')) {
    $$('.aspects-region').forEach(function (b) { b.addEventListener('change', aspectsUpdate); });
    $('#aspectsReset').addEventListener('click', function () {
      $$('.aspects-region').forEach(function (b) { b.checked = false; }); aspectsUpdate();
    });
    aspectsUpdate();
  }

  /* --------------------------------------------------------- PC-ASPECTS */
  /* Same 10-point ceiling as the anterior score, but weighted: pons and
     midbrain are 2 points each and are scored whole (no grading by extent).
     `pmi` is how many deducted points came from the brainstem, 0/2/4 — a
     prompt to check the published pons-midbrain index (which BAOCHE capped at
     <3), NOT that index itself, which grades pons and midbrain 0-2 by extent. */
  function pcUpdate() {
    var boxes = $$('.pc-region');
    var hit = boxes.filter(function (b) { return b.checked; });
    var lost = hit.reduce(function (a, b) { return a + Number(b.getAttribute('data-pts')); }, 0);
    var pmi = hit.reduce(function (a, b) { return a + (b.getAttribute('data-pmi') ? Number(b.getAttribute('data-pts')) : 0); }, 0);
    var score = 10 - lost;
    $('#pcScore').textContent = score;
    $('#pcPmi').textContent = pmi;
    var band;
    if (score >= 6 && pmi >= 3) band = 'PC-ASPECTS ≥6, but all deductions are brainstem — check the pons–midbrain index';
    else if (score >= 6) band = 'PC-ASPECTS ≥6 — meets the imaging criterion';
    else band = 'PC-ASPECTS <6 — outside the trial evidence';
    $('#pcBand').textContent = band;
    $('#pcRegions').textContent = hit.length ? hit.map(function (b) { return b.value; }).join(', ') : 'none';
  }
  if ($('#pcScore')) {
    $$('.pc-region').forEach(function (b) { b.addEventListener('change', pcUpdate); });
    $('#pcReset').addEventListener('click', function () {
      $$('.pc-region').forEach(function (b) { b.checked = false; }); pcUpdate();
    });
    pcUpdate();
  }

  /* -------------------------------------------------------- LKW time clock */
  function clockUpdate() {
    var lkw = $('#lkwTime').value;
    var out = $('#clockOut'), note = $('#clockNote');
    if (!lkw) { out.textContent = '—'; note.textContent = 'Enter the last-known-well date and time.'; return; }
    var now = new Date();
    /* A time-of-day alone cannot express "yesterday evening", and guessing
       wrong understates the elapsed time — the one direction this must never
       fail in. The date is entered, not inferred. */
    var t = new Date(lkw);
    if (isNaN(t)) { out.textContent = '—'; note.textContent = 'Could not read that date and time.'; return; }
    if (t > now) {
      out.textContent = '—';
      note.textContent = 'That is in the future. Check the date — a wrong last-known-well is the commonest reason a treatable patient is not treated.';
      return;
    }
    var mins = Math.round((now - t) / 60000);
    var h = Math.floor(mins / 60), m = mins % 60;
    out.textContent = h + ' h ' + (m < 10 ? '0' : '') + m + ' m';
    var win = [];
    if (mins <= 270) win.push('Within the 4.5-hour IVT window — if the deficit is disabling and there is no contraindication, treat as fast as possible; NCCT alone is sufficient.');
    else if (mins <= 540) win.push('4.5–9 h: for a patient <strong>not eligible for thrombectomy</strong>, perfusion-selected IVT can be beneficial (COR 2a). If EVT is available and the patient qualifies, go to EVT.');
    else if (mins <= 1440) win.push('9–24 h: EVT window; extended IVT only for LVO that cannot get EVT (COR 2b).');
    else win.push('Beyond 24 h from LKW — no established reperfusion indication.');
    if (mins <= 360) win.push('Within the 0–6 h EVT window.');
    else if (mins <= 1440) win.push('Within the 6–24 h EVT window.');
    note.innerHTML = win.join(' ');
  }
  if ($('#lkwTime')) {
    $('#lkwTime').addEventListener('input', clockUpdate);
    $('#clockNow').addEventListener('click', function () {
      var d = new Date();
      var p2 = function (n) { return ('0' + n).slice(-2); };
      $('#lkwTime').value = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
        'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
      clockUpdate();
    });
    clockUpdate();
  }

  /* ------------------------------------------------- reperfusion pathfinder */
  function pf(id) { var el = $('#' + id); return el ? el.value : ''; }
  function pathfinder() {
    var out = $('#pfOut'); if (!out) return;
    var hours = parseFloat(pf('pfTime'));
    var disabling = pf('pfDisabling');
    var ich = pf('pfIch');
    var contra = pf('pfContra');
    var occl = pf('pfOccl');
    var aspects = pf('pfAspects');
    var mrs = pf('pfMrs');
    var age = pf('pfAge');
    var flair = pf('pfFlair');
    var nihss = parseFloat(pf('pfNihss'));
    var lines = [];

    /* The disabling question exists to separate mild-but-disabling from
       mild-and-not. The guideline's COR 3: No Benefit applies to "mild
       non-disabling stroke deficits", and the whole adjudication — PRISMS,
       Table 4, the stated knowledge gap — is framed around NIHSS 0 to 5.
       Above that the question does not arise, and a deficit severe enough to
       qualify for thrombectomy is disabling by the enrolment criteria of
       every EVT trial. So two things answer it on the clinician's behalf,
       and each names itself in the card so the reasoning stays visible. */
    var evtGradeOcclusion = occl === 'lvo' || occl === 'basilar' || occl === 'm2';
    var disablingBy = disabling === 'yes' ? 'stated'
      : (!isNaN(nihss) && nihss >= 6) ? 'nihss'
      : evtGradeOcclusion ? 'occlusion' : '';
    /* An explicit "non-disabling" still wins — the clinician saw the patient.
       But if it contradicts NIHSS >=6 or a large-vessel occlusion, say so. */
    var disablingConflict = disabling === 'no' && (( !isNaN(nihss) && nihss >= 6) || evtGradeOcclusion);
    var disablingMet = disabling !== 'no' && disablingBy !== '';
    var disablingWhy = disablingBy === 'nihss'
      ? ' <br><br><strong>Why this fired without the disabling question:</strong> NIHSS ' + nihss +
        ' is outside the mild range the disabling/non-disabling distinction applies to — the guideline reserves that judgement for NIHSS 0–5.'
      : disablingBy === 'occlusion'
      ? ' <br><br><strong>Why this fired without the disabling question:</strong> a ' +
        (occl === 'basilar' ? 'basilar' : occl === 'm2' ? 'proximal M2' : 'an ICA or M1') +
        ' occlusion carries a disabling deficit by the enrolment criteria of the thrombectomy trials. ' +
        '<span class="cor cor-1">COR 1</span> <span class="loe">A</span>: in patients eligible for both, IVT is recommended alongside EVT and must not be delayed to observe response.'
      : '';

    /* Perfusion comes in as the two numbers the software prints — core and
       Tmax>6 s volumes — and the mismatch arithmetic is done here, tested
       against each trial's own profile. Thresholds as stated in the 2026
       guideline's trial descriptions:
         EXTEND    ratio >1.2,  mismatch >10 mL,  core <70 mL
         TRACE-III ratio >1.8,  mismatch >15 mL,  core <70 mL
         OPTION    ratio >=1.2, mismatch >=10 mL, core <50 mL */
    var core = parseFloat(pf('pfCore'));
    var tmax = parseFloat(pf('pfTmax'));
    var havePerf = !isNaN(core) && !isNaN(tmax);
    var mmVol = havePerf ? tmax - core : NaN;
    var mmRatio = havePerf ? (core > 0 ? tmax / core : (tmax > 0 ? Infinity : 0)) : NaN;
    var meetsEXTEND = havePerf && mmRatio > 1.2 && mmVol > 10 && core < 70;
    var meetsTRACE3 = havePerf && mmRatio > 1.8 && mmVol > 15 && core < 70;
    var meetsOPTION = havePerf && mmRatio >= 1.2 && mmVol >= 10 && core < 50;
    var perfVals = havePerf
      ? 'core ' + core + ' mL, Tmax&gt;6 s ' + tmax + ' mL → mismatch ' + Math.round(mmVol) + ' mL, ratio ' + (mmRatio === Infinity ? '∞' : Math.round(mmRatio * 10) / 10)
      : '';
    var MM_EXTEND = 'ratio &gt;1.2, mismatch &gt;10 mL, core &lt;70 mL';
    var P_EXTEND = 'EXTEND profile (' + MM_EXTEND + ')';
    var P_TRACE3 = 'TRACE-III profile (ratio &gt;1.8, mismatch &gt;15 mL, core &lt;70 mL)';
    var calcEl = $('#pfPerfCalc');
    if (calcEl) {
      calcEl.innerHTML = havePerf
        ? 'Computed: ' + perfVals + ' — EXTEND profile ' + (meetsEXTEND ? '<strong>met</strong>' : 'not met') +
          ' · TRACE-III ' + (meetsTRACE3 ? '<strong>met</strong>' : 'not met') +
          ' · OPTION ' + (meetsOPTION ? '<strong>met</strong>' : 'not met')
        : ((pf('pfCore') !== '' || pf('pfTmax') !== '') ? 'Enter both perfusion volumes — or leave both blank if perfusion was not done.' : '');
    }

    function add(kind, cor, title, body) {
      lines.push('<div class="note note--' + kind + '"><div class="note__t">' +
        (cor ? '<span class="cor cor-' + cor.cls + '">' + cor.label + '</span> ' : '') + title + '</div>' + body + '</div>');
    }

    /* A relative contraindication never blocks treatment, but it must never be
       silently ignored either — append it to every thrombolysis card. */
    var relCaveat = contra === 'relative'
      ? ' <br><br><strong>A relative contraindication was recorded.</strong> Table 8 classifies these as individualised risk–benefit decisions, usually with the relevant consultant. For a severe, clearly disabling deficit, benefit generally outweighs bleeding risk — but review the specific condition before the bolus. <a href="#contraindications">Relative contraindications</a>'
      : '';

    var nonDisablingCard = function () {
      add('warn', { cls: '3n', label: 'COR 3: No Benefit' }, 'Non-disabling deficit — thrombolysis not recommended',
        'Trials failed to show benefit of IVT over dual antiplatelet therapy for mild non-disabling deficits, and the late-window trials enrolled disabling deficits only. ' +
        'Give <a href="#antithrombotics">DAPT</a> instead: for NIHSS ≤3 or high-risk TIA, aspirin + clopidogrel with a loading dose, within 24 h, for 21 days ' +
        '<span class="cor cor-1">COR 1</span>. For NIHSS 4–5 see the 24–72 h and ticagrelor rows. ' +
        'Re-read <a href="#thrombolysis">the disabling-deficit definition</a> before you settle on "non-disabling" — lower-limb weakness preventing walking scores 2 on the NIHSS and is disabling.');
      /* "Non-disabling" alongside NIHSS >=6 or a large-vessel occlusion is a
         contradiction, not a preference. Surface it rather than acting on it
         silently in either direction. */
      if (disablingConflict) {
        add('danger', null, 'This does not add up — check before you withhold thrombolysis',
          'You recorded a <strong>non-disabling</strong> deficit, but ' +
          (!isNaN(nihss) && nihss >= 6
            ? 'also an <strong>NIHSS of ' + nihss + '</strong>. The guideline reserves the disabling/non-disabling judgement for NIHSS 0–5; a score of 6 or more is not a mild deficit. '
            : '') +
          (evtGradeOcclusion
            ? 'also ' + (occl === 'basilar' ? 'a <strong>basilar occlusion</strong>' : occl === 'm2' ? 'a <strong>proximal M2 occlusion</strong>' : 'an <strong>ICA or M1 occlusion</strong>') +
              '. Every thrombectomy trial enrolled disabling deficits. '
            : '') +
          'If the deficit really is non-disabling, the card above stands. If it is not, correct the answer — this is the difference between treating and not treating.');
      }
    };

    if (ich === 'yes') {
      add('danger', null, 'Haemorrhage on imaging — stop the ischaemic pathway',
        'Thrombolysis is an absolute contraindication when CT shows acute intracranial haemorrhage. Switch to the ' +
        '<a href="#ich">intracerebral haemorrhage pathway</a>: blood pressure control, anticoagulation reversal, neurosurgical review.');
      out.innerHTML = lines.join('');
      return;
    }

    /* ------------------------------------------------------------ thrombolysis */
    if (isNaN(hours)) {
      add('warn', null, 'Enter time from last known well', 'Every downstream decision keys off this number.');
    } else if (contra === 'absolute') {
      add('danger', null, 'Absolute contraindication to thrombolysis recorded',
        'Do not give IV thrombolysis. <strong>Assess thrombectomy eligibility independently</strong> — a contraindication to thrombolysis does not exclude EVT.');
    } else if (hours <= 4.5) {
      if (disablingMet) {
        add(contra === 'relative' ? 'warn' : 'ok', { cls: '1', label: 'COR 1' },
          'IV thrombolysis now — tenecteplase 0.25 mg/kg or alteplase 0.9 mg/kg',
          'Within 4.5 h with a disabling deficit. Treat on NCCT alone — do <em>not</em> wait for CTA/CTP or MRI. ' +
          'BP must be &lt;185/110 before the bolus. Check glucose first. <a href="#dosing">Dosing</a> · <a href="#contraindications">Contraindications</a>' +
          relCaveat + disablingWhy);
      } else if (disabling === 'no') {
        nonDisablingCard();
      } else {
        add('warn', null, 'Decide whether the deficit is disabling',
          'This is the highest-yield decision in the 4.5-hour window, and NIHSS alone does not answer it. ' +
          'Enter an NIHSS above, or record the occlusion — either can answer it for you. See <a href="#thrombolysis">the Table 4 guidance</a>.');
      }
    } else if (hours <= 6) {
      if (disabling === 'no') {
        nonDisablingCard();
      } else if (!disablingMet) {
        add('warn', null, 'Decide whether the deficit is disabling',
          'This is the highest-yield decision for thrombolysis in this window, and NIHSS alone does not answer it. ' +
          'Enter an NIHSS above, or record the occlusion — either can answer it for you. See <a href="#thrombolysis">the Table 4 guidance</a>.');
      } else if (!havePerf) {
        add('note', { cls: '2a', label: 'COR 2a' }, 'Extended-window thrombolysis may be reasonable (4.5–9 h)',
          'This requires salvageable penumbra on automated perfusion imaging — enter the core and Tmax&gt;6 s volumes above and the tool will test the ' + P_EXTEND + '. ' +
          'For unknown-onset stroke within 4.5 h of symptom recognition, DWI–FLAIR mismatch on MRI is the alternative selection route. ' +
          '<strong>Where there is an LVO and thrombectomy is available, proceed straight to EVT</strong> — extended-window IVT should not delay the angio suite, and thrombolysis before EVT in this window has not shown benefit (TIMELESS). <a href="#extended">Criteria</a>' + relCaveat);
      } else if (meetsEXTEND) {
        add('note', { cls: '2a', label: 'COR 2a' }, 'Extended-window thrombolysis may be reasonable (4.5–9 h)',
          'Your values — ' + perfVals + ' — meet the ' + P_EXTEND + '. IVT may be reasonable (EXTEND, ECASS-4). ' +
          '<strong>Where there is an LVO and thrombectomy is available, proceed straight to EVT</strong> — extended-window IVT should not delay the angio suite, and thrombolysis before EVT in this window has not shown benefit (TIMELESS). <a href="#extended">Criteria</a>' + relCaveat);
      } else {
        add('warn', { cls: '3n', label: 'Criteria not met' }, 'Perfusion profile not met — extended-window IVT is not indicated',
          'Your values — ' + perfVals + ' — do not meet the ' + P_EXTEND + ' behind the 4.5–9 h <span class="cor cor-2a">COR 2a</span> recommendation. ' +
          'For unknown-onset stroke, DWI–FLAIR mismatch on MRI is a separate selection route. ' +
          'Move to <a href="#antithrombotics">antithrombotics</a> and <a href="#supportive">supportive care</a>, and assess EVT separately if there is a large vessel occlusion.');
      }
    } else if (hours <= 24) {
      /* 6-24 h is one slot: the bedside question (mismatch present, and can
         EVT happen?) is the same across it. The 9-hour line changes only the
         strength of the label - EXTEND's COR 2a ends at 9 h - so that nuance
         lives in the card text rather than as a separate time option. */
      var nineHrNote = ' <strong>If still within 9 h of last known well</strong>, perfusion-selected IVT itself carries <span class="cor cor-2a">COR 2a</span> (EXTEND) — stronger than the late-window recommendation.';
      if (disabling === 'no') {
        nonDisablingCard();
      } else if (occl === 'lvo' || occl === 'basilar' || occl === 'm2') {
        /* The guideline's 4.5-24 h LVO COR 2b recommendation cites TRACE-III
           and HOPE jointly, with no separate threshold per trial. HOPE used
           the same numeric profile as EXTEND (ratio >1.2, mismatch >10 mL,
           core <70 mL — see the imaging table) but, unlike EXTEND, enrolled
           out to 24 h and did not require LVO. So a patient meeting only the
           EXTEND/HOPE profile still qualifies for the full COR 2b card via
           HOPE - this is not a lesser case cut off at 9 h. TRACE-III's own
           thresholds are strictly tighter (ratio >1.8, mismatch >15 mL,
           same core cutoff), so meeting TRACE-III always meets HOPE's too. */
        if (!havePerf) {
          add('note', { cls: '2b', label: 'COR 2b' }, 'Late IVT only if thrombectomy is unavailable (6–24 h)',
            'For ICA, M1 or M2 occlusion with salvageable penumbra that <em>cannot</em> receive EVT, IVT directed by clinicians with expertise in thrombolytic stroke care may be beneficial (TRACE-III, HOPE). ' +
            'Salvageable penumbra must be demonstrated first — enter the core and Tmax&gt;6 s volumes above and the tool will test both the ' + P_TRACE3 + ' and the laxer HOPE profile (' + MM_EXTEND + '). ' +
            '<strong>If EVT is available, EVT takes priority</strong> — TIMELESS was neutral. <a href="#extended">Detail</a>' + relCaveat);
        } else if (meetsTRACE3) {
          add('note', { cls: '2b', label: 'COR 2b' }, 'Late IVT only if thrombectomy is unavailable (6–24 h)',
            'Your values — ' + perfVals + ' — meet the ' + P_TRACE3 + '. For ICA, M1 or M2 occlusion that <em>cannot</em> receive EVT, IVT directed by clinicians with expertise in thrombolytic stroke care may be beneficial (TRACE-III, HOPE). ' +
            '<strong>If EVT is available, EVT takes priority</strong> and there is no established role for adding late IVT — TIMELESS was neutral.' +
            nineHrNote + ' <a href="#extended">Detail</a>' + relCaveat);
        } else if (meetsEXTEND) {
          add('note', { cls: '2b', label: 'COR 2b' }, 'Late IVT only if thrombectomy is unavailable (6–24 h, via HOPE)',
            'Your values — ' + perfVals + ' — fall short of the ' + P_TRACE3 + ' but meet HOPE\'s profile (' + MM_EXTEND + ', identical to EXTEND\'s), which enrolled out to 24 h regardless of vessel. ' +
            'IVT directed by clinicians with expertise in thrombolytic stroke care may be beneficial. <strong>If EVT is available, EVT takes priority</strong> — TIMELESS was neutral.' +
            nineHrNote + ' <a href="#extended">Detail</a>' + relCaveat);
        } else {
          add('warn', { cls: '3n', label: 'Criteria not met' }, 'Perfusion profile not met — late IVT is not indicated',
            'Your values — ' + perfVals + ' — meet neither the ' + P_TRACE3 + ' nor the laxer HOPE/EXTEND profile (' + MM_EXTEND + '). ' +
            'Assess <a href="#evt">thrombectomy</a> on its own criteria — the EVT recommendations in this window are ASPECTS-based and do not require perfusion mismatch.');
        }
      } else if (occl === 'nonlvo' || occl === 'noneg') {
        if (!havePerf) {
          add('note', null, 'Non-LVO, 6–24 h — selection is by perfusion',
            'The only randomised evidence is OPTION (JAMA 2026, postdates the guideline, <strong>no class of recommendation</strong>): non-LVO stroke, NIHSS 6–25 or 4–5 with a disabling deficit, prestroke mRS 0–1, core &lt;50 mL, ratio ≥1.2, mismatch ≥10 mL. ' +
            'Enter the core and Tmax&gt;6 s volumes above and the tool will test the profile. <a href="#extended">Detail</a>' + relCaveat);
        } else if (meetsOPTION) {
          add('note', null, 'Non-LVO, 6–24 h — OPTION profile met',
            'Your values — ' + perfVals + ' — meet the OPTION profile (core &lt;50 mL, ratio ≥1.2, mismatch ≥10 mL). OPTION (JAMA 2026) randomised 566 such patients (NIHSS 6–25 or 4–5 with a disabling deficit, prestroke mRS 0–1) to tenecteplase versus standard care: mRS 0–1 43.6% vs 34.2% (RR 1.28), sICH 2.8% vs 0%. ' +
            'It postdates the 2026 AHA guideline literature cut-off and <strong>carries no class of recommendation</strong> — whether to act on it is a local governance decision.' +
            (meetsEXTEND ? nineHrNote : '') + ' <a href="#extended">Detail</a>' + relCaveat);
        } else if (meetsEXTEND) {
          add('note', null, 'Meets EXTEND but not OPTION',
            'Your values — ' + perfVals + ' — miss the OPTION profile (core &lt;50 mL, ratio ≥1.2, mismatch ≥10 mL) but meet the ' + P_EXTEND + '.' + nineHrNote +
            ' Beyond 9 h there is no randomised support for IVT in non-LVO stroke at these values.' + relCaveat);
        } else {
          add('warn', { cls: '3n', label: 'Criteria not met' }, 'Perfusion profile not met — late IVT is not indicated',
            'Your values — ' + perfVals + ' — meet neither the OPTION profile (core &lt;50 mL, ratio ≥1.2, mismatch ≥10 mL) nor the ' + P_EXTEND + '. Move to <a href="#antithrombotics">antithrombotics</a> and <a href="#supportive">supportive care</a>.');
        }
      } else {
        add('warn', null, 'Vascular imaging is the next step',
          'Late-window advice diverges sharply between LVO and non-LVO, so the occlusion has to be defined. Emergent CT/CTA or MRI/MRA of the cervical <em>and</em> intracranial vessels is recommended as rapidly as possible <span class="cor cor-1">COR 1</span> <span class="loe">A</span> — and should not be delayed for a creatinine.');
      }
    } else {
      add('warn', null, 'Beyond 24 h from last known well',
        'No established reperfusion indication. Move to <a href="#antithrombotics">early secondary prevention</a> and <a href="#supportive">supportive care</a>.');
    }

    /* DWI-FLAIR is an independent, optional selection route: it never blocks
       the cards above, but a positive MRI adds the WAKE-UP pathway whenever
       the clock-based COR 1 window has passed. */
    if (!isNaN(hours) && hours > 4.5 && contra !== 'absolute' && disabling !== 'no' && flair === 'yes') {
      add('note', { cls: '2a', label: 'COR 2a' }, 'DWI–FLAIR mismatch — the WAKE-UP route',
        'A DWI lesion (&lt;⅓ of the MCA territory) with no corresponding FLAIR change indicates a biological onset likely within 4.5 h. ' +
        'For unknown-onset or wake-up stroke, IVT within <strong>4.5 h of symptom recognition</strong> can be beneficial in otherwise eligible patients (WAKE-UP) <span class="loe">B-R</span>. ' +
        'This route stands on the MRI alone — it does not require perfusion imaging. <a href="#extended">Criteria</a>' + relCaveat);
    }

    /* ------------------------------------------------------------ thrombectomy */
    /* Every thrombectomy recommendation is written for prestroke mRS 0-1
       (extending to 2 within 6 h in the anterior circulation). Above that the
       card must stop asserting a recommendation, whichever vessel it is.
       One gate so a branch added later cannot quietly skip it. Returns true
       when it has handled the case and the caller should not add its own card. */
    function mrsBlocksEvt(basis) {
      if (mrs === '5') {
        add('danger', null, 'Prestroke mRS 5 — thrombectomy is not supported',
          basis + ' That does not change the decision. Prestroke mRS 5 means bedridden, incontinent and requiring constant nursing care <em>before</em> this stroke, and ' +
          '<strong>every thrombectomy trial excluded these patients</strong> — the recommendations require mRS 0–1, extending to 2 within 6 h. There is no evidence of benefit. ' +
          'Confirm the premorbid state with a collateral history first, since a wrongly recorded mRS 5 would deny treatment to someone eligible. ' +
          'Where it is correct, the conversation is comfort, cause and secondary prevention rather than reperfusion.');
        return true;
      }
      if (mrs === '3-4') {
        add('warn', null, 'Prestroke mRS 3–4 — decide case by case',
          basis + ' But <strong>no completed randomised trial</strong> has tested thrombectomy in moderate prestroke disability, and good outcomes are less frequent than with mRS 0–2 — ' +
          'in cohort studies 20–30% of such patients returned to their premorbid mRS. ' +
          '<strong>This is a case-by-case decision</strong> for the treating team with the patient\'s family, weighing premorbid function, the realistic ceiling of recovery, comorbidity and goals of care — not something to read off a table. ' +
          'The question is return to <em>their</em> baseline, not independence. <a href="#evt">Full criteria</a>');
        return true;
      }
      if (!mrs) {
        add('warn', null, 'Confirm prestroke mRS before proceeding',
          basis + ' But prestroke mRS is a formal eligibility criterion, not a detail: the recommendations require mRS 0–1, extending to 2 within 6 h in the anterior circulation. ' +
          'Ask the family or EMS — <em>before this stroke, could they walk, dress and manage their own affairs independently?</em> ' +
          '<a href="#mrs">Scoring the mRS</a>');
        return true;
      }
      return false;
    }

    if (occl === 'nonlvo') {
      add('warn', { cls: '3n', label: 'COR 3: No Benefit' }, 'Medium or distal vessel — thrombectomy not recommended',
        'EVT is not recommended for nondominant or codominant proximal M2, distal MCA (M3), ACA or PCA occlusions <span class="loe">A</span> — recent randomised trials of medium and distal vessel occlusion showed no functional benefit. ' +
        'A <em>dominant</em> proximal M2 is the exception: select it above. <a href="#evt">Detail</a>');
    } else if (occl === 'none') {
      if (!isNaN(hours) && hours <= 24) {
        add('warn', { cls: '1', label: 'COR 1' }, 'Vascular imaging has not been done',
          'In suspected AIS with possible LVO presenting within 24 h of last known well, emergent CT/CTA or MRI/MRA of the cervical and intracranial vessels should be performed as rapidly as possible for EVT selection <span class="loe">A</span>. ' +
          'Do not delay it to obtain a serum creatinine <span class="cor cor-1">COR 1</span>. Thrombectomy eligibility cannot be assessed without it.');
      }
    } else if (occl === 'lvo' || occl === 'basilar' || occl === 'm2') {
      if (isNaN(hours)) {
        add('warn', null, 'Thrombectomy window', 'Enter the time from last known well. EVT trials extend to 24 h; beyond that there is no randomised evidence.');
      } else if (hours > 24) {
        add('warn', null, 'Beyond the thrombectomy evidence', 'EVT trials extend to 24 h from last known well. Beyond that there is no randomised evidence.');
      } else if (occl === 'basilar') {
        /* The basilar recommendation specifies baseline mRS 0-1, so the same
           prestroke-function gate applies here as in the anterior circulation. */
        var basilarCore = 'Recommended when <strong>baseline mRS 0–1</strong>, <strong>NIHSS ≥10</strong> and <strong>PC-ASPECTS ≥6</strong> (ATTENTION, BAOCHE) <span class="loe">A</span>. ' +
          'For NIHSS 6–9 with the same imaging, effectiveness is not well established <span class="cor cor-2b">COR 2b</span>. ' +
          'Note that PC-ASPECTS, not the anterior-circulation ASPECTS, is the relevant score here — <a href="#aspects">score it</a>. <a href="#evt">Detail</a>';
        if (mrs === '0-1') {
          /* NIHSS is optional — when entered, pick the row it actually falls
             in rather than showing the flat COR 1 headline with both rows
             described in prose underneath. */
          if (!isNaN(nihss) && nihss >= 10) {
            add('ok', { cls: '1', label: 'COR 1' }, 'Basilar occlusion, NIHSS ' + nihss + ' — EVT within 24 h', basilarCore);
          } else if (!isNaN(nihss) && nihss >= 6) {
            add('note', { cls: '2b', label: 'COR 2b' }, 'Basilar occlusion, NIHSS ' + nihss + ' — effectiveness not well established', basilarCore);
          } else if (!isNaN(nihss)) {
            add('warn', null, 'Basilar occlusion, NIHSS ' + nihss + ' — outside the basilar EVT table',
              'The basilar EVT recommendations are written for NIHSS 6–9 and NIHSS ≥10; NIHSS below 6 falls outside both rows and is not addressed. ' + basilarCore);
          } else {
            add('ok', { cls: '1', label: 'COR 1' }, 'Basilar occlusion — EVT within 24 h', basilarCore);
          }
        } else if (mrsBlocksEvt('A basilar occlusion within 24 h meets the vessel and time criteria.')) {
          /* handled by the shared gate */
        } else if (mrs === '2') {
          add('note', null, 'Basilar occlusion, prestroke mRS 2 — individualised',
            'The basilar recommendation is written for baseline mRS 0–1; unlike the anterior circulation there is no separate mRS 2 recommendation. Reasonable to consider on an individual basis. ' + basilarCore);
        }
      } else if (occl === 'm2') {
        if (mrsBlocksEvt(hours <= 6 ? 'A dominant proximal M2 occlusion within 6 h meets the vessel and time criteria.' : 'A proximal M2 occlusion beyond 6 h is already outside the recommendation.')) {
          /* handled by the shared gate */
        } else if (hours <= 6) {
          var m2NihssLow = !isNaN(nihss) && nihss < 6;
          add(m2NihssLow ? 'warn' : 'note', m2NihssLow ? null : { cls: '2a', label: 'COR 2a' }, 'Dominant proximal M2 within 6 h',
            'Reasonable when prestroke mRS 0–1, NIHSS ≥6 and ASPECTS ≥6 <span class="loe">B-NR</span>.' +
            (m2NihssLow ? ' <strong>Entered NIHSS ' + nihss + ' is below that threshold</strong> — outside the trial population; individualise.' : '') + ' ' +
            'EVT is <strong>not</strong> recommended <span class="cor cor-3n">COR 3: No Benefit</span> <span class="loe">A</span> for nondominant or codominant proximal M2, distal MCA, ACA or PCA occlusions. <a href="#evt">Detail</a>');
        } else {
          add('warn', null, 'Proximal M2 beyond 6 h — outside the recommendation',
            'The M2 recommendation <span class="cor cor-2a">COR 2a</span> is written for the 0–6 h window only. Beyond 6 h there is no recommendation for M2 thrombectomy, and recent trials of medium and distal vessel occlusion were negative overall. Individualised decision. <a href="#evt">Detail</a>');
        }
      } else if (!aspects) {
        add('warn', null, 'Select ASPECTS to assess thrombectomy eligibility',
          'For ICA or M1 occlusion, ASPECTS is the variable that determines which recommendation applies. <a href="#aspects">Score it here</a>.');
      } else {
        var cor = null, title = '', body = '', kind = 'note';

        if (hours <= 6) {
          if (aspects === '6-10' || aspects === '3-5') {
            cor = { cls: '1', label: 'COR 1' };
            title = 'EVT recommended — ICA/M1, 0–6 h, ASPECTS ' + (aspects === '6-10' ? '6–10' : '3–5');
            body = 'The 0–6 h recommendation covers <strong>ASPECTS 3 to 10</strong> and carries <strong>no age criterion</strong> <span class="loe">A</span>. ';
            if (aspects === '3-5' && age === '80plus') {
              body += 'Note that the large-core trials under-enrolled patients over 80 — but HERMES showed EVT benefit persisting at age ≥80 (common OR 3.68, 95% CI 1.95–6.92), and this recommendation does not exclude them. ';
            }
          } else if (aspects === '0-2') {
            if (age === '80plus') {
              title = 'ASPECTS 0–2 at age ≥80 — outside the recommendation';
              kind = 'warn';
              body = 'The <span class="cor cor-2a">COR 2a</span> recommendation for ASPECTS 0–2 specifies <strong>age &lt;80</strong>. LASTE, the only trial to systematically enrol ASPECTS 0–2, excluded patients aged 80 and over outright. This is an individualised decision made explicitly outside the evidence base, and it should be named as such with the family. ';
            } else {
              cor = { cls: '2a', label: 'COR 2a' };
              title = 'EVT reasonable — ICA/M1, 0–6 h, ASPECTS 0–2';
              body = 'Requires age &lt;80, prestroke mRS 0–1 and no significant mass effect <span class="loe">B-R</span>. ' +
                'LASTE also excluded significant head and neck vessel tortuosity, comorbidity confounding neurological assessment, seizure at onset preventing accurate NIHSS, suspected intracranial stenosis, and life expectancy &lt;6 months. ' +
                'In LASTE, functional independence (mRS 0–2) was achieved by 13.3% after EVT versus 4.9% with medical therapy — the family conversation should carry that number. ';
            }
          }
        } else {
          if (aspects === '6-10') {
            cor = { cls: '1', label: 'COR 1' };
            title = 'EVT recommended — ICA/M1, 6–24 h, ASPECTS ≥6';
            body = 'Requires prestroke mRS 0–1 <span class="loe">A</span> (DAWN, DEFUSE 3, AURORA). ';
          } else if (aspects === '3-5') {
            if (age === '80plus') {
              title = 'Large core beyond 6 h at age ≥80 — outside the recommendation';
              kind = 'warn';
              body = 'The 6–24 h ASPECTS 3–5 recommendation specifies <strong>age &lt;80</strong>. SELECT2 and ANGEL-ASPECT under-enrolled or excluded older patients, along with those with renal failure, refractory hypertension (SBP ≥185 or DBP ≥110), comorbidity confounding neurological assessment, or life expectancy &lt;3 months. This is an individualised decision outside the evidence base — name it as such with the family. ';
            } else {
              cor = { cls: '1', label: 'COR 1' };
              title = 'EVT recommended — ICA/M1, 6–24 h, ASPECTS 3–5';
              body = 'Requires age &lt;80, prestroke mRS 0–1 and no significant mass effect <span class="loe">A</span> (SELECT2, ANGEL-ASPECT). ';
            }
          } else if (aspects === '0-2') {
            title = 'ASPECTS 0–2 beyond 6 h — outside the recommendations';
            kind = 'warn';
            body = 'The <span class="cor cor-2a">COR 2a</span> recommendation for ASPECTS 0–2 is limited to the 0–6 h window, because LASTE enrolled within 6.5 h. Beyond 6 h this is off-evidence and an individualised decision. ';
          }
        }

        if (title) {
          body += 'All rows require <strong>NIHSS ≥6</strong>.';
          if (!isNaN(nihss) && nihss < 6) {
            body += ' <strong>Entered NIHSS ' + nihss + ' is below that threshold</strong> — the pivotal EVT trials enrolled NIHSS ≥6, so this sits outside the trial population and is an individualised decision, not a straightforward recommendation.';
            cor = null; kind = 'warn';
          }

          /* Prestroke function governs the headline. Every thrombectomy
             recommendation is written for mRS 0-1, extending to 2 within 6 h.
             Above that the trials give no support, so the card must not keep
             saying "EVT recommended" — the imaging and window finding becomes
             background to an individualised decision, not the conclusion. */
          var imagingBasis = title;

          if (mrs === '0-1') {
            body += ' Prestroke mRS 0–1 — within the trial population.';
          } else if (mrs === '2') {
            body += hours <= 6
              ? ' <strong>Prestroke mRS 2:</strong> reasonable within 6 h for ICA/M1 with ASPECTS ≥6 <span class="cor cor-2a">COR 2a</span>.'
              : ' <strong>Prestroke mRS 2 beyond 6 h:</strong> the mRS 2 recommendation is written for the 0–6 h window; the 6–24 h recommendations require mRS 0–1. Individualised.';
            if (hours > 6) { cor = null; kind = 'warn'; }
          } else if (mrsBlocksEvt('On time and imaging alone this would be “' + imagingBasis + '”.')) {
            title = '';   /* handled by the shared gate */
          }

          if (title) {
            body += ' Aim for eTICI 2b/2c/3 as early as possible. <a href="#evt">Full criteria</a>';
            add(kind === 'warn' ? 'warn' : (cor && cor.cls === '1' ? 'ok' : 'note'), cor, title, body);
          }
        }
      }

      if (hours <= 4.5 && contra !== 'absolute' && disablingMet && ich !== 'yes' && mrs !== '5') {
        add('note', null, 'Do not delay thrombectomy to watch for a response to thrombolysis',
          'Bridging IVT remains standard where the patient is thrombolysis-eligible. Delaying EVT to assess for clinical improvement after the bolus is explicitly not recommended.');
      }
    }

    if (!lines.length) add('warn', null, 'Not enough information yet', 'Fill in the fields above.');
    lines.push('<p class="src">Generated from the recommendation tables in the 2026 AHA/ASA acute ischaemic stroke guideline. ' +
      'It restates published criteria for the inputs you gave — it does not know this patient, does not weigh their individual risks, ' +
      'and is not a substitute for the treating team\'s judgement. Read the linked section before acting on any card.</p>');
    out.innerHTML = lines.join('');
  }
  $$('#pathfinder select').forEach(function (el) { el.addEventListener('change', pathfinder); });
  $$('#pathfinder input').forEach(function (el) { el.addEventListener('input', pathfinder); });
  if ($('#pfOut')) {
    pathfinder();
    $('#pfReset').addEventListener('click', function () {
      $$('#pathfinder select').forEach(function (el) { el.selectedIndex = 0; });
      $$('#pathfinder input').forEach(function (el) { el.value = ''; });
      pathfinder();
    });
    $('#pfCopy').addEventListener('click', function () {
      var btn = this;
      function opt(id) { var el = $('#' + id); var o = el && el.options ? el.options[el.selectedIndex] : null; return o ? o.textContent : ''; }
      var core = pf('pfCore'), tmax = pf('pfTmax');
      var perfLine = (core !== '' && tmax !== '')
        ? 'core ' + core + ' mL, Tmax>6s ' + tmax + ' mL (mismatch ' + (tmax - core) + ' mL, ratio ' + (core > 0 ? (tmax / core).toFixed(1) : '∞') + ')'
        : 'not entered';
      var summary = [
        'Reperfusion pathfinder',
        'Last known well: ' + (opt('pfTime') || '—'),
        'Haemorrhage on NCCT: ' + (opt('pfIch') || '—'),
        'Deficit disabling: ' + (opt('pfDisabling') || '—'),
        'NIHSS: ' + (pf('pfNihss') || '—'),
        'Thrombolysis contraindications: ' + (opt('pfContra') || '—'),
        'Occlusion: ' + (opt('pfOccl') || '—'),
        'ASPECTS: ' + (opt('pfAspects') || '—'),
        'Perfusion: ' + perfLine,
        'DWI–FLAIR mismatch: ' + (opt('pfFlair') || 'MRI not done'),
        'Prestroke mRS: ' + (opt('pfMrs') || '—'),
        'Age: ' + (opt('pfAge') || '—'),
        ''
      ].join('\n');
      var cards = $$('#pfOut .note').map(function (n) {
        var clone = n.cloneNode(true);
        var t = clone.querySelector('.note__t');
        var title = t ? t.textContent.trim() : '';
        if (t) t.remove();
        return title + '\n' + clone.textContent.trim().replace(/\s+/g, ' ');
      }).join('\n\n');
      copy(summary + cards, btn);
    });
  }

  /* -------------------------------------------------------- trials filter */
  var trialFilter = $('#trialFilter');
  if (trialFilter) {
    function updateTrialFilter() {
      var q = trialFilter.value.toLowerCase().trim();
      var shown = 0;
      $$('#trialTable tbody tr').forEach(function (tr) {
        var hit = !q || tr.textContent.toLowerCase().indexOf(q) !== -1;
        tr.hidden = !hit; if (hit) shown++;
      });
      $('#trialCount').textContent = shown + ' trial' + (shown === 1 ? '' : 's');
    }
    trialFilter.addEventListener('input', updateTrialFilter);
    updateTrialFilter();
  }

  /* ------------------------------------------------------- disclaimer bar */
  var bar = $('#disclaimerBar');
  if (bar) {
    if (store.get('ack', false)) bar.hidden = true;
    $('#ackBtn').addEventListener('click', function () { store.set('ack', true); bar.hidden = true; });
  }

  /* ------------------------------------------------------------- install */
  var deferred = null;
  var installBtn = $('#installBtn');
  var installed = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
                  navigator.standalone === true;

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function installHelp() {
    var existing = $('.installhelp');
    if (existing) { existing.remove(); return; }
    var el = document.createElement('div');
    el.className = 'installhelp';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'How to install');
    el.innerHTML = isIOS()
      ? '<h4>Add to Home Screen</h4><ol>' +
        '<li>Tap the <strong>Share</strong> button in the Safari toolbar.</li>' +
        '<li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>' +
        '<li>Tap <strong>Add</strong>.</li></ol>' +
        '<p>It then opens full screen and works with no signal.</p>'
      : '<h4>Install this guide</h4>' +
        '<p>Your browser has not offered an install prompt. In Chrome or Edge, look for the install icon in the address bar, or open the browser menu and choose <strong>Install</strong> or <strong>Add to Home screen</strong>.</p>' +
        '<p>Safari on iPhone and iPad uses <strong>Share → Add to Home Screen</strong>.</p>';
    var close = document.createElement('button');
    close.className = 'btn'; close.textContent = 'Close';
    close.addEventListener('click', function () { el.remove(); });
    el.appendChild(close);
    document.body.appendChild(el);
    close.focus();
  }

  if (installBtn) {
    if (installed) {
      installBtn.remove();
      installBtn = null;
    } else {
      /* Chromium fires this when the app is installable; Safari and Firefox
         never do, so on iOS show the button anyway and explain the manual
         route rather than leaving a button that does nothing. */
      window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault(); deferred = e; installBtn.hidden = false;
      });
      if (isIOS()) installBtn.hidden = false;

      installBtn.addEventListener('click', function () {
        if (deferred) {
          deferred.prompt();
          deferred.userChoice.then(function () { deferred = null; installBtn.hidden = true; });
        } else {
          installHelp();
        }
      });
      window.addEventListener('appinstalled', function () {
        deferred = null;
        if (installBtn) installBtn.hidden = true;
      });
    }
  }

  /* ------------------------------------------------------- service worker */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  /* --------------------------------------------------- section feedback */
  /* One "report an issue" link per section, generated rather than hand-added
     25 times over, so it can't drift as sections are added or removed.
     Pre-fills a GitHub issue with the fields CONTRIBUTING.md asks for. */
  function addFeedbackLinks() {
    $$('.section').forEach(function (sec) {
      if (sec.querySelector('.section-feedback')) return;
      var title = sec.getAttribute('data-title') || sec.id;
      var ver = document.documentElement.getAttribute('data-version') || '';
      var body = 'Section: ' + title + ' (#' + sec.id + ')\nApp version: ' + ver +
        '\n\n1. The text as it currently reads:\n\n\n2. What it should say:\n\n\n3. Source (guideline section, or trial with DOI):\n';
      var url = 'https://github.com/strokedoc/stroke-guide/issues/new' +
        '?title=' + encodeURIComponent('Issue in "' + title + '"') +
        '&body=' + encodeURIComponent(body);
      var a = document.createElement('a');
      a.href = url;
      a.className = 'section-feedback no-print';
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Report an issue with this section →';
      sec.appendChild(a);
    });
  }
  addFeedbackLinks();

  /* -------------------------------------------------- scoring diagrams */
  /* The diagrams are a second surface onto the same checkboxes, not a second
     source of truth: a tap sets the box and fires its change event, so the
     existing scorer runs untouched, and the paint always reads back off the
     boxes. data-r matches the checkbox value exactly. */
  function paintDiagrams() {
    $$('.dgm__svg').forEach(function (svg) {
      var sel = svg.getAttribute('data-map') === 'pc' ? '.pc-region' : '.aspects-region';
      var rgns = $$('.rgn', svg), labels = $$('.dgm__lbl text', svg);
      rgns.forEach(function (r, i) {
        var box = $$(sel).filter(function (b) { return b.value === r.getAttribute('data-r'); })[0];
        var on = !!(box && box.checked);
        r.classList.toggle('on', on);
        /* Labels are drawn in the same order as the regions, so a filled
           region flips its own label to white rather than losing it. */
        if (labels[i]) labels[i].classList.toggle('on', on);
      });
    });
  }
  $$('.dgm__svg').forEach(function (svg) {
    var sel = svg.getAttribute('data-map') === 'pc' ? '.pc-region' : '.aspects-region';
    $$('.rgn', svg).forEach(function (r) {
      var label = r.getAttribute('data-r');
      r.addEventListener('click', function () {
        var box = $$(sel).filter(function (b) { return b.value === label; })[0];
        if (!box) return;
        box.checked = !box.checked;
        box.dispatchEvent(new Event('change'));
      });
    });
  });
  $$('.aspects-region, .pc-region').forEach(function (b) { b.addEventListener('change', paintDiagrams); });
  paintDiagrams();

  /* ----------------------------------------------------- home screen tiles */
  /* Every section lives in the DOM at once, so the tiles just mirror whatever
     each calculator's own readout currently says.  Refreshed when the home
     screen is shown — the only moment the values can be looked at. */
  function syncTiles() {
    /* Recompute the clock first — elapsed time since LKW is the one value
       that goes stale on its own between visits. */
    if ($('#lkwTime')) clockUpdate();
    [['#tileNihss', '#nihssTotal'], ['#tileAspects', '#aspectsScore'],
     ['#tileClock', '#clockOut'], ['#tileDose', '#doseOut'],
     ['#tileIch', '#ichScore']].forEach(function (pair) {
      var tile = $(pair[0]), src = $(pair[1]);
      if (tile && src) tile.textContent = src.textContent;
    });
    /* The Tools list mirrors the same readouts, declared once in TOOLS. */
    $$('#toolsBody .toollist__v[data-src]').forEach(function (el) {
      var src = el.getAttribute('data-src') && $(el.getAttribute('data-src'));
      if (src) el.textContent = src.textContent;
    });
  }

  /* ------------------------------------------------------------ kick off */
  buildGuide();    /* before route(), so generated links get current-page marking */
  route();
  buildIndex();
  var v = $('#buildVersion');
  if (v) v.textContent = document.documentElement.getAttribute('data-version') || '';
})();
