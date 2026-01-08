// app.js - Updated with cookies, progression, levels, sentence builder
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

// Load progress from cookies
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
    level = Math.floor(totalXP / 100) + 1; // 100 XP per level
}

function updateDisplays() {
    xpDisplay.innerText = `XP: ${totalXP}`;
    levelDisplay.innerText = `Level: ${level}`;
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
        if (!options.includes(randomMeaning)) {
            options.push(randomMeaning);
        }
    }
    
    options.sort(() => Math.random() - 0.5);

    mainContent.innerHTML = `
        <div class="quiz-container">
            <div class="question-word">${word}</div>
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
    const correctSentence = exercise.sentence.split(' ');
    const shuffled = [...correctSentence].sort(() => Math.random() - 0.5);
    mascotText.innerText = `Build the sentence: "${exercise.translation}"`;

    mainContent.innerHTML = `
        <div class="quiz-container">
            <div class="question-sentence">${exercise.translation}</div>
            <div class="sentence-builder" id="builder-area"></div>
            <div class="word-pool" id="word-pool">
                ${shuffled.map(word => `<div class="word-tile" draggable="true">${word}</div>`).join('')}
            </div>
            <button class="btn-primary submit-btn" onclick="checkSentence('${correctSentence.join(' ')}')">Submit</button>
        </div>
    `;

    setupDragAndDrop();
}

function setupDragAndDrop() {
    const tiles = document.querySelectorAll('.word-tile');
    const builder = document.getElementById('builder-area');
    const pool = document.getElementById('word-pool');

    tiles.forEach(tile => {
        tile.addEventListener('dragstart', dragStart);
        tile.addEventListener('dragend', dragEnd);
    });

    [builder, pool].forEach(area => {
        area.addEventListener('dragover', dragOver);
        area.addEventListener('drop', drop);
    });
}

function dragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.innerText);
    setTimeout(() => this.classList.add('dragging'), 0);
}

function dragEnd() {
    this.classList.remove('dragging');
}

function dragOver(e) {
    e.preventDefault();
}

function drop(e) {
    e.preventDefault();
    const text = e.dataTransfer.getData('text/plain');
    const tile = document.querySelector(`.word-tile:not(.dragging)`);
    if (tile && tile.innerText === text) {
        e.target.appendChild(tile);
    }
}

function checkSentence(correct) {
    const builder = document.getElementById('builder-area');
    const built = Array.from(builder.children).map(child => child.innerText).join(' ');
    
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;

    if (built === correct) {
        builder.classList.add('correct');
        mascotText.innerText = "Amazing! Correct!";
        score++;
    } else {
        builder.classList.add('wrong');
        mascotText.innerText = `Oops! Correct: "${correct}"`;
    }

    setTimeout(nextExercise, 1500);
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
    if (!completedLessons.includes(lessons.indexOf(currentLesson))) {
        completedLessons.push(lessons.indexOf(currentLesson));
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
