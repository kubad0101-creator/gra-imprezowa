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

// --- KONFIGURACJA 16 KATEGORII (Czas i Punkty) ---
let categoriesConfig = {
    "1. Szybki Strzał": { type: "abcd", time: 15, points: 100 },
    "2. Sąd Społeczny": { type: "vote", time: 30, points: 50 },
    "3. Inżynieria i Kalkulacje": { type: "open", time: 45, points: 150 },
    "4. Globtroter": { type: "abcd", time: 20, points: 100 },
    "5. Licytacja w Dół": { type: "auction", time: 60, points: 0 }, // Punkty licytowane
    "6. Historyczna Oś Czasu": { type: "slider", time: 30, points: 100 },
    "7. Iluzja Optyczna": { type: "open", time: 20, points: 150 },
    "8. Detektyw Zbiegowisk": { type: "open", time: 45, points: 100 },
    "9. Archiwum X": { type: "photo", time: 60, points: 50 },
    "10. Pikasso pod Presją": { type: "draw", time: 60, points: 100 },
    "11. Biologia i Ciało": { type: "abcd", time: 10, points: 150 },
    "12. Loża Szyderców": { type: "agree_disagree", time: 120, points: 50 },
    "13. Side Quest": { type: "open", time: 30, points: 200 },
    "14. Finał Finałów": { type: "auction", time: 60, points: 0 },
    "15. Pojedynek Desperata": { type: "abcd", time: 15, points: 300 },
    "16. Tajny Agent": { type: "info", time: 15, points: 500 }
};

// --- BAZA PYTAŃ ---
let questionsDB = [
    { id: 1, category: "1. Szybki Strzał", q: "Jaka jest stolica Australii?", options: ["Canberra", "Sydney", "Melbourne", "Perth"], answer: "Canberra" },
    { id: 2, category: "5. Licytacja w Dół", q: "Zrobienie 15 pompek w czasie poniżej 15 sekund.", options: [], answer: "" },
    { id: 3, category: "10. Pikasso pod Presją", q: "Narysuj leniwca przeżywającego kryzys finansowy.", options: [], answer: "" }
];

let gameState = {
    phase: 'lobby',
    currentQuestion: null,
    players: {},
    timer: 0,
    currentLowestBid: { player: null, amount: 100, socketId: null }
};

let gameLoopInterval = null;

// --- API DLA PANELU ADMINA ---
app.get('/api/config', (req, res) => res.json(categoriesConfig));
app.post('/api/config', (req, res) => {
    const { category, time, points } = req.body;
    if(categoriesConfig[category]) {
        categoriesConfig[category].time = parseInt(time);
        categoriesConfig[category].points = parseInt(points);
    }
    res.json({ success: true });
});

app.get('/api/questions', (req, res) => res.json(questionsDB));
app.post('/api/questions', (req, res) => {
    const newQuestion = { id: Date.now(), ...req.body };
    questionsDB.push(newQuestion);
    res.json({ success: true, question: newQuestion });
});
app.delete('/api/questions/:id', (req, res) => {
    questionsDB = questionsDB.filter(q => q.id != req.params.id);
    res.json({ success: true });
});

// --- AUTONOMICZNY SILNIK GRY ---
function startNextRound() {
    if(questionsDB.length === 0) return;
    gameState.currentQuestion = questionsDB[Math.floor(Math.random() * questionsDB.length)];
    gameState.phase = 'tactical';
    gameState.timer = 15; // 15s na pokój taktyczny
    
    gameState.currentLowestBid = { player: "Brak licytacji", amount: 100, socketId: null };
    for(let id in gameState.players) {
        gameState.players[id].boostActive = false;
        gameState.players[id].answered = false;
    }
    
    io.emit('updateState', gameState);
    startTimer(enterRoundPhase);
}

function enterRoundPhase() {
    gameState.phase = 'round';
    const catConfig = categoriesConfig[gameState.currentQuestion.category];
    gameState.timer = catConfig ? catConfig.time : 30; // Dynamiczny czas
    io.emit('updateState', gameState);

    startTimer(() => {
        if(catConfig.type === 'auction') enterAuctionVerify();
        else enterResultsPhase();
    });
}

function enterAuctionVerify() {
    gameState.phase = 'auction_verify';
    io.emit('updateState', gameState);
}

function enterResultsPhase() {
    gameState.phase = 'results';
    gameState.timer = 10;
    io.emit('updateState', gameState);
    startTimer(startNextRound);
}

function startTimer(callback) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(() => {
        gameState.timer--;
        io.emit('tick', gameState.timer);
        
        let allAnswered = true;
        let playerCount = 0;
        for(let id in gameState.players) {
            playerCount++;
            if(!gameState.players[id].answered) allAnswered = false;
        }

        const catType = categoriesConfig[gameState.currentQuestion?.category]?.type;
        if(gameState.timer <= 0 || (allAnswered && playerCount > 0 && catType !== 'auction' && catType !== 'photo' && catType !== 'draw' && catType !== 'agree_disagree')) {
            clearInterval(gameLoopInterval);
            callback();
        }
    }, 1000);
}

// --- WEBSOCKETS ---
io.on('connection', (socket) => {
    socket.on('joinGame', (playerName) => {
        gameState.players[socket.id] = { name: playerName, score: 0, boostActive: false, answered: false };
        io.emit('updateState', gameState);
    });

    socket.on('activateBoost', () => {
        if(gameState.players[socket.id]) {
            gameState.players[socket.id].boostActive = true;
            io.to(socket.id).emit('msg', 'Boost x2 Aktywowany!');
        }
    });

    socket.on('tvStartGame', () => { if(gameState.phase === 'lobby') startNextRound(); });

    socket.on('tvAuctionResult', (success) => {
        if(gameState.currentLowestBid.socketId) {
            const winnerId = gameState.currentLowestBid.socketId;
            if(gameState.players[winnerId]) {
                if(success) gameState.players[winnerId].score += gameState.currentLowestBid.amount;
                else gameState.players[winnerId].score -= gameState.currentLowestBid.amount;
            }
        }
        enterResultsPhase();
    });

    socket.on('submitAnswer', (answer) => {
        const player = gameState.players[socket.id];
        if(!player || player.answered || gameState.phase !== 'round') return;

        const catConfig = categoriesConfig[gameState.currentQuestion.category];
        
        if (catConfig.type === 'auction') {
            const bid = parseInt(answer);
            if(bid < gameState.currentLowestBid.amount && bid > 0) {
                gameState.currentLowestBid = { player: player.name, amount: bid, socketId: socket.id };
                io.emit('auctionUpdate', gameState.currentLowestBid);
            }
            return; 
        }

        player.answered = true;
        let points = 0;
        
        if(gameState.currentQuestion.answer && answer.toString().toLowerCase() === gameState.currentQuestion.answer.toString().toLowerCase()) {
            points = catConfig.points;
        } else if(catConfig.type === 'vote' || catConfig.type === 'photo' || catConfig.type === 'draw') {
            points = catConfig.points; 
        }

        if(player.boostActive && points > 0) points *= 2;
        player.score += points;
        io.emit('updateState', gameState);
    });

    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        io.emit('updateState', gameState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serwer na porcie ${PORT}`));
