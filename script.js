const quizPath = 'quiz.json';
let quizData = {};
let currentTest = '';
let questions = [];
let userAnswers = [];

async function loadQuiz() {
  const resp = await fetch(quizPath);
  quizData = await resp.json();
}

function startQuiz(testId) {
  currentTest = testId;
  questions = quizData[testId];
  userAnswers = new Array(questions.length).fill(null);
  renderQuiz();
}

function renderQuiz() {
  document.body.innerHTML = `
    <div class="container py-5">
      <h2>${document.querySelector(`[data-testid="${currentTest}"]`).textContent}</h2>
      <form id="quiz-form"></form>
      <button id="submit-btn" class="btn btn-primary mt-3">Verifica le Risposte</button>
    </div>`;
  
  const form = document.getElementById('quiz-form');
  questions.forEach((q, i) => form.insertAdjacentHTML('beforeend', renderQuestion(q, i)));

  document.getElementById('submit-btn')
    .addEventListener('click', e => { e.preventDefault(); showResults(); });
}

function renderQuestion(q, idx) {
  let html = `<div class="mb-4"><p><strong>${idx + 1}.</strong> ${q.domanda}`;
  if (q.riflessione) {
    html += ` <img src="brain-help.jpg" class="brain-help" onclick="showHelpPopup('${q.riflessione.replace(/'/g, "\\'")}')">`;
  }
  html += '</p>';
  
  if (q.tipo === 'vero_falso') {
    html += ['Vero', 'Falso'].map(v => `
      <div class="form-check">
        <input class="form-check-input" type="radio" name="q${idx}" value="${v}" />
        <label class="form-check-label">${v}</label>
      </div>`).join('');
  }
  else if (q.tipo === 'scelta_multipla') {
    Object.entries(q.opzioni).forEach(([k,v]) => {
      html += `<div class="form-check">
        <input class="form-check-input" type="radio" name="q${idx}" value="${k}" />
        <label class="form-check-label">${v}</label>
      </div>`;
    });
  }
  else if (q.tipo === 'aperta') {
    html += `<textarea class="form-control" name="q${idx}" rows="2"></textarea>`;
  }
  html += '</div>';
  return html;
}

function showHelpPopup(text) {
  const popup = document.createElement('div');
  popup.className = 'help-popup';
  popup.textContent = text;
  popup.style.opacity = '1';
  document.body.appendChild(popup);

  function removePopup() {
    popup.style.opacity = '0';
    setTimeout(() => popup.remove(), 300);
    document.removeEventListener('click', removePopup);
    document.removeEventListener('scroll', removePopup);
  }

  document.addEventListener('click', removePopup);
  document.addEventListener('scroll', removePopup);
  setTimeout(removePopup, 10000);
}

function showResults() {
  const form = document.getElementById('quiz-form');
  const results = questions.map((q, i) => {
    const input = form[`q${i}`];
    let ans = null;
    if (!input) return null;
    if (Array.isArray(input)) {
      ans = Array.from(input).find(r => r.checked)?.value;
    } else {
      ans = input.value.trim();
    }
    return ans;
  });

  const content = questions.map((q, i) => {
    const ans = results[i] || '(nessuna risposta)';
    let correct = '';
    let explanation = '';
    if (q.tipo === 'vero_falso' || q.tipo === 'scelta_multipla') {
      correct = (ans === q.risposta_corretta || ans.toLowerCase() === q.risposta_corretta.toLowerCase())
        ? '🟢 Corretto' : `🔴 Errato (risposta corretta: ${q.risposta_corretta})`;
      explanation = `<div class="mt-2 alert alert-secondary">${q.spiegazione}</div>`;
    }
    return `<div class="mb-4">
      <p><strong>${i+1}.</strong> ${q.domanda}</p>
      <p><em>La tua risposta:</em> ${ans}</p>
      <p>${correct}</p>
      ${explanation}
    </div>`;
  }).join('');

  document.body.innerHTML = `
    <div class="container py-5">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <button id="result-menu-btn" class="btn btn-secondary">Torna al menù</button>
      </div>
      <div id="results-container">${content}</div>
    </div>`;

  document.getElementById('result-menu-btn')
    .addEventListener('click', () => location.reload());

  // Pulsante Scarica PDF
  const pdfBtn = document.createElement('button');
  pdfBtn.textContent = 'Scarica PDF';
  pdfBtn.className = 'btn btn-outline-secondary ml-2';
  pdfBtn.onclick = exportToPDF;
  document.querySelector('.d-flex').appendChild(pdfBtn);
}

function exportToPDF() {
  const el = document.getElementById('results-container');
  html2pdf().from(el).set({
    margin: 0.5,
    filename: 'risultati_test.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4' }
  }).save();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadQuiz();
  document.querySelectorAll('.menu-btn').forEach(btn =>
    btn.addEventListener('click', () => startQuiz(btn.dataset.testid))
  );
});
