/**
 * app.js – Shared JS for the ArticleBot dashboard.
 * Handles the "Generate Article" modal that lives in base.html.
 */

let _genJobId = null;
let _genPollTimer = null;

async function startGeneration() {
  const topic = document.getElementById('genTopic').value.trim();
  if (!topic) { alert('Please enter a topic.'); return; }

  const btn = document.getElementById('genSubmitBtn');
  const statusDiv = document.getElementById('genStatus');
  const statusMsg = document.getElementById('genStatusMsg');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Starting…';
  statusDiv.classList.remove('d-none');
  statusMsg.textContent = 'Researching Reddit & X/Twitter…';

  const payload = {
    topic,
    tone: document.getElementById('genTone').value,
    image_provider: document.getElementById('genImageProvider').value,
    country: document.getElementById('genCountry').value,
    language: document.getElementById('genLang').value,
    category: document.getElementById('genCategory').value,
  };

  try {
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'Unknown error');

    _genJobId = data.job_id;
    statusMsg.textContent = 'Writing article with GPT-4o… (~45s)';
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Generating…';

    // Poll for completion
    _genPollTimer = setInterval(_pollGenJob, 4000);
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-lightning-charge"></i> Generate';
    statusMsg.textContent = 'Error: ' + err.message;
    statusDiv.querySelector('div').className = 'd-flex align-items-center gap-2 text-danger';
  }
}

async function _pollGenJob() {
  if (!_genJobId) return;
  try {
    const r = await fetch(`/api/jobs/${_genJobId}`);
    const job = await r.json();

    const statusMsg = document.getElementById('genStatusMsg');

    if (job.status === 'completed') {
      clearInterval(_genPollTimer);
      statusMsg.textContent = 'Done! Redirecting to editor…';
      setTimeout(() => {
        if (job.article_id) {
          location.href = `/articles/${job.article_id}/edit`;
        } else {
          location.reload();
        }
      }, 800);
    } else if (job.status === 'failed') {
      clearInterval(_genPollTimer);
      const statusDiv = document.getElementById('genStatus');
      statusDiv.querySelector('div').className = 'd-flex align-items-center gap-2 text-danger';
      statusMsg.textContent = 'Generation failed: ' + (job.error || 'Unknown error');
      document.getElementById('genSubmitBtn').disabled = false;
      document.getElementById('genSubmitBtn').innerHTML = '<i class="bi bi-lightning-charge"></i> Retry';
    } else {
      // Still running — update message based on elapsed time
      const elapsed = (Date.now() - new Date(job.created_at).getTime()) / 1000;
      if (elapsed < 20) statusMsg.textContent = 'Researching Reddit & X/Twitter…';
      else if (elapsed < 50) statusMsg.textContent = 'Writing article with GPT-4o…';
      else statusMsg.textContent = 'Generating featured image…';
    }
  } catch (e) {
    // Network hiccup – keep polling
  }
}

// Reset modal state when closed
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('generateModal');
  if (!modal) return;
  modal.addEventListener('hidden.bs.modal', () => {
    clearInterval(_genPollTimer);
    _genJobId = null;
    document.getElementById('genTopic').value = '';
    document.getElementById('genSubmitBtn').disabled = false;
    document.getElementById('genSubmitBtn').innerHTML = '<i class="bi bi-lightning-charge"></i> Generate';
    document.getElementById('genStatus').classList.add('d-none');
    const statusDiv = document.getElementById('genStatus');
    statusDiv.querySelector('div').className = 'd-flex align-items-center gap-2 text-info';
  });
});
