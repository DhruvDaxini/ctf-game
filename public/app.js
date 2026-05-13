// ===== CTF Game — Client Logic =====

async function submitFlag() {
  const input = document.getElementById('flag-input');
  const resultEl = document.getElementById('result-msg');
  const flag = input.value.trim();

  if (!flag) {
    showResult('Please enter a flag.', false);
    return;
  }

  resultEl.textContent = '⏳ Checking...';
  resultEl.className = 'result-msg';

  try {
    const res = await fetch('/api/submit-flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag })
    });

    const data = await res.json();

    if (data.success) {
      showResult(`${data.message}  🚩 ${data.flag}`, true);
      triggerWin();
      loadScoreboard();
    } else {
      showResult(data.message, false);
    }
  } catch (err) {
    showResult('⚠️ Server error. Is the server running?', false);
  }
}

async function getHint() {
  const hintEl = document.getElementById('hint-output');
  hintEl.textContent = '⏳ Fetching hint...';

  try {
    const res = await fetch('/api/hint');
    const data = await res.json();
    hintEl.innerHTML = `
      <span style="color:#ffbd2e">${data.message}</span><br/>
      <span style="color:#888">${data.trace}</span>
    `;
  } catch (err) {
    hintEl.textContent = '⚠️ Could not fetch hint.';
  }
}

function showResult(message, success) {
  const el = document.getElementById('result-msg');
  el.textContent = message;
  el.className = 'result-msg ' + (success ? 'success' : 'error');
}

function triggerWin() {
  // Show the winner registration form
  const winnerForm = document.getElementById('winner-form');
  if (winnerForm) winnerForm.style.display = 'flex';

  // Fun matrix rain effect for 3 seconds
  document.body.style.transition = 'background 0.5s';
  document.body.style.background = '#001a00';
  setTimeout(() => {
    document.body.style.background = '#0d0d0d';
  }, 3000);
}

async function registerWinner() {
  const nameInput = document.getElementById('winner-name');
  const flagInput = document.getElementById('flag-input');
  const name = nameInput.value.trim();
  const flag = flagInput.value.trim();

  if (!name) {
    alert('Please enter your name!');
    return;
  }

  try {
    const res = await fetch('/api/winner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, flag })
    });

    const data = await res.json();
    if (data.success) {
      nameInput.value = '';
      document.getElementById('winner-form').style.display = 'none';
      loadScoreboard();
    }
  } catch (err) {
    console.error('Failed to register winner:', err);
  }
}

async function loadScoreboard() {
  const sbEl = document.getElementById('scoreboard');
  if (!sbEl) return;

  try {
    const res = await fetch('/api/scoreboard');
    const data = await res.json();

    if (!data.winners || data.winners.length === 0) {
      sbEl.innerHTML = '<p class="muted">No winners yet. Be the first!</p>';
      return;
    }

    sbEl.innerHTML = data.winners
      .map((w, i) => `<div>🥇 #${i + 1} &nbsp;<strong>${escapeHtml(w.name)}</strong> &nbsp;<span class="muted">${w.time}</span></div>`)
      .join('');
  } catch (err) {
    sbEl.innerHTML = '<p class="muted">Could not load scoreboard.</p>';
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Allow pressing Enter to submit flag
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('flag-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitFlag();
    });
  }
  loadScoreboard();
});
