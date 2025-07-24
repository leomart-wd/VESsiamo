
document.addEventListener('DOMContentLoaded', () => {
    // DOM element references with null checks
    const menuContainer = document.getElementById('menu-container');
    const quizContainer = document.getElementById('quiz-container');
    const resultsContainer = document.getElementById('results-container');
    const historyContainer = document.getElementById('history-container');
    const numQuestionsInput = document.getElementById('num-questions');
    
    // Static buttons and containers
    const viewHistoryBtn = document.getElementById('view-history-btn');
    const backToMenuFromHistoryBtn = document.getElementById('back-to-menu-from-history-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const historyContent = document.getElementById('history-content');
    const homeButton = document.getElementById('home-button');
    
    // Search elements
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const searchOverlay = document.getElementById('search-overlay');
    const searchCloseBtn = document.getElementById('search-close-btn');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');

    // Tutor elements
    const tutorButton = document.getElementById('tutor-button');

    // Global state variables
    let allQuestionsData = {};
    let searchIndex = [];
    let currentTestId = '';
    let currentTestQuestions = [];
    let chartInstances = {};
    let reflectionModal = null;
    let currentQuizState = {
        options: [],
        questions: []
    };

    // Utility function to safely shuffle an array
    function shuffleArray(array) {
        if (!Array.isArray(array) || array.length === 0) return array;
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Safe string operations
    function safeString(str) {
        return (str || '').toString().trim();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize the application
    async function initializeApp() {
        try {
            console.log('Initializing application...');
            
            // Fetch quiz data
            const response = await fetch('quiz.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            allQuestionsData = await response.json();
            console.log('Quiz data loaded:', Object.keys(allQuestionsData));
            
            // Build search index
            buildSearchIndex();
            
            // Initialize Bootstrap modal with error handling
            const modalElement = document.getElementById('reflection-modal');
            if (modalElement && typeof bootstrap !== 'undefined') {
                try {
                    reflectionModal = new bootstrap.Modal(modalElement);
                } catch (modalError) {
                    console.warn('Failed to initialize Bootstrap modal:', modalError);
                }
            }

            // Initialize menu buttons with proper event handling
            initializeMenuButtons();
            
            // Initialize other event listeners
            initializeEventListeners();
            
            console.log('Application initialized successfully');

        } catch (error) {
            console.error('Failed to initialize application:', error);
            if (menuContainer) {
                menuContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <h4>Errore di Caricamento</h4>
                        <p>Impossibile caricare il test. Dettagli: ${error.message}</p>
                        <button class="btn btn-primary" onclick="location.reload()">Riprova</button>
                    </div>`;
            }
        }
    }

    // Initialize menu buttons without cloneNode
    function initializeMenuButtons() {
        const menuButtons = document.querySelectorAll('.menu-btn');
        console.log(`Found ${menuButtons.length} menu buttons`);
        
        menuButtons.forEach((button, index) => {
            const testId = button.getAttribute('data-testid');
            console.log(`Initializing button ${index}: testId=${testId}`);
            
            if (!testId) {
                console.warn('Button missing data-testid:', button);
                return;
            }

            // Remove any existing event listeners by creating a new function
            const clickHandler = (event) => {
                event.preventDefault();
                event.stopPropagation();
                console.log(`Button clicked: ${testId}`);
                startQuiz(testId);
            };

            // Add event listener
            button.addEventListener('click', clickHandler);
            
            // Store reference for cleanup if needed
            button._clickHandler = clickHandler;
        });
    }

    // Initialize all other event listeners
    function initializeEventListeners() {
        // Home button
        if (homeButton) {
            homeButton.addEventListener('click', resetToMenu);
        }

        // History buttons
        if (viewHistoryBtn) {
            viewHistoryBtn.addEventListener('click', viewHistory);
        }
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', clearHistory);
        }
        if (backToMenuFromHistoryBtn) {
            backToMenuFromHistoryBtn.addEventListener('click', resetToMenu);
        }

        // Search functionality
        if (searchToggleBtn) {
            searchToggleBtn.addEventListener('click', () => {
                if (searchOverlay) {
                    searchOverlay.classList.remove('d-none');
                    document.body.style.overflow = 'hidden';
                    if (searchInput) searchInput.focus();
                }
            });
        }
        
        if (searchCloseBtn) {
            searchCloseBtn.addEventListener('click', closeSearch);
        }
        
        if (searchInput) {
            searchInput.addEventListener('input', performSearch);
        }
        
        if (searchOverlay) {
            searchOverlay.addEventListener('click', (e) => {
                if (e.target === searchOverlay) closeSearch();
            });
        }

        // Tutor button
        if (tutorButton) {
            tutorButton.addEventListener('click', () => {
                window.open('https://chatgpt.com/g/g-68778387b31081918d876453face6087-tutor-ves', 'TutorVES', 'width=500,height=700');
            });
        }
    }

    // Build search index
    function buildSearchIndex() {
        searchIndex = [];
        
        if (!allQuestionsData || typeof allQuestionsData !== 'object') {
            console.warn('Invalid questions data for search index');
            return;
        }

        Object.keys(allQuestionsData).forEach(testId => {
            const questions = allQuestionsData[testId];
            if (!Array.isArray(questions) || questions.length === 0) return;
            
            const testTitleButton = document.querySelector(`[data-testid="${testId}"]`);
            const testTitle = testTitleButton ? safeString(testTitleButton.textContent) : 'Test Generico';
            
            questions.forEach(q => {
                if (!q || q.type === 'header') return;
                
                let answerText = '';
                if (q.type === 'open_ended' && q.model_answer) {
                    if (typeof q.model_answer === 'string') {
                        answerText = q.model_answer;
                    } else if (q.model_answer.summary) {
                        answerText = q.model_answer.summary;
                        if (q.model_answer.keywords && Array.isArray(q.model_answer.keywords)) {
                            answerText += ' ' + q.model_answer.keywords.map(kw => 
                                `${kw.keyword || ''} ${kw.explanation || ''}`
                            ).join(' ');
                        }
                    }
                } else {
                    answerText = safeString(q.explanation || q.answer);
                }
                
                searchIndex.push({
                    question: safeString(q.question),
                    text_to_search: `${safeString(q.question)} ${answerText}`.toLowerCase(),
                    explanation: answerText,
                    test: testTitle
                });
            });
        });
        
        console.log(`Search index built with ${searchIndex.length} items`);
    }

    // Start a quiz
    function startQuiz(testId) {
        console.log(`Starting quiz: ${testId}`);
        
        if (!testId || !allQuestionsData[testId]) {
            console.error(`Invalid test ID or missing data: ${testId}`);
            alert(`Errore: test '${testId}' non trovato.`);
            return;
        }

        currentTestId = testId;
        const questionPool = allQuestionsData[testId].filter(q => q && q.type !== 'header');
        
        if (questionPool.length === 0) {
            alert(`Attenzione: non ci sono domande disponibili per il test '${testId}'.`);
            return;
        }

        const titleElement = document.querySelector(`[data-testid="${testId}"]`);
        if (!titleElement) {
            console.error(`Title element not found for testId: ${testId}`);
            alert(`Errore: elemento del titolo non trovato per il test '${testId}'.`);
            return;
        }

        // Handle random tests
        const isRandomTest = ['test1', 'test2', 'test5'].includes(testId);
        
        if (isRandomTest && numQuestionsInput) {
            const numQuestionsToSelect = parseInt(numQuestionsInput.value, 10);
            const maxQuestions = questionPool.length;
            
            if (isNaN(numQuestionsToSelect) || numQuestionsToSelect > maxQuestions || numQuestionsToSelect < 1) {
                alert(`Per favore, scegli un numero di domande tra 1 e ${maxQuestions}.`);
                return;
            }
            
            const shuffledQuestions = shuffleArray(questionPool);
            currentTestQuestions = shuffledQuestions.slice(0, numQuestionsToSelect);
        } else {
            currentTestQuestions = [...questionPool];
        }
        
        // Reset quiz state
        currentQuizState = {
            options: [],
            questions: [...currentTestQuestions]
        };
        
        const testTitleText = safeString(titleElement.textContent);
        renderQuizUI(testTitleText);

        // Show quiz container
        showContainer('quiz');
    }

    // Render quiz UI
    function renderQuizUI(title) {
        if (!quizContainer) {
            console.error('Quiz container not found');
            return;
        }

        const quizHeaderHTML = `
            <div class="card-body p-md-5 p-4">
                <div class="mb-4">
                    <h2 class="quiz-title-text">${escapeHtml(title)}</h2>
                </div>
                <div id="progress-container" class="mb-4">
                    <p id="progress-text" class="mb-1 text-center">Domande risposte: 0 di ${currentTestQuestions.length}</p>
                    <div class="progress" style="height: 10px;">
                        <div id="progress-bar-inner" class="progress-bar" role="progressbar" style="width: 0%"></div>
                    </div>
                </div>
                <form id="quiz-form"></form>
                <div class="d-grid mt-4">
                    <button id="submit-btn" class="btn btn-lg btn-warning" type="button">Verifica le Risposte</button>
                </div>
            </div>`;
            
        quizContainer.innerHTML = quizHeaderHTML;
        renderQuestions();
        
        // Add event listeners
        const submitBtn = quizContainer.querySelector('#submit-btn');
        const quizForm = quizContainer.querySelector('#quiz-form');
        
        if (submitBtn) {
            submitBtn.addEventListener('click', handleSubmit);
        }
        
        if (quizForm) {
            quizForm.addEventListener('input', updateProgress);
            quizForm.addEventListener('change', updateProgress);
        }
    }

    // Render questions
    function renderQuestions() {
        const quizForm = quizContainer?.querySelector('#quiz-form');
        if (!quizForm) {
            console.error('Quiz form not found');
            return;
        }

        let formHTML = '';
        let questionCounter = 0;
        
        currentTestQuestions.forEach((q, index) => {
            if (!q || !q.question) return;
            
            questionCounter++;
            let helpButtonsHTML = '';
            
            // Add answer button
            let answerText = '';
            if (q.type === 'open_ended') {
                if (q.model_answer) {
                    answerText = typeof q.model_answer === 'string' 
                        ? q.model_answer 
                        : safeString(q.model_answer.summary);
                }
            } else {
                answerText = safeString(q.answer);
            }

            // Convert true/false answers for display
            if (q.type === 'true_false') {
                answerText = answerText.toLowerCase() === 'true' ? 'Vero' : 'Falso';
            }

            if (answerText) {
                helpButtonsHTML += `
                    <button type="button" class="help-btn show-answer-btn" data-answer="${escapeHtml(answerText)}">
                        <i class="bi bi-check-circle-fill answer-icon"></i>
                    </button>`;
            }

            // Add reflection button if prompt exists
            if (q.reflection_prompt) {
                helpButtonsHTML += `
                    <button type="button" class="help-btn" data-reflection="${escapeHtml(q.reflection_prompt)}">
                        <i class="bi bi-question-circle-fill question-icon"></i>
                    </button>`;
            }

            formHTML += `
                <div class="question-block" id="q-block-${index}">
                    <p class="question-text">
                        <span>${questionCounter}. ${escapeHtml(q.question)}</span>
                        <span class="help-buttons">${helpButtonsHTML}</span>
                    </p>
                    <div class="options-container">`;
            
            // Render question based on type
            switch (q.type) {
                case 'multiple_choice':
                case 'true_false':
                    const options = q.type === 'true_false' ? ['Vero', 'Falso'] : (q.options || []);
                    currentQuizState.options[index] = options;
                    
                    options.forEach(option => {
                        const optionId = `q-${index}-${safeString(option).replace(/[^a-zA-Z0-9]/g, '')}`;
                        const optionValue = q.type === 'true_false' 
                            ? (option === 'Vero' ? 'true' : 'false') 
                            : option;
                        
                        formHTML += `
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="q-${index}" id="${optionId}" value="${escapeHtml(optionValue)}">
                                <label class="form-check-label" for="${optionId}">${escapeHtml(option)}</label>
                            </div>`;
                    });
                    break;
                    
                case 'short_answer':
                    formHTML += `<input type="text" class="form-control" name="q-${index}" placeholder="La tua risposta...">`;
                    break;
                    
                case 'open_ended':
                    formHTML += `<textarea class="form-control" name="q-${index}" rows="4" placeholder="Spiega con parole tue..."></textarea>`;
                    break;
            }
            
            formHTML += '</div></div>';
        });
        
        quizForm.innerHTML = formHTML;

        // Add event listeners for help buttons
        quizForm.querySelectorAll('.help-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                showModal(btn.dataset.reflection, btn.dataset.answer);
            });
        });

        updateProgress();
    }

    // Show modal with proper error handling
    function showModal(reflectionPrompt, answer) {
        const modalTitleElement = document.getElementById('modal-title-text');
        const modalBodyElement = document.getElementById('reflection-modal-body');
        
        if (!modalTitleElement || !modalBodyElement) {
            console.error('Modal elements not found');
            alert(reflectionPrompt || answer || 'Contenuto non disponibile');
            return;
        }
        
        modalTitleElement.textContent = reflectionPrompt ? 'Spunto di Riflessione' : 'Risposta Corretta';
        modalBodyElement.textContent = reflectionPrompt || answer || 'Contenuto non disponibile';
        
        if (reflectionModal) {
            try {
                reflectionModal.show();
            } catch (error) {
                console.error('Failed to show modal:', error);
                alert(reflectionPrompt || answer || 'Contenuto non disponibile');
            }
        } else {
            alert(reflectionPrompt || answer || 'Contenuto non disponibile');
        }
    }
    
    // Update progress
    function updateProgress() {
        const totalQuestions = currentTestQuestions.length;
        const quizForm = quizContainer?.querySelector('#quiz-form');
        const progressText = quizContainer?.querySelector('#progress-text');
        const progressBar = quizContainer?.querySelector('#progress-bar-inner');
        
        if (!quizForm || !progressText || !progressBar) return;

        const inputs = quizForm.querySelectorAll('input[type=text], input[type=radio], textarea');
        const answeredNames = new Set();
        
        inputs.forEach(input => {
            if ((input.type === 'radio' && input.checked) || 
                (input.type !== 'radio' && safeString(input.value) !== '')) {
                answeredNames.add(input.name);
            }
        });
        
        const answeredCount = answeredNames.size;
        progressText.textContent = `Domande risposte: ${answeredCount} di ${totalQuestions}`;
        const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
        progressBar.style.width = `${progressPercentage}%`;
    }

    // Handle quiz submission
    function handleSubmit(e) {
        e.preventDefault();
        
        let score = 0;
        let resultsHTML = '';
        let questionCounter = 0;
        const gradableCount = currentTestQuestions.filter(q => q && q.type !== 'open_ended').length;

        currentTestQuestions.forEach((q, index) => {
            if (!q) return;
            
            questionCounter++;
            const inputElement = document.querySelector(`[name="q-${index}"]:checked`) || 
                               document.querySelector(`[name="q-${index}"]`);
            const userAnswer = inputElement ? safeString(inputElement.value) : "";

            if (q.type !== 'open_ended') {
                // Check if question was answered
                const isAnswered = inputElement && (
                    (inputElement.type === 'radio' && inputElement.checked) || 
                    (inputElement.type !== 'radio' && userAnswer !== "")
                );

                const correctAnswer = safeString(q.answer);
                const isCorrect = isAnswered && userAnswer.toLowerCase() === correctAnswer.toLowerCase();
                const resultClass = !isAnswered ? '' : (isCorrect ? 'correct' : 'incorrect');
                
                if (isCorrect) score++;
                
                // Format display answers
                let displayAnswer = correctAnswer;
                let displayUserAnswer = userAnswer;
                
                if (q.type === 'true_false') {
                    displayAnswer = correctAnswer.toLowerCase() === 'true' ? 'Vero' : 'Falso';
                    displayUserAnswer = userAnswer.toLowerCase() === 'true' ? 'Vero' : 'Falso';
                }

                resultsHTML += `
                    <div class="result-item ${resultClass}">
                        <p class="result-question">${questionCounter}. ${escapeHtml(q.question)}</p>
                        <p><strong>La tua risposta:</strong> ${isAnswered ? escapeHtml(displayUserAnswer) : "<em>Nessuna risposta</em>"}</p>
                        <p class="result-explanation"><strong>Risposta corretta:</strong> ${escapeHtml(displayAnswer)}</p>
                        ${q.explanation ? `<p class="result-explanation"><strong>Spiegazione:</strong> ${escapeHtml(q.explanation)}</p>` : ''}
                    </div>`;
            } else {
                // Handle open-ended questions
                let modelAnswerHTML = '';
                if (q.model_answer) {
                    if (typeof q.model_answer === 'string') {
                        modelAnswerHTML = `
                            <div class="model-answer-section mt-3">
                                <strong>Risposta corretta:</strong>
                                <div class="model-answer-summary">${escapeHtml(q.model_answer)}</div>
                            </div>`;
                    } else {
                        modelAnswerHTML = `
                            <div class="model-answer-section mt-3">
                                <strong>Risposta corretta:</strong>
                                <div class="model-answer-summary">${escapeHtml(q.model_answer.summary || "")}</div>`;
                        
                        if (q.model_answer.keywords && Array.isArray(q.model_answer.keywords)) {
                            modelAnswerHTML += `
                                <div class="mt-2">
                                    <strong>Concetti chiave:</strong>
                                    <ul class="model-answer-keywords">`;
                            q.model_answer.keywords.forEach(kw => {
                                if (kw && kw.keyword) {
                                    modelAnswerHTML += `
                                        <li><strong>${escapeHtml(kw.keyword)}</strong>: ${escapeHtml(kw.explanation || '')}</li>`;
                                }
                            });
                            modelAnswerHTML += `</ul></div>`;
                        }
                        modelAnswerHTML += `</div>`;
                    }
                }

                resultsHTML += `
                    <div class="result-item open">
                        <p class="result-question">${questionCounter}. ${escapeHtml(q.question)}</p>
                        <div class="row">
                            <div class="col-12">
                                <strong>La tua risposta:</strong>
                                <div class="user-answer-box">
                                    ${userAnswer ? escapeHtml(userAnswer) : "<em>Nessuna risposta</em>"}
                                </div>
                                ${modelAnswerHTML}
                            </div>
                        </div>
                    </div>`;
            }
        });
        
        // Save results
        if (gradableCount > 0) {
            saveResult(currentTestId, score, gradableCount);
        }

        // Display results
        const scoreDisplay = gradableCount > 0 ? `${score} / ${gradableCount}` : "Test di Autovalutazione";
        const quizTitle = quizContainer?.querySelector('.quiz-title-text')?.textContent || 'Quiz';
        
        const resultsPageHTML = `
            <div class="card-body p-md-5 p-4">
                <h2 class="text-center">${escapeHtml(quizTitle)} - Risultati</h2>
                <p class="text-center display-5 fw-bold my-4">${escapeHtml(scoreDisplay)}</p>
                <div class="mt-4">${resultsHTML}</div>
                <div class="d-grid gap-2 d-md-flex justify-content-md-center mt-5">
                    <button id="save-pdf-btn" class="btn btn-lg btn-danger" type="button">
                        <i class="bi bi-file-earmark-pdf-fill"></i> Salva Risultati in PDF
                    </button>
                </div>
            </div>`;
        
        if (resultsContainer) {
            resultsContainer.innerHTML = resultsPageHTML;
            const pdfBtn = resultsContainer.querySelector('#save-pdf-btn');
            if (pdfBtn) {
                pdfBtn.addEventListener('click', generatePdf);
            }
        }

        showContainer('results');
    }

    // Generate PDF
    function generatePdf() {
        if (typeof window.jspdf === 'undefined') {
            alert('Libreria PDF non disponibile. Impossibile generare il PDF.');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;
            const usableWidth = pageWidth - (margin * 2);
            
            let yPos = margin;
            
            // Get content safely
            const testTitle = resultsContainer?.querySelector('h2')?.textContent || 'Quiz Results';
            const score = resultsContainer?.querySelector('p.display-5')?.textContent || 'N/A';
            const resultItems = resultsContainer?.querySelectorAll('.result-item') || [];
            
            // Add date and time
            const now = new Date();
            const dateStr = now.toLocaleDateString('it-IT') + ' ' + now.toLocaleTimeString('it-IT');
            
            // Title
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            const titleLines = doc.splitTextToSize(testTitle, usableWidth);
            titleLines.forEach(line => {
                if (yPos > pageHeight - margin) {
                    doc.addPage();
                    yPos = margin;
                }
                doc.text(line, pageWidth / 2, yPos, { align: 'center' });
                yPos += 8;
            });
            
            // Date and Score
            yPos += 5;
            doc.setFontSize(11);
            doc.text(`Data: ${dateStr}`, margin, yPos);
            yPos += 8;
            doc.setFontSize(14);
            doc.text(`Punteggio: ${score}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 15;
            
            // Results
            doc.setFontSize(11);
            resultItems.forEach((item, index) => {
                if (yPos > pageHeight - margin) {
                    doc.addPage();
                    yPos = margin;
                }
                
                const questionEl = item.querySelector('.result-question');
                if (questionEl) {
                    doc.setFont('helvetica', 'bold');
                    const questionLines = doc.splitTextToSize(questionEl.textContent, usableWidth);
                    questionLines.forEach(line => {
                        if (yPos > pageHeight - margin) {
                            doc.addPage();
                            yPos = margin;
                        }
                        doc.text(line, margin, yPos);
                        yPos += 6;
                    });
                }
                
                // Add options if available
                const options = currentQuizState.options[index];
                if (options && options.length > 0) {
                    yPos += 2;
                    doc.setFont('helvetica', 'bold');
                    doc.text("Opzioni disponibili:", margin, yPos);
                    yPos += 6;
                    
                    doc.setFont('helvetica', 'normal');
                    options.forEach((optionText, optIndex) => {
                        const optionLine = `${optIndex + 1}) ${optionText}`;
                        const optionLines = doc.splitTextToSize(optionLine, usableWidth - 10);
                        optionLines.forEach(line => {
                            if (yPos > pageHeight - margin) {
                                doc.addPage();
                                yPos = margin;
                            }
                            doc.text(line, margin + 5, yPos);
                            yPos += 6;
                        });
                    });
                }
                
                // User's answer
                yPos += 2;
                doc.setFont('helvetica', 'bold');
                doc.text("La tua risposta:", margin, yPos);
                yPos += 6;
                
                doc.setFont('helvetica', 'normal');
                const userAnswerBox = item.querySelector('.user-answer-box');
                if (userAnswerBox) {
                    const userAnswerText = safeString(userAnswerBox.textContent);
                    const userAnswerLines = doc.splitTextToSize(userAnswerText, usableWidth - 5);
                    userAnswerLines.forEach(line => {
                        if (yPos > pageHeight - margin) {
                            doc.addPage();
                            yPos = margin;
                        }
                        doc.text(line, margin + 5, yPos);
                        yPos += 6;
                    });
                }
                
                // Correct answer and explanation
                const explanationEl = item.querySelector('.result-explanation');
                if (explanationEl) {
                    yPos += 2;
                    doc.setFont('helvetica', 'bold');
                    doc.text("Risposta corretta:", margin, yPos);
                    yPos += 6;
                    
                    doc.setFont('helvetica', 'normal');
                    const explanationText = safeString(explanationEl.textContent);
                    const parts = explanationText.split('Spiegazione:');
                    const answerText = parts[0].replace('Risposta corretta:', '').trim();
                    
                    const answerLines = doc.splitTextToSize(answerText, usableWidth - 5);
                    answerLines.forEach(line => {
                        if (yPos > pageHeight - margin) {
                            doc.addPage();
                            yPos = margin;
                        }
                        doc.text(line, margin + 5, yPos);
                        yPos += 6;
                    });

                    // Add explanation if exists
                    if (parts.length > 1) {
                        yPos += 2;
                        doc.setFont('helvetica', 'bold');
                        doc.text("Spiegazione:", margin, yPos);
                        yPos += 6;
                        
                        doc.setFont('helvetica', 'normal');
                        const explanationLines = doc.splitTextToSize(parts[1].trim(), usableWidth - 5);
                        explanationLines.forEach(line => {
                            if (yPos > pageHeight - margin) {
                                doc.addPage();
                                yPos = margin;
                            }
                            doc.text(line, margin + 5, yPos);
                            yPos += 6;
                        });
                    }
                }

                // Model answer for open-ended questions
                const modelAnswer = item.querySelector('.model-answer-section');
                if (modelAnswer) {
                    const summary = modelAnswer.querySelector('.model-answer-summary');
                    if (summary) {
                        const summaryLines = doc.splitTextToSize(safeString(summary.textContent), usableWidth - 5);
                        summaryLines.forEach(line => {
                            if (yPos > pageHeight - margin) {
                                doc.addPage();
                                yPos = margin;
                            }
                            doc.text(line, margin + 5, yPos);
                            yPos += 6;
                        });
                    }
                    
                    // Keywords
                    const keywords = modelAnswer.querySelectorAll('.model-answer-keywords li');
                    if (keywords.length > 0) {
                        yPos += 2;
                        doc.setFont('helvetica', 'bold');
                        doc.text("Concetti chiave:", margin, yPos);
                        yPos += 6;
                        
                        doc.setFont('helvetica', 'normal');
                        keywords.forEach(keyword => {
                            const keywordText = safeString(keyword.textContent);
                            const keywordLines = doc.splitTextToSize(keywordText, usableWidth - 10);
                            keywordLines.forEach(line => {
                                if (yPos > pageHeight - margin) {
                                    doc.addPage();
                                    yPos = margin;
                                }
                                doc.text("• " + line, margin + 5, yPos);
                                yPos += 6;
                            });
                        });
                    }
                }
                
                yPos += 10;
                
                // Separator line
                if (index < resultItems.length - 1) {
                    doc.setDrawColor(200);
                    doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
                }
            });
            
            // Save PDF
            const fileName = `risultati_${currentTestId}_${new Date().toISOString().slice(0,10)}.pdf`;
            doc.save(fileName);
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Errore durante la generazione del PDF. Riprova più tardi.');
        }
    }

    // Save result to localStorage
    function saveResult(testId, score, total) {
        try {
            const history = JSON.parse(localStorage.getItem('quizHistory') || '{}');
            if (!history[testId]) history[testId] = [];
            
            history[testId].push({ 
                score, 
                total, 
                percentage: total > 0 ? Math.round((score / total) * 100) : 0, 
                date: new Date().toISOString() 
            });
            
            localStorage.setItem('quizHistory', JSON.stringify(history));
        } catch (error) {
            console.error('Failed to save result:', error);
        }
    }

    // Clear history
    function clearHistory() {
        if (confirm("Sei sicuro di voler cancellare TUTTO lo storico dei risultati? L'azione è irreversibile.")) {
            try {
                localStorage.removeItem('quizHistory');
                viewHistory();
            } catch (error) {
                console.error('Failed to clear history:', error);
            }
        }
    }

    // Reset to menu
    function resetToMenu() {
        showContainer('menu');
    }

    // Show specific container
    function showContainer(containerName) {
        const containers = {
            menu: menuContainer,
            quiz: quizContainer,
            results: resultsContainer,
            history: historyContainer
        };

        Object.values(containers).forEach(container => {
            if (container) container.classList.add('d-none');
        });

        if (containers[containerName]) {
            containers[containerName].classList.remove('d-none');
        }
    }
    
    // Perform search
    function performSearch() {
        if (!searchInput || !searchResultsContainer) return;
        
        const query = safeString(searchInput.value).toLowerCase();
        if (query.length < 3) {
            searchResultsContainer.innerHTML = '<p class="no-results">Scrivi almeno 3 caratteri per iniziare la ricerca.</p>';
            return;
        }

        const results = searchIndex.filter(item => 
            item.text_to_search && item.text_to_search.includes(query)
        );

        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<p class="no-results">Nessun risultato trovato.</p>';
        } else {
            let resultsHTML = '';
            results.forEach(res => {
                const explanation = safeString(res.explanation);
                const highlightedExplanation = explanation.replace(
                    new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'),
                    '<span class="highlight">$&</span>'
                );
                
                resultsHTML += `
                    <div class="search-result-item">
                        <p class="search-result-question">${escapeHtml(res.question)} 
                            <small class="text-muted">(${escapeHtml(res.test)})</small>
                        </p>
                        <p class="search-result-answer">${highlightedExplanation}</p>
                    </div>`;
            });
            searchResultsContainer.innerHTML = resultsHTML;
        }
    }
    
    // Close search
    function closeSearch() {
        if (searchOverlay) {
            searchOverlay.classList.add('d-none');
        }
        document.body.style.overflow = '';
        if (searchInput) {
            searchInput.value = '';
        }
        if (searchResultsContainer) {
            searchResultsContainer.innerHTML = '';
        }
    }

    // View history
    function viewHistory() {
        showContainer('history');
        
        if (!historyContent) return;
        
        try {
            const history = JSON.parse(localStorage.getItem('quizHistory') || '{}');
            historyContent.innerHTML = '';

            if (Object.keys(history).length === 0) {
                historyContent.innerHTML = '<p class="text-center text-muted">Nessun risultato salvato.</p>';
                return;
            }

            Object.keys(allQuestionsData).forEach(testId => {
                const questions = allQuestionsData[testId];
                if (!Array.isArray(questions)) return;
                
                const testHistory = history[testId];
                const testTitleButton = document.querySelector(`[data-testid="${testId}"]`);
                const testTitle = testTitleButton ? safeString(testTitleButton.textContent) : testId;
                
                let testHTML = `<div class="mb-5"><h3>${escapeHtml(testTitle)}</h3>`;
                
                if (!testHistory || testHistory.length === 0) {
                    testHTML += '<p class="text-muted">Nessun tentativo registrato per questo test.</p>';
                } else {
                    const canvasId = `chart-${testId}`;
                    testHTML += `<div class="history-chart-container"><canvas id="${canvasId}"></canvas></div>`;
                    testHTML += `<table class="table table-striped table-hover history-table">
                        <thead><tr><th>Data</th><th>Punteggio</th><th>Percentuale</th></tr></thead><tbody>`;
                    
                    [...testHistory].reverse().slice(0, 10).forEach(result => {
                        const date = new Date(result.date);
                        testHTML += `
                            <tr>
                                <td class="history-date">
                                    ${date.toLocaleDateString('it-IT')} ${date.toLocaleTimeString('it-IT')}
                                </td>
                                <td><strong>${result.score} / ${result.total}</strong></td>
                                <td>${result.percentage}%</td>
                            </tr>`;
                    });
                    testHTML += '</tbody></table>';
                }
                testHTML += '</div><hr>';
                historyContent.innerHTML += testHTML;
            });

            // Render charts
            Object.keys(history).forEach(testId => {
                if (history[testId] && history[testId].length > 0) {
                    renderChart(testId, history[testId]);
                }
            });
            
        } catch (error) {
            console.error('Failed to view history:', error);
            if (historyContent) {
                historyContent.innerHTML = '<p class="text-center text-danger">Errore nel caricamento dello storico.</p>';
            }
        }
    }

    // Render chart with error handling
    function renderChart(testId, data) {
        const canvas = document.getElementById(`chart-${testId}`);
        if (!canvas || typeof Chart === 'undefined') return;

        try {
            // Cleanup existing chart
            if (chartInstances[testId]) {
                chartInstances[testId].destroy();
                delete chartInstances[testId];
            }

            const labels = data.map(r => {
                const date = new Date(r.date);
                return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
            });
            const percentages = data.map(r => r.percentage || 0);

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
        } catch (error) {
            console.error(`Failed to render chart for ${testId}:`, error);
        }
    }

    // Cleanup function for proper memory management
    function cleanup() {
        // Destroy all chart instances
        Object.values(chartInstances).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        chartInstances = {};
    }

    // Handle page unload
    window.addEventListener('beforeunload', cleanup);
    
    // Initialize the application
    initializeApp();
});
