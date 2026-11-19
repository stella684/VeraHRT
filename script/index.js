document.getElementById('year').textContent = new Date().getFullYear();

const modal = document.getElementById('qrModal');
const openBtn = document.getElementById('openQrModal');
const closeBtn = document.getElementById('closeModalBtn');

openBtn.addEventListener('click', () => modal.showModal());
closeBtn.addEventListener('click', () => modal.close());

modal.addEventListener('click', (e) => {
  const d = modal.getBoundingClientRect();
  if (e.clientX < d.left || e.clientX > d.right || e.clientY < d.top || e.clientY > d.bottom) {
    modal.close();
  }
});

document.getElementById('copyBtn').addEventListener('click', async function() {
  const text = this.dataset.copy;
  const original = this.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e2) {}
    document.body.removeChild(ta);
  }
  this.textContent = 'Copied ✓';
  this.style.background = '#10b981';
  setTimeout(() => {
    this.textContent = original;
    this.style.background = '';
  }, 1600);
});