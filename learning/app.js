// app.js - Now with click-to-reveal translation on Enêoke words
let dictionary = {};
let lessons = [];
let currentLesson = null;
let currentQuestionIndex = 0;
let score = 0;
let totalXP = 0;
let level = 1;
let completedLessons = [];

const mainContent = document.getElementById('main-content');
const mascotText = document.getElementById('mascot-text');
const xpDisplay = document.getElementById('xp-display');
const levelDisplay = document.getElementById('level-display');
const statsBar = document.getElementById('stats-bar');

let dragged = null;

// Helper to escape quotes
function escapeQuotes(str) {
    return str.replace(/'/g, "\\'");
}

// Cookie helpers
function setCookie(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${JSON.stringify(value)};expires=${date.toUTCString()};path=/`;
}

function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name + '=')) {
            return JSON.parse(cookie.substring(name.length + 1));
        }
    }
    return null;
}

// Load/save progress
function loadProgress() {
    const savedXP = getCookie('totalXP');
    const savedCompleted = getCookie('completedLessons');
    if (savedXP !== null) totalXP = savedXP;
    if (savedCompleted !== null) completedLessons = savedCompleted;
    updateLevel();
    updateDisplays();
}

function saveProgress() {
    setCookie('totalXP', totalXP);
    setCookie('completedLessons', completedLessons);
    updateDisplays();
}

function updateLevel() {
    level = Math.floor(totalXP / 100) + 1;
}

function updateDisplays() {
    xpDisplay.innerText = `XP: ${totalXP}`;
    levelDisplay.innerText = `Level: ${level}`;
}

// === NEW: Translation Tooltip ===
function createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'translation-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.background = 'var(--primary)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '8px';
    tooltip.style.fontSize = '1rem';
    tooltip.style.fontWeight = 'bold';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '1000';
    tooltip.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.2s';
    document.body.appendChild(tooltip);
}

function showTranslation(word, event) {
    const translation = dictionary[word] || "(no translation)";
    let tooltip = document.getElementById('translation-tooltip');
    if (!tooltip) {
        createTooltip();
        tooltip = document.getElementById('translation-tooltip');
    }

    tooltip.textContent = translation;
    tooltip.style.opacity = '1';

    // Position near click/tap
    const x = event.pageX || event.touches[0].pageX;
    const y = event.pageY || event.touches[0].pageY;
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
}

function hideTranslation() {
    const tooltip = document.getElementById('translation-tooltip');
    if (tooltip) tooltip.style.opacity = '0';
}

// Hide tooltip when clicking elsewhere
document.addEventListener('click', hideTranslation);
document.addEventListener('touchstart', hideTranslation);

// Helper to make Enêoke words clickable
function makeWordClickable(word) {
    return `<span class="en-word" data-word="${word}" 
             onclick="showTranslation('${escapeQuotes(word)}', event); event.stopPropagation();"
             ontouchstart="showTranslation('${escapeQuotes(word)}', event); event.stopPropagation();">
             ${word}
            </span>`;
}

// Init
async function init() {
    try {
        const dictRes = await fetch('dictionary.json');
        dictionary = await dictRes.json();
        
        const lessonRes = await fetch('lessons.json');
        lessons = await lessonRes.json();
        
        loadProgress();
        statsBar.classList.remove('hidden');
        showHome();
    } catch (err) {
        console.error("Load error:", err);
        mainContent.innerHTML = "<p style='color:red'>Error loading files. Check console (F12).</p>";
    }
}

function showHome() {
    currentLesson = null;
    mascotText.innerText = "Choose a path!";
    
    let html = `<h1>Your Lessons</h1>`;
    lessons.forEach((lesson, index) => {
        const isLocked = index > 0 && !completedLessons.includes(index - 1);
        html += `
            <div class="lesson-card ${isLocked ? 'locked' : ''}" ${isLocked ? '' : `onclick="startLesson(${index})"`}>
                <h3>${lesson.title}</h3>
                <p>${lesson.exercises.length} exercises</p>
                ${isLocked ? '<p>(Complete previous lesson to unlock)</p>' : ''}
            </div>
        `;
    });
    mainContent.innerHTML = html;
}

function startLesson(index) {
    currentLesson = lessons[index];
    currentQuestionIndex = 0;
    score = 0;
    showExercise();
}

function showExercise() {
    const exercise = currentLesson.exercises[currentQuestionIndex];
    if (exercise.type === 'mc') {
        showMultipleChoice(exercise);
    } else if (exercise.type === 'sentence') {
        showSentenceBuilder(exercise);
    }
}

function showMultipleChoice(exercise) {
    const word = exercise.word;
    const correctAnswer = dictionary[word] || "(missing translation)";
    mascotText.innerText = "What does this mean?";

    let options = [correctAnswer];
    const allMeanings = Object.values(dictionary);
    
    while (options.length < 4) {
        const randomMeaning = allMeanings[Math.floor(Math.random() * allMeanings.length)];
        if (!options.includes(randomMeaning)) options.push(randomMeaning);
    }
    
    options.sort(() => Math.random() - 0.5);

    mainContent.innerHTML = `
        <div class="quiz-container">
            <div class="question-word">${makeWordClickable(word)}</div>
            <div class="options-grid">
                ${options.map(opt => `
                    <button class="option-btn" onclick="checkAnswer(this, '${escapeQuotes(opt)}', '${escapeQuotes(correctAnswer)}')">
                        ${opt}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function showSentenceBuilder(exercise) {
    const correctWords = exercise.sentence.split(' ');
    const shuffled = [...correctWords].sort(() => Math.random() - 0.5);
    mascotText.innerText = `Build the sentence: "${exercise.translation}"`;

    // Make each word in the correct sentence clickable too
    const clickableTarget = exercise.sentence.split(' ').map(makeWordClickable).join(' ');

    mainContent.innerHTML = `
        <div class="quiz-container">
            <div class="question-sentence">${clickableTarget}</div>
            <div class="sentence-builder" id="builder-area"></div>
            <div class="word-pool" id="word-pool">
                ${shuffled.map(word => 
                    `<div class="word-tile" draggable="true">${makeWordClickable(word)}</div>`
                ).join('')}
            </div>
            <button class="btn-primary submit-btn" id="submit-btn">Submit</button>
        </div>
    `;

    setupDragAndDrop();
    document.getElementById('submit-btn').addEventListener('click', () => checkSentence(exercise.sentence));
}

function setupDragAndDrop() {
    const tiles = document.querySelectorAll('.word-tile');
    const builder = document.getElementById('builder-area');
    const pool = document.getElementById('word-pool');

    tiles.forEach(tile => {
        tile.addEventListener('dragstart', (e) => {
            dragged = tile;
            tile.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        tile.addEventListener('dragend', () => {
            tile.classList.remove('dragging');
            dragged = null;
        });
    });

    [builder, pool].forEach(area => {
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dragged) {
                area.appendChild(dragged);
            }
        });
    });
}

function checkSentence(correct) {
    const builder = document.getElementById('builder-area');
    const builtWords = Array.from(builder.querySelectorAll('.word-tile')).map(tile => 
        tile.querySelector('.en-word')?.dataset.word || tile.innerText.trim()
    );
    const built = builtWords.join(' ');
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;

    if (built === correct) {
        builder.style.borderColor = 'var(--primary)';
        mascotText.innerText = "Amazing! Correct!";
        score++;
    } else {
        builder.style.borderColor = 'var(--error)';
        mascotText.innerText = `Oops! Correct order: "${correct}"`;
    }

    setTimeout(nextExercise, 2000);
}

function checkAnswer(btn, selected, correct) {
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(b => b.disabled = true);

    if (selected === correct) {
        btn.classList.add('correct');
        mascotText.innerText = "Amazing! Correct!";
        score++;
    } else {
        btn.classList.add('wrong');
        mascotText.innerText = `Oops! It means "${correct}".`;
    }

    setTimeout(nextExercise, 1500);
}

function nextExercise() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentLesson.exercises.length) {
        showExercise();
    } else {
        showResults();
    }
}

function showResults() {
    const xpEarned = score * 10;
    totalXP += xpEarned;
    updateLevel();
    const lessonIndex = lessons.indexOf(currentLesson);
    if (!completedLessons.includes(lessonIndex)) {
        completedLessons.push(lessonIndex);
    }
    saveProgress();

    mascotText.innerText = "Lesson Complete!";
    mainContent.innerHTML = `
        <div class="quiz-container">
            <h2>You finished ${currentLesson.title}!</h2>
            <p style="font-size: 1.5rem">Score: ${score} / ${currentLesson.exercises.length}</p>
            <p>You earned <strong>${xpEarned} XP</strong></p>
            <p>Now at Level ${level}</p>
            <button class="btn-primary" onclick="showHome()">Continue</button>
        </div>
    `;
}

init();
