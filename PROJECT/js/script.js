/* ============================================================
   TAB ROUTER
   ============================================================ */
function showPanel(target){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id===target));
  if(target === 'game-mines') Mines.resize();
  if(target === 'game-2048' && Game2048.grid.length){
    Game2048.setupCells();
    Game2048.render();
  }
}

const Tabs = {
  init(){
    document.querySelectorAll('.game-card').forEach(card=>{
      card.addEventListener('click', ()=>showPanel(card.dataset.target));
    });
    document.querySelectorAll('[data-back]').forEach(btn=>{
      btn.addEventListener('click', ()=>showPanel('menu'));
    });
  }
};

function pad(n,len){ return String(n).padStart(len,'0'); }
function padSigned(n,len){
  if(n<0) return '-'+String(Math.abs(n)).padStart(len-1,'0');
  return String(n).padStart(len,'0');
}
function fitCell(container, cols, maxPx){
  const avail = container.clientWidth || 340;
  const size = Math.max(20, Math.min(maxPx, Math.floor((avail-12)/cols)));
  return size;
}

/* ============================================================
   MODAL POPUP (menang / kalah / seri) — dipakai semua game
   ============================================================ */
const Modal = {
  init(){
    this.overlay = document.getElementById('modal-overlay');
    this.box = document.getElementById('modal-box');
    this.iconEl = document.getElementById('modal-icon');
    this.titleEl = document.getElementById('modal-title');
    this.msgEl = document.getElementById('modal-msg');
    this.primaryBtn = document.getElementById('modal-primary');
    this.secondaryBtn = document.getElementById('modal-secondary');

    this.overlay.addEventListener('click', (e)=>{
      if(e.target === this.overlay) this.hide();
    });
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape' && this.overlay.classList.contains('show')) this.hide();
    });
  },

  show({icon, title, msg, type, primary, secondary}){
    this.iconEl.textContent = icon;
    this.titleEl.textContent = title;
    this.msgEl.textContent = msg;
    this.box.className = 'modal-box' + (type ? ' '+type : '');

    this.primaryBtn.textContent = (primary && primary.label) || 'Main Lagi';
    this.primaryBtn.onclick = ()=>{ this.hide(); if(primary && primary.onClick) primary.onClick(); };

    if(secondary){
      this.secondaryBtn.style.display = '';
      this.secondaryBtn.textContent = secondary.label || 'Menu';
      this.secondaryBtn.onclick = ()=>{ this.hide(); if(secondary.onClick) secondary.onClick(); };
    } else {
      this.secondaryBtn.style.display = 'none';
    }

    this.overlay.classList.add('show');
  },

  hide(){
    this.overlay.classList.remove('show');
  }
};

/* ============================================================
   MINESWEEPER
   ============================================================ */
const Mines = {
  diffs:{
    easy:{rows:9, cols:9, mines:10},
    medium:{rows:13, cols:13, mines:25},
    hard:{rows:16, cols:16, mines:40}
  },
  diff:'easy',
  customCfg:{rows:9, cols:9, mines:10},
  grid:[], els:[],
  rows:9, cols:9, mineCount:10,
  revealedCount:0, flagCount:0,
  firstClickDone:false, state:'ready',
  timer:0, timerHandle:null,
  flagMode:false,

  init(){
    this.boardEl = document.getElementById('ms-board');
    this.boardWrapEl = document.getElementById('ms-board-wrap');
    this.statusEl = document.getElementById('ms-status');
    this.minesEl = document.getElementById('ms-mines');
    this.timerEl = document.getElementById('ms-timer');
    this.faceEl = document.getElementById('ms-face');
    this.customRow = document.getElementById('ms-custom-row');
    this.customRowsInput = document.getElementById('ms-custom-rows');
    this.customColsInput = document.getElementById('ms-custom-cols');
    this.customMinesInput = document.getElementById('ms-custom-mines');
    this.zoomOverride = null;
    this.classic = false;

    document.querySelectorAll('#game-mines [data-diff]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#game-mines [data-diff]').forEach(b=>b.classList.remove('on'));
        btn.classList.add('on');
        this.diff = btn.dataset.diff;
        this.customRow.classList.toggle('show', this.diff==='custom');
        if(this.diff==='custom'){
          this.applyCustom();
        } else {
          this.newGame();
        }
      });
    });

    document.getElementById('ms-custom-apply').addEventListener('click', ()=>this.applyCustom());
    [this.customRowsInput, this.customColsInput, this.customMinesInput].forEach(inp=>{
      inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter') this.applyCustom(); });
    });

    this.faceEl.addEventListener('click', ()=>this.newGame());

    this.zoomSelect = document.getElementById('ms-zoom-select');
    this.zoomSelect.addEventListener('change', ()=>{
      const v = this.zoomSelect.value;
      this.zoomOverride = v==='auto' ? null : parseInt(v,10);
      this.resize();
    });

    this.gearBtn = document.getElementById('ms-settings-btn');
    this.settingsPanel = document.getElementById('ms-settings-panel');
    this.gearBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const willShow = !this.settingsPanel.classList.contains('show');
      this.settingsPanel.classList.toggle('show', willShow);
      this.gearBtn.classList.toggle('on', willShow);
    });
    document.addEventListener('click', (e)=>{
      if(this.settingsPanel.classList.contains('show') && !this.settingsPanel.contains(e.target) && e.target!==this.gearBtn){
        this.settingsPanel.classList.remove('show');
        this.gearBtn.classList.remove('on');
      }
    });

    this.flagCheck = document.getElementById('ms-flagmode-check');
    this.flagCheck.addEventListener('change', ()=>{ this.flagMode = this.flagCheck.checked; });

    this.classicCheck = document.getElementById('ms-classic-check');
    this.classicCheck.addEventListener('change', ()=>{
      this.classic = this.classicCheck.checked;
      document.getElementById('game-mines').classList.toggle('classic-theme', this.classic);
    });

    this.newGame();
  },

  applyCustom(){
    let rows = parseInt(this.customRowsInput.value, 10);
    let cols = parseInt(this.customColsInput.value, 10);
    let mines = parseInt(this.customMinesInput.value, 10);

    if(isNaN(rows)) rows = 9;
    if(isNaN(cols)) cols = 9;
    if(isNaN(mines)) mines = 10;

    rows = Math.max(5, Math.min(30, rows));
    cols = Math.max(5, Math.min(30, cols));
    const maxMines = Math.max(1, rows*cols - 9);
    mines = Math.max(1, Math.min(maxMines, mines));

    this.customRowsInput.value = rows;
    this.customColsInput.value = cols;
    this.customMinesInput.value = mines;

    this.customCfg = {rows, cols, mines};
    this.newGame();
  },

  newGame(){
    const cfg = this.diff==='custom' ? this.customCfg : this.diffs[this.diff];
    this.rows = cfg.rows; this.cols = cfg.cols; this.mineCount = cfg.mines;
    this.revealedCount = 0; this.flagCount = 0;
    this.firstClickDone = false; this.state = 'ready';
    this.timer = 0;
    clearInterval(this.timerHandle);
    this.timerEl.textContent = pad(0,3);
    this.minesEl.textContent = pad(this.mineCount,3);
    this.faceEl.textContent = '🙂';
    this.statusEl.textContent = '';
    this.statusEl.classList.remove('lose');

    this.grid = [];
    for(let r=0;r<this.rows;r++){
      const row=[];
      for(let c=0;c<this.cols;c++){
        row.push({mine:false, adj:0, revealed:false, flagged:false});
      }
      this.grid.push(row);
    }
    this.render();
  },

  resize(){
    if(!this.boardEl) return;
    const cell = this.zoomOverride || fitCell(this.boardEl.parentElement, this.cols, 30);
    this.boardEl.style.setProperty('--cell', cell+'px');
  },

  render(){
    this.boardEl.style.gridTemplateColumns = `repeat(${this.cols}, var(--cell))`;
    this.resize();
    this.boardEl.innerHTML='';
    this.els = [];
    for(let r=0;r<this.rows;r++){
      const rowEls=[];
      for(let c=0;c<this.cols;c++){
        const b = document.createElement('button');
        b.className='cell';
        b.setAttribute('aria-label','kotak tertutup');
        b.addEventListener('click', ()=>this.handleTap(r,c));
        b.addEventListener('contextmenu', (e)=>{ e.preventDefault(); this.toggleFlag(r,c); });
        this.boardEl.appendChild(b);
        rowEls.push(b);
      }
      this.els.push(rowEls);
    }
  },

  handleTap(r,c){
    if(this.state==='won' || this.state==='lost') return;
    if(this.flagMode){ this.toggleFlag(r,c); return; }
    const cell = this.grid[r][c];
    if(cell.revealed && cell.adj>0){ this.chord(r,c); return; }
    this.reveal(r,c);
  },

  chord(r,c){
    if(this.state==='won' || this.state==='lost') return;
    const cell = this.grid[r][c];
    if(!cell.revealed || cell.adj===0) return;
    const nbrs = this.neighbors(r,c);
    const flaggedCount = nbrs.reduce((n,[nr,nc])=>n+(this.grid[nr][nc].flagged?1:0), 0);
    if(flaggedCount !== cell.adj) return;
    for(const [nr,nc] of nbrs){
      const n = this.grid[nr][nc];
      if(n.revealed || n.flagged) continue;
      if(n.mine){ this.loseGame(nr,nc); return; }
      this.floodReveal(nr,nc);
    }
    this.checkWin();
  },

  toggleFlag(r,c){
    if(this.state==='won' || this.state==='lost') return;
    const cell = this.grid[r][c];
    if(cell.revealed) return;
    cell.flagged = !cell.flagged;
    this.flagCount += cell.flagged ? 1 : -1;
    this.minesEl.textContent = padSigned(this.mineCount - this.flagCount, 3);
    const el = this.els[r][c];
    el.classList.toggle('flagged', cell.flagged);
    el.textContent = cell.flagged ? '🚩' : '';
  },

  placeMines(safeR, safeC){
    let placed = 0;
    while(placed < this.mineCount){
      const r = Math.floor(Math.random()*this.rows);
      const c = Math.floor(Math.random()*this.cols);
      if(Math.abs(r-safeR)<=1 && Math.abs(c-safeC)<=1) continue;
      if(this.grid[r][c].mine) continue;
      this.grid[r][c].mine = true;
      placed++;
    }
    for(let r=0;r<this.rows;r++){
      for(let c=0;c<this.cols;c++){
        if(this.grid[r][c].mine) continue;
        let count=0;
        this.neighbors(r,c).forEach(([nr,nc])=>{ if(this.grid[nr][nc].mine) count++; });
        this.grid[r][c].adj = count;
      }
    }
  },

  neighbors(r,c){
    const out=[];
    for(let dr=-1;dr<=1;dr++){
      for(let dc=-1;dc<=1;dc++){
        if(dr===0 && dc===0) continue;
        const nr=r+dr, nc=c+dc;
        if(nr>=0 && nr<this.rows && nc>=0 && nc<this.cols) out.push([nr,nc]);
      }
    }
    return out;
  },

  reveal(r,c){
    const cell = this.grid[r][c];
    if(cell.revealed || cell.flagged) return;

    if(!this.firstClickDone){
      this.placeMines(r,c);
      this.firstClickDone = true;
      this.state = 'playing';
      this.startTimer();
    }

    if(cell.mine){
      this.loseGame(r,c);
      return;
    }

    this.floodReveal(r,c);
    this.checkWin();
  },

  floodReveal(r,c){
    const stack=[[r,c]];
    while(stack.length){
      const [cr,cc] = stack.pop();
      const cell = this.grid[cr][cc];
      if(cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      this.revealedCount++;
      const el = this.els[cr][cc];
      el.classList.add('revealed');
      if(cell.adj>0){
        el.textContent = cell.adj;
        el.classList.add('n'+cell.adj);
        el.classList.add('chordable');
      } else {
        el.textContent='';
        this.neighbors(cr,cc).forEach(([nr,nc])=>{
          if(!this.grid[nr][nc].revealed) stack.push([nr,nc]);
        });
      }
    }
  },

  checkWin(){
    if(this.revealedCount === this.rows*this.cols - this.mineCount){
      this.state='won';
      clearInterval(this.timerHandle);
      this.faceEl.textContent='😎';
      this.statusEl.textContent='Selesai! Semua kotak aman berhasil dibuka.';
      this.statusEl.classList.remove('lose');
      for(let r=0;r<this.rows;r++) for(let c=0;c<this.cols;c++){
        if(this.grid[r][c].mine && !this.grid[r][c].flagged){
          this.grid[r][c].flagged=true;
          this.els[r][c].classList.add('flagged');
          this.els[r][c].textContent='🚩';
        }
      }
      setTimeout(()=>{
        Modal.show({
          icon:'🎉', title:'Menang!', type:'win',
          msg:`Semua kotak aman terbuka dalam ${this.timer} detik.`,
          primary:{label:'Main Lagi', onClick:()=>this.newGame()},
          secondary:{label:'Menu', onClick:()=>showPanel('menu')}
        });
      }, 500);
    }
  },

  loseGame(r,c){
    this.state='lost';
    clearInterval(this.timerHandle);
    this.faceEl.textContent='😵';
    this.statusEl.textContent='Kena ranjau. Coba lagi?';
    this.statusEl.classList.add('lose');
    for(let rr=0;rr<this.rows;rr++) for(let cc=0;cc<this.cols;cc++){
      const cell=this.grid[rr][cc];
      if(cell.mine){
        cell.revealed=true;
        const el=this.els[rr][cc];
        el.classList.add('revealed');
        el.textContent='💣';
        if(rr===r && cc===c) el.classList.add('mine-hit');
      }
    }
    setTimeout(()=>{
      Modal.show({
        icon:'💥', title:'Kena Ranjau!', type:'lose',
        msg:`${this.revealedCount} kotak aman berhasil dibuka sebelum meledak.`,
        primary:{label:'Main Lagi', onClick:()=>this.newGame()},
        secondary:{label:'Menu', onClick:()=>showPanel('menu')}
      });
    }, 500);
  },

  startTimer(){
    this.timerHandle = setInterval(()=>{
      this.timer = Math.min(999, this.timer+1);
      this.timerEl.textContent = pad(this.timer,3);
    },1000);
  }
};

/* ============================================================
   2048
   ============================================================ */
const Game2048 = {
  size:4, grid:[], score:0, best:0,
  tiles:new Map(), tileEls:new Map(), nextId:1,
  moving:false, moveTimeout:null,

  init(){
    this.boardEl = document.getElementById('g2048-board');
    this.scoreEl = document.getElementById('g2048-score');
    this.bestEl = document.getElementById('g2048-best');
    this.statusEl = document.getElementById('g2048-status');
    document.getElementById('g2048-new').addEventListener('click', ()=>this.newGame());

    document.querySelectorAll('#g2048-size-row [data-size]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#g2048-size-row [data-size]').forEach(b=>b.classList.remove('on'));
        btn.classList.add('on');
        this.size = parseInt(btn.dataset.size, 10);
        this.newGame();
      });
    });

    document.addEventListener('keydown', (e)=>{
      if(!document.getElementById('game-2048').classList.contains('active')) return;
      const map = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
      if(map[e.key]){ e.preventDefault(); this.move(map[e.key]); }
    });

    let touchStartX=0, touchStartY=0;
    this.boardEl.addEventListener('touchstart', (e)=>{
      touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    }, {passive:true});
    this.boardEl.addEventListener('touchend', (e)=>{
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if(Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if(Math.abs(dx) > Math.abs(dy)) this.move(dx>0?'right':'left');
      else this.move(dy>0?'down':'up');
    }, {passive:true});

    this.newGame();
  },

  newGame(){
    clearTimeout(this.moveTimeout);
    this.moving = false;
    this.grid = Array.from({length:this.size},()=>Array(this.size).fill(0));
    this.tiles = new Map();
    this.tileEls.forEach(el=>el.remove());
    this.tileEls = new Map();
    this.nextId = 1;
    this.score = 0;
    this.gameOver = false;
    this.wonShown = false;
    this.statusEl.textContent='';
    this.scoreEl.textContent = pad(0,4);
    this.bestEl.textContent = pad(this.best,4);
    this.setupCells();
    this.addRandomTile(); this.addRandomTile();
    this.render();
  },

  setupCells(){
    const maxPx = this.size <= 4 ? 74 : this.size === 5 ? 64 : 54;
    const t = fitCell(this.boardEl.parentElement, this.size, maxPx);
    this.boardEl.style.setProperty('--t2048', t+'px');
    this.boardEl.style.setProperty('--g2048-size', this.size);
    this.cellSize = t;
    this.boardEl.querySelectorAll('.t2048-cell').forEach(n=>n.remove());
    for(let i=0;i<this.size*this.size;i++){
      const d=document.createElement('div');
      d.className='t2048-cell';
      this.boardEl.appendChild(d);
    }
  },

  addRandomTile(){
    const empty=[];
    for(let r=0;r<this.size;r++) for(let c=0;c<this.size;c++) if(this.grid[r][c]===0) empty.push([r,c]);
    if(!empty.length) return;
    const [r,c] = empty[Math.floor(Math.random()*empty.length)];
    const value = Math.random()<0.9 ? 2 : 4;
    this.grid[r][c] = value;
    const id = this.nextId++;
    this.tiles.set(id, {id, r, c, value, isNew:true, justMerged:false});
  },

  move(dir){
    if(this.gameOver || this.moving) return;
    const n = this.size;
    const posGrid = Array.from({length:n},()=>Array(n).fill(null));
    for(const tile of this.tiles.values()) posGrid[tile.r][tile.c] = tile;

    const reverse = (dir==='right' || dir==='down');
    let changed=false, totalGained=0;
    const removedIds = [];
    const newGrid = Array.from({length:n},()=>Array(n).fill(0));

    for(let i=0;i<n;i++){
      const lineTiles=[];
      for(let j=0;j<n;j++){
        const t = (dir==='left'||dir==='right') ? posGrid[i][j] : posGrid[j][i];
        if(t) lineTiles.push(t);
      }
      const ordered = reverse ? [...lineTiles].reverse() : lineTiles;

      const results = [];
      let idx=0;
      while(idx < ordered.length){
        if(idx+1 < ordered.length && ordered[idx].value === ordered[idx+1].value){
          results.push({tiles:[ordered[idx], ordered[idx+1]], value: ordered[idx].value*2});
          idx+=2;
        } else {
          results.push({tiles:[ordered[idx]], value: ordered[idx].value});
          idx+=1;
        }
      }

      results.forEach((res,k)=>{
        const j = reverse ? (n-1-k) : k;
        const r = (dir==='left'||dir==='right') ? i : j;
        const c = (dir==='left'||dir==='right') ? j : i;

        const survivor = res.tiles[0];
        if(survivor.r !== r || survivor.c !== c) changed = true;
        survivor.r = r; survivor.c = c;

        if(res.tiles.length===2){
          changed = true;
          totalGained += res.value;
          survivor.pendingValue = res.value;
          const loser = res.tiles[1];
          loser.r = r; loser.c = c;
          loser.toRemove = true;
          removedIds.push(loser.id);
        }
        newGrid[r][c] = res.value;
      });
    }

    if(!changed) return;

    this.moving = true;
    this.score += totalGained;
    if(this.score > this.best) this.best = this.score;
    this.scoreEl.textContent = pad(Math.min(9999,this.score),4);
    this.bestEl.textContent = pad(Math.min(9999,this.best),4);
    this.grid = newGrid;

    // Phase 1: slide everything (including tiles about to merge) to their destination.
    for(const t of this.tiles.values()){ t.isNew=false; t.justMerged=false; }
    this.render();

    clearTimeout(this.moveTimeout);
    this.moveTimeout = setTimeout(()=>{
      // Phase 2: remove the tiles absorbed by a merge, apply the merged value, add a new tile.
      removedIds.forEach(id=>this.tiles.delete(id));
      for(const t of this.tiles.values()){
        if(t.pendingValue){
          t.value = t.pendingValue;
          t.pendingValue = null;
          t.justMerged = true;
        }
      }
      this.addRandomTile();
      this.render();
      this.moving = false;
      this.checkEnd();
    }, 130);
  },

  checkEnd(){
    const n=this.size, g=this.grid;
    let hasEmpty=false, canMerge=false, has2048=false;
    for(let r=0;r<n;r++) for(let c=0;c<n;c++){
      if(g[r][c]===0) hasEmpty=true;
      if(g[r][c]===2048) has2048=true;
      if(c<n-1 && g[r][c]===g[r][c+1]) canMerge=true;
      if(r<n-1 && g[r][c]===g[r+1][c]) canMerge=true;
    }
    if(has2048 && !this.wonShown){
      this.statusEl.textContent = 'Kamu mencapai 2048! Terus main untuk skor lebih tinggi.';
      this.wonShown = true;
      Modal.show({
        icon:'🏆', title:'Kamu Mencapai 2048!', type:'win',
        msg:`Skor saat ini ${this.score}. Lanjutkan bermain untuk skor lebih tinggi, atau mulai papan baru.`,
        primary:{label:'Lanjutkan', onClick:()=>{}},
        secondary:{label:'Main Baru', onClick:()=>this.newGame()}
      });
    } else if(!hasEmpty && !canMerge){
      this.statusEl.textContent = 'Papan penuh, tidak ada langkah lagi. Mulai baru untuk coba lagi.';
      this.gameOver = true;
      Modal.show({
        icon:'💀', title:'Game Over', type:'lose',
        msg:`Papan penuh, tidak ada langkah lagi. Skor akhir: ${this.score}.`,
        primary:{label:'Main Lagi', onClick:()=>this.newGame()},
        secondary:{label:'Menu', onClick:()=>showPanel('menu')}
      });
    }
  },

  render(){
    const gap=8, t=this.cellSize;
    const seen = new Set();
    for(const tile of this.tiles.values()){
      seen.add(tile.id);
      let el = this.tileEls.get(tile.id);
      let inner;
      if(!el){
        el = document.createElement('div');
        el.className = 't2048-tile';
        inner = document.createElement('div');
        inner.className = 't2048-tile-inner';
        el.appendChild(inner);
        this.boardEl.appendChild(el);
        this.tileEls.set(tile.id, el);
      } else {
        inner = el.firstChild;
      }
      el.style.width = t+'px'; el.style.height = t+'px';
      el.style.transform = `translate(${tile.c*(t+gap)}px, ${tile.r*(t+gap)}px)`;
      el.className = 't2048-tile v'+tile.value + (tile.isNew ? ' pop-in' : '') + (tile.justMerged ? ' pop-merge' : '');
      inner.textContent = tile.value;
    }
    for(const [id, el] of this.tileEls){
      if(!seen.has(id)){ el.remove(); this.tileEls.delete(id); }
    }
  }
};

/* ============================================================
   TIC-TAC-TOE
   ============================================================ */
const TicTacToe = {
  board:Array(9).fill(''), current:'X', mode:'2p', active:true,
  cpuDifficulty:'medium',
  tally:{X:0,O:0,draw:0},
  lines:[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]],

  init(){
    this.boardEl = document.getElementById('ttt-board');
    this.statusEl = document.getElementById('ttt-status');
    this.xwinsEl = document.getElementById('ttt-xwins');
    this.owinsEl = document.getElementById('ttt-owins');
    this.drawsEl = document.getElementById('ttt-draws');

    document.querySelectorAll('#game-ttt [data-mode]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#game-ttt [data-mode]').forEach(b=>b.classList.remove('on'));
        btn.classList.add('on');
        this.mode = btn.dataset.mode;
        this.newGame();
      });
    });
    document.getElementById('ttt-reset').addEventListener('click', ()=>this.newGame());

    document.querySelectorAll('#ttt-diff-row [data-tdiff]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#ttt-diff-row [data-tdiff]').forEach(b=>b.classList.remove('on'));
        btn.classList.add('on');
        this.cpuDifficulty = btn.dataset.tdiff;
      });
    });

    this.render(true);
  },

  newGame(){
    this.board = Array(9).fill('');
    this.current = 'X';
    this.active = true;
    this.statusEl.textContent = 'Giliran X';
    this.statusEl.classList.remove('lose');
    this.render(true);
  },

  render(rebuild){
    if(rebuild){
      this.boardEl.innerHTML='';
      this.cells=[];
      for(let i=0;i<9;i++){
        const b=document.createElement('button');
        b.className='ttt-cell';
        b.addEventListener('click', ()=>this.play(i));
        this.boardEl.appendChild(b);
        this.cells.push(b);
      }
    }
    this.boardEl.dataset.turn = this.current;
    this.board.forEach((v,i)=>{
      this.cells[i].textContent = v;
      this.cells[i].className = 'ttt-cell' + (v==='X'?' x':v==='O'?' o':'');
    });
  },

  play(i){
    if(!this.active || this.board[i]) return;
    this.board[i]=this.current;
    this.render(false);
    if(this.checkEnd()) return;
    this.current = this.current==='X' ? 'O' : 'X';
    this.statusEl.textContent = 'Giliran ' + this.current;
    if(this.mode==='cpu' && this.current==='O' && this.active){
      setTimeout(()=>this.cpuMove(), 380);
    }
  },

  cpuMove(){
    if(!this.active) return;
    let move = -1;

    if(this.cpuDifficulty === 'easy'){
      const empties = this.board.map((v,i)=>v?-1:i).filter(i=>i>=0);
      move = empties[Math.floor(Math.random()*empties.length)];
    } else if(this.cpuDifficulty === 'hard'){
      move = this.bestMove();
    } else {
      move = this.findWinning('O');
      if(move===-1) move = this.findWinning('X');
      if(move===-1 && !this.board[4]) move = 4;
      if(move===-1){
        const corners=[0,2,6,8].filter(i=>!this.board[i]);
        if(corners.length) move = corners[Math.floor(Math.random()*corners.length)];
      }
      if(move===-1){
        const empties=this.board.map((v,i)=>v?-1:i).filter(i=>i>=0);
        move = empties[Math.floor(Math.random()*empties.length)];
      }
    }
    this.play(move);
  },

  winnerOf(board){
    for(const line of this.lines){
      const [a,b,c] = line;
      if(board[a] && board[a]===board[b] && board[b]===board[c]) return board[a];
    }
    return null;
  },

  bestMove(){
    const board = [...this.board];
    let best = null;
    let bestScore = -Infinity;
    for(let i=0;i<9;i++){
      if(board[i]) continue;
      board[i] = 'O';
      const score = this.minimax(board, false);
      board[i] = '';
      if(score > bestScore){ bestScore = score; best = i; }
    }
    return best;
  },

  minimax(board, isMaximizing, depth){
    depth = depth || 0;
    const w = this.winnerOf(board);
    if(w === 'O') return 10 - depth;
    if(w === 'X') return depth - 10;
    if(board.every(v=>v)) return 0;

    if(isMaximizing){
      let best = -Infinity;
      for(let i=0;i<9;i++){
        if(board[i]) continue;
        board[i]='O';
        best = Math.max(best, this.minimax(board, false, depth+1));
        board[i]='';
      }
      return best;
    } else {
      let best = Infinity;
      for(let i=0;i<9;i++){
        if(board[i]) continue;
        board[i]='X';
        best = Math.min(best, this.minimax(board, true, depth+1));
        board[i]='';
      }
      return best;
    }
  },

  findWinning(mark){
    for(const line of this.lines){
      const vals = line.map(i=>this.board[i]);
      const marks = vals.filter(v=>v===mark).length;
      const empties = line.filter(i=>!this.board[i]);
      if(marks===2 && empties.length===1) return empties[0];
    }
    return -1;
  },

  checkEnd(){
    for(const line of this.lines){
      const [a,b,c] = line;
      if(this.board[a] && this.board[a]===this.board[b] && this.board[b]===this.board[c]){
        this.active=false;
        line.forEach(i=>this.cells[i].classList.add('win'));
        const winner = this.board[a];
        this.statusEl.textContent = winner + ' menang!';
        this.tally[winner]++;
        this.updateTally();
        setTimeout(()=>{
          Modal.show({
            icon: winner==='X' ? '❌' : '⭕', title: winner+' Menang!', type:'win',
            msg:`Skor — X: ${this.tally.X}  O: ${this.tally.O}  Seri: ${this.tally.draw}`,
            primary:{label:'Main Lagi', onClick:()=>this.newGame()},
            secondary:{label:'Menu', onClick:()=>showPanel('menu')}
          });
        }, 350);
        return true;
      }
    }
    if(this.board.every(v=>v)){
      this.active=false;
      this.statusEl.textContent = 'Seri.';
      this.tally.draw++;
      this.updateTally();
      setTimeout(()=>{
        Modal.show({
          icon:'🤝', title:'Seri!', type:'draw',
          msg:`Tidak ada pemenang kali ini. Skor — X: ${this.tally.X}  O: ${this.tally.O}  Seri: ${this.tally.draw}`,
          primary:{label:'Main Lagi', onClick:()=>this.newGame()},
          secondary:{label:'Menu', onClick:()=>showPanel('menu')}
        });
      }, 250);
      return true;
    }
    return false;
  },

  updateTally(){
    this.xwinsEl.textContent = this.tally.X;
    this.owinsEl.textContent = this.tally.O;
    this.drawsEl.textContent = this.tally.draw;
  }
};

/* ============================================================
   MEMORY MATCH
   ============================================================ */
const Memory = {
  symbols:['🐝','🍄','🐙','🎲','🌵','🍀','⭐','🔔','🦊','🐳','🎯','🍉'],
  pairCount:8,
  cards:[], flippedIdx:[], matchedCount:0, moves:0, timer:0, timerHandle:null, locked:false,

  init(){
    this.boardEl = document.getElementById('mem-board');
    this.movesEl = document.getElementById('mem-moves');
    this.timerEl = document.getElementById('mem-timer');
    this.statusEl = document.getElementById('mem-status');
    document.getElementById('mem-new').addEventListener('click', ()=>this.newGame());

    document.querySelectorAll('#mem-diff-row [data-mdiff]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#mem-diff-row [data-mdiff]').forEach(b=>b.classList.remove('on'));
        btn.classList.add('on');
        const map = {easy:6, medium:8, hard:12};
        this.pairCount = map[btn.dataset.mdiff];
        this.newGame();
      });
    });

    this.newGame();
  },

  newGame(){
    clearInterval(this.timerHandle);
    this.timer=0; this.moves=0; this.matchedCount=0; this.flippedIdx=[]; this.locked=false;
    this.timerEl.textContent=pad(0,3);
    this.movesEl.textContent=pad(0,3);
    this.statusEl.textContent='';
    const activeSymbols = this.symbols.slice(0, this.pairCount);
    const deck = [...activeSymbols, ...activeSymbols];
    for(let i=deck.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [deck[i],deck[j]]=[deck[j],deck[i]];
    }
    this.cards = deck.map(sym=>({sym, flipped:false, matched:false}));
    this.render();
  },

  render(){
    this.boardEl.innerHTML='';
    this.cardEls=[];
    this.cards.forEach((card,i)=>{
      const b=document.createElement('button');
      b.className='mem-card';
      b.addEventListener('click', ()=>this.flip(i));
      this.boardEl.appendChild(b);
      this.cardEls.push(b);
    });
  },

  flip(i){
    if(this.locked) return;
    const card=this.cards[i];
    if(card.flipped || card.matched) return;
    if(!this.timerHandle) this.startTimer();

    card.flipped=true;
    this.cardEls[i].classList.add('flipped');
    this.cardEls[i].textContent = card.sym;
    this.flippedIdx.push(i);

    if(this.flippedIdx.length===2){
      this.moves++;
      this.movesEl.textContent=pad(this.moves,3);
      this.locked=true;
      const [a,bI] = this.flippedIdx;
      if(this.cards[a].sym === this.cards[bI].sym){
        this.cards[a].matched=true; this.cards[bI].matched=true;
        this.cardEls[a].classList.add('matched');
        this.cardEls[bI].classList.add('matched');
        this.flippedIdx=[];
        this.locked=false;
        this.matchedCount++;
        if(this.matchedCount === this.pairCount) this.win();
      } else {
        setTimeout(()=>{
          this.cards[a].flipped=false; this.cards[bI].flipped=false;
          this.cardEls[a].classList.remove('flipped'); this.cardEls[a].textContent='';
          this.cardEls[bI].classList.remove('flipped'); this.cardEls[bI].textContent='';
          this.flippedIdx=[];
          this.locked=false;
        }, 700);
      }
    }
  },

  win(){
    clearInterval(this.timerHandle);
    this.statusEl.textContent = `Semua pasangan ditemukan dalam ${this.moves} langkah!`;
    setTimeout(()=>{
      Modal.show({
        icon:'🎊', title:'Selesai!', type:'win',
        msg:`Semua pasangan ditemukan dalam ${this.moves} langkah dan ${this.timer} detik.`,
        primary:{label:'Main Lagi', onClick:()=>this.newGame()},
        secondary:{label:'Menu', onClick:()=>showPanel('menu')}
      });
    }, 400);
  },

  startTimer(){
    this.timerHandle = setInterval(()=>{
      this.timer = Math.min(999, this.timer+1);
      this.timerEl.textContent = pad(this.timer,3);
    },1000);
  }
};

/* ============================================================
   CATUR — mesin aturan
   ============================================================ */
const PIECE_VALUES = {P:100,N:320,B:330,R:500,Q:900,K:0};
const CHESS_UNICODE = {
  w:{K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙'},
  b:{K:'♚',Q:'♛',R:'♜',B:'♝',N:'♞',P:'♟'}
};
const KNIGHT_OFFS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_OFFS   = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_DIRS   = [[-1,0],[1,0],[0,-1],[0,1]];

function inBoardBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

function initialBoard(){
  const back = ['R','N','B','Q','K','B','N','R'];
  const board = Array.from({length:8},()=>Array(8).fill(null));
  for(let c=0;c<8;c++){
    board[0][c] = 'b'+back[c];
    board[1][c] = 'bP';
    board[6][c] = 'wP';
    board[7][c] = 'w'+back[c];
  }
  return board;
}

function cloneState(state){
  return {
    board: state.board.map(row=>row.slice()),
    turn: state.turn,
    castling: {...state.castling},
    enPassant: state.enPassant ? {...state.enPassant} : null
  };
}

function findKing(state,color){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    if(state.board[r][c] === color+'K') return {r,c};
  }
  return null;
}

function isSquareAttacked(state, r, c, byColor){
  const board = state.board;
  const pawnDir = byColor==='w' ? 1 : -1;
  for(const dc of [-1,1]){
    const pr = r+pawnDir, pc = c+dc;
    if(inBoardBounds(pr,pc) && board[pr][pc]===byColor+'P') return true;
  }
  for(const [dr,dc] of KNIGHT_OFFS){
    const nr=r+dr, nc=c+dc;
    if(inBoardBounds(nr,nc) && board[nr][nc]===byColor+'N') return true;
  }
  for(const [dr,dc] of KING_OFFS){
    const nr=r+dr, nc=c+dc;
    if(inBoardBounds(nr,nc) && board[nr][nc]===byColor+'K') return true;
  }
  for(const [dr,dc] of BISHOP_DIRS){
    let nr=r+dr, nc=c+dc;
    while(inBoardBounds(nr,nc)){
      const p = board[nr][nc];
      if(p){ if(p[0]===byColor && (p[1]==='B'||p[1]==='Q')) return true; break; }
      nr+=dr; nc+=dc;
    }
  }
  for(const [dr,dc] of ROOK_DIRS){
    let nr=r+dr, nc=c+dc;
    while(inBoardBounds(nr,nc)){
      const p = board[nr][nc];
      if(p){ if(p[0]===byColor && (p[1]==='R'||p[1]==='Q')) return true; break; }
      nr+=dr; nc+=dc;
    }
  }
  return false;
}

function inCheck(state,color){
  const k = findKing(state,color);
  if(!k) return false;
  return isSquareAttacked(state, k.r, k.c, color==='w'?'b':'w');
}

function addPawnMove(fr,fc,tr,tc,promoRow,moves){
  if(tr===promoRow){
    ['Q','R','B','N'].forEach(pt=>moves.push({fr,fc,tr,tc,promotion:pt}));
  } else {
    moves.push({fr,fc,tr,tc});
  }
}

function pawnMoves(state,r,c,color,moves){
  const board=state.board;
  const dir = color==='w' ? -1 : 1;
  const startRow = color==='w' ? 6 : 1;
  const promoRow = color==='w' ? 0 : 7;
  const oneR = r+dir;
  if(inBoardBounds(oneR,c) && !board[oneR][c]){
    addPawnMove(r,c,oneR,c,promoRow,moves);
    if(r===startRow){
      const twoR = r+2*dir;
      if(!board[twoR][c]) moves.push({fr:r,fc:c,tr:twoR,tc:c,doubleStep:true});
    }
  }
  for(const dc of [-1,1]){
    const nc=c+dc;
    if(!inBoardBounds(oneR,nc)) continue;
    const target = board[oneR][nc];
    if(target && target[0]!==color){
      addPawnMove(r,c,oneR,nc,promoRow,moves);
    } else if(!target && state.enPassant && state.enPassant.r===oneR && state.enPassant.c===nc){
      moves.push({fr:r,fc:c,tr:oneR,tc:nc,enpassant:true});
    }
  }
}

function knightMoves(state,r,c,color,moves){
  const board=state.board;
  for(const [dr,dc] of KNIGHT_OFFS){
    const nr=r+dr, nc=c+dc;
    if(!inBoardBounds(nr,nc)) continue;
    const t=board[nr][nc];
    if(!t || t[0]!==color) moves.push({fr:r,fc:c,tr:nr,tc:nc});
  }
}

function slideMoves(state,r,c,color,moves,dirs){
  const board=state.board;
  for(const [dr,dc] of dirs){
    let nr=r+dr, nc=c+dc;
    while(inBoardBounds(nr,nc)){
      const t=board[nr][nc];
      if(!t){ moves.push({fr:r,fc:c,tr:nr,tc:nc}); }
      else { if(t[0]!==color) moves.push({fr:r,fc:c,tr:nr,tc:nc}); break; }
      nr+=dr; nc+=dc;
    }
  }
}

function kingMoves(state,r,c,color,moves){
  const board=state.board;
  for(const [dr,dc] of KING_OFFS){
    const nr=r+dr, nc=c+dc;
    if(!inBoardBounds(nr,nc)) continue;
    const t=board[nr][nc];
    if(!t || t[0]!==color) moves.push({fr:r,fc:c,tr:nr,tc:nc});
  }
  const opp = color==='w'?'b':'w';
  const rights = state.castling;
  const homeRow = color==='w' ? 7 : 0;
  if(r===homeRow && c===4 && !isSquareAttacked(state,r,c,opp)){
    if(rights[color+'K'] && !board[homeRow][5] && !board[homeRow][6] && board[homeRow][7]===color+'R'){
      if(!isSquareAttacked(state,homeRow,5,opp) && !isSquareAttacked(state,homeRow,6,opp)){
        moves.push({fr:r,fc:c,tr:homeRow,tc:6,castle:'K'});
      }
    }
    if(rights[color+'Q'] && !board[homeRow][3] && !board[homeRow][2] && !board[homeRow][1] && board[homeRow][0]===color+'R'){
      if(!isSquareAttacked(state,homeRow,3,opp) && !isSquareAttacked(state,homeRow,2,opp)){
        moves.push({fr:r,fc:c,tr:homeRow,tc:2,castle:'Q'});
      }
    }
  }
}

function generatePseudoMoves(state,color){
  const board = state.board;
  const moves=[];
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p = board[r][c];
      if(!p || p[0]!==color) continue;
      const type = p[1];
      if(type==='P') pawnMoves(state,r,c,color,moves);
      else if(type==='N') knightMoves(state,r,c,color,moves);
      else if(type==='B') slideMoves(state,r,c,color,moves,BISHOP_DIRS);
      else if(type==='R') slideMoves(state,r,c,color,moves,ROOK_DIRS);
      else if(type==='Q'){ slideMoves(state,r,c,color,moves,BISHOP_DIRS); slideMoves(state,r,c,color,moves,ROOK_DIRS); }
      else if(type==='K') kingMoves(state,r,c,color,moves);
    }
  }
  return moves;
}

function applyMove(state, move){
  const next = cloneState(state);
  const board = next.board;
  const color = state.turn;
  const opp = color==='w'?'b':'w';
  const piece = board[move.fr][move.fc];
  const pieceType = piece[1];

  if(move.enpassant){
    const capturedRow = color==='w' ? move.tr+1 : move.tr-1;
    board[capturedRow][move.tc] = null;
  }

  board[move.tr][move.tc] = move.promotion ? color+move.promotion : piece;
  board[move.fr][move.fc] = null;

  if(move.castle==='K'){
    board[move.fr][5] = board[move.fr][7];
    board[move.fr][7] = null;
  } else if(move.castle==='Q'){
    board[move.fr][3] = board[move.fr][0];
    board[move.fr][0] = null;
  }

  if(pieceType==='K'){
    next.castling[color+'K']=false;
    next.castling[color+'Q']=false;
  }
  if(pieceType==='R'){
    if(color==='w'){
      if(move.fr===7 && move.fc===0) next.castling.wQ=false;
      if(move.fr===7 && move.fc===7) next.castling.wK=false;
    } else {
      if(move.fr===0 && move.fc===0) next.castling.bQ=false;
      if(move.fr===0 && move.fc===7) next.castling.bK=false;
    }
  }
  if(move.tr===7 && move.tc===0) next.castling.wQ=false;
  if(move.tr===7 && move.tc===7) next.castling.wK=false;
  if(move.tr===0 && move.tc===0) next.castling.bQ=false;
  if(move.tr===0 && move.tc===7) next.castling.bK=false;

  next.enPassant = move.doubleStep ? {r:(move.fr+move.tr)/2, c:move.fc} : null;
  next.turn = opp;
  return next;
}

function generateLegalMoves(state,color){
  const pseudo = generatePseudoMoves(state,color);
  const legal=[];
  for(const m of pseudo){
    const next = applyMove(state,m);
    if(!inCheck(next,color)) legal.push(m);
  }
  return legal;
}

function evaluateBoard(state){
  const board = state.board;
  const centerBonus = {'3,3':10,'3,4':10,'4,3':10,'4,4':10,'2,3':4,'2,4':4,'5,3':4,'5,4':4};
  let score=0;
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p = board[r][c];
      if(!p) continue;
      let val = PIECE_VALUES[p[1]];
      if(p[1]!=='K'){
        const bonus = centerBonus[r+','+c];
        if(bonus) val += bonus;
      }
      score += p[0]==='w' ? val : -val;
    }
  }
  return score;
}

function negamax(state, depth, alpha, beta){
  const moves = generateLegalMoves(state, state.turn);
  if(moves.length===0){
    return inCheck(state,state.turn) ? -99000 : 0;
  }
  if(depth===0){
    return (state.turn==='w'?1:-1) * evaluateBoard(state);
  }
  let best=-Infinity;
  for(const m of moves){
    const next = applyMove(state,m);
    const score = -negamax(next, depth-1, -beta, -alpha);
    if(score>best) best=score;
    if(best>alpha) alpha=best;
    if(alpha>=beta) break;
  }
  return best;
}

/* ============================================================
   CATUR — kontroler UI
   ============================================================ */
const Chess = {
  mode:'2p', cpuColor:'b', difficulty:'medium',
  state:null, history:[], selected:null, selectedMoves:[],
  legalMoves:[], lastMove:null, gameOver:false, pendingPromo:false, moveCount:0,

  init(){
    this.boardEl = document.getElementById('chess-board');
    this.statusEl = document.getElementById('chess-status');
    this.movesEl = document.getElementById('chess-moves');
    this.materialEl = document.getElementById('chess-material');
    this.diffRow = document.getElementById('chess-diff-row');
    this.promoOverlay = document.getElementById('chess-promo-overlay');
    this.promoChoices = document.getElementById('chess-promo-choices');

    document.querySelectorAll('#game-chess [data-cmode]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#game-chess [data-cmode]').forEach(b=>b.classList.remove('on'));
        btn.classList.add('on');
        this.mode = btn.dataset.cmode;
        this.newGame();
      });
    });
    document.querySelectorAll('#chess-diff-row [data-cdiff]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#chess-diff-row [data-cdiff]').forEach(b=>b.classList.remove('on'));
        btn.classList.add('on');
        this.difficulty = btn.dataset.cdiff;
      });
    });
    document.getElementById('chess-new').addEventListener('click', ()=>this.newGame());
    document.getElementById('chess-undo').addEventListener('click', ()=>this.undo());

    this.newGame();
  },

  newGame(){
    this.state = { board: initialBoard(), turn:'w', castling:{wK:true,wQ:true,bK:true,bQ:true}, enPassant:null };
    this.history = [];
    this.selected = null; this.selectedMoves = [];
    this.lastMove = null; this.gameOver = false; this.pendingPromo = false;
    this.moveCount = 0;
    this.statusEl.classList.remove('lose');
    this.promoOverlay.classList.remove('show');
    this.legalMoves = generateLegalMoves(this.state, this.state.turn);
    this.movesEl.textContent = pad(0,3);
    this.updateMaterial();
    this.updateStatus();
    this.buildBoard();
    this.render();
  },

  buildBoard(){
    this.boardEl.innerHTML='';
    this.squareEls=[];
    for(let r=0;r<8;r++){
      const rowEls=[];
      for(let c=0;c<8;c++){
        const b=document.createElement('button');
        b.addEventListener('click', ()=>this.handleClick(r,c));
        this.boardEl.appendChild(b);
        rowEls.push(b);
      }
      this.squareEls.push(rowEls);
    }
  },

  render(){
    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const el = this.squareEls[r][c];
        const piece = this.state.board[r][c];
        el.className = 'chess-sq ' + ((r+c)%2===0 ? 'light':'dark');
        if(piece){
          el.textContent = CHESS_UNICODE[piece[0]][piece[1]];
          el.classList.add(piece[0]==='w' ? 'piece-w' : 'piece-b');
        } else {
          el.textContent='';
        }
      }
    }
    if(this.lastMove){
      this.squareEls[this.lastMove.fr][this.lastMove.fc].classList.add('last-move');
      this.squareEls[this.lastMove.tr][this.lastMove.tc].classList.add('last-move');
    }
    if(this.selected){
      this.squareEls[this.selected.r][this.selected.c].classList.add('selected');
      this.selectedMoves.forEach(m=>{
        const el = this.squareEls[m.tr][m.tc];
        const isCapture = !!this.state.board[m.tr][m.tc] || m.enpassant;
        el.classList.add(isCapture ? 'highlight-capture' : 'highlight-move');
      });
    }
    if(!this.gameOver){
      const kingPos = findKing(this.state, this.state.turn);
      if(kingPos && inCheck(this.state, this.state.turn)) this.squareEls[kingPos.r][kingPos.c].classList.add('in-check');
    }
  },

  handleClick(r,c){
    if(this.gameOver || this.pendingPromo) return;
    if(this.mode==='cpu' && this.state.turn===this.cpuColor) return;
    const piece = this.state.board[r][c];

    if(this.selected){
      const move = this.selectedMoves.find(m=>m.tr===r && m.tc===c);
      if(move){ this.executeMove(move); return; }
      if(piece && piece[0]===this.state.turn){ this.selectSquare(r,c); }
      else { this.selected=null; this.selectedMoves=[]; this.render(); }
      return;
    }
    if(piece && piece[0]===this.state.turn) this.selectSquare(r,c);
  },

  selectSquare(r,c){
    this.selected = {r,c};
    this.selectedMoves = this.legalMoves.filter(m=>m.fr===r && m.fc===c);
    this.render();
  },

  executeMove(move){
    const variants = this.legalMoves.filter(m=>m.fr===move.fr && m.fc===move.fc && m.tr===move.tr && m.tc===move.tc);
    this.selected=null; this.selectedMoves=[];
    if(variants.length>1){ this.openPromo(variants); return; }
    this.applyAndContinue(move);
  },

  openPromo(variants){
    this.pendingPromo = true;
    const color = this.state.turn;
    this.promoChoices.innerHTML='';
    ['Q','R','B','N'].forEach(pt=>{
      const v = variants.find(x=>x.promotion===pt);
      if(!v) return;
      const btn=document.createElement('button');
      btn.textContent = CHESS_UNICODE[color][pt];
      btn.classList.add(color==='w' ? 'piece-w' : 'piece-b');
      btn.addEventListener('click', ()=>{
        this.promoOverlay.classList.remove('show');
        this.pendingPromo=false;
        this.applyAndContinue(v);
      });
      this.promoChoices.appendChild(btn);
    });
    this.promoOverlay.classList.add('show');
    this.render();
  },

  applyAndContinue(move){
    this.history.push(cloneState(this.state));
    this.state = applyMove(this.state, move);
    this.lastMove = {fr:move.fr, fc:move.fc, tr:move.tr, tc:move.tc};
    this.moveCount++;
    this.movesEl.textContent = pad(Math.min(999,this.moveCount),3);
    this.updateMaterial();
    this.legalMoves = generateLegalMoves(this.state, this.state.turn);
    this.render();
    this.checkGameEnd();
    if(!this.gameOver){
      this.updateStatus();
      if(this.mode==='cpu' && this.state.turn===this.cpuColor){
        setTimeout(()=>this.cpuMove(), 350);
      }
    }
  },

  undo(){
    if(this.pendingPromo || !this.history.length) return;
    let steps = 1;
    if(this.mode==='cpu' && this.history.length>=2 && this.state.turn!==this.cpuColor){
      steps = 2;
    }
    for(let i=0;i<steps && this.history.length;i++) this.state = this.history.pop();
    this.gameOver = false;
    this.selected=null; this.selectedMoves=[];
    this.statusEl.classList.remove('lose');
    this.lastMove = null;
    this.moveCount = Math.max(0, this.moveCount-steps);
    this.movesEl.textContent = pad(this.moveCount,3);
    this.legalMoves = generateLegalMoves(this.state, this.state.turn);
    this.updateMaterial();
    this.updateStatus();
    this.render();
  },

  checkGameEnd(){
    if(this.legalMoves.length>0) return;
    this.gameOver = true;
    const inChk = inCheck(this.state, this.state.turn);
    if(inChk){
      const winner = this.state.turn==='w' ? 'Hitam' : 'Putih';
      this.statusEl.textContent = `Skakmat! ${winner} menang.`;
      this.statusEl.classList.add('lose');
      setTimeout(()=>{
        Modal.show({
          icon:'♚', title:'Skakmat!', type:'win',
          msg:`${winner} menang dengan skakmat dalam ${this.moveCount} langkah.`,
          primary:{label:'Main Lagi', onClick:()=>this.newGame()},
          secondary:{label:'Menu', onClick:()=>showPanel('menu')}
        });
      }, 400);
    } else {
      this.statusEl.textContent = 'Buntu — permainan seri.';
      setTimeout(()=>{
        Modal.show({
          icon:'🤝', title:'Seri!', type:'draw',
          msg:'Tidak ada langkah legal tersisa, tapi raja tidak sedang diskak (stalemate).',
          primary:{label:'Main Lagi', onClick:()=>this.newGame()},
          secondary:{label:'Menu', onClick:()=>showPanel('menu')}
        });
      }, 400);
    }
  },

  updateStatus(){
    if(this.gameOver) return;
    const who = this.state.turn==='w' ? 'Putih' : 'Hitam';
    const chk = inCheck(this.state, this.state.turn);
    this.statusEl.textContent = chk ? `Skak! Giliran ${who}` : `Giliran ${who}`;
    this.statusEl.classList.toggle('lose', chk);
  },

  updateMaterial(){
    let diff=0;
    for(const row of this.state.board){
      for(const p of row){
        if(!p) continue;
        const val = PIECE_VALUES[p[1]]/100;
        diff += p[0]==='w' ? val : -val;
      }
    }
    diff = Math.round(diff);
    this.materialEl.textContent = diff===0 ? '±0' : (diff>0?'+':'')+diff;
  },

  cpuMove(){
    if(this.gameOver) return;
    const moves = this.legalMoves;
    if(!moves.length) return;
    const depthMap = {easy:1, medium:2, hard:3};
    const depth = depthMap[this.difficulty] || 2;
    let candidates=[], bestScore=-Infinity;
    for(const m of moves){
      const next = applyMove(this.state, m);
      const score = -negamax(next, depth-1, -Infinity, Infinity);
      candidates.push({m,score});
      if(score>bestScore) bestScore=score;
    }
    let pool = candidates.filter(x=>x.score >= bestScore-30);
    if(this.difficulty==='easy' && Math.random()<0.35) pool = candidates;
    const choice = pool[Math.floor(Math.random()*pool.length)].m;
    this.applyAndContinue(choice);
  }
};

document.addEventListener('DOMContentLoaded', ()=>{
  Tabs.init();
  Modal.init();
  Mines.init();
  Game2048.init();
  TicTacToe.init();
  Memory.init();
  Chess.init();
  window.addEventListener('resize', ()=>{
    Mines.resize();
    if(Game2048.grid.length){ Game2048.setupCells(); Game2048.render(); }
  });
});
