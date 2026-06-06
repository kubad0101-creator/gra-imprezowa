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

// BAZA DANYCH (Teraz panel admina będzie ją edytował)
let questionsDB = [
    { id: 101, category: "1. Szybki Strzał", type: "abcd", q: "Jaka jest stolica Australii?", options: ["Canberra", "Sydney", "Melbourne", "Perth"], answer: "Canberra" },
    { id: 501, category: "5. Licytacja w Dół", type: "auction", q: "Zrobienie 15 pompek w czasie poniżej 15 sekund.", options: [], answer: "" },
    { id: 201, category: "2. Sąd Społeczny", type: "vote", q: "Kto z nas zginąłby jako pierwszy w horrorze?", options: [], answer: "" }
];

let gameState = {
    phase: 'lobby', // lobby, tactical, round, auction_verify, results
    currentQuestion: null,
    players: {},
    timer: 0,
    currentLowestBid: { player: null, amount: 100, socketId: null }
};

let gameLoopInterval = null;

// --- API DLA PANELU ADMINA (Tylko Baza Danych) ---
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

// --- AUTONOMICZNY SILNIK GRY (GAME ENGINE) ---

function startNextRound() {
    if(questionsDB.length === 0) return;
    gameState.currentQuestion = questionsDB[Math.floor(Math.random() * questionsDB.length)];
    gameState.phase = 'tactical';
    gameState.timer = 15; // 15 sekund w pokoju taktycznym
    
    // Reset graczy i licytacji
    gameState.currentLowestBid = { player: "Nikt jeszcze nie licytował", amount: 100, socketId: null };
    for(let id in gameState.players) {
        gameState.players[id].boostActive = false;
        gameState.players[id].answered = false;
    }
    
    io.emit('updateState', gameState);
    startTimer(enterRoundPhase);
}

function enterRoundPhase() {
    gameState.phase = 'round';
    // Licytacja ma 60 sekund, inne rundy 30 sekund
    gameState.timer = gameState.currentQuestion.type === 'auction' ? 60 : 30; 
    io.emit('updateState', gameState);

    startTimer(() => {
        if(gameState.currentQuestion.type === 'auction') {
            enterAuctionVerify(); // Zatrzymuje grę na weryfikację zadania fizycznego
        } else {
            enterResultsPhase();
        }
    });
}

function enterAuctionVerify() {
    gameState.phase = 'auction_verify';
    io.emit('updateState', gameState);
    // Tutaj nie ma timera. Gra czeka, aż ktoś na TV kliknie ZALICZONE lub OBLANE.
}

function enterResultsPhase() {
    gameState.phase = 'results';
    gameState.timer = 10; // 10 sekund na pokazanie wyników i rankingów
    io.emit('updateState', gameState);
    
    startTimer(startNextRound); // Pętla wraca do początku!
}

function startTimer(callback) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(() => {
        gameState.timer--;
        io.emit('tick', gameState.timer); // Wysyłanie samego czasu co sekundę
        
        // Sprawdzanie czy wszyscy odpowiedzieli (przyspieszenie rundy)
        let allAnswered = true;
        let playerCount = 0;
        for(let id in gameState.players) {
            playerCount++;
            if(!gameState.players[id].answered) allAnswered = false;
        }

        if(gameState.timer <= 0 || (allAnswered && playerCount > 0 && gameState.currentQuestion.type !== 'auction')) {
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

    // Sterowanie Grą z poziomu Telewizora
    socket.on('tvStartGame', () => {
        if(gameState.phase === 'lobby') startNextRound();
    });

    socket.on('tvAuctionResult', (success) => {
        // Weryfikacja po licytacji
        if(gameState.currentLowestBid.socketId) {
            const winnerId = gameState.currentLowestBid.socketId;
            if(gameState.players[winnerId]) {
                if(success) {
                    gameState.players[winnerId].score += gameState.currentLowestBid.amount;
                } else {
                    // OSTRZEŻENIE ZREALIZOWANE: Odejmujemy wylicytowane punkty za porażkę
                    gameState.players[winnerId].score -= gameState.currentLowestBid.amount;
                }
            }
        }
        enterResultsPhase();
    });

    // Zbieranie odpowiedzi
    socket.on('submitAnswer', (answer) => {
        const player = gameState.players[socket.id];
        if(!player || player.answered || gameState.phase !== 'round') return;

        // Logika Licytacji na żywo (Gracz nie jest blokowany po wysłaniu, może licytować wiele razy)
        if (gameState.currentQuestion.type === 'auction') {
            const bid = parseInt(answer);
            if(bid < gameState.currentLowestBid.amount && bid > 0) {
                gameState.currentLowestBid = { player: player.name, amount: bid, socketId: socket.id };
                io.emit('auctionUpdate', gameState.currentLowestBid); // Natychmiastowy update na ekrany
            }
            return; // Wychodzimy, bo przy licytacji gracz może pisać dalej
        }

        // Standardowe punkty
        player.answered = true;
        let points = 0;
        if(gameState.currentQuestion.answer && answer.toString().toLowerCase() === gameState.currentQuestion.answer.toString().toLowerCase()) {
            points = 100;
        } else if(gameState.currentQuestion.type === 'vote') {
            points = 50; // Za udział w głosowaniu
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
