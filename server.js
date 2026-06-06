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

// GIGANTYCZNA BAZA PYTAŃ (16 Kategorii x 5 Pytań = 80)
let questionsDB = [
    // 1. Szybki Strzał (abcd)
    { id: 101, category: "1. Szybki Strzał", type: "abcd", q: "Jaka jest stolica Australii?", options: ["Canberra", "Sydney", "Melbourne", "Perth"], answer: "Canberra" },
    { id: 102, category: "1. Szybki Strzał", type: "abcd", q: "Ile zębów ma dorosły człowiek?", options: ["32", "30", "34", "28"], answer: "32" },
    { id: 103, category: "1. Szybki Strzał", type: "abcd", q: "Jaki jest najlżejszy pierwiastek?", options: ["Wodór", "Hel", "Tlen", "Azot"], answer: "Wodór" },
    { id: 104, category: "1. Szybki Strzał", type: "abcd", q: "Z jakiego kraju pochodzi marka Skoda?", options: ["Czechy", "Słowacja", "Polska", "Niemcy"], answer: "Czechy" },
    { id: 105, category: "1. Szybki Strzał", type: "abcd", q: "Ile zer ma bilion?", options: ["12", "9", "15", "6"], answer: "12" },

    // 2. Sąd Społeczny (vote)
    { id: 201, category: "2. Sąd Społeczny", type: "vote", q: "Kto z nas jako pierwszy zginąłby w filmie grozy przez własną głupotę?", options: [], answer: "" },
    { id: 202, category: "2. Sąd Społeczny", type: "vote", q: "Kto z obecnych najbardziej ukrywa, że nie ma pojęcia, co robi w życiu?", options: [], answer: "" },
    { id: 203, category: "2. Sąd Społeczny", type: "vote", q: "Gdybyśmy założyli firmę, kto pierwszy zwolniłby resztę z zimną krwią?", options: [], answer: "" },
    { id: 204, category: "2. Sąd Społeczny", type: "vote", q: "Kto najgorzej znosi przegrywanie w planszówki?", options: [], answer: "" },
    { id: 205, category: "2. Sąd Społeczny", type: "vote", q: "Kto z nas mógłby przypadkiem wstąpić do sekty, myśląc, że to kurs jogi?", options: [], answer: "" },

    // 3. Inżynieria i Kalkulacje (open)
    { id: 301, category: "3. Inżynieria i Kalkulacje", type: "open", q: "Samochód jedzie 60 km/h. Ile km pokona w 120 minut?", options: [], answer: "120" },
    { id: 302, category: "3. Inżynieria i Kalkulacje", type: "open", q: "Bateria i telefon kosztują 110. Telefon jest o 100 droższy. Ile kosztuje bateria?", options: [], answer: "5" },
    { id: 303, category: "3. Inżynieria i Kalkulacje", type: "open", q: "Oblicz: 6^2 / 2(3) + 4 (zgodnie z kolejnością działań).", options: [], answer: "58" },
    { id: 304, category: "3. Inżynieria i Kalkulacje", type: "open", q: "Rolnik ma 17 owiec. Wszystkie oprócz 9 zmarły. Ile owiec mu zostało?", options: [], answer: "9" },
    { id: 305, category: "3. Inżynieria i Kalkulacje", type: "open", q: "Jaka jest kolejna liczba w ciągu: 2, 6, 12, 20...?", options: [], answer: "30" },

    // 4. Globtroter (abcd)
    { id: 401, category: "4. Globtroter", type: "abcd", q: "Gdzie znajduje się najwyższy wodospad na świecie?", options: ["Wenezuela", "Kanada", "Brazylia", "RPA"], answer: "Wenezuela" },
    { id: 402, category: "4. Globtroter", type: "abcd", q: "Który z tych krajów NIE ma dostępu do morza?", options: ["Czechy", "Holandia", "Szwecja", "Portugalia"], answer: "Czechy" },
    { id: 403, category: "4. Globtroter", type: "abcd", q: "Przez które miasto NIE przepływa rzeka Dunaj?", options: ["Praga", "Wiedeń", "Budapeszt", "Belgrad"], answer: "Praga" },
    { id: 404, category: "4. Globtroter", type: "abcd", q: "Stolicą jakiego państwa jest Lima?", options: ["Peru", "Chile", "Ekwador", "Kolumbia"], answer: "Peru" },
    { id: 405, category: "4. Globtroter", type: "abcd", q: "Najmniejsze niepodległe państwo świata to:", options: ["Watykan", "Monako", "Nauru", "San Marino"], answer: "Watykan" },

    // 5. Licytacja w Dół (auction)
    { id: 501, category: "5. Licytacja w Dół", type: "auction", q: "Stanie w pozycji deski (plank) przez 45 sekund. Kto da najmniej punktów, by to zrobić?", options: [], answer: "" },
    { id: 502, category: "5. Licytacja w Dół", type: "auction", q: "Wypicie szklanki wody z cytryną i solą duszkiem.", options: [], answer: "" },
    { id: 503, category: "5. Licytacja w Dół", type: "auction", q: "Pozwolenie, by ktoś narysował ci kropkę na czole markerem.", options: [], answer: "" },
    { id: 504, category: "5. Licytacja w Dół", type: "auction", q: "Zrobienie 15 przysiadów w czasie poniżej 15 sekund.", options: [], answer: "" },
    { id: 505, category: "5. Licytacja w Dół", type: "auction", q: "Wymienienie 10 państw afrykańskich w 15 sekund.", options: [], answer: "" },

    // 6. Historyczna Oś Czasu (slider - dekady)
    { id: 601, category: "6. Historyczna Oś Czasu", type: "slider", q: "W której dekadzie wybuchła I wojna światowa?", options: [], answer: "1910" },
    { id: 602, category: "6. Historyczna Oś Czasu", type: "slider", q: "W której dekadzie zatonął Titanic?", options: [], answer: "1910" },
    { id: 603, category: "6. Historyczna Oś Czasu", type: "slider", q: "W której dekadzie wylądowano na Księżycu (Apollo 11)?", options: [], answer: "1960" },
    { id: 604, category: "6. Historyczna Oś Czasu", type: "slider", q: "W której dekadzie założono Google?", options: [], answer: "1990" },
    { id: 605, category: "6. Historyczna Oś Czasu", type: "slider", q: "W której dekadzie wypuszczono pierwszego iPhone'a?", options: [], answer: "2000" },

    // 7. Iluzja Optyczna (open - zgadywanie przedmiotu)
    { id: 701, category: "7. Iluzja Optyczna", type: "open", q: "To struktura, która z bliska wygląda jak małe haczyki i pętelki. Co to jest?", options: [], answer: "Rzep" },
    { id: 702, category: "7. Iluzja Optyczna", type: "open", q: "Zdjęcie mikroskopowe nasion na czerwonej, pofałdowanej powierzchni. Co to za owoc?", options: [], answer: "Truskawka" },
    { id: 703, category: "7. Iluzja Optyczna", type: "open", q: "Czarne, cienkie spirale z bliska pod igłą. Co to jest?", options: [], answer: "Płyta winylowa" },
    { id: 704, category: "7. Iluzja Optyczna", type: "open", q: "Wielokrotnie powiększone ziarno o brązowym kolorze po wypaleniu. Co to?", options: [], answer: "Kawa" },
    { id: 705, category: "7. Iluzja Optyczna", type: "open", q: "Złote lub srebrne okręgi z ząbkami na krawędzi. Co to za przedmiot?", options: [], answer: "Moneta" },

    // 8. Detektyw Zbiegowisk (open - prawdy o grupie)
    { id: 801, category: "8. Detektyw Zbiegowisk", type: "open", q: "Wpisz poniżej najgłupszą rzecz, w którą wierzyłeś jako dziecko.", options: [], answer: "" },
    { id: 802, category: "8. Detektyw Zbiegowisk", type: "open", q: "Jaką piosenkę śpiewasz, gdy nikt nie słyszy?", options: [], answer: "" },
    { id: 803, category: "8. Detektyw Zbiegowisk", type: "open", q: "Twój najdziwniejszy, najbardziej wstydliwy zakup w internecie to...", options: [], answer: "" },
    { id: 804, category: "8. Detektyw Zbiegowisk", type: "open", q: "Wpisz swoje najbardziej absurdalne fobie.", options: [], answer: "" },
    { id: 805, category: "8. Detektyw Zbiegowisk", type: "open", q: "Podaj najgorszy prezent, jaki kiedykolwiek dostałeś.", options: [], answer: "" },

    // 9. Archiwum X (photo - przesyłanie zdjęć)
    { id: 901, category: "9. Archiwum X", type: "photo", q: "Wgraj swoje najdziwniejsze selfie z galerii telefonu.", options: [], answer: "" },
    { id: 902, category: "9. Archiwum X", type: "photo", q: "Wgraj najstarszego mema, jakiego znajdziesz u siebie na dysku.", options: [], answer: "" },
    { id: 903, category: "9. Archiwum X", type: "photo", q: "Zrób teraz zdjęcie przedmiotu w tym pokoju pod dziwnym kątem.", options: [], answer: "" },
    { id: 904, category: "9. Archiwum X", type: "photo", q: "Wgraj zdjęcie ze swoich wakacji, na którym ktoś robi dziwną minę.", options: [], answer: "" },
    { id: 905, category: "9. Archiwum X", type: "photo", q: "Wrzuć zdjęcie swojego dzisiejszego posiłku lub pierwszego lepszego jedzenia z galerii.", options: [], answer: "" },

    // 10. Pikasso pod Presją (draw - rysowanie na canvasie)
    { id: 1001, category: "10. Pikasso", type: "draw", q: "Narysuj: Leniwca przeżywającego kryzys finansowy.", options: [], answer: "" },
    { id: 1002, category: "10. Pikasso", type: "draw", q: "Narysuj: Rekina grającego na saksofonie.", options: [], answer: "" },
    { id: 1003, category: "10. Pikasso", type: "draw", q: "Narysuj: Zapach świeżo skoszonej trawy.", options: [], answer: "" },
    { id: 1004, category: "10. Pikasso", type: "draw", q: "Narysuj: Wymarzony środek transportu do pracy.", options: [], answer: "" },
    { id: 1005, category: "10. Pikasso", type: "draw", q: "Narysuj: Swój wyraz twarzy, gdy rano dzwoni budzik.", options: [], answer: "" },

    // 11. Biologia i Ciało (abcd)
    { id: 1101, category: "11. Biologia i Ciało", type: "abcd", q: "Ile serc ma ośmiornica?", options: ["3", "1", "2", "4"], answer: "3" },
    { id: 1102, category: "11. Biologia i Ciało", type: "abcd", q: "Najdłuższa kość w ciele człowieka to:", options: ["Udowa", "Piszczelowa", "Ramienna", "Strzałkowa"], answer: "Udowa" },
    { id: 1103, category: "11. Biologia i Ciało", type: "abcd", q: "Uniwersalny dawca krwi ma grupę:", options: ["0", "AB", "A", "B"], answer: "0" },
    { id: 1104, category: "11. Biologia i Ciało", type: "abcd", q: "Białko tworzące włosy i paznokcie to:", options: ["Keratyna", "Kolagen", "Melanina", "Hemoglobina"], answer: "Keratyna" },
    { id: 1105, category: "11. Biologia i Ciało", type: "abcd", q: "Który narząd ludzki ma największe zdolności regeneracyjne?", options: ["Wątroba", "Serce", "Płuco", "Nerka"], answer: "Wątroba" },

    // 12. Loża Szyderców (agree_disagree)
    { id: 1201, category: "12. Loża Szyderców", type: "agree_disagree", q: "Ananas na pizzy to kulinarna zbrodnia.", options: [], answer: "" },
    { id: 1202, category: "12. Loża Szyderców", type: "agree_disagree", q: "Praca zdalna rozleniwia ludzi bardziej niż praca w biurze.", options: [], answer: "" },
    { id: 1203, category: "12. Loża Szyderców", type: "agree_disagree", q: "Sztuczna inteligencja przyniesie ludzkości więcej szkód niż pożytku.", options: [], answer: "" },
    { id: 1204, category: "12. Loża Szyderców", type: "agree_disagree", q: "Studia wyższe w dzisiejszych czasach to w większości strata czasu.", options: [], answer: "" },
    { id: 1205, category: "12. Loża Szyderców", type: "agree_disagree", q: "Oglądanie filmów z dubbingiem to profanacja sztuki filmowej.", options: [], answer: "" },

    // 13. Side Quest (open - pamięć o grze)
    { id: 1301, category: "13. Side Quest", type: "open", q: "Jaką kategorię wylosowano jako pierwszą w tej grze?", options: [], answer: "" },
    { id: 1302, category: "13. Side Quest", type: "open", q: "Jakiego koloru był stoper/pasek podczas oczekiwania w Pokoju Taktycznym?", options: [], answer: "" },
    { id: 1303, category: "13. Side Quest", type: "open", q: "Kto wygrał poprzednią licytację w dół?", options: [], answer: "" },
    { id: 1304, category: "13. Side Quest", type: "open", q: "Jakiego słowa użyto na pierwszym ekranie telewizora by wejść do gry?", options: [], answer: "Zeskanuj" },
    { id: 1305, category: "13. Side Quest", type: "open", q: "Kto na początku gry miał najmniej punktów po pierwszej rundzie?", options: [], answer: "" },

    // 14. Finał Finałów (auction - licytacja wiedzy)
    { id: 1401, category: "14. Finał Finałów", type: "auction", q: "Wymień na głos państwa leżące w Europie. Ile zadeklarujesz, że wymienisz?", options: [], answer: "" },
    { id: 1402, category: "14. Finał Finałów", type: "auction", q: "Ile wymienisz marek samochodów produkowanych w Azji?", options: [], answer: "" },
    { id: 1403, category: "14. Finał Finałów", type: "auction", q: "Ile wymienisz pierwiastków z tablicy Mendelejewa?", options: [], answer: "" },
    { id: 1404, category: "14. Finał Finałów", type: "auction", q: "Ile wymienisz stolic państw amerykańskich (Północna + Południowa)?", options: [], answer: "" },
    { id: 1405, category: "14. Finał Finałów", type: "auction", q: "Ile wymienisz zawodów medycznych/specjalizacji lekarskich?", options: [], answer: "" },

    // 15. Pojedynek Desperata (abcd - niszowa)
    { id: 1501, category: "15. Pojedynek Desperata", type: "abcd", q: "Które drewno uchodzi za najtwardsze w Europie?", options: ["Grab", "Dąb", "Brzoza", "Sosna"], answer: "Grab" },
    { id: 1502, category: "15. Pojedynek Desperata", type: "abcd", q: "Z jakiego owocu produkuje się wodę kokosową?", options: ["Młodego, zielonego", "Brązowego", "Liści", "Korzeni"], answer: "Młodego, zielonego" },
    { id: 1503, category: "15. Pojedynek Desperata", type: "abcd", q: "Choroba dawniej zwana suchotami to:", options: ["Gruźlica", "Dżuma", "Cholera", "Szkorbut"], answer: "Gruźlica" },
    { id: 1504, category: "15. Pojedynek Desperata", type: "abcd", q: "Jakiego koloru dym oznacza palenie oleju silnikowego?", options: ["Niebieski", "Biały", "Czarny", "Zielony"], answer: "Niebieski" },
    { id: 1505, category: "15. Pojedynek Desperata", type: "abcd", q: "Karambola po przekrojeniu ma kształt:", options: ["Gwiazdy", "Serca", "Kwadratu", "Krzyża"], answer: "Gwiazdy" },

    // 16. Tajny Agent (info - na telefonach na wejściu)
    { id: 1601, category: "16. Tajny Agent", type: "info", q: "Upewnij się na koniec gry, że ktoś podał Ci napój z własnej woli.", options: [], answer: "" },
    { id: 1602, category: "16. Tajny Agent", type: "info", q: "Przekonaj grupę w pewnym momencie gry, że telewizor się na chwilę zaciął.", options: [], answer: "" },
    { id: 1603, category: "16. Tajny Agent", type: "info", q: "Wpleć słowo 'hipopotam' do dowolnej dyskusji podczas gry.", options: [], answer: "" },
    { id: 1604, category: "16. Tajny Agent", type: "info", q: "Zmuś osobę po swojej prawej stronie, by przybiła Ci piątkę.", options: [], answer: "" },
    { id: 1605, category: "16. Tajny Agent", type: "info", q: "Zaproponuj przewietrzenie pokoju i wstań, by otworzyć okno.", options: [], answer: "" }
];

let gameState = {
    phase: 'lobby',
    currentQuestion: null,
    players: {},
    submittedImages: [] // Dla obrazów i rysunków
};

// --- WEBSOCKETS ---
io.on('connection', (socket) => {
    socket.on('joinGame', (playerName) => {
        gameState.players[socket.id] = { name: playerName, score: 0, boostActive: false, answered: false, answerData: null };
        io.emit('updateState', gameState);
    });

    socket.on('activateBoost', () => {
        if(gameState.players[socket.id]) {
            gameState.players[socket.id].boostActive = true;
            io.to(socket.id).emit('msg', 'Boost x2 Aktywowany!');
        }
    });

    socket.on('submitAnswer', (answer) => {
        const player = gameState.players[socket.id];
        if(!player || player.answered) return;
        
        player.answered = true;
        player.answerData = answer; // Zapisz odpowiedź (np. wpisany tekst lub wybraną osobę)
        let pointsEarned = 0;
        const q = gameState.currentQuestion;

        if (q.type === 'abcd' || q.type === 'open') {
            if(answer.toString().toLowerCase() === q.answer.toString().toLowerCase()) {
                pointsEarned = 100;
            }
        } else if (q.type === 'slider') {
            if(Math.abs(parseInt(answer) - parseInt(q.answer)) === 0) pointsEarned = 100;
            else if (Math.abs(parseInt(answer) - parseInt(q.answer)) <= 10) pointsEarned = 50;
        } else if (q.type === 'photo' || q.type === 'draw') {
            gameState.submittedImages.push({ name: player.name, img: answer });
            pointsEarned = 50; // Nagroda za kreację
        } else {
            pointsEarned = 50; // Głosowanie/Licytacja - nagroda za udział, reszta liczona ręcznie przez Admina
        }

        if(player.boostActive) pointsEarned *= 2;
        player.score += pointsEarned;
        
        io.emit('updateState', gameState);
    });

    socket.on('adminStartTactical', () => {
        if(questionsDB.length === 0) return;
        gameState.currentQuestion = questionsDB[Math.floor(Math.random() * questionsDB.length)];
        gameState.phase = 'tactical';
        gameState.submittedImages = []; // Reset obrazów
        for(let id in gameState.players) {
            gameState.players[id].boostActive = false;
            gameState.players[id].answered = false;
            gameState.players[id].answerData = null;
        }
        io.emit('updateState', gameState);
    });

    socket.on('adminStartRound', () => {
        gameState.phase = 'round';
        io.emit('updateState', gameState);
    });

    socket.on('adminShowResults', () => {
        gameState.phase = 'results';
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
server.listen(PORT, () => console.log(`Serwer na porcie ${PORT}`));
