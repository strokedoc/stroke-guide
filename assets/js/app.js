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

  /* ------------------------------------------------------------ mobile nav */
  function openNav() {
    $('#sidebar').classList.add('open');
    $('#navToggle').setAttribute('aria-expanded', 'true');
    if (!$('.scrim')) {
      var s = document.createElement('div');
      s.className = 'scrim';
      s.addEventListener('click', closeNav);
      document.body.appendChild(s);
    }
  }
  function closeNav() {
    $('#sidebar').classList.remove('open');
    $('#navToggle').setAttribute('aria-expanded', 'false');
    var s = $('.scrim'); if (s) s.remove();
  }
  $('#navToggle').addEventListener('click', function () {
    $('#sidebar').classList.contains('open') ? closeNav() : openNav();
  });

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

  /* -------------------------------------------------------- LKW time clock */
  function clockUpdate() {
    var lkw = $('#lkwTime').value;
    var out = $('#clockOut'), note = $('#clockNote');
    if (!lkw) { out.textContent = '—'; note.textContent = 'Enter the last-known-well time.'; return; }
    var now = new Date();
    var parts = lkw.split(':');
    var t = new Date(now); t.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    if (t > now) t.setDate(t.getDate() - 1);           // LKW was yesterday
    var mins = Math.round((now - t) / 60000);
    var h = Math.floor(mins / 60), m = mins % 60;
    out.textContent = h + ' h ' + (m < 10 ? '0' : '') + m + ' m';
    var win = [];
    if (mins <= 270) win.push('Within the 4.5-hour IVT window — if the deficit is disabling and there is no contraindication, treat as fast as possible; NCCT alone is sufficient.');
    else if (mins <= 540) win.push('4.5–9 h: extended-window IVT possible with perfusion mismatch (COR 2a).');
    else if (mins <= 1440) win.push('9–24 h: EVT window; extended IVT only for LVO that cannot get EVT (COR 2b).');
    else win.push('Beyond 24 h from LKW — no established reperfusion indication.');
    if (mins <= 360) win.push('Within the 0–6 h EVT window.');
    else if (mins <= 1440) win.push('Within the 6–24 h EVT window.');
    note.textContent = win.join(' ');
  }
  if ($('#lkwTime')) {
    $('#lkwTime').addEventListener('input', clockUpdate);
    $('#clockNow').addEventListener('click', function () {
      var d = new Date();
      $('#lkwTime').value = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
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
    var mismatch = pf('pfMismatch');
    var mrs = pf('pfMrs');
    var age = pf('pfAge');
    var lines = [];

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
      if (disabling === 'yes') {
        add(contra === 'relative' ? 'warn' : 'ok', { cls: '1', label: 'COR 1' },
          'IV thrombolysis now — tenecteplase 0.25 mg/kg or alteplase 0.9 mg/kg',
          'Disabling deficit within 4.5 h. Treat on NCCT alone — do <em>not</em> wait for CTA/CTP or MRI. ' +
          'BP must be &lt;185/110 before the bolus. Check glucose first. <a href="#dosing">Dosing</a> · <a href="#contraindications">Contraindications</a>' + relCaveat);
      } else if (disabling === 'no') {
        nonDisablingCard();
      } else {
        add('warn', null, 'Decide whether the deficit is disabling',
          'This is the highest-yield decision in the 4.5-hour window, and NIHSS alone does not answer it. See <a href="#thrombolysis">the Table 4 guidance</a>.');
      }
    } else if (hours <= 9) {
      if (disabling === 'no') {
        nonDisablingCard();
      } else if (mismatch === 'no') {
        add('warn', { cls: '3n', label: 'Criteria not met' }, 'No salvageable penumbra — extended-window IVT is not indicated',
          'The 4.5–9 h recommendation <span class="cor cor-2a">COR 2a</span> applies only where automated perfusion imaging shows salvageable penumbra, ' +
          'or where DWI–FLAIR mismatch is present in unknown-onset stroke. Perfusion imaging showing no mismatch takes this option off the table. ' +
          'Move to <a href="#antithrombotics">antithrombotics</a> and <a href="#supportive">supportive care</a>, and assess EVT separately if there is a large vessel occlusion.');
      } else {
        add('note', { cls: '2a', label: 'COR 2a' }, 'Extended-window thrombolysis may be reasonable (4.5–9 h)',
          (mismatch === 'yes'
            ? 'Salvageable penumbra confirmed on automated perfusion imaging. IVT may be reasonable (EXTEND, ECASS-4).'
            : 'This requires salvageable penumbra on automated perfusion imaging, or DWI–FLAIR mismatch for unknown onset within 4.5 h of symptom recognition. Obtain that imaging before deciding.') +
          ' <a href="#extended">Criteria</a>' + relCaveat);
      }
    } else if (hours <= 24) {
      if (disabling === 'no') {
        nonDisablingCard();
      } else if (occl === 'lvo' || occl === 'basilar') {
        if (mismatch === 'no') {
          add('warn', { cls: '3n', label: 'Criteria not met' }, 'No salvageable penumbra — late IVT is not indicated',
            'The 4.5–24 h recommendation <span class="cor cor-2b">COR 2b</span> requires LVO <em>with salvageable ischaemic penumbra</em>. ' +
            'Assess <a href="#evt">thrombectomy</a> on its own criteria — the EVT recommendations in this window do not all require perfusion mismatch.');
        } else {
          add('note', { cls: '2b', label: 'COR 2b' }, 'Late IVT only if thrombectomy is unavailable (4.5–24 h, LVO)',
            'For LVO with salvageable penumbra that <em>cannot</em> receive EVT, IVT directed by clinicians with expertise in thrombolytic stroke care may be beneficial (TRACE-III, HOPE). ' +
            (mismatch === 'na' ? 'Salvageable penumbra must be demonstrated first. ' : '') +
            '<strong>If EVT is available, EVT takes priority</strong> and there is no established role for adding late IVT — TIMELESS was neutral. ' +
            '<a href="#extended">Detail</a>' + relCaveat);
        }
      } else if (occl === 'm2' || occl === 'nonlvo') {
        add('note', null, 'Medium or distal vessel, 4.5–24 h — evidence newer than the guideline',
          'OPTION (JAMA 2026) randomised 566 patients with <strong>non-LVO</strong> stroke (ICA, M1 and vertebrobasilar excluded) and perfusion mismatch — core &lt;50 mL, ratio ≥1.2, mismatch ≥10 mL, NIHSS 6–25 or 4–5 with a disabling deficit, prestroke mRS 0–1 — to tenecteplase versus standard care: ' +
          'mRS 0–1 43.6% vs 34.2% (RR 1.28), sICH 2.8% vs 0%. ' +
          'This postdates the 2026 AHA guideline literature cut-off and <strong>carries no class of recommendation</strong>. Whether to act on it is a local governance decision. <a href="#extended">Detail</a>' + relCaveat);
      } else if (occl === 'noneg') {
        add('warn', null, 'No occlusion, 4.5–24 h', 'The guideline\'s late-window thrombolysis recommendation is written for LVO that cannot receive EVT. For a non-LVO stroke in this window the only randomised evidence is OPTION, which postdates the guideline — select "medium / distal vessel" to see it.');
      } else {
        add('warn', null, 'Vascular imaging is the next step',
          'Late-window advice diverges sharply between LVO and non-LVO, so the occlusion has to be defined. Emergent CT/CTA or MRI/MRA of the cervical <em>and</em> intracranial vessels is recommended as rapidly as possible <span class="cor cor-1">COR 1</span> <span class="loe">A</span> — and should not be delayed for a creatinine.');
      }
    } else {
      add('warn', null, 'Beyond 24 h from last known well',
        'No established reperfusion indication. Move to <a href="#antithrombotics">early secondary prevention</a> and <a href="#supportive">supportive care</a>.');
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

    if (occl === 'none') {
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
          'Note that PC-ASPECTS, not the anterior-circulation ASPECTS, is the relevant score here. <a href="#evt">Detail</a>';
        if (mrs === '0-1') {
          add('ok', { cls: '1', label: 'COR 1' }, 'Basilar occlusion — EVT within 24 h', basilarCore);
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
          add('note', { cls: '2a', label: 'COR 2a' }, 'Dominant proximal M2 within 6 h',
            'Reasonable when prestroke mRS 0–1, NIHSS ≥6 and ASPECTS ≥6 <span class="loe">B-NR</span>. ' +
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
                'Functional independence was achieved by 13.3% after EVT versus 7.5% with medical therapy — the family conversation should carry that number. ';
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

      if (hours <= 4.5 && contra !== 'absolute' && disabling === 'yes' && ich !== 'yes' && mrs !== '5') {
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
  if ($('#pfOut')) {
    pathfinder();
    $('#pfReset').addEventListener('click', function () {
      $$('#pathfinder select').forEach(function (el) { el.selectedIndex = 0; });
      pathfinder();
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

  /* ------------------------------------------------------------ kick off */
  route();
  buildIndex();
  var v = $('#buildVersion');
  if (v) v.textContent = document.documentElement.getAttribute('data-version') || '';
})();
