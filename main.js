// main.js - BlackJack game logic
// Enable strict mode
'use strict';

/********************
 * Utility Helpers  *
 *******************/
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const flash = (el) => { el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'), 300); };
const showEl = (el, show=true)=> el.classList.toggle('hidden', !show);

const showToast = (msg) => {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
};

/********************
 * Card & Deck      *
 *******************/
class Card {
  /**
   * @param {string} rank - "A", "2".."K"
   * @param {string} suit - "♠","♥","♦","♣"
   */
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  }
  get value() {
    if (['J','Q','K'].includes(this.rank)) return 10;
    if (this.rank === 'A') return 11;
    return parseInt(this.rank, 10);
  }
  render(faceDown = false) {
    const div = document.createElement('div');
    const isRed = ['♥','♦'].includes(this.suit);
    div.className = 'card' + (isRed ? ' red' : '');
    if (['J', 'Q', 'K'].includes(this.rank)) {
      div.classList.add('face-card');
    }

    if (faceDown) {
      div.textContent = '🂠';
      return div;
    }
    const top = document.createElement('div');
    top.className = 'corner';
    top.textContent = `${this.rank}${this.suit}`;

    const suitMid = document.createElement('div');
    suitMid.className = 'suit';
    if (['J', 'Q', 'K'].includes(this.rank)) {
      suitMid.textContent = this.rank;
    } else {
      suitMid.textContent = this.suit;
    }

    const bot = document.createElement('div');
    bot.className = 'corner bottom';
    bot.textContent = `${this.rank}${this.suit}`;

    div.append(top, suitMid, bot);
    return div;
  }
}

class Deck {
  constructor(numDecks = 6) {
    this.numDecks = numDecks;
    this.cards = [];
    this.reset();
  }
  reset() {
    const suits = ['♠','♥','♦','♣'];
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    this.cards = [];
    for (let n = 0; n < this.numDecks; n++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          this.cards.push(new Card(rank, suit));
        }
      }
    }
    this.shuffle();
  }
  shuffle() {
    // Fisher-Yates
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
  draw() {
    if (this.cards.length === 0) this.reset();
    return this.cards.pop();
  }
  penetration() {
    return 1 - this.cards.length / (52 * this.numDecks);
  }
}

/********************
 * Hand             *
 *******************/
class Hand {
  constructor() {
    this.cards = [];
  }
  add(card) { this.cards.push(card); }
  reset() { this.cards = []; }
  get score() {
    let total = 0;
    let aces = 0;
    for (const c of this.cards) {
      total += c.value;
      if (c.rank === 'A') aces += 1;
    }
    while (total > 21 && aces) {
      total -= 10; // Ace as 1 instead of 11
      aces -= 1;
    }
    return total;
  }
  isBlackjack() { return this.cards.length === 2 && this.score === 21; }
  isBusted() { return this.score > 21; }
  isSoft() {
    const aceCount = this.cards.filter(c => c.rank === 'A').length;
    if (aceCount === 0) return false;

    const nonAceTotal = this.cards
      .filter(c => c.rank !== 'A')
      .reduce((sum, card) => sum + card.value, 0);

    const hardTotal = nonAceTotal + aceCount;
    return hardTotal + 10 <= 21;
  }
}

/********************
 * Player & Dealer  *
 *******************/
class Player {
  constructor(name, bankroll = 1000, isAI = false) {
    this.name = name;
    this.bankroll = bankroll;
    this.hand = new Hand();
    this.bet = 0;
    this.isAI = isAI;
    this.stats = { wins: 0, losses: 0, pushes: 0 };

    // UI elements to be assigned later
    this.el = null;
    this.handEl = null;
    this.totalEl = null;
  }
  resetHand() { this.hand.reset(); }
}

class Dealer extends Player {
  constructor() {
    super('Dealer', Infinity);
  }
}

/********************
 * Achievement System *
 ********************/
class AchievementManager {
  constructor() {
    this.achievements = {
      firstWin: { name: 'First Victory', desc: 'Win your first hand.', icon: '🏆', unlocked: false },
      blackjack: { name: 'Blackjack!', desc: 'Get a Blackjack.', icon: '🃏', unlocked: false },
      fiveCardCharlie: { name: 'Five Card Charlie', desc: 'Win with 5 cards without busting.', icon: '🖐️', unlocked: false },
      streak3: { name: 'On a Roll', desc: 'Win 3 hands in a row.', icon: '🔥', unlocked: false },
      highRoller: { name: 'High Roller', desc: 'Place a bet of 100 or more.', icon: '💰', unlocked: false },
      bankrupt: { name: 'Fresh Start', desc: 'Lose all your money.', icon: '💔', unlocked: false },
    };
    this.winStreak = 0;
    this.load();
  }

  unlock(key) {
    if (!this.achievements[key] || this.achievements[key].unlocked) return;
    this.achievements[key].unlocked = true;
    showToast(`Achievement Unlocked: ${this.achievements[key].name}!`, 'success');
    this.save();
  }

  check(game, result) {
    const player = game.players[0];
    if (result === 'win') {
      this.winStreak++;
      this.unlock('firstWin');
      if (player.hand.isBlackjack()) this.unlock('blackjack');
      if (player.hand.cards.length >= 5) this.unlock('fiveCardCharlie');
      if (this.winStreak >= 3) this.unlock('streak3');
    } else if (result === 'lose') {
      this.winStreak = 0;
    }

    if (player.bet >= 100) this.unlock('highRoller');
    if (player.bankroll <= 0 && player.bet === 0) this.unlock('bankrupt');
  }

  save() {
    const unlocked = Object.keys(this.achievements).filter(k => this.achievements[k].unlocked);
    localStorage.setItem('blackjack_achievements', JSON.stringify(unlocked));
  }

  load() {
    const unlocked = JSON.parse(localStorage.getItem('blackjack_achievements') || '[]');
    unlocked.forEach(key => {
      if (this.achievements[key]) this.achievements[key].unlocked = true;
    });
  }

  render() {
    const listEl = $('#achievements-list');
    listEl.innerHTML = '';
    for (const key in this.achievements) {
      const ach = this.achievements[key];
      const el = document.createElement('div');
      el.className = 'achievement' + (ach.unlocked ? ' unlocked' : '');
      el.innerHTML = `
        <div class="achievement-icon">${ach.icon}</div>
        <h3>${ach.name}</h3>
        <p>${ach.desc}</p>
      `;
      listEl.appendChild(el);
    }
  }
}

/********************
 * ChipBank         *
 *******************/
class ChipBank {
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.denoms = [1,5,25,100];
    this.render();
  }
  render() {
    this.rootEl.innerHTML = '';
    for (const val of this.denoms) {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.dataset.value = val;
      chip.textContent = val;
      chip.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('chip-click', { detail: val }));
      });
      this.rootEl.appendChild(chip);
    }
  }
}

/********************
 * Game             *
 *******************/
class BlackJackGame {
  constructor() {
    // Elements
    this.appEl = $('#app');
    this.playersAreaEl = $('#players-area');
    this.dealerHandEl = $('#dealer-hand');
    this.bankrollEl = $('#bankroll');
    this.betDisplayEl = $('#bet-display');
    this.hitBtn = $('#hit-btn');
    this.standBtn = $('#stand-btn');
    this.doubleBtn = $('#double-btn');
    this.dealBtn = $('#deal-btn');
    // Update button label
    this.dealBtn.textContent = 'Ready & Deal';
    this.timerRing = $('#timer-ring');
    // Remove global HUD timer element
    const globalTimerEl = $('#timer');
    if (globalTimerEl) globalTimerEl.remove();
    this.chipTray = $('#chip-tray');
    this.resultModal = $('#result-modal');
    this.resultModalContent = $('#result-modal .modal-content');
    this.resultMessageEl = $('#result-message');
    this.resultPlayerScoreEl = $('#result-player-score');
    this.resultDealerScoreEl = $('#result-dealer-score');
    this.nextRoundBtn = $('#next-round-btn');
    this.themeToggleBtn = $('#theme-toggle');
    this.achievementsBtn = $('#achievements-btn');
    this.achievementsModal = $('#achievements-modal');
    this.deckPileEl = $('#deck-pile');

    // Game state
    this.deck = new Deck();
    this.players = [];
    this.dealer = new Dealer();
    this.loadStats(); // Load saved stats on startup
    this.currentPlayerIndex = 0;
    this.running = false;
    this.timer = null;
    this.timeLeft = 15;
    this.achievementManager = new AchievementManager();
    this.themes = ['casino-theme', 'cyberpunk-theme', 'candyland-theme'];
    this.currentThemeIndex = 0;
    this.selectedPlayerIndex = 0;

    // UI & events
    new ChipBank($('#chip-tray'));
    this.init();
  }

  init() {
    this.setupEventHandlers();
    this.setupPlayers();
    this.updateHUD();
    this.loadTheme();
    this.loadStats();
    this.achievementManager.render(); // Initial render
  }

  setupEventHandlers() {
    // Game controls
    this.dealBtn.addEventListener('click', () => this.readyOrStart());
    this.hitBtn.addEventListener('click', () => this.playerAction('hit'));
    this.standBtn.addEventListener('click', () => this.playerAction('stand'));
    this.doubleBtn.addEventListener('click', () => this.playerAction('double'));

    // Chip betting
    this.chipTray.addEventListener('click', e => {
      if (e.target.classList.contains('chip')) {
        const value = parseInt(e.target.dataset.value, 10);
        this.placeBet(value);
      }
    });

    // Toolbar and modals
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    this.nextRoundBtn.addEventListener('click', () => this.prepareNewRound());
    $('#leaderboard-btn').addEventListener('click', () => this.showLeaderboard());
    $('#reset-leaderboard-btn').addEventListener('click', () => {
      localStorage.removeItem('blackjack_leaderboard');
      // Also reset stats on the current player object
      const humanPlayer = this.players[0];
      humanPlayer.stats = { wins: 0, losses: 0, pushes: 0 };
      this.showLeaderboard(); // Refresh the view
    });

    // Achievements modal
    this.achievementsBtn.addEventListener('click', () => {
      this.achievementManager.render();
      this.achievementsModal.classList.remove('hidden');
      // attach reset once
      const resetBtn = $('#reset-achievements-btn');
      if (resetBtn && !resetBtn.dataset.bound){
        resetBtn.dataset.bound='1';
        resetBtn.addEventListener('click',()=>{
          localStorage.removeItem('blackjack_achievements');
          for(const k in this.achievementManager.achievements){
            this.achievementManager.achievements[k].unlocked=false;
          }
          this.achievementManager.render();
          showToast('Achievements cleared');
        });
      }
    });

    // Close modals
    $('#practice-btn').addEventListener('click', () => this.startPracticeMode());

    document.querySelectorAll('.modal .close-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.modal').classList.add('hidden'));
    });

    $('#add-player-btn').addEventListener('click', () => {
      if (this.running) { showToast('Cannot add players during a round.'); return; }
      if (this.players.length >= 6) { showToast('Maximum of 6 players.'); return; }
      const index = this.players.length + 1;
      this.addPlayer(new Player(`Player ${index}`, 1000));
    });


  }

  toggleTheme() {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
    const newTheme = this.themes[this.currentThemeIndex];
    this.appEl.className = newTheme;
    localStorage.setItem('blackjack_theme', newTheme);
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('blackjack_theme') || this.themes[0];
    this.currentThemeIndex = this.themes.indexOf(savedTheme);
    if (this.currentThemeIndex === -1) {
      this.currentThemeIndex = 0;
    }
    this.appEl.className = this.themes[this.currentThemeIndex];
  }

    setupPlayers() {
    this.addPlayer(new Player('Player 1', 1000));
    // Set the first player as selected by default
    setTimeout(() => {
      const firstPlayerEl = $('#player-0');
      if (firstPlayerEl) firstPlayerEl.classList.add('selected');
    }, 0);
  }

  startPracticeMode() {
    if (this.running) { showToast('Finish the current round first'); return; }
    // clear existing players
    this.playersAreaEl.innerHTML='';
    this.players=[];
    this.selectedPlayerIndex=0;
    this.currentPlayerIndex=0;
    // add human and AI
    this.addPlayer(new Player('Player 1',1000,false));
    this.addPlayer(new Player('AI',1000,true));
    showToast('Practice mode: 1v1 vs AI');
    this.updateHUD();
  }

  loadStats() {
    const stats = JSON.parse(localStorage.getItem('blackjack_leaderboard') || '{}');
    if (this.players[0] && stats) {
      this.players[0].stats = {
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        pushes: stats.pushes || 0,
      };
      // Don't load bankroll, as it's session-based
    }
  }

  addPlayer(player) {
    const playerIndex = this.players.length;
    this.players.push(player);

    const playerEl = document.createElement('div');
    player.el = playerEl;
    playerEl.className = 'player-container';
    playerEl.id = `player-${playerIndex}`;
    playerEl.innerHTML = `
      <div class="player-header">
        <div class="player-timer" style="position:relative;width:40px;height:40px;">
          <svg width="40" height="40">
            <circle cx="20" cy="20" r="14" stroke-width="4" stroke="var(--timer-track)" fill="none" />
            <circle class="timer-ring" cx="20" cy="20" r="14" stroke-width="4" stroke="var(--timer-ring)" fill="none" stroke-dasharray="87.96" stroke-dashoffset="0"></circle>
          </svg>
          <span class="time-text" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:0.65rem;">15</span>
        </div>
        <h2>${player.name}</h2>
        <span class="hand-total">0</span>
      </div>
      <div class="hand" aria-label="${player.name} hand"></div>
      <div class="player-feedback">
        <span class="player-status"></span>
        <button class="leave-btn hidden">Publish & Leave</button>
      </div>
    `;
    this.playersAreaEl.appendChild(playerEl);

    // Store element references on the player object
    player.handEl = playerEl.querySelector('.hand');
    player.totalEl = playerEl.querySelector('.hand-total');
    player.statusEl = playerEl.querySelector('.player-status');
    player.leaveBtn = playerEl.querySelector('.leave-btn');
    // timer elements
    const timerDiv = playerEl.querySelector('.player-timer');
    player.timerDiv = timerDiv;
    player.timerRing = timerDiv.querySelector('.timer-ring');
    player.timerText = timerDiv.querySelector('.time-text');
    player.timeLeft = 15;
    player.timerInterval = null;

    player.leaveBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent player selection click
      this.leaveTable(player);
    });

    if(!player.isAI){
      playerEl.addEventListener('click', () => {
        if (this.running) return;
        this.selectedPlayerIndex = this.players.indexOf(player);
        this.updateActivePlayerSelection();
        this.updateHUD();
      });
    }
    this.updateHUD();
  }

  placeBet(amount) {
    const player = this.players[this.selectedPlayerIndex];
    if (player.isAI) return; // AI cannot bet
    if (this.running) return;
    if (player.bet + amount > 500) { showToast('Table limit 500'); return; }
    if (player.bankroll < amount) { showToast('Insufficient chips'); return; }
    player.bet += amount;
    player.bankroll -= amount;
    this.updateHUD();
    this.checkReadyToDeal();

  }

  // ---- Ready check helpers & ready/start flow ----
  allPlayersBet() {
    const humans = this.players.filter(p => !p.isAI);
    return humans.length > 0 && humans.every(p => p.bet > 0);
  }
  checkReadyToDeal() {
    if (this.running) { this.dealBtn.disabled = true; return; }
    const cur = this.players[this.selectedPlayerIndex];
    this.dealBtn.disabled = !cur || cur.bet === 0;
  }

  // Toggle 'selected' class to reflect whose turn / betting focus
  updateActivePlayerSelection() {
    // highlight selected
    document.querySelectorAll('.player-container').forEach((el, idx) => {
      el.classList.toggle('selected', idx === this.selectedPlayerIndex);
    });
  }

  /**
   * Handle Ready & Deal button when not all players have bet yet.
   * Locks current player's bet and moves to next player, or starts the round when everyone is ready.
   */
  readyOrStart() {
    if (this.running) return;
    const cur = this.players[this.selectedPlayerIndex];
    if (!cur || cur.bet === 0) { showToast('Place a bet first'); return; }

    if (this.allPlayersBet()) {
      this.startRound();
    } else {
      // move to next player without bet
      let next = (this.selectedPlayerIndex + 1) % this.players.length;
      const start = next;
      while (true) {
        const p = this.players[next];
        if (!p.isAI && p.bet === 0) break; // human without bet
        next = (next + 1) % this.players.length;
        if (next === start) {
          // No remaining humans needing bets -> start round
          this.startRound();
          return;
        }
      }
      this.selectedPlayerIndex = next;
      this.updateActivePlayerSelection();
      this.updateHUD();
    }
  }

  updateActivePlayerSelection() {
    document.querySelectorAll('.player-container').forEach((el, idx) => {
      el.classList.toggle('selected', idx === this.selectedPlayerIndex);
    });
  }


    updateHUD() {
    const player = this.players[this.selectedPlayerIndex];
    if (!player) {
      this.bankrollEl.textContent = 'Bankroll: -';
      this.betDisplayEl.textContent = 'Bet: -';
      return;
    }
    if (player.isAI) {
      this.bankrollEl.textContent = `${player.name} (AI)`;
      this.betDisplayEl.textContent = '';
    } else {
      this.bankrollEl.textContent = `Bankroll (${player.name}): ${player.bankroll}`;
      this.betDisplayEl.textContent = `Bet: ${player.bet}`;
    }
    flash(this.betDisplayEl);
    // Re-evaluate button enable whenever HUD refreshed
    this.checkReadyToDeal();
  }

    startRound() {
    if (!this.allPlayersBet()) { showToast('All players must place a bet.'); return; }
    if (this.running) return;
    const totalBet = this.players.reduce((sum, p) => sum + p.bet, 0);
    

    this.running = true;
    this.currentPlayerIndex = 0;
    showEl(this.themeToggleBtn, true);
    this.resetHands();

    // Bets are placed by players before starting the round.

    // Initial deal
    const dealQueue = [];
    for (let i = 0; i < 2; i++) {
      for (const player of this.players) {
        dealQueue.push(() => this.dealCard(player, player.handEl));
      }
      dealQueue.push(() => this.dealCard(this.dealer, this.dealerHandEl, i === 1));
    }

    const processDeal = () => {
      if (dealQueue.length > 0) {
        dealQueue.shift()();
        setTimeout(processDeal, 200);
      } else {
        this.updateControlsOnDeal();
        this.startPlayerTurn();
      }
    };
    processDeal();
  }

    resetHands() {
    this.players.forEach(p => {
      p.resetHand();
      p.handEl.innerHTML = '';
    });
    this.dealer.resetHand();
    this.dealerHandEl.innerHTML = '';
    this.updateTotals();
  }

  /** Update hand totals on UI */
    updateTotals() {
    this.players.forEach(p => {
      p.totalEl.textContent = p.hand.score;
      flash(p.totalEl);
    });

    // Dealer total
    const dealerCards = this.dealer.hand.cards;
    const holeHidden = this.dealerHandEl.querySelector('.card:nth-child(2)')?.textContent === '🂠';
    if (holeHidden) {
      $('#dealer-total').textContent = dealerCards.length ? dealerCards[0].value : 0;
    } else {
      $('#dealer-total').textContent = this.dealer.hand.score;
    }
  }

  dealCard(targetPlayer, container, faceDown = false, onFinish = null) {
    const card = this.deck.draw();
    if (!card) {
      if (onFinish) onFinish();
      return;
    }

    const el = card.render(faceDown);
    const startRect = this.deckPileEl.getBoundingClientRect();
    container.appendChild(el);
    const endRect = el.getBoundingClientRect();

    const anim = el.animate([
      { transform: `translate(${startRect.x - endRect.x}px, ${startRect.y - endRect.y}px) rotateY(90deg)` },
      { transform: 'translate(0, 0) rotateY(0deg)' }
    ], {
      duration: 400,
      easing: 'ease-in-out'
    });

    anim.onfinish = () => {
      targetPlayer.hand.add(card);
      this.updateTotals();
      if (onFinish) onFinish();
    };
  }

  updateControlsOnDeal() {
    this.dealBtn.classList.add('hidden');
    this.hitBtn.classList.remove('hidden');
    this.standBtn.classList.remove('hidden');
    this.chipTray.style.pointerEvents = 'none';
    this.chipTray.style.opacity = '0.5';
  }

  enableActions() {
    const player = this.players[this.currentPlayerIndex];
    if (player.isAI) { // AI auto play
      this.disableActions();
      this.playAITurn(player);
      return;
    }
    if (!player) return;

    showEl(this.hitBtn, true);
    this.hitBtn.disabled = false;

    showEl(this.standBtn, true);
    this.standBtn.disabled = false;

    showEl(this.dealBtn, false);
    this.dealBtn.disabled = true;

    showEl(this.chipTray, false);

    // Handle Double Down button
    const canDouble = player.bankroll >= player.bet && player.hand.cards.length === 2;
    showEl(this.doubleBtn, canDouble);
    this.doubleBtn.disabled = !canDouble;
  }
  disableActions() {
    // betting stage
    showEl(this.hitBtn, false);
    showEl(this.standBtn, false);
    showEl(this.doubleBtn, false);
    showEl(this.dealBtn, true);
    showEl(this.chipTray, true);
    this.chipTray.style.pointerEvents = 'auto';
    this.chipTray.style.opacity = '1';

    this.hitBtn.disabled = true;
    this.standBtn.disabled = true;
    this.doubleBtn.disabled = true;
    this.dealBtn.disabled = false;
  }

    startPlayerTurn() {
    this.updateActivePlayer();
    const currentPlayer = this.players[this.currentPlayerIndex];

    if (currentPlayer.hand.isBlackjack()) {
      this.nextPlayerTurn();
      return;
    }

    // Automatically set HUD and controls to the active player
    this.selectedPlayerIndex = this.currentPlayerIndex;
    this.updateActivePlayerSelection();
    this.updateHUD();

    this.isPlayerTurn = true;
    this.enableActions();
    if (!currentPlayer.isAI) {
      this.startTimer();
    }
  }

  nextPlayerTurn() {
    this.players[this.currentPlayerIndex].el.classList.remove('active');
    this.currentPlayerIndex++;
    if (this.currentPlayerIndex < this.players.length) {
      this.startPlayerTurn();
    } else {
      this.dealerTurn();
    }
  }

  updateActivePlayer() {
    this.players.forEach((p, i) => {
      const isActive = i === this.currentPlayerIndex;
      p.el.classList.toggle('active', isActive);
      if (p.timerDiv) p.timerDiv.style.visibility = isActive ? 'visible' : 'hidden';
    });
  }

  getAIAction(player, dealerUpCard) {
    const hand = player.hand;
    const score = hand.score;
    const upCardValue = dealerUpCard.value;

    // Soft Totals
    if (hand.isSoft()) {
      if (score >= 19) { // A,8 and A,9
        return 'S';
      }
      if (score === 18) { // A,7
        if (upCardValue >= 2 && upCardValue <= 6) return 'D';
        if (upCardValue === 7 || upCardValue === 8) return 'S';
        return 'H'; // vs 9, 10, A
      }
      if (score === 17) { // A,6
        return (upCardValue >= 3 && upCardValue <= 6) ? 'D' : 'H';
      }
      if (score <= 16) { // A,2 to A,5
        return (upCardValue >= 4 && upCardValue <= 6) ? 'D' : 'H';
      }
    }

    // Hard Totals
    if (score >= 17) return 'S';
    if (score >= 13 && score <= 16) {
      return (upCardValue >= 2 && upCardValue <= 6) ? 'S' : 'H';
    }
    if (score === 12) {
      return (upCardValue >= 4 && upCardValue <= 6) ? 'S' : 'H';
    }
    if (score === 11) {
      return 'D';
    }
    if (score === 10) {
      return (upCardValue >= 2 && upCardValue <= 9) ? 'D' : 'H';
    }
    if (score === 9) {
      return (upCardValue >= 3 && upCardValue <= 6) ? 'D' : 'H';
    }
    return 'H'; // 8 or less
  }

  playAITurn(player) {
    const play = () => {
      if (player.hand.isBusted()) {
        this.nextPlayerTurn();
        return;
      }

      const dealerUpCard = this.dealer.hand.cards[0];
      const action = this.getAIAction(player, dealerUpCard);

      if (action === 'S') {
        this.nextPlayerTurn();
        return;
      }

      if (action === 'D') {
        if (player.bankroll >= player.bet) {
          player.bankroll -= player.bet;
          player.bet *= 2;
          this.dealCard(player, player.handEl, false, () => {
            this.nextPlayerTurn(); // Turn ends after doubling
          });
        } else {
          // Can't afford to double, so just hit
          this.dealCard(player, player.handEl, false, () => {
            setTimeout(play, 800); // Re-evaluate after hit
          });
        }
        return;
      }

      // Action is 'H'
      this.dealCard(player, player.handEl, false, () => {
        setTimeout(play, 800); // Re-evaluate after hit
      });
    };
    setTimeout(play, 1000); // Initial delay for AI "thinking"
  }

  playerHit() {
    this.stopTimer();
    const currentPlayer = this.players[this.currentPlayerIndex];
    this.dealCard(currentPlayer, currentPlayer.handEl, false, () => {
      if (currentPlayer.hand.isBusted()) {
        this.nextPlayerTurn();
      } else {
        this.startTimer();
      }
    });
  }

    playerStand() {
    this.isPlayerTurn = false;
    this.stopTimer();
    this.nextPlayerTurn();
  }

    doubleDown() {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.bankroll < currentPlayer.bet) { showToast('Not enough bankroll'); return; }
    currentPlayer.bankroll -= currentPlayer.bet;
    currentPlayer.bet *= 2;
    this.updateHUD(); // Assumes HUD is for player 0
    this.dealCard(currentPlayer, currentPlayer.handEl, false, () => {
      if (currentPlayer.hand.isBusted()) {
        this.nextPlayerTurn();
      } else {
        this.playerStand();
      }
    });
  }

  dealerTurn() {
    this.revealDealerCard();
    const play = () => {
      if (this.dealer.hand.score < 17) {
        this.dealCard(this.dealer, this.dealerHandEl);
        setTimeout(play, 800);
      } else {
        this.finishRound();
      }
    };
    setTimeout(() => play(), 800);
  }

  revealDealerCard() {
    const holeCardEl = this.dealerHandEl.querySelector('.card:nth-child(2)');
    if (holeCardEl && holeCardEl.textContent === '🂠') {
      const card = this.dealer.hand.cards[1];
      const newCardEl = card.render();
      newCardEl.style.animation = 'flip 0.4s forwards';
      holeCardEl.replaceWith(newCardEl);
      this.updateTotals();
    }
  }

  finishRound() {
    this.isPlayerTurn = false;
    this.stopTimer();
    this.revealDealerCard();

    // Dealer plays
    while (this.dealer.hand.score < 17) {
      this.dealer.hand.add(this.deck.draw());
    }
    this.updateTotals();

    const dealerScore = this.dealer.hand.score;

    // Determine results for each player
    this.players.forEach(player => {
      if (player.bet === 0) return; // Skip players who didn't bet

      const playerScore = player.hand.score;
      let result = '';
      let resultText = '';

      if (player.hand.isBusted()) {
        this.achievementManager.check(this, 'lose');
        result = 'lose';
        resultText = 'Bust!';
      } else if (dealerScore > 21 || playerScore > dealerScore) {
        this.achievementManager.check(this, "win");
        result = 'win';
        resultText = 'You Win!';
        if (player.hand.isBlackjack()) {
          player.bankroll += player.bet * 2.5; // 3:2 payout
          resultText = 'Blackjack!';
        } else {
          player.bankroll += player.bet * 2; // 1:1 payout
        }
      } else if (playerScore < dealerScore) {
        this.achievementManager.check(this, "lose");
        result = 'lose';
        resultText = 'Dealer Wins';
      } else {
        result = 'push';
        resultText = 'Push';
        player.bankroll += player.bet;
      }

      player.stats[result + 's']++;
      player.statusEl.textContent = resultText;
      player.leaveBtn.classList.remove('hidden');
    });

    
    this.running = false; // The round is over

    // Show the "Next Round" button, hide action buttons
    showEl(this.nextRoundBtn, true);
    showEl(this.dealBtn, false);
    this.disableActions();

    // Reshuffle if penetration high
    if (this.deck.penetration() > 0.75) {
      showToast('Reshuffling deck...');
      this.deckPileEl.classList.add('shuffling');
      setTimeout(() => {
        this.deck.reset();
        this.deckPileEl.classList.remove('shuffling');
      }, 500);
    }
  }

    playerAction(action) {
    if (!this.isPlayerTurn) return;

    switch (action) {
      case 'hit':
        this.playerHit();
        break;
      case 'stand':
        this.playerStand();
        break;
      case 'double':
        this.doubleDown();
        break;
    }
  }

  prepareNewRound() {
    //check for Fresh Start/bankrupt
    this.achievementManager.check(this, 'bankrupt');
    // Animate deck shuffle
    this.deckPileEl.classList.add('shuffling');
    setTimeout(() => this.deckPileEl.classList.remove('shuffling'), 600);
    this.running = false;
    this.resetHands();

    this.players.forEach(p => {
      p.bet = 0;
      if(p.statusEl) p.statusEl.textContent = '';
      if(p.leaveBtn) p.leaveBtn.classList.add('hidden');
    });

    // Auto-select first human player
    const firstHumanIndex = this.players.findIndex(p => !p.isAI);
    if (firstHumanIndex !== -1) this.selectedPlayerIndex = firstHumanIndex;
    this.updateActivePlayerSelection();

    this.updateHUD();
    this.disableActions(); // Resets controls to betting state
    showEl(this.nextRoundBtn, false);
    showEl(this.dealBtn, true);
    this.checkReadyToDeal();
  }

  leaveTable(playerToLeave) {
    const name = prompt('Publish bankroll under what name?', playerToLeave.name || 'Player');
    if (name) {
      this.addLeaderboardEntry(name, playerToLeave.bankroll);
      showToast(`${name} published with bankroll ${playerToLeave.bankroll}.`);
      playerToLeave.bankroll = 1000; // reset bankroll after publishing
    }

    const playerIndex = this.players.indexOf(playerToLeave);
    if (playerIndex > -1) {

      playerToLeave.el.remove();
      this.players.splice(playerIndex, 1);
    }

    if (this.players.length === 0) {
      this.resetGame();
    } else {
      // If the player who left was selected, select the first remaining player
      if (this.selectedPlayerIndex >= this.players.length) {
        this.selectedPlayerIndex = 0;
      }
      // Reselect the now-current player to update the 'selected' class
      const newSelectedPlayer = this.players[this.selectedPlayerIndex];
      document.querySelectorAll('.player-container').forEach(el => el.classList.remove('selected'));
      if (newSelectedPlayer) newSelectedPlayer.el.classList.add('selected');
      this.updateHUD();
    }
  }

  resetGame() {
    showToast('All players have left. Resetting game.');
    setTimeout(() => window.location.reload(), 2000);
  }

  /******** Timer ********/ 
  startTimer() {
    const player = this.players[this.currentPlayerIndex];
    if (!player) return;
    this.stopTimer();
    player.timeLeft = 15;
    const circumference = 2 * Math.PI * 14;
    const update = () => {
      const offset = circumference - (player.timeLeft / 15) * circumference;
      player.timerRing.style.strokeDashoffset = offset;
      player.timerText.textContent = player.timeLeft;
      if (player.timeLeft <= 0) {
        this.playerStand();
        return;
      }
      player.timeLeft--;
    };
    update();
    player.timerInterval = setInterval(update, 1000);
  }

  stopTimer() {
    const player = this.players[this.currentPlayerIndex];
    if (player && player.timerInterval) {
      clearInterval(player.timerInterval);
      player.timerInterval = null;
    }
  }

  /******** Leaderboard ********/
  addLeaderboardEntry(name, bankroll) {
    const data = JSON.parse(localStorage.getItem('blackjack_leaderboard') || '[]');
    data.push({ name, bankroll });
    localStorage.setItem('blackjack_leaderboard', JSON.stringify(data));
  }

  showLeaderboard() {
    const data = JSON.parse(localStorage.getItem('blackjack_leaderboard') || '[]');
    const listEl = $('#leaderboard-list');
    if (!Array.isArray(data) || data.length === 0) {
      listEl.innerHTML = '<p>No records yet.</p>';
    } else {
      const rows = data
        .sort((a,b)=> b.bankroll - a.bankroll)
        .map(d => `<tr><td>${d.name}</td><td>${d.bankroll}</td></tr>`)
        .join('');
      listEl.innerHTML = `<table><tr><th>Name</th><th>Bankroll</th></tr>${rows}</table>`;
    }
    $('#leaderboard-modal').classList.remove('hidden');
  }
}

// Initialize game
window.addEventListener('DOMContentLoaded', () => {
  const game = new BlackJackGame();
  game.loadTheme();
});
