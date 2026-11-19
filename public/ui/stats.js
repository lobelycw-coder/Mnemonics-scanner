const POINTS = 60;

export function createStats() {
  const canvas = document.getElementById('spark');
  const ctx = canvas.getContext('2d');
  const series = new Array(POINTS).fill(0);
  const els = {
    scanned: document.getElementById('s-scanned'),
    rate: document.getElementById('s-rate'),
    hits: document.getElementById('s-hits'),
  };

  function draw() {
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(1, ...series);
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#5ef2a4';
    series.forEach((v, i) => {
      const x = (i / (POINTS - 1)) * w;
      const y = h - (v / max) * (h - 6) - 3;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }

  return {
    update(s) {
      els.scanned.textContent = s.scanned.toLocaleString();
      els.rate.textContent = s.rate.toLocaleString();
      els.hits.textContent = s.dbHits.toLocaleString();
      series.push(s.rate);
      series.shift();
      draw();
    },
    bumpHits(n) { els.hits.textContent = n.toLocaleString(); },
  };
}