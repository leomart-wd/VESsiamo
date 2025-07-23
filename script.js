
document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti agli elementi del DOM
    const menuContainer = document.getElementById('menu-container');
    const quizContainer = document.getElementById('quiz-container');
    const resultsContainer = document.getElementById('results-container');
    const historyContainer = document.getElementById('history-container');
    const numQuestionsInput = document.getElementById('num-questions');
    const viewHistoryBtn = document.getElementById('view-history-btn');
    const backToMenuFromHistoryBtn = document.getElementById('back-to-menu-from-history-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const historyContent = document.getElementById('history-content');
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const searchOverlay = document.getElementById('search-overlay');
    const searchCloseBtn = document.getElementById('search-close-btn');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const tutorButton = document.getElementById('tutor-button');
    let reflectionModal;

    let allQuestionsData = {};
    let searchIndex = [];
    let currentTestId = '';
    let currentTestQuestions = [];
    let chartInstances = {};

    function shuffleArray(array) { /* ... (codice invariato) ... */ }
    async function initializeApp() { /* ... (codice invariato con inizializzazione modale) ... */ }
    function buildSearchIndex() { /* ... (codice invariato) ... */ }

    function startQuiz(testId) {
        currentTestId = testId;
        const questionPool = allQuestionsData[testId].filter(q => q.type !== 'header');
        
        const isRandomTest = (testId === 'test1' || testId === 'test2' || testId === 'test5');
        if (isRandomTest) {
            const numQuestionsToSelect = parseInt(numQuestionsInput.value, 10);
            const maxQuestions = questionPool.length;
            if (numQuestionsToSelect > maxQuestions || numQuestionsToSelect < 5) {
                alert(`Per favore, scegli un numero di domande tra 5 e ${maxQuestions}.`);
                return;
            }
            const shuffledQuestions = shuffleArray([...questionPool]);
            currentTestQuestions = shuffledQuestions.slice(0, numQuestionsToSelect);
        } else {
            currentTestQuestions = questionPool; 
        }
        
        const testTitleText = document.querySelector(`[data-testid="${testId}"]`).textContent;
        renderQuizUI(testTitleText);

        menuContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        historyContainer.classList.add('d-none');
        quizContainer.classList.remove('d-none');
    }

    function renderQuizUI(title) { /* ... (codice invariato) ... */ }
    
    function renderQuestions() {
        const quizForm = quizContainer.querySelector('#quiz-form');
        let formHTML = '';
        let questionCounter = 0;
        
        currentTestQuestions.forEach((q, index) => {
            questionCounter++;
            let helpButtonHTML = '';
            if (q.reflection_prompt) {
                helpButtonHTML = `
                    <button type="button" class="help-btn" data-reflection="${q.reflection_prompt}">
                        <img src="brain-help.jpg" alt="Aiuto">
                    </button>`;
            }
            
            formHTML += `<div class="question-block" id="q-block-${index}"><p class="question-text"><span>${questionCounter}. ${q.question}</span> ${helpButtonHTML}</p><div class="options-container">`;
            
            switch (q.type) {
                case 'multiple_choice':
                case 'true_false':
                    const options = q.type === 'true_false' ? ['Vero', 'Falso'] : q.options;
                    options.forEach(option => {
                        const optionId = `q-${index}-${option.replace(/[^a-zA-Z0-9]/g, '')}`;
                        const optionValue = q.type === 'true_false' ? (option === 'Vero' ? 'true' : 'false') : option;
                        formHTML += `<div class="form-check"><input class="form-check-input" type="radio" name="q-${index}" id="${optionId}" value="${optionValue}" required><label class="form-check-label" for="${optionId}">${option}</label></div>`;
                    });
                    break;
                case 'short_answer':
                    formHTML += `<input type="text" class="form-control" name="q-${index}" placeholder="La tua risposta..." required>`;
                    break;
                case 'open_ended':
                    formHTML += `<textarea class="form-control" name="q-${index}" rows="4" placeholder="Spiega con parole tue..."></textarea>`;
                    break;
            }
            formHTML += '</div></div>';
        });
        quizForm.innerHTML = formHTML;
        updateProgress();
    }
    
    function updateProgress() { /* ... (codice invariato) ... */ }

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

            if (q.type !== 'open_ended') {
                const isCorrect = userAnswer.toLowerCase() === q.answer.toString().toLowerCase();
                let resultClass = isCorrect ? 'correct' : 'incorrect';
                if (isCorrect) score++;
                
                resultsHTML += `<div class="result-item ${resultClass}"><p class="result-question">${questionCounter}. ${q.question}</p><p><strong>La tua risposta:</strong> ${userAnswer || "<em>Nessuna risposta</em>"}</p>${!isCorrect ? `<p class="result-explanation"><strong>Spiegazione:</strong> ${q.explanation}</p>` : ''}</div>`;
            } else {
                let keywordsHTML = '';
                if (q.model_answer && q.model_answer.keywords) {
                    q.model_answer.keywords.forEach((kw, kw_index) => {
                        keywordsHTML += `<div class="form-check keyword-checklist-item"><input class="form-check-input" type="checkbox" id="kw-${index}-${kw_index}"><label class="form-check-label" for="kw-${index}-${kw_index}"><span>${kw.keyword}</span><i class="bi bi-info-circle-fill" data-bs-toggle="tooltip" data-bs-placement="top" title="${kw.explanation}"></i></label></div>`;
                    });
                }

                resultsHTML += `<div class="result-item open"><p class="result-question">${questionCounter}. ${q.question}</p><div class="row"><div class="col-md-6 mb-3 mb-md-0"><strong>La tua risposta:</strong><div class="user-answer-box">${userAnswer.replace(/</g, "<").replace(/>/g, ">") || "<em>Nessuna risposta</em>"}</div></div><div class="col-md-6"><strong>Concetti Chiave (autovalutazione):</strong><div class="keyword-summary">${q.model_answer ? q.model_answer.summary : ''}</div><div id="checklist-${index}">${keywordsHTML}</div><div class="progress mt-2" style="height: 10px;"><div class="progress-bar bg-success" id="progress-open-${index}" role="progressbar" style="width: 0%"></div></div></div></div></div>`;
            }
        });
        
        if (gradableCount > 0) {
            saveResult(currentTestId, score, gradableCount);
        }

        const scoreDisplay = gradableCount > 0 ? `${score} / ${gradableCount}` : "Test di Autovalutazione";
        const resultsPageHTML = `<div class="card-body p-md-5 p-4"><h2 class="text-center">${quizContainer.querySelector('h2').textContent} - Risultati</h2><p class="text-center display-5 fw-bold my-4">${scoreDisplay}</p><div class="mt-4">${resultsHTML}</div><div class="d-grid mt-5"><button id="back-to-menu-from-results-btn" class="btn btn-lg btn-secondary">Torna al Menù</button></div></div>`;
        
        resultsContainer.innerHTML = resultsPageHTML;
        resultsContainer.querySelector('#back-to-menu-from-results-btn').addEventListener('click', resetToMenu);

        new bootstrap.Tooltip(document.body, { selector: '[data-bs-toggle="tooltip"]', trigger: 'hover', html: true });

        currentTestQuestions.forEach((q, index) => {
            if (q.type === 'open_ended') {
                const checklist = document.getElementById(`checklist-${index}`);
                if(checklist) {
                    checklist.addEventListener('change', () => {
                        const checkboxes = checklist.querySelectorAll('input[type="checkbox"]');
                        const checkedCount = checklist.querySelectorAll('input[type="checkbox"]:checked').length;
                        const progressPercentage = (checkedCount / checkboxes.length) * 100;
                        document.getElementById(`progress-open-${index}`).style.width = `${progressPercentage}%`;
                    });
                }
            }
        });

        quizContainer.classList.add('d-none');
        resultsContainer.classList.remove('d-none');
    }

    // Le altre funzioni (saveResult, viewHistory, renderChart, clearHistory, resetToMenu, handleBackToMenuDuringQuiz) rimangono invariate.
    // ...

    // Event Listeners
    // ...
    
    initializeApp();
});