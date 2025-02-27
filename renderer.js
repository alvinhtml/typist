const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

let words = [];
let currentWordIndex = 0;
let correctCount = 0;
let totalAttempts = 0;
let gameTime;
let speed;
let limit;
let timer;

// Load configuration
function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    speed = config.speed;
    limit = config.limit;
    gameTime = config.gameTime;
    updateTimer();
}

// Load words from CSV
function loadWords() {
    const results = [];
    fs.createReadStream(path.join(__dirname, 'data', 'words.csv'))
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            words = results;
            displayNextWord();
        });
}

function displayNextWord() {
    if (currentWordIndex < words.length) {
        document.getElementById('word-display').textContent = words[currentWordIndex].word;
    }
}

function updateStats() {
    const accuracy = totalAttempts > 0 ? (correctCount / totalAttempts * 100).toFixed(1) : 0;
    const wordsPerMinute = (correctCount / (gameTime - timer) * 60).toFixed(1);
    
    document.getElementById('accuracy').textContent = `${accuracy}%`;
    document.getElementById('speed').textContent = `${wordsPerMinute} 字/分`;
}

function updateTimer() {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    document.getElementById('time').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startGame() {
    timer = gameTime;
    setInterval(() => {
        if (timer > 0) {
            timer--;
            updateTimer();
        } else {
            endGame();
        }
    }, 1000);
}

function endGame() {
    document.getElementById('input-area').disabled = true;
    alert('练习结束！');
}

// Event listeners
document.getElementById('input-area').addEventListener('input', (e) => {
    const input = e.target.value;
    const currentWord = words[currentWordIndex];
    
    if (input === currentWord.code) {
        correctCount++;
        currentWordIndex++;
        e.target.value = '';
        displayNextWord();
    }
    
    totalAttempts++;
    updateStats();
});

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadWords();
    startGame();
});
