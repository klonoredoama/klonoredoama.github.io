// app.js - FIXED VERSION
let dictionary = {};
let lessons = [];
let currentLesson = null;
let currentQuestionIndex = 0;
let score = 0;
let totalXP = 0;

const mainContent = document.getElementById('main-content');
const mascotText = document.getElementById('mascot-text');
const xpDisplay = document.getElementById('xp-display');
const statsBar = document.getElementById('stats-bar');

// Helper to safely escape single quotes for inline JS
function escapeQuotes(str) {
    return str.replace(/'/g, "\\'");
}

async function init() {
    try {
        const dictRes = await fetch('dictionary.json');
        dictionary = await dictRes.json();
        
        const lessonRes = await fetch('lessons.json');
        lessons = await lessonRes.json();
        
        xpDisplay.innerText = `XP: ${totalXP}`;
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
        html += `
            <div class="lesson-card" onclick="startLesson(${index})">
                <h3>${lesson.title}</h3>
                <p>${lesson.words.length} words</p>
            </div>
        `;
    });
    mainContent.innerHTML = html;
}

function startLesson(index) {
    currentLesson = lessons[index];
    currentQuestionIndex = 0;
    score = 0;
    showQuestion();
}

function showQuestion() {
    const word = currentLesson.words[currentQuestionIndex];
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

    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentLesson.words.length) {
            showQuestion();
        } else {
            showResults();
        }
    }, 1500);
}

function showResults() {
    const xpEarned = score * 10;
    totalXP += xpEarned;
    xpDisplay.innerText = `XP: ${totalXP}`;
    
    mascotText.innerText = "Lesson Complete!";
    mainContent.innerHTML = `
        <div class="quiz-container">
            <h2>You finished ${currentLesson.title}!</h2>
            <p style="font-size: 1.5rem">Score: ${score} / ${currentLesson.words.length}</p>
            <p>You earned <strong>${xpEarned} XP</strong></p>
            <button class="btn-primary" onclick="showHome()">Continue</button>
        </div>
    `;
}

init();