document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti agli elementi del DOM
    const menuContainer = document.getElementById('menu-container');
    const quizContainer = document.getElementById('quiz-container');
    const resultsContainer = document.getElementById('results-container');
    const historyContainer = document.getElementById('history-container');
    const numQuestionsInput = document.getElementById('num-questions');
    
    // Riferimenti statici per pulsanti
    const viewHistoryBtn = document.getElementById('view-history-btn');
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
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Carica il file JSON con tutte le domande
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

    // Inizia un quiz specifico
    function startQuiz(testId) {
        currentTestId = testId;
        const questionPool = allQuestionsData[testId].filter(q => q.type !== 'header');
        
        if (testId === 'test3') {
            currentTestQuestions = questionPool; // Il Test 3 usa tutte le domande, non è casuale
        } else {
            const numQuestionsToSelect = parseInt(numQuestionsInput.value, 10);
            const maxQuestions = questionPool.length;
            if (numQuestionsToSelect > maxQuestions || numQuestionsToSelect < 1) {
                alert(`Per favore, scegli un numero di domande tra 1 e ${maxQuestions}.`);
                return;
            }
            const shuffledQuestions = shuffleArray([...questionPool]);
            currentTestQuestions = shuffledQuestions.slice(0, numQuestionsToSelect);
        }
        
        const testTitleText = document.querySelector(`[data-testid="${testId}"]`).textContent;
        renderQuizUI(testTitleText);

        menuContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        historyContainer.classList.add('d-none');
        quizContainer.classList.remove('d-none');
    }

    // Renderizza l'interfaccia del quiz
    function renderQuizUI(title) {
        const quizHeaderHTML = `
            <div class="card-body p-md-5 p-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2 class="text-primary m-0">${title}</h2>
                    <button id="back-to-menu-during-quiz-btn" class="btn btn-sm btn-outline-secondary">Torna al Menù</button>
                </div>
                <div id="progress-container" class="mb-4">
                    <p id="progress-text" class="mb-1 text-center"></p>
                    <div class="progress" style="height: 10px;">
                        <div id="progress-bar-inner" class="progress-bar" role="progressbar"></div>
                    </div>
                </div>
                <form id="quiz-form"></form>
                <div class="d-grid mt-4">
                    <button id="submit-btn" class="btn btn-lg btn-warning">Verifica le Risposte</button>
                </div>
            </div>`;
            
        quizContainer.innerHTML = quizHeaderHTML;
        
        renderQuestions();

        // Aggiungi event listener dopo aver creato gli elementi
        quizContainer.querySelector('#back-to-menu-during-quiz-btn').addEventListener('click', handleBackToMenuDuringQuiz);
        quizContainer.querySelector('#submit-btn').addEventListener('click', handleSubmit);
        quizContainer.querySelector('#quiz-form').addEventListener('change', updateProgress);
        quizContainer.querySelector('#quiz-form').addEventListener('keyup', updateProgress);
        updateProgress();
    }

    // Renderizza le domande nel form
    function renderQuestions() {
        const quizForm = quizContainer.querySelector('#quiz-form');
        let formHTML = '';
        let questionCounter = 0;
        
        // Se il test è casuale non ha senso mantenere i titoli di sezione
        const questionsToRender = currentTestId === 'test3' ? allQuestionsData.test3 : currentTestQuestions;

        questionsToRender.forEach((q, index) => {
            if (q.type === 'header') {
                formHTML += `<h3 class="section-header">${q.text}</h3>`;
                return;
            }
            questionCounter++;
            const originalIndex = allQuestionsData[currentTestId].indexOf(q); // Mantiene riferimento all'indice originale

            formHTML += `<div class="question-block" id="q-block-${originalIndex}"><p class="question-text">${questionCounter}. ${q.question}</p><div class="options-container">`;
            
            switch (q.type) {
                case 'multiple_choice':
                case 'true_false':
                    const options = q.type === 'true_false' ? ['Vero', 'Falso'] : q.options;
                    options.forEach(option => {
                        const optionId = `q-${originalIndex}-${option.replace(/[^a-zA-Z0-9]/g, '')}`;
                        const optionValue = q.type === 'true_false' ? (option === 'Vero' ? 'true' : 'false') : option;
                        formHTML += `
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="q-${originalIndex}" id="${optionId}" value="${optionValue}" required>
                                <label class="form-check-label" for="${optionId}">${option}</label>
                            </div>`;
                    });
                    break;
                case 'short_answer':
                    formHTML += `<input type="text" class="form-control" name="q-${originalIndex}" placeholder="La tua risposta..." required>`;
                    break;
                case 'open_ended':
                    formHTML += `<textarea class="form-control" name="q-${originalIndex}" rows="4" placeholder="Spiega con parole tue..."></textarea>`;
                    break;
            }
            formHTML += '</div></div>';
        });
        quizForm.innerHTML = formHTML;
    }
    
    // Aggiorna la barra di progresso
    function updateProgress() {
        const totalQuestions = currentTestQuestions.length;
        const quizForm = quizContainer.querySelector('#quiz-form');
        const inputs = quizForm.querySelectorAll('input[type=text], input[type=radio], textarea');
        const answeredNames = new Set();
        
        inputs.forEach(input => {
            if ((input.type === 'radio' && input.checked) || (input.type !== 'radio' && input.value.trim() !== '')) {
                answeredNames.add(input.name);
            }
        });
        
        const answeredCount = answeredNames.size;
        quizContainer.querySelector('#progress-text').textContent = `Domande risposte: ${answeredCount} di ${totalQuestions}`;
        const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
        quizContainer.querySelector('#progress-bar-inner').style.width = `${progressPercentage}%`;
    }

    // Gestisce l'invio e la correzione
    function handleSubmit(e) {
        e.preventDefault();
        let score = 0;
        let resultsHTML = '';
        let questionCounter = 0;

        const gradableCount = currentTestQuestions.filter(q => q.type !== 'open_ended').length;

        currentTestQuestions.forEach((q, index) => {
            questionCounter++;
            const originalIndex = allQuestionsData[currentTestId].indexOf(q);
            const inputElement = document.querySelector(`[name="q-${originalIndex}"]:checked`) || document.querySelector(`[name="q-${originalIndex}"]`);
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
        
        // Salva il risultato solo se il test è valutabile
        if (gradableCount > 0) {
            saveResult(currentTestId, score, gradableCount);
        }

        const resultsPageHTML = `
            <div class="card-body p-md-5 p-4">
                <h2 id="results-title" class="text-center">${quizContainer.querySelector('h2').textContent} - Risultati</h2>
                <p id="score-text" class="text-center display-5 fw-bold my-4">${score} / ${gradableCount}</p>
                <div id="results-details" class="mt-4">${resultsHTML}</div>
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
                const canvasId = `chart-${testId}`;
                testHTML += `<div class="history-chart-container"><canvas id="${canvasId}"></canvas></div>`;
                testHTML += `
                    <table class="table table-striped table-hover history-table">
                        <thead><tr><th>Data</th><th>Punteggio</th><th>Percentuale</th></tr></thead>
                        <tbody>`;
                [...testHistory].reverse().slice(0, 10).forEach(result => { // Mostra solo gli ultimi 10 risultati
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
            testHTML += '</div><hr>';
            historyContent.innerHTML += testHTML;
        });

        Object.keys(history).forEach(testId => {
            if (history[testId] && history[testId].length > 0) {
                renderChart(testId, history[testId]);
            }
        });
    }

    function renderChart(testId, data) {
        const canvas = document.getElementById(`chart-${testId}`);
        if (!canvas) return;

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
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
    }

    function clearHistory() {
        if (confirm("Sei sicuro di voler cancellare TUTTO lo storico dei risultati? L'azione è irreversibile.")) {
            localStorage.removeItem('quizHistory');
            viewHistory();
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
    viewHistoryBtn.addEventListener('click', viewHistory);
    clearHistoryBtn.addEventListener('click', clearHistory);
    backToMenuFromHistoryBtn.addEventListener('click', resetToMenu);

    fetchQuestions();
});
