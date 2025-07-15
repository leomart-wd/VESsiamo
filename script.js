document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti agli elementi del DOM
    const menuContainer = document.getElementById('menu-container');
    const quizContainer = document.getElementById('quiz-container');
    const resultsContainer = document.getElementById('results-container');
    const numQuestionsInput = document.getElementById('num-questions');
    
    const quizTitle = document.getElementById('quiz-title');
    const quizForm = document.getElementById('quiz-form');
    
    const progressText = document.getElementById('progress-text');
    const progressBarInner = document.getElementById('progress-bar-inner');
    
    const submitBtn = document.getElementById('submit-btn');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const backToMenuDuringQuizBtn = document.getElementById('back-to-menu-during-quiz-btn'); // NUOVO RIFERIMENTO
    
    const resultsTitle = document.getElementById('results-title');
    const scoreText = document.getElementById('score-text');
    const resultsDetails = document.getElementById('results-details');

    let allQuestionsData = {};
    let currentTestQuestions = [];
    let gradableQuestionsCount = 0;

    // Funzione per mescolare un array (algoritmo di Fisher-Yates)
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
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
        const questionPool = allQuestionsData[testId];
        
        if (testId === 'test3') {
            currentTestQuestions = questionPool;
        } else {
            const numQuestionsToSelect = parseInt(numQuestionsInput.value, 10);
            if (numQuestionsToSelect > questionPool.length || numQuestionsToSelect < 1) {
                alert(`Per favore, scegli un numero di domande tra 1 e ${questionPool.length}.`);
                return;
            }
            const shuffledQuestions = shuffleArray([...questionPool]);
            currentTestQuestions = shuffledQuestions.slice(0, numQuestionsToSelect);
        }
        
        gradableQuestionsCount = currentTestQuestions.filter(q => q.type !== 'open_ended' && q.type !== 'header').length;
        
        quizTitle.textContent = document.querySelector(`[data-testid="${testId}"]`).textContent;
        renderQuestions();

        menuContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        quizContainer.classList.remove('d-none');
        updateProgress();
    }

    function renderQuestions() {
        let formHTML = '';
        let questionCounter = 0;
        currentTestQuestions.forEach((q, index) => {
            if (q.type === 'header') {
                formHTML += `<h3 class="section-header">${q.text}</h3>`;
                return;
            }
            questionCounter++;
            formHTML += `<div class="question-block" id="q-block-${index}"><p class="question-text">${questionCounter}. ${q.question}</p><div class="options-container">`;
            
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
        quizForm.addEventListener('keyup', updateProgress);
    }
    
    function updateProgress() {
        const totalQuestions = currentTestQuestions.filter(q => q.type !== 'header').length;
        const inputs = quizForm.querySelectorAll('input[type=text], input[type=radio], textarea');
        const answeredNames = new Set();
        
        inputs.forEach(input => {
            if ((input.type === 'radio' && input.checked) || (input.type !== 'radio' && input.value.trim() !== '')) {
                answeredNames.add(input.name);
            }
        });
        
        const answeredCount = answeredNames.size;
        progressText.textContent = `Domande risposte: ${answeredCount} di ${totalQuestions}`;
        const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
        progressBarInner.style.width = `${progressPercentage}%`;
    }

    function handleSubmit(e) {
        e.preventDefault();
        let score = 0;
        let resultsHTML = '';
        let questionCounter = 0;

        currentTestQuestions.forEach((q, index) => {
            if (q.type === 'header') return;
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
        quizContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        menuContainer.classList.remove('d-none');
        quizForm.reset();
    }
    
    // NUOVA FUNZIONE PER LA CONFERMA
    function handleBackToMenuDuringQuiz() {
        const userConfirmed = confirm("Sei sicura/o di voler tornare al menù principale? Perderai tutti i progressi di questo test.");
        if (userConfirmed) {
            resetToMenu();
        }
    }

    // Event Listeners
    submitBtn.addEventListener('click', handleSubmit);
    backToMenuBtn.addEventListener('click', resetToMenu);
    backToMenuDuringQuizBtn.addEventListener('click', handleBackToMenuDuringQuiz); // NUOVO EVENT LISTENER

    fetchQuestions();
});
