document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti agli elementi del DOM
    const menuContainer = document.getElementById('menu-container');
    const quizContainer = document.getElementById('quiz-container');
    const resultsContainer = document.getElementById('results-container');
    
    const quizTitle = document.getElementById('quiz-title');
    const quizForm = document.getElementById('quiz-form');
    
    const progressText = document.getElementById('progress-text');
    const progressBarInner = document.getElementById('progress-bar-inner');
    
    const submitBtn = document.getElementById('submit-btn');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    
    const resultsTitle = document.getElementById('results-title');
    const scoreText = document.getElementById('score-text');
    const resultsDetails = document.getElementById('results-details');

    let allQuestionsData = {};
    let currentTestId = '';
    let currentTestQuestions = [];
    let gradableQuestionsCount = 0;

    // Carica il file JSON
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

    // Inizia un quiz
    function startQuiz(testId) {
        currentTestId = testId;
        currentTestQuestions = allQuestionsData[testId];
        gradableQuestionsCount = currentTestQuestions.filter(q => q.type !== 'header' && q.type !== 'open_ended').length;
        
        quizTitle.textContent = currentTestQuestions.find(q => q.type === 'header').text || `Test`;
        renderQuestions();

        menuContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        quizContainer.classList.remove('d-none');
        updateProgress();
    }

    // Renderizza le domande
    function renderQuestions() {
        let formHTML = '';
        currentTestQuestions.forEach((q, index) => {
            if (q.type === 'header') {
                formHTML += `<h3 class="section-header">${q.text}</h3>`;
                return;
            }

            formHTML += `<div class="question-block" id="q-block-${index}"><p class="question-text">${q.question}</p><div class="options-container">`;
            
            switch (q.type) {
                case 'multiple_choice':
                case 'true_false':
                    const options = q.type === 'true_false' ? ['Vero', 'Falso'] : q.options;
                    options.forEach(option => {
                        const optionId = `q-${index}-${option.replace(/[^a-zA-Z0-9]/g, '')}`;
                        const optionValue = q.type === 'true_false' ? (option === 'Vero' ? 'true' : 'false') : option;
                        formHTML += `
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="q-${index}" id="${optionId}" value="${optionValue}" required>
                                <label class="form-check-label" for="${optionId}">${option}</label>
                            </div>
                        `;
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
        quizForm.addEventListener('change', updateProgress);
    }
    
    // Aggiorna la barra di progresso
    function updateProgress() {
        const totalQuestions = currentTestQuestions.filter(q => q.type !== 'header').length;
        const answeredInputs = quizForm.querySelectorAll('input:checked, input[type=text]:not(:placeholder-shown), textarea:not(:placeholder-shown)');
        const answeredQuestions = new Set(Array.from(answeredInputs).map(el => el.name)).size;
        
        progressText.textContent = `Domanda ${answeredQuestions} di ${totalQuestions}`;
        const progressPercentage = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
        progressBarInner.style.width = `${progressPercentage}%`;
    }

    // Gestisce l'invio e la correzione
    function handleSubmit(e) {
        e.preventDefault();
        let score = 0;
        let resultsHTML = '';

        currentTestQuestions.forEach((q, index) => {
            if (q.type === 'header') return;

            const inputElement = document.querySelector(`[name="q-${index}"]:checked`) || document.querySelector(`[name="q-${index}"]`);
            const userAnswer = inputElement ? inputElement.value.trim() : "";

            let isCorrect = false;
            let resultClass = 'open';
            
            if (q.type !== 'open_ended') {
                isCorrect = userAnswer.toLowerCase() === q.answer.toString().toLowerCase();
                if (isCorrect) {
                    score++;
                    resultClass = 'correct';
                } else {
                    resultClass = 'incorrect';
                }
            }

            resultsHTML += `
                <div class="result-item ${resultClass}">
                    <p class="result-question">${q.question}</p>
                    <p><strong>La tua risposta:</strong> ${userAnswer || "<em>Nessuna risposta</em>"}</p>
                    <p class="result-explanation"><strong>Spiegazione:</strong> ${q.explanation || q.model_answer}</p>
                </div>
            `;
        });

        resultsTitle.textContent = `Risultati - ${quizTitle.textContent}`;
        scoreText.textContent = `${score} / ${gradableQuestionsCount}`;
        resultsDetails.innerHTML = resultsHTML;

        quizContainer.classList.add('d-none');
        resultsContainer.classList.remove('d-none');
    }

    function resetToMenu() {
        resultsContainer.classList.add('d-none');
        menuContainer.classList.remove('d-none');
    }
    
    // Event Listeners
    submitBtn.addEventListener('click', handleSubmit);
    backToMenuBtn.addEventListener('click', resetToMenu);

    fetchQuestions();
});