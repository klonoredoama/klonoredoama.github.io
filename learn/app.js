/* ================================
   PROGRESS + STATE MANAGEMENT
================================ */

let COURSE, STORIES;
let XP = 0;
let LEVEL = 1;
let STREAK = 0;
let LAST_DAY = "";
let DAILY_GOAL = 20;
let PROGRESS = {}; // completed units

function loadProgress() {
  try {
    XP = +localStorage.getItem("xp") || 0;
    LEVEL = +localStorage.getItem("level") || 1;
    STREAK = +localStorage.getItem("streak") || 0;
    LAST_DAY = localStorage.getItem("lastDay") || "";
    DAILY_GOAL = +localStorage.getItem("goal") || 20;
    PROGRESS = JSON.parse(localStorage.getItem("progress") || "{}");
  } catch {}
}
function saveProgress() {
  localStorage.setItem("xp", XP);
  localStorage.setItem("level", LEVEL);
  localStorage.setItem("streak", STREAK);
  localStorage.setItem("goal", DAILY_GOAL);
  localStorage.setItem("lastDay", LAST_DAY);
  localStorage.setItem("progress", JSON.stringify(PROGRESS));
}

function updateDay() {
  const today = new Date().toDateString();
  if (LAST_DAY !== today) {
    if (XP < DAILY_GOAL) STREAK = 0;
    else STREAK++;
    LAST_DAY = today;
    XP = 0; // daily XP clears but total progress stays
    saveProgress();
  }
}

// XP curve: 1–2 slow, 3–5 normal, 6+ grind
function addXP(amount) {
  XP += amount;
  if (XP >= LEVEL * 30) {
    XP = 0;
    LEVEL++;
    ding();
  }
  saveProgress();
}

/* ================================
   UI + PATH RENDERING
================================ */

function canStart(si, ui) {
  if (si === 0 && ui === 0) return true;
  return PROGRESS[`${si}-${ui-1}`] === true;
}

function renderPath() {
  const path = document.getElementById("path");
  path.innerHTML = `
    <h2>Level: ${LEVEL}</h2>
    <p>XP today: ${XP}/${LEVEL * 30}</p>
    <p>🔥 Streak: ${STREAK} days</p>
  `;

  COURSE.sections.forEach((s, si) => {
    const h = document.createElement("h2");
    h.textContent = s.title;
    path.appendChild(h);

    // grammar tooltip
    if (s.grammar) {
      const g = document.createElement("div");
      g.textContent = "📘 Grammar Note (click)";
      g.style.color = "blue";
      g.style.cursor = "pointer";
      g.onclick = () => alert(s.grammar);
      path.appendChild(g);
    }

    s.units.forEach((u, ui) => {
      const key = `${si}-${ui}`;
      const div = document.createElement("div");
      div.className = "unit";
      if (!canStart(si, ui)) div.classList.add("locked");
      div.textContent = u.title + (PROGRESS[key] ? " ✔" : "");
      div.onclick = () => {
        if (!canStart(si, ui)) return;
        startLesson(si, ui);
      };
      path.appendChild(div);
    });
  });

  const storiesBtn = document.createElement("button");
  storiesBtn.textContent = "📖 Stories";
  storiesBtn.onclick = showStories;
  path.appendChild(storiesBtn);
}

/* ================================
   LESSON ENGINE
================================ */

const EXERCISES = ["flashcard", "multiple", "fill", "match"];

function startLesson(si, ui) {
  const unit = COURSE.sections[si].units[ui];
  const vocab = Object.entries(unit.words);
  const lesson = document.getElementById("lesson");

  document.getElementById("path").classList = "hidden";
  lesson.classList = "";

  let index = 0;

  function nextExercise() {
    const type = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
    if (type === "flashcard") flashcard();
    else if (type === "multiple") mcq();
    else if (type === "fill") fillBlank();
    else match();
  }

  function flashcard() {
    const [w, info] = vocab[index];
    lesson.innerHTML = `
      <h2>${unit.title}</h2>
      <div class="card">${w} (${info.pos}) ${info.ipa}</div>
      <button id="show">Show Meaning</button>
      <div id="meaning" class="hidden">${info.meaning}</div>
      <button id="next">Next</button>
    `;
    document.getElementById("show").onclick = () =>
      document.getElementById("meaning").classList.remove("hidden");
    document.getElementById("next").onclick = advance;
  }

  function mcq() {
    const correct = vocab[index];
    const [w, info] = correct;
    const wrongs = vocab
      .filter(([k]) => k !== w)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const choices = [...wrongs, correct]
      .sort(() => Math.random() - 0.5)
      .map(([_, x]) => x.meaning);

    lesson.innerHTML = `
      <h2>${unit.title}</h2>
      <p>Pick meaning of <strong>${w}</strong></p>
      ${choices
        .map(c => `<button class="mc">${c}</button><br>`)
        .join("")}
    `;
    document.querySelectorAll(".mc").forEach(btn => {
      btn.onclick = () => {
        if (btn.textContent === info.meaning) {
          correctAnswer();
        } else wrongAnswer(info.meaning);
      };
    });
  }

  function fillBlank() {
    const [w, info] = vocab[index];
    lesson.innerHTML = `
      <h2>${unit.title}</h2>
      <p>Type meaning of <strong>${w}</strong></p>
      <input id="guess">
      <button id="check">Check</button>
      <p id="fb"></p>
    `;
    document.getElementById("check").onclick = () => {
      const guess = document.getElementById("guess").value.trim().toLowerCase();
      if (info.meaning.toLowerCase().includes(guess)) correctAnswer();
      else wrongAnswer(info.meaning);
    };
  }

  function match() {
    const slice = vocab.slice(0, Math.min(4, vocab.length));
    const words = slice.map(([w]) => w);
    const meanings = slice.map(([_, i]) => i.meaning).sort(() => Math.random() - 0.5);

    lesson.innerHTML = `<h2>${unit.title}</h2><p>Match the pairs</p>`;
    words.forEach(w => {
      const div = document.createElement("div");
      div.textContent = w;
      div.style.cursor = "pointer";
      div.onclick = () => {
        const pick = prompt("Pick meaning:");
        if (meanings.includes(pick)) correctAnswer();
        else wrongAnswer(slice.find(([x]) => x === w)[1].meaning);
      };
      lesson.appendChild(div);
    });
  }

  function correctAnswer() {
    ding();
    addXP(5);
    advance();
  }

  function wrongAnswer(correct) {
    buzz();
    alert("Wrong! Correct: " + correct);
    advance();
  }

  function advance() {
    index++;
    if (index >= vocab.length) return finish();
    nextExercise();
  }

  function finish() {
    PROGRESS[`${si}-${ui}`] = true;
    saveProgress();
    lesson.innerHTML = `
      <p class="correct">Unit Complete! +20 XP</p>
      <button onclick="back()">Back</button>
    `;
    addXP(20);
  }

  window.back = () => {
    lesson.classList = "hidden";
    document.getElementById("path").classList = "";
    renderPath();
  };

  nextExercise();
}

/* ================================
   STORIES
================================ */

function showStories() {
  const story = STORIES[Math.floor(Math.random() * STORIES.length)];

  const lesson = document.getElementById("lesson");
  document.getElementById("path").classList = "hidden";
  lesson.classList = "";
  let line = 0;

  function render() {
    if (line >= story.lines.length) {
      addXP(15);
      lesson.innerHTML = `
        <p>Story finished! +15 XP</p>
        <button onclick="back()">Back</button>
      `;
      return;
    }
    const l = story.lines[line];
    lesson.innerHTML = `
      <p>${l.rac}</p>
      <button id="reveal">Translate</button>
      <div id="eng" class="hidden">${l.en}</div>
      <button id="next">Next</button>
    `;
    document.getElementById("reveal").onclick = () =>
      document.getElementById("eng").classList.remove("hidden");
    document.getElementById("next").onclick = () => {
      line++;
      render();
    };
  }
  render();

  window.back = () => {
    lesson.classList = "hidden";
    document.getElementById("path").classList = "";
    renderPath();
  };
}

/* ================================
   SOUND FX
================================ */

function ding() { new Audio("https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.wav").play(); }
function buzz() { new Audio("https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.wav").play(); }

/* ================================
   BOOT
================================ */

loadProgress();
updateDay();

Promise.all([
  fetch("course.json").then(r => r.json()),
  fetch("stories.json").then(r => r.json())
]).then(([c, s]) => {
  COURSE = c;
  STORIES = s;
  renderPath();
});
