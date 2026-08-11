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
  var navLinks = $$('.sidebar a[href^="#"]');

  function show(id, opts) {
    var target = document.getElementById(id);
    if (!target || !target.classList.contains('section')) { id = 'start'; target = document.getElementById('start'); }
    sections.forEach(function (s) { s.classList.toggle('active', s === target); });
    navLinks.forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('href') === '#' + id ? 'true' : 'false'); });
    var t = target.getAttribute('data-title');
    document.title = (t ? t + ' — ' : '') + 'Acute Stroke Guide';
    if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
    closeNav();
    if (opts && opts.focusText) highlightText(target, opts.focusText);
  }

  function route(opts) { show((location.hash || '#start').slice(1), opts); }
  window.addEventListener('hashchange', function () { route(); });

  /* ------------------------------------------------------------ mobile nav */
  function openNav() {
    $('#sidebar').classList.add('open');
    if (!$('.scrim')) {
      var s = document.createElement('div');
      s.className = 'scrim';
      s.addEventListener('click', closeNav);
      document.body.appendChild(s);
    }
  }
  function closeNav() {
    $('#sidebar').classList.remove('open');
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

  function renderResults(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
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
  ['#wt', '#wtUnit', '#agent'].forEach(function (s) {
    var el = $(s); if (el) el.addEventListener('input', doseCalc);
  });
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
    $('#ichMort').textContent = mort + ' 30-day mortality (Hemphill 2001 derivation cohort)';
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
    if (mins <= 270) win.push('Within the 4.5-hour IVT window — treat now, NCCT alone is sufficient.');
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

    if (ich === 'yes') {
      add('danger', null, 'Haemorrhage on imaging — stop the ischaemic pathway',
        'Thrombolysis is an absolute contraindication when CT shows acute intracranial haemorrhage. Switch to the ' +
        '<a href="#ich">intracerebral haemorrhage pathway</a>: blood pressure control, anticoagulation reversal, neurosurgical review.');
      out.innerHTML = lines.join('');
      return;
    }

    /* ---- thrombolysis ---- */
    if (isNaN(hours)) {
      add('warn', null, 'Enter time from last known well', 'Every downstream decision keys off this number.');
    } else if (contra === 'absolute') {
      add('danger', null, 'Absolute contraindication to thrombolysis recorded',
        'Do not give IV thrombolysis. EVT eligibility is assessed independently — an IVT contraindication does not exclude thrombectomy.');
    } else if (hours <= 4.5) {
      if (disabling === 'yes') {
        add('ok', { cls: '1', label: 'COR 1' }, 'IV thrombolysis now — tenecteplase 0.25 mg/kg or alteplase 0.9 mg/kg',
          'Disabling deficit within 4.5 h and no absolute contraindication. Treat on NCCT alone — do <em>not</em> wait for CTA/CTP or MRI. ' +
          'BP must be &lt;185/110 before the bolus. <a href="#dosing">Dosing</a> · <a href="#contraindications">Contraindications</a>');
      } else if (disabling === 'no') {
        add('warn', { cls: '3n', label: 'COR 3: No Benefit' }, 'Non-disabling deficit — thrombolysis not recommended',
          'Trials failed to show benefit of IVT over dual antiplatelet therapy for mild non-disabling deficits. ' +
          'Give <a href="#antithrombotics">DAPT</a> (aspirin + clopidogrel with a loading dose) instead, within 24 h, for 21 days. ' +
          'Re-read <a href="#thrombolysis">the disabling-deficit definition</a> before you settle on "non-disabling".');
      } else {
        add('warn', null, 'Decide whether the deficit is disabling', 'This is the single highest-yield decision in the 4.5-hour window. See <a href="#thrombolysis">Table 4 guidance</a>.');
      }
    } else if (hours <= 9) {
      add('note', { cls: '2a', label: 'COR 2a' }, 'Extended-window thrombolysis may be reasonable (4.5–9 h)',
        mismatch === 'yes'
          ? 'Salvageable penumbra on automated perfusion imaging (or DWI–FLAIR mismatch if unknown onset within 4.5 h of recognition). IVT may be reasonable. <a href="#extended">Criteria</a>'
          : 'Requires salvageable penumbra on automated perfusion imaging, or DWI–FLAIR mismatch. Obtain that imaging before deciding. <a href="#extended">Criteria</a>');
    } else if (hours <= 24) {
      if (occl === 'lvo') {
        add('note', { cls: '2b', label: 'COR 2b' }, 'Extended-window IVT only if EVT is not available (4.5–24 h, LVO)',
          'For LVO with salvageable penumbra that <em>cannot</em> receive EVT, IVT directed by stroke expertise may be beneficial (TRACE-III, HOPE). ' +
          'If EVT is available, EVT takes priority and there is no established role for adding late IVT (TIMELESS was neutral). <a href="#extended">Detail</a>');
      } else if (occl === 'nonlvo') {
        add('note', null, 'Non-LVO 4.5–24 h — evidence newer than the guideline',
          'OPTION (JAMA 2026) randomised 566 patients with non-LVO stroke and perfusion mismatch to tenecteplase vs standard care: mRS 0–1 43.6% vs 34.2% ' +
          '(RR 1.28), sICH 2.8% vs 0%. This postdates the 2026 AHA guideline literature cut-off and carries no COR. Local governance applies. <a href="#extended">Detail</a>');
      } else {
        add('warn', null, 'Define the occlusion to go further', 'Late-window thrombolysis advice diverges sharply between LVO and non-LVO.');
      }
    } else {
      add('warn', null, 'Beyond 24 h from last known well', 'No established reperfusion indication. Move to <a href="#antithrombotics">secondary prevention</a> and <a href="#supportive">supportive care</a>.');
    }

    /* ---- thrombectomy ---- */
    if (occl === 'lvo' || occl === 'basilar' || occl === 'm2') {
      if (isNaN(hours) || hours > 24) {
        add('warn', null, 'Thrombectomy window', 'EVT trials extend to 24 h from last known well. Beyond that there is no randomised evidence.');
      } else if (occl === 'basilar') {
        add('ok', { cls: '1', label: 'COR 1' }, 'Basilar occlusion — EVT within 24 h',
          'Recommended when baseline mRS 0–1, NIHSS ≥10 and PC-ASPECTS ≥6 (ATTENTION, BAOCHE). For NIHSS 6–9 the effectiveness of EVT is not well established (COR 2b). <a href="#evt">Detail</a>');
      } else if (occl === 'm2') {
        add('note', { cls: '2a', label: 'COR 2a' }, 'Dominant proximal M2 within 6 h',
          'Reasonable when prestroke mRS 0–1, NIHSS ≥6 and ASPECTS ≥6. EVT is <strong>not</strong> recommended (COR 3: No Benefit) for nondominant/codominant proximal M2, distal MCA, ACA or PCA occlusions. <a href="#evt">Detail</a>');
      } else {
        var cor = null, title = '', body = '';
        if (hours <= 6) {
          if (aspects === '6-10') { cor = { cls: '1', label: 'COR 1' }; title = 'EVT recommended — ICA/M1, 0–6 h, ASPECTS 6–10'; }
          else if (aspects === '3-5') { cor = { cls: '1', label: 'COR 1' }; title = 'EVT recommended — ICA/M1, 0–6 h, ASPECTS 3–5'; }
          else if (aspects === '0-2') { cor = { cls: '2a', label: 'COR 2a' }; title = 'EVT reasonable — ICA/M1, 0–6 h, ASPECTS 0–2'; body = 'Supported chiefly by LASTE, which enrolled only patients &lt;80 years and excluded significant vessel tortuosity, confounding comorbidity, seizure at onset, suspected intracranial stenosis, or life expectancy &lt;6 months. '; }
        } else {
          if (aspects === '6-10') { cor = { cls: '1', label: 'COR 1' }; title = 'EVT recommended — ICA/M1, 6–24 h, ASPECTS ≥6'; }
          else if (aspects === '3-5') { cor = { cls: '1', label: 'COR 1' }; title = 'EVT recommended — ICA/M1, 6–24 h, ASPECTS 3–5, age &lt;80'; body = 'Age &lt;80 years and no significant mass effect are part of this recommendation (SELECT2, ANGEL-ASPECT). '; }
          else if (aspects === '0-2') { cor = null; title = 'ASPECTS 0–2 beyond 6 h'; body = 'The COR 2a recommendation for ASPECTS 0–2 is limited to the 0–6 h window. Beyond 6 h this is off-evidence and an individualised decision. '; }
        }
        var offTrialAge = age === '80plus' && (aspects === '3-5' || aspects === '0-2');
        if (title && offTrialAge) {
          cor = null;
          title = 'Large core at age ≥80 — outside the trial populations';
          body = 'The large-core recommendations are written for age &lt;80: SELECT2 and ANGEL-ASPECT under-enrolled or excluded older patients, and LASTE excluded age ≥80 outright. ' +
            'This is an individualised decision made explicitly outside the evidence base, and it should be named as such in the conversation with the family. ';
        }
        if (title) {
          body += 'Requires NIHSS ≥6.';
          if (mrs === '0-1') body += ' Prestroke mRS 0–1 — within the trial population.';
          else if (mrs === '2') body += ' Prestroke mRS 2: reasonable within 6 h for ASPECTS ≥6 (COR 2a).';
          else if (mrs === '3-4') body += ' Prestroke mRS 3–4: might be reasonable within 6 h for ASPECTS ≥6 (COR 2b); no completed RCT.';
          body += ' Aim for eTICI 2b/2c/3 as early as possible. <a href="#evt">Full criteria</a>';
          add(offTrialAge ? 'warn' : (cor && cor.cls === '1' ? 'ok' : 'note'), cor, title, body);
        }
      }
      if (hours <= 4.5 && contra !== 'absolute' && disabling === 'yes') {
        add('note', null, 'Do not delay EVT to observe the response to thrombolysis',
          'Bridging IVT before EVT remains standard where the patient is IVT-eligible; delaying thrombectomy to assess for clinical improvement is not recommended.');
      }
    }

    if (!lines.length) add('warn', null, 'Not enough information yet', 'Fill in the fields above.');
    lines.push('<p class="src">Generated from the recommendation tables in the 2026 AHA/ASA acute ischaemic stroke guideline. ' +
      'It restates published criteria — it does not weigh this patient\'s individual risks, and it is not a substitute for the treating team\'s judgement.</p>');
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
    trialFilter.addEventListener('input', function () {
      var q = trialFilter.value.toLowerCase().trim();
      var shown = 0;
      $$('#trialTable tbody tr').forEach(function (tr) {
        var hit = !q || tr.textContent.toLowerCase().indexOf(q) !== -1;
        tr.hidden = !hit; if (hit) shown++;
      });
      $('#trialCount').textContent = shown + ' trial' + (shown === 1 ? '' : 's');
    });
  }

  /* --------------------------------------------------------- generic copy */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var src = document.getElementById(b.getAttribute('data-copy'));
    if (src) copy(src.getAttribute('data-summary') || src.textContent.trim(), b);
  });

  /* ------------------------------------------------------- disclaimer bar */
  var bar = $('#disclaimerBar');
  if (bar) {
    if (store.get('ack', false)) bar.hidden = true;
    $('#ackBtn').addEventListener('click', function () { store.set('ack', true); bar.hidden = true; });
  }

  /* ------------------------------------------------------------- install */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    var b = $('#installBtn'); if (b) b.hidden = false;
  });
  var installBtn = $('#installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; installBtn.hidden = true; });
    });
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
