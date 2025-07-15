document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti agli elementi del DOM
    const menuContainer = document.getElementById('menu-container');
    const quizContainer = document.getElementById('quiz-container');
    const resultsContainer = document.getElementById('results-container');
    const historyContainer = document.getElementById('history-container');
    const numQuestionsInput = document.getElementById('num-questions');
    
    // Contenitori dinamici
    const quizTitle = document.createElement('h2');
    quizTitle.className = 'text-primary m-0';
    const backToMenuDuringQuizBtn = document.createElement('button');
    backToMenuDuringQuizBtn.className = 'btn btn-sm btn-outline-secondary';
    backToMenuDuringQuizBtn.textContent = 'Torna al Menù';

    const quizForm = document.createElement('form');
    const submitBtn = document.createElement('button');
    submitBtn.id = 'submit-btn';
    submitBtn.className = 'btn btn-lg btn-warning';
    submitBtn.textContent = 'Verifica le Risposte';

    // Riferimenti ai pulsanti e contenitori statici
    const viewHistoryBtn = document.getElementById('view-history-btn');
    const backToMenuBtn = document.createElement('button');
    backToMenuBtn.id = 'back-to-menu-btn';
    backToMenuBtn.className = 'btn btn-lg btn-secondary';
    backToMenuBtn.textContent = 'Torna al Menù';
    
    const backToMenuFromHistoryBtn = document.getElementById('back-to-menu-from-history-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const historyContent = document.getElementById('history-content');

    let allQuestionsData = {};
    let currentTestId = '';
    let currentTestQuestions = [];
    let chartInstances = {};

    // Funzione per mescolare un array (algoritmo di Fisher-Yates)
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async function fetchQuestions() {
        try {
            const response = await fetch('quiz.json');
            if (!response.ok) throw new Error('Network response was not ok');
            allQuestionsData = await response.json();
            document.querySelectorAll('.menu-btn').forEach(button => {
                button.addEventListener('click', () => startQuiz(button.dataset.testid));
            });
        } catch (error) {
            console.error('Failed to fetch questions:', error);
            menuContainer.innerHTML = '<h1>Errore</h1><p>Impossibile caricare il test. Riprova più tardi.</p>';
        }
    }

    function startQuiz(testId) {
        currentTestId = testId;
        const questionPool = allQuestionsData[testId];
        
        if (testId !== 'test3') {
            const numQuestionsToSelect = parseInt(numQuestionsInput.value, 10);
            const maxQuestions = questionPool.filter(q => q.type !== 'header').length;
            if (numQuestionsToSelect > maxQuestions || numQuestionsToSelect < 1) {
                alert(`Per favore, scegli un numero di domande tra 1 e ${maxQuestions}.`);
                return;
            }
            const shuffledQuestions = shuffleArray([...questionPool.filter(q => q.type !== 'header')]);
            currentTestQuestions = shuffledQuestions.slice(0, numQuestionsToSelect);
        } else {
            currentTestQuestions = questionPool.filter(q => q.type !== 'header');
        }
        
        const testTitleText = document.querySelector(`[data-testid="${testId}"]`).textContent;
        renderQuizUI(testTitleText);

        menuContainer.classList.add('d-none');
        quizContainer.classList.remove('d-none');
    }

    function renderQuizUI(title) {
        quizTitle.textContent = title;
        const quizHeader = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="text-primary m-0">${title}</h2>
                <button id="back-to-menu-during-quiz-btn" class="btn btn-sm btn-outline-secondary">Torna al Menù</button>
            </div>
            <div id="progress-container" class="mb-4">
                <p id="progress-text" class="mb-1 text-center"></p>
                <div class="progress" style="height: 10px;">
                    <div id="progress-bar-inner" class="progress-bar" role="progressbar"></div>
                </div>
            </div>`;
        
        quizForm.innerHTML = ''; // Pulisce il form
        let questionCounter = 0;
        currentTestQuestions.forEach((q, index) => {
            questionCounter++;
            let block = `<div class="question-block" id="q-block-${index}"><p class="question-text">${questionCounter}. ${q.question}</p><div class="options-container">`;
            
            switch (q.type) {
                case 'multiple_choice':
                case 'true_false':
                    const options = q.type === 'true_false' ? ['Vero', 'Falso'] : q.options;
                    options.forEach(option => {
                        const optionId = `q-${index}-${option.replace(/[^a-zA-Z0-9]/g, '')}`;
                        const optionValue = q.type === 'true_false' ? (option === 'Vero' ? 'true' : 'false') : option;
                        block += `
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="q-${index}" id="${optionId}" value="${optionValue}" required>
                                <label class="form-check-label" for="${optionId}">${option}</label>
                            </div>`;
                    });
                    break;
                case 'short_answer':
                    block += `<input type="text" class="form-control" name="q-${index}" placeholder="La tua risposta..." required>`;
                    break;
                case 'open_ended':
                    block += `<textarea class="form-control" name="q-${index}" rows="4" placeholder="Spiega con parole tue..."></textarea>`;
                    break;
            }
            block += '</div></div>';
            quizForm.innerHTML += block;
        });
        
        quizContainer.innerHTML = quizHeader;
        quizContainer.appendChild(quizForm);
        quizContainer.appendChild(document.createElement('div')).className = 'd-grid mt-4';
        quizContainer.querySelector('.d-grid').appendChild(submitBtn);

        // Aggiungi event listener dopo aver creato gli elementi
        quizContainer.querySelector('#back-to-menu-during-quiz-btn').addEventListener('click', handleBackToMenuDuringQuiz);
        quizForm.addEventListener('change', updateProgress);
        quizForm.addEventListener('keyup', updateProgress);
        updateProgress();
    }
    
    function updateProgress() {
        const totalQuestions = currentTestQuestions.length;
        const inputs = quizForm.querySelectorAll('input[type=text], input[type=radio], textarea');
        let answeredCount = 0;
        const answeredNames = new Set();
        
        inputs.forEach(input => {
            if ((input.type === 'radio' && input.checked) || (input.type !== 'radio' && input.value.trim() !== '')) {
                answeredNames.add(input.name);
            }
        });
        
        answeredCount = answeredNames.size;
        document.getElementById('progress-text').textContent = `Domande risposte: ${answeredCount} di ${totalQuestions}`;
        const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
        document.getElementById('progress-bar-inner').style.width = `${progressPercentage}%`;
    }

    function handleSubmit(e) {
        e.preventDefault();
        let score = 0;
        let resultsHTML = '';
        let questionCounter = 0;

        const gradableCount = currentTestQuestions.filter(q => q.type !== 'open_ended').length;

        currentTestQuestions.forEach((q, index) => {
            questionCounter++;
            const inputElement = document.querySelector(`[name="q-${index}"]:checked`) || document.querySelector(`[name="q-${index}"]`);
            const userAnswer = inputElement ? inputElement.value.trim() : "";

            let resultClass = 'open';
            
            if (q.type !== 'open_ended') {
                const isCorrect = userAnswer.toLowerCase() === q.answer.toString().toLowerCase();
                if (isCorrect) {
                    score++;
                    resultClass = 'correct';
                } else {
                    resultClass = 'incorrect';
                }
            }
            resultsHTML += `
                <div class="result-item ${resultClass}">
                    <p class="result-question">${questionCounter}. ${q.question}</p>
                    <p><strong>La tua risposta:</strong> ${userAnswer || "<em>Nessuna risposta</em>"}</p>
                    <p class="result-explanation"><strong>Spiegazione:</strong> ${q.explanation || q.model_answer}</p>
                </div>`;
        });
        
        // Salva il risultato
        saveResult(currentTestId, score, gradableCount);

        const resultsPageHTML = `
            <div class="card-body p-md-5 p-4">
                <h2 class="text-center">${quizTitle.textContent} - Risultati</h2>
                <p class="text-center display-5 fw-bold my-4">${score} / ${gradableCount}</p>
                <div class="mt-4">${resultsHTML}</div>
                <div class="d-grid mt-5">
                    <button id="back-to-menu-from-results-btn" class="btn btn-lg btn-secondary">Torna al Menù</button>
                </div>
            </div>`;
        
        resultsContainer.innerHTML = resultsPageHTML;
        resultsContainer.querySelector('#back-to-menu-from-results-btn').addEventListener('click', resetToMenu);

        quizContainer.classList.add('d-none');
        resultsContainer.classList.remove('d-none');
    }
    
    // --- Funzioni per lo Storico ---
    function saveResult(testId, score, total) {
        const history = JSON.parse(localStorage.getItem('quizHistory')) || {};
        if (!history[testId]) {
            history[testId] = [];
        }
        const newResult = {
            score,
            total,
            percentage: total > 0 ? Math.round((score / total) * 100) : 0,
            date: new Date().toISOString()
        };
        history[testId].push(newResult);
        localStorage.setItem('quizHistory', JSON.stringify(history));
    }

    function viewHistory() {
        menuContainer.classList.add('d-none');
        historyContainer.classList.remove('d-none');
        
        const history = JSON.parse(localStorage.getItem('quizHistory')) || {};
        historyContent.innerHTML = ''; // Pulisce il contenuto precedente

        if (Object.keys(history).length === 0) {
            historyContent.innerHTML = '<p class="text-center text-muted">Nessun risultato salvato.</p>';
            return;
        }

        Object.keys(allQuestionsData).forEach(testId => {
            const testHistory = history[testId];
            const testTitle = document.querySelector(`[data-testid="${testId}"]`).textContent;
            
            let testHTML = `<div class="mb-5"><h3>${testTitle}</h3>`;
            if (!testHistory || testHistory.length === 0) {
                testHTML += '<p class="text-muted">Nessun tentativo registrato per questo test.</p>';
            } else {
                // Grafico
                const canvasId = `chart-${testId}`;
                testHTML += `<div class="history-chart-container"><canvas id="${canvasId}"></canvas></div>`;
                // Tabella
                testHTML += `
                    <table class="table table-striped table-hover history-table">
                        <thead><tr><th>Data</th><th>Punteggio</th><th>Percentuale</th></tr></thead>
                        <tbody>`;
                [...testHistory].reverse().forEach(result => {
                    const date = new Date(result.date);
                    testHTML += `
                        <tr>
                            <td class="history-date">${date.toLocaleDateString('it-IT')} ${date.toLocaleTimeString('it-IT')}</td>
                            <td><strong>${result.score} / ${result.total}</strong></td>
                            <td>${result.percentage}%</td>
                        </tr>`;
                });
                testHTML += '</tbody></table>';
            }
            testHTML += '</div>';
            historyContent.innerHTML += testHTML;
        });

        // Renderizza i grafici dopo aver creato i canvas
        Object.keys(history).forEach(testId => {
            if (history[testId] && history[testId].length > 0) {
                renderChart(testId, history[testId]);
            }
        });
    }

    function renderChart(testId, data) {
        const canvas = document.getElementById(`chart-${testId}`);
        if (!canvas) return;

        // Se un grafico esiste già su questo canvas, distruggilo prima di crearne uno nuovo
        if (chartInstances[testId]) {
            chartInstances[testId].destroy();
        }

        const labels = data.map(r => new Date(r.date).toLocaleDateString('it-IT'));
        const percentages = data.map(r => r.percentage);

        chartInstances[testId] = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Andamento Punteggio (%)',
                    data: percentages,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    function clearHistory() {
        if (confirm("Sei sicuro di voler cancellare TUTTO lo storico dei risultati? L'azione è irreversibile.")) {
            localStorage.removeItem('quizHistory');
            viewHistory(); // Aggiorna la vista per mostrare che è vuota
        }
    }

    function resetToMenu() {
        quizContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        historyContainer.classList.add('d-none');
        menuContainer.classList.remove('d-none');
    }
    
    function handleBackToMenuDuringQuiz() {
        if (confirm("Sei sicuro di voler tornare al menù principale? Perderai tutti i progressi di questo test.")) {
            resetToMenu();
        }
    }

    // Event Listeners
    submitBtn.addEventListener('click', handleSubmit);
    viewHistoryBtn.addEventListener('click', viewHistory);
    clearHistoryBtn.addEventListener('click', clearHistory);
    backToMenuFromHistoryBtn.addEventListener('click', resetToMenu);

    fetchQuestions();
});
