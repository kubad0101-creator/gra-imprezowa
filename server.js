const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- BAZA DANYCH W PAMIĘCI RAM ---
let questionsDB = [
    { 
        id: 1, 
        category: "1. Szybki Strzał", 
        q: "Ile zębów ma dorosły człowiek?", 
        options: ["32", "30", "34", "28"], 
        answer: "32" 
    },
    { 
        id: 2, 
        category: "5. Licytacja w Dół", 
        q: "Zrobienie 15 pompek w czasie poniżej 20 sekund.", 
        options: [], 
        answer: "" 
    }
];

let gameState = {
    phase: 'lobby',
    currentQuestion: null,
    players: {}
};

// --- API DLA PANELU ADMINA (CRUD) ---
app.get('/api/questions', (req, res) => res.json(questionsDB));

app.post('/api/questions', (req, res) => {
    // req.body zawiera teraz category, q, answer i tablicę options
    const newQuestion = { id: Date.now(), ...req.body };
    questionsDB.push(newQuestion);
    res.json({ success: true, question: newQuestion });
});

app.delete('/api/questions/:id', (req, res) => {
    questionsDB = questionsDB.filter(q => q.id != req.params.id);
    res.json({ success: true });
});

// --- KOMUNIKACJA W CZASIE RZECZYWISTYM (WEBSOCKETS) ---
io.on('connection', (socket) => {
    console.log(`Nowe połączenie: ${socket.id}`);

    socket.on('joinGame', (playerName) => {
        gameState.players[socket.id] = { name: playerName, score: 0, isDesperado: false };
        io.emit('updateState', gameState);
    });

    socket.on('submitAnswer', (answer) => {
        if(gameState.currentQuestion && answer === gameState.currentQuestion.answer) {
            gameState.players[socket.id].score += 100;
        }
        io.emit('updateState', gameState);
    });

    socket.on('adminStartRound', () => {
        if(questionsDB.length === 0) return;
        const randomQ = questionsDB[Math.floor(Math.random() * questionsDB.length)];
        gameState.phase = 'round';
        gameState.currentQuestion = randomQ;
        io.emit('updateState', gameState);
    });

    socket.on('adminBackToLobby', () => {
        gameState.phase = 'lobby';
        gameState.currentQuestion = null;
        io.emit('updateState', gameState);
    });

    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        io.emit('updateState', gameState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serwer dziala na porcie ${PORT}`);
});
