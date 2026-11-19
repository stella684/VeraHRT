let pages = [];
let navPages = [];
let currentNavIndex = 0;

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');
const sidebarNav = document.getElementById('sidebarNav');
const loader = document.getElementById('loader');
const pageContainer = document.getElementById('pageContainer');

function toggleSidebar(open) {
  if (open) {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('open');
  } else {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
  }
}
menuBtn.addEventListener('click', () => toggleSidebar(true));
closeBtn.addEventListener('click', () => toggleSidebar(false));
sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

function inline(s) {
  return s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function parseChartCells(str) {
  const cells = [];
  let cur = '', inQ = false;
  for (const ch of str) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function formatContent(raw) {
  const re = /(```[\s\S]*?```|image\[[\s\S]*?\]|#text\[[\s\S]*?\]|chart_title\[[\s\S]*?\]|chart_content\[[\s\S]*?\])/g;
  const chunks = raw.split(re);

  let html = '';
  let quote = [];
  let chart = null;

  const flushQuote = () => {
    if (quote.length) { html += `<blockquote>${quote.join('<br>')}</blockquote>`; quote = []; }
  };

  const flushChart = () => {
    if (!chart) return;
    if (!chart.titles.length && !chart.rows.length) { chart = null; return; }

    const cols = Math.max(chart.titles.length, ...chart.rows.map(r => r.length), 1);

    let c = `<div class="chart-card"><div class="chart-grid" style="--cols:${cols}">`;

    if (chart.titles.length) {
      for (let i = 0; i < cols; i++) {
        c += `<div class="chart-head">${chart.titles[i] ? inline(chart.titles[i]) : ''}</div>`;
      }
    }

    chart.rows.forEach(row => {
      for (let i = 0; i < cols; i++) {
        c += `<div class="chart-cell">${row[i] ? inline(row[i]) : ''}</div>`;
      }
    });

    c += `</div></div>`;
    html += c;
    chart = null;
  };

  for (const chunk of chunks) {
    if (!chunk) continue;
    let m;

    if ((m = chunk.match(/^```([\s\S]*?)```$/))) {
      flushQuote(); flushChart();
      const escaped = m[1].trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += `<pre><code>${escaped}</code></pre>`;
    }
    else if ((m = chunk.match(/^image\[\s*([\s\S]*?)\s*\]$/))) {
      flushQuote(); flushChart();
      const src = m[1]
        .replace(/\n/g, ' ')
        .trim()
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      if (src) {
        const alt = src.replace(/\.[a-z0-9]+$/i, '');
        html += `<img src="${src}" alt="${alt}" class="md-image" loading="lazy" />`;
      }
    }
    else if ((m = chunk.match(/^#text\[\s*([\s\S]*?)\s*\]$/))) {
      flushQuote(); flushChart();
      html += `<div class="md-title"><span>${inline(m[1].replace(/\n/g, ' '))}</span></div>`;
    }
    else if ((m = chunk.match(/^chart_title\[\s*([\s\S]*?)\s*\]$/))) {
      flushQuote();
      if (!chart) chart = { titles: [], rows: [] };
      chart.titles.push(...parseChartCells(m[1].replace(/\n/g, ' ')));
    }
    else if ((m = chunk.match(/^chart_content\[\s*([\s\S]*?)\s*\]$/))) {
      flushQuote();
      if (!chart) chart = { titles: [], rows: [] };
      chart.rows.push(parseChartCells(m[1].replace(/\n/g, ' ')));
    }
    else {
      flushQuote(); flushChart();
      const lines = chunk.split('\n');
      let para = [];
      const flushPara = () => {
        if (para.length) { html += `<p>${para.join('<br>')}</p>`; para = []; }
      };

      for (let line of lines) {
        const t = line.trim();
        let sm;

        if ((sm = t.match(/^-#\s+(.*)$/))) {
          flushPara(); flushQuote();
          html += `<div class="md-small">${inline(sm[1])}</div>`;
        }
        else if (/^>\s?/.test(t)) {
          flushPara();
          quote.push(inline(t.replace(/^>\s?/, '')));
        }
        else if (t === '') {
          flushPara(); flushQuote();
        }
        else {
          flushQuote();
          para.push(inline(t));
        }
      }
      flushPara();
    }
  }

  flushQuote(); flushChart();
  return html;
}

async function fetchPages() {
  let i = 1;
  while (true) {
    try {
      const res = await fetch(`txt/txt${i}.txt`);
      if (!res.ok) break;

      const rawText = await res.text();

      const titleMatch = rawText.match(/\[title:(.*?)\]/);
      const cataMatch = rawText.match(/\[cata:(.*?)\]/);

      const title = titleMatch ? titleMatch[1].trim() : `Page ${i}`;
      const cata = cataMatch ? cataMatch[1].trim() : 'Uncategorized';

      let content = rawText.replace(/\[title:.*?\]/g, '').replace(/\[cata:.*?\]/g, '').trim();
      content = formatContent(content);

      pages.push({ id: i, title, cata, content });
      i++;
    } catch (err) {
      console.error("Stopped fetching at txt" + i + ".txt");
      break;
    }
  }

  if (pages.length > 0) {
    buildSidebar();
    loader.style.display = 'none';
    pageContainer.style.display = 'block';
    loadPageByNavIndex(0);
  } else {
    loader.innerHTML = '<p>No pages found. Check your txt/ folder.</p>';
  }
}

function buildSidebar() {
  const categories = {};
  pages.forEach((page, index) => {
    if (!categories[page.cata]) categories[page.cata] = [];
    categories[page.cata].push({ ...page, originalIndex: index });
  });

  navPages = [];
  sidebarNav.innerHTML = '';

  for (const [cataName, cataPages] of Object.entries(categories)) {
    const catDiv = document.createElement('div');
    catDiv.className = 'nav-category';
    catDiv.innerHTML = `<div class="nav-category-title">${cataName}</div>`;

    cataPages.forEach(page => {
      const navIndex = navPages.length;
      navPages.push(page);

      const link = document.createElement('a');
      link.className = `nav-link`;
      link.textContent = page.title;
      link.dataset.navIndex = navIndex;

      link.addEventListener('click', (e) => {
        e.preventDefault();
        loadPageByNavIndex(navIndex);
        if (window.innerWidth < 900) toggleSidebar(false);
      });

      catDiv.appendChild(link);
    });
    sidebarNav.appendChild(catDiv);
  }
}

function loadPageByNavIndex(navIndex) {
  if (navIndex < 0 || navIndex >= navPages.length) return;

  currentNavIndex = navIndex;
  const page = navPages[navIndex];

  document.getElementById('pageCat').textContent = page.cata;
  document.getElementById('pageTitle').textContent = page.title;
  document.getElementById('pageBody').innerHTML = page.content;

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (parseInt(link.dataset.navIndex) === navIndex) link.classList.add('active');
  });

  document.getElementById('prevBtn').disabled = (navIndex === 0);
  document.getElementById('nextBtn').disabled = (navIndex === navPages.length - 1);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('prevBtn').addEventListener('click', () => {
  if (currentNavIndex > 0) loadPageByNavIndex(currentNavIndex - 1);
});

document.getElementById('nextBtn').addEventListener('click', () => {
  if (currentNavIndex < navPages.length - 1) loadPageByNavIndex(currentNavIndex + 1);
});

fetchPages();