// ========= LEITURA ========
const $ = (sel) => document.querySelector(sel);
const boardEl = $("#board");
const turnInfoEl = $("#turnInfo");
const checkInfoEl = $("#checkInfo");
const resetBtn = $("#resetBtn");

const PIECE_TO_CHAR = {   //dicionário de figuras, wK = white King
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟︎",
};

const cloneBoard = (b) => b.map(row => row.slice()); //simular movimentos sem bagunçar o jogo de verdade
const inBounds = (r,c) => r>=0 && r<8 && c>=0 && c<8; //verifica se uma posição esta dentro do tabuleiro 8x8
const colorOf = (piece) => piece ? piece[0] : null; // 'w' | 'b' | null DESCOBRE QUAL PEÇ ESTA NO LUGAR
const isEmpty = (b,r,c) => !b[r][c]; // vê se tem alguma casa vazia

        // converte numeros para casas xadrez
const fileLetters = "abcdefgh";
const toCoord = (r,c) => `${fileLetters[c]}${8-r}`;

// ========= ESTADO DE JOGO ========
let board, selected, legalTargets, turn;

function initialBoard(){     // cria tabuleiro                        
  return [
    ["bR","bN","bB","bQ","bK","bB","bN","bR"],
    ["bP","bP","bP","bP","bP","bP","bP","bP"],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ["wP","wP","wP","wP","wP","wP","wP","wP"],
    ["wR","wN","wB","wQ","wK","wB","wN","wR"],
  ];
}

function resetGame(){ //reinicia o jogo
  board = initialBoard();
  selected = null;
  legalTargets = [];
  turn = "w";
  render();
}
resetBtn.addEventListener("click", resetGame);

// ========= RENDERIZANDO  ======== 
function render(){
  boardEl.innerHTML = "";
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const sq = document.createElement("button");
      sq.className = "square " + (((r+c)%2===0) ? "light" : "dark");
      sq.setAttribute("data-r", r);
      sq.setAttribute("data-c", c);
      sq.setAttribute("aria-label", `Casa ${toCoord(r,c)}`);

      const p = board[r][c];
      if(p){
        sq.textContent = PIECE_TO_CHAR[p] || "?";
      }

      // coordinate label (bottom-left of each square)
      const coord = document.createElement("span");
      coord.className = "coord";
      coord.textContent = toCoord(r,c);
      sq.appendChild(coord);

      // selection + legal target highlights
      if(selected && selected.r===r && selected.c===c){
        sq.classList.add("selected");
      }
      if(legalTargets.some(t => t.r===r && t.c===c)){
        if(board[r][c]) sq.classList.add("capture-possible");
        else sq.classList.add("move-possible");
      }

      sq.addEventListener("click", onSquareClick);
      boardEl.appendChild(sq);
    }
  }

  turnInfoEl.textContent = (turn === "w") ? "Vez das Brancas" : "Vez das Pretas";
  checkInfoEl.classList.toggle("hidden", !isKingInCheck(board, turn));
}

// ========= interaction ========
function onSquareClick(e){
  const r = parseInt(e.currentTarget.getAttribute("data-r"),10);
  const c = parseInt(e.currentTarget.getAttribute("data-c"),10);
  const piece = board[r][c];
  const pieceColor = colorOf(piece);

  if(selected){
    // if clicked same color piece, switch selection
    if(piece && pieceColor === turn){
      selectSquare(r,c);
      return;
    }
    // try move
    const isLegal = legalTargets.some(t => t.r===r && t.c===c);
    if(isLegal){
      makeMove(selected.r, selected.c, r, c);
      // switch turn
      turn = (turn === "w") ? "b" : "w";
      selected = null;
      legalTargets = [];
      render();
      return;
    }
    // click elsewhere: clear selection
    selected = null;
    legalTargets = [];
    render();
    return;
  }

  // no selection yet
  if(piece && pieceColor === turn){
    selectSquare(r,c);
  }
}

function selectSquare(r,c){
  selected = {r,c};
  const pseudo = generatePseudoMoves(board, r, c);
  // filter out moves that leave own king in check
  legalTargets = pseudo.filter(t => !moveLeavesKingInCheck(board, r, c, t.r, t.c));
  render();
}

function makeMove(r1,c1,r2,c2){
  const p = board[r1][c1];
  board[r2][c2] = p;
  board[r1][c1] = null;

  // promoção automática para Rainha
  if(p === "wP" && r2 === 0) board[r2][c2] = "wQ";
  if(p === "bP" && r2 === 7) board[r2][c2] = "bQ";
}

// ========= rules ========
function generatePseudoMoves(b, r, c){
  const p = b[r][c];
  if(!p) return [];
  const color = colorOf(p);
  const dir = (color === "w") ? -1 : 1; // peões

  const moves = [];
  const pushIf = (nr,nc) => { if(inBounds(nr,nc) && !b[nr][nc]) moves.push({r:nr,c:nc}); };
  const captureIf = (nr,nc) => { if(inBounds(nr,nc) && b[nr][nc] && colorOf(b[nr][nc]) !== color) moves.push({r:nr,c:nc}); };

  switch(p[1]){ // piece type char
    case "P": {
      // forward 1
      pushIf(r+dir, c);
      // forward 2 from start
      const startRow = (color === "w") ? 6 : 1;
      if(r === startRow && isEmpty(b,r+dir,c) && isEmpty(b,r+2*dir,c)){
        moves.push({r:r+2*dir, c});
      }
      // captures
      captureIf(r+dir, c-1);
      captureIf(r+dir, c+1);
      break;
    }
    case "N": {
      const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for(const [dr,dc] of deltas){
        const nr=r+dr, nc=c+dc;
        if(!inBounds(nr,nc)) continue;
        const tgt=b[nr][nc];
        if(!tgt || colorOf(tgt)!==color) moves.push({r:nr,c:nc});
      }
      break;
    }
    case "B": slideDirs([[1,1],[1,-1],[-1,1],[-1,-1]]); break;
    case "R": slideDirs([[1,0],[-1,0],[0,1],[0,-1]]); break;
    case "Q": slideDirs([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]); break;
    case "K": {
      const deltas = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for(const [dr,dc] of deltas){
        const nr=r+dr, nc=c+dc;
        if(!inBounds(nr,nc)) continue;
        const tgt=b[nr][nc];
        if(!tgt || colorOf(tgt)!==color) moves.push({r:nr,c:nc});
      }
      // (roque ficará para depois)
      break;
    }
  }

  function slideDirs(dirs){
    for(const [dr,dc] of dirs){
      let nr=r+dr, nc=c+dc;
      while(inBounds(nr,nc)){
        const tgt=b[nr][nc];
        if(!tgt){ moves.push({r:nr,c:nc}); }
        else {
          if(colorOf(tgt)!==color) moves.push({r:nr,c:nc});
          break;
        }
        nr+=dr; nc+=dc;
      }
    }
  }

  return moves;
}

function moveLeavesKingInCheck(b, r1,c1, r2,c2){
  const next = cloneBoard(b);
  const moving = next[r1][c1];
  next[r1][c1] = null;
  next[r2][c2] = moving;
  // promoção hipotética para manter validação consistente
  if(moving==="wP" && r2===0) next[r2][c2]="wQ";
  if(moving==="bP" && r2===7) next[r2][c2]="bQ";

  const me = colorOf(moving);
  return isKingInCheck(next, me);
}

function isKingInCheck(b, color){
  // acha o rei da cor
  let kr=-1, kc=-1;
  outer:
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      if(b[r][c] === (color+"K")){ kr=r; kc=c; break outer; }
    }
  }
  if(kr===-1) return false; // rei capturado? (não deveria acontecer)
  // atacado pelo oponente?
  const opp = (color === "w") ? "b" : "w";
  return squareAttackedBy(b, kr, kc, opp);
}

function squareAttackedBy(b, tr, tc, attackerColor){
  // cavalo
  const knightD = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for(const [dr,dc] of knightD){
    const nr=tr+dr, nc=tc+dc;
    if(inBounds(nr,nc) && b[nr][nc]===attackerColor+"N") return true;
  }
  // rei adjacente
  const kingD = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for(const [dr,dc] of kingD){
    const nr=tr+dr, nc=tc+dc;
    if(inBounds(nr,nc) && b[nr][nc]===attackerColor+"K") return true;
  }
  // peões
  const dir = (attackerColor==="w") ? -1 : 1;
  for(const dc of [-1,1]){
    const nr=tr-dir, nc=tc-dc; // inverso: casas de onde um peão poderia estar capturando para (tr,tc)
    if(inBounds(nr,nc) && b[nr][nc]===attackerColor+"P") return true;
  }
  // bispo/torre/rainha por linhas
  const rays = [
    [1,0],[-1,0],[0,1],[0,-1], // torre
    [1,1],[1,-1],[-1,1],[-1,-1] // bispo
  ];
  for(let i=0;i<rays.length;i++){
    const [dr,dc]=rays[i];
    let nr=tr+dr, nc=tc+dc;
    while(inBounds(nr,nc)){
      const p=b[nr][nc];
      if(p){
        const col=colorOf(p), type=p[1];
        if(col===attackerColor){
          if((i<4 && (type==="R"||type==="Q")) || (i>=4 && (type==="B"||type==="Q"))){
            return true;
          }
        }
        break;
      }
      nr+=dr; nc+=dc;
    }
  }
  return false;
}

// ========= boot ========
resetGame();
