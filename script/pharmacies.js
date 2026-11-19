document.getElementById('year').textContent = new Date().getFullYear();

(async () => {
  const mount = document.getElementById('content');
  const src = document.body.dataset.src;
  if (!mount || !src) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const inl = s => esc(s)
    .replace(/\*{5}(.+?)\*{5}/g, '<strong><em>$1</em></strong>')
    .replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>')
    .replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>');

  const attrs = s => {
    const o = {};
    String(s).replace(/(\w+)\s*=\s*"([^"]*)"/g, (_, k, v) => { o[k] = v; return ''; });
    return o;
  };

  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';

  const btnEl = (label, url, style) => {
    if (!label || !url) return '';
    const cls = style === 'ghost' ? 'btn-ghost' : 'btn-primary';
    return '<a class="' + cls + '" href="' + esc(url) +
      '" target="_blank" rel="noopener noreferrer">' + inl(label) + ARROW + '</a>';
  };

  const iconEl = (src, alt, cls) => !src ? '' :
    '<img class="' + cls + '" src="' + esc(src) + '" alt="' + esc(alt || '') + '" ' +
    'loading="lazy" decoding="async" ' +
    'onerror="console.warn(\'Icon failed to load:\', this.src); ' +
    'var s=document.createElement(\'span\');' +
    's.className=\'embed-icon-fallback\';s.textContent=\'!\';' +
    's.title=\'Failed: \'+this.src;this.replaceWith(s);">';

  function prose(lines) {
    const out = [], p = [], q = [], ul = [];
    const fp = () => { if (p.length) { out.push('<p>' + inl(p.join(' ')) + '</p>'); p.length = 0; } };
    const fq = () => { if (q.length) { out.push('<blockquote>' + prose(q) + '</blockquote>'); q.length = 0; } };
    const fu = () => { if (ul.length) { out.push('<ul>' + ul.map(x => '<li>' + inl(x) + '</li>').join('') + '</ul>'); ul.length = 0; } };
    for (const ln of lines) {
      const m = ln.match(/^\s*>\s?(.*)/);
      if (m) { fp(); fu(); q.push(m[1]); continue; }
      const b = ln.match(/^\s*[-*]\s+(.*)$/);
      if (b) { fp(); fq(); ul.push(b[1]); continue; }
      fq(); fu();
      if (!ln.trim()) { fp(); continue; }
      p.push(ln.trim());
    }
    fp(); fq(); fu();
    return out.join('');
  }

  let txt;
  try {
    txt = await (await fetch(src)).text();
  } catch (e) {
    mount.innerHTML = '<div class="card"><p>Cannot load <code>' + esc(src) +
      '</code>. Serve with a local server (e.g. <code>python3 -m http.server</code>).</p></div>';
    return;
  }

  const lines = txt.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let buf = [], mode = null, a = {};

  function extractButtons(arr) {
    const btns = [], rest = [];
    for (const l of arr) {
      const m = l.match(/^\s*\[button((?:\s+\w+\s*=\s*"[^"]*")*)\s*\]\s*$/);
      if (m) btns.push(attrs(m[1]));
      else rest.push(l);
    }
    return { btns, rest };
  }

  function actionsHtml(list) {
    if (!list.length) return '';
    return '<div class="embed-actions">' + list.join('') + '</div>';
  }

  function flush() {
    if (!mode) {
      if (buf.length) {
        const { rest } = extractButtons(buf);
        const body = prose(rest.splice(0));
        if (body) html.push('<div class="prose">' + body + '</div>');
      }
      buf = []; a = {};
      return;
    }

    const { btns: inlineBtns, rest } = extractButtons(buf);
    const body = prose(rest);

    const btnParts = [];
    if (a.button)  btnParts.push(btnEl(a.button,  a.url));
    if (a.button2) btnParts.push(btnEl(a.button2, a.url2, 'ghost'));
    for (const b of inlineBtns) {
      const el = btnEl(b.text, b.url, b.style);
      if (el) btnParts.push(el);
    }
    const actions = actionsHtml(btnParts);

    if (mode === 'embed') {
      const inner = [];
      if (a.icon || a.title) {
        const head = [];
        const ic = iconEl(a.icon, a.iconAlt, 'embed-icon');
        if (ic) head.push(ic);
        if (a.title) head.push('<h3 class="embed-title">' + inl(a.title) + '</h3>');
        if (head.length) inner.push('<header class="embed-head">' + head.join('') + '</header>');
      }
      const descIcon = iconEl(a.descIcon, a.descIconAlt, 'embed-icon-sm');
      if (descIcon) inner.push(descIcon);

      const desc = body || (a.description ? prose([a.description]) : '');
      if (desc) inner.push('<div class="embed-body">' + desc + '</div>');
      if (actions) inner.push(actions);
      if (a.footer) inner.push('<footer class="embed-foot">' + inl(a.footer) + '</footer>');

      if (inner.length) html.push('<article class="embed">' + inner.join('') + '</article>');
    } else if (mode === 'card') {
      const inner = [];
      if (a.title) inner.push('<h2 class="section-title">' + inl(a.title) + '</h2>');
      const innerBody = body || (a.text ? prose([a.text]) : (a.description ? prose([a.description]) : ''));
      if (innerBody) inner.push('<div class="prose">' + innerBody + '</div>');
      if (actions) inner.push(actions);
      if (inner.length) html.push('<section class="card">' + inner.join('') + '</section>');
    }

    buf = []; mode = null; a = {};
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    const btnLine = line.match(/^\s*\[button((?:\s+\w+\s*=\s*"[^"]*")*)\s*\]\s*$/);
    if (btnLine && !mode) {
      flush();
      const ba = attrs(btnLine[1]);
      const b = btnEl(ba.text, ba.url, ba.style);
      if (b) html.push('<div class="embed-actions">' + b + '</div>');
      continue;
    }

    const open = line.match(/^\s*\[(embed|card)((?:\s+\w+\s*=\s*"[^"]*")*)\s*\]\s*$/);
    if (open) { flush(); mode = open[1]; a = attrs(open[2]); continue; }

    const close = line.match(/^\s*\[\/(embed|card)\]\s*$/);
    if (close) { flush(); continue; }

    if (!mode) {
      const h = line.match(/^#\s+(.+)$/);
      if (h) { flush(); html.push('<h2 class="section-title">' + inl(h[1]) + '</h2>'); continue; }
    }

    buf.push(raw);
  }
  flush();

  mount.innerHTML = html.join('\n');
})();