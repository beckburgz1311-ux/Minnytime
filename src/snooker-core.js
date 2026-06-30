"use strict";

const SnookerGame = (() => {
  const TABLE = { x: 70, y: 50, w: 860, h: 460, ballR: 12, pocketR: 25 };
  const POCKETS = [
    { x: TABLE.x, y: TABLE.y },
    { x: TABLE.x + TABLE.w / 2, y: TABLE.y - 2 },
    { x: TABLE.x + TABLE.w, y: TABLE.y },
    { x: TABLE.x, y: TABLE.y + TABLE.h },
    { x: TABLE.x + TABLE.w / 2, y: TABLE.y + TABLE.h + 2 },
    { x: TABLE.x + TABLE.w, y: TABLE.y + TABLE.h }
  ];
  const VALUES = { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7, white: 0 };
  const COLOURS = {
    white: "#f7f3df", red: "#bc2f31", yellow: "#e6cd31", green: "#2f8b4a",
    brown: "#7b4628", blue: "#2674bc", pink: "#e88ba7", black: "#151515"
  };
  const CLEARANCE = ["yellow", "green", "brown", "blue", "pink", "black"];
  const SPOTS = {
    yellow: { x: 250, y: 370 }, green: { x: 250, y: 190 }, brown: { x: 250, y: 280 },
    blue: { x: 500, y: 280 }, pink: { x: 675, y: 280 }, black: { x: 850, y: 280 }
  };

  const state = {
    players: [{ name: "PLAYER 1", score: 0 }, { name: "PLAYER 2", score: 0 }],
    current: 0,
    balls: [],
    targetMode: "red",
    clearanceIndex: 0,
    aimingAngle: 0,
    power: 45,
    shotActive: false,
    paused: true,
    frameOver: false,
    shot: null,
    message: "",
    result: ""
  };

  function makeBall(name, x, y, id = name) {
    return {
      id, name, type: name === "red" ? "red" : name === "white" ? "cue" : "colour",
      value: VALUES[name], colour: COLOURS[name], x, y, vx: 0, vy: 0, potted: false
    };
  }

  function reset(playerOne = "PLAYER 1", playerTwo = "PLAYER 2") {
    state.players = [
      { name: (playerOne || "PLAYER 1").toUpperCase(), score: 0 },
      { name: (playerTwo || "PLAYER 2").toUpperCase(), score: 0 }
    ];
    state.current = 0;
    state.targetMode = "red";
    state.clearanceIndex = 0;
    state.aimingAngle = 0;
    state.power = 45;
    state.shotActive = false;
    state.paused = false;
    state.frameOver = false;
    state.result = "";
    state.shot = null;
    state.balls = [];

    state.balls.push(makeBall("white", 220, 280, "cue"));
    Object.entries(SPOTS).forEach(([name, spot]) => state.balls.push(makeBall(name, spot.x, spot.y, name)));

    const startX = 705;
    const spacingX = TABLE.ballR * 1.78;
    const spacingY = TABLE.ballR * 2.04;
    let id = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        state.balls.push(makeBall(
          "red",
          startX + row * spacingX,
          280 - row * spacingY / 2 + col * spacingY,
          `red-${id++}`
        ));
      }
    }
    separateFromSpot("pink");
    setMessage(`${state.players[0].name} to break. On a red.`);
  }

  function separateFromSpot(name) {
    const ball = getBall(name);
    if (!ball) return;
    for (const other of state.balls) {
      if (other === ball || other.potted) continue;
      const dx = ball.x - other.x;
      const dy = ball.y - other.y;
      const dist = Math.hypot(dx, dy);
      if (dist < TABLE.ballR * 2) ball.x -= TABLE.ballR * 2 - dist + 2;
    }
  }

  function getBall(id) {
    return state.balls.find(ball => ball.id === id);
  }

  function cueBall() {
    return getBall("cue");
  }

  function redsRemaining() {
    return state.balls.filter(ball => ball.type === "red" && !ball.potted).length;
  }

  function targetName() {
    if (state.targetMode === "red") return "RED";
    if (state.targetMode === "colour") return "COLOUR";
    return CLEARANCE[state.clearanceIndex].toUpperCase();
  }

  function targetValue() {
    if (state.targetMode === "red") return 1;
    if (state.targetMode === "colour") return 7;
    return VALUES[CLEARANCE[state.clearanceIndex]] || 7;
  }

  function isLegalTarget(ball) {
    if (!ball || ball.type === "cue") return false;
    if (state.targetMode === "red") return ball.type === "red";
    if (state.targetMode === "colour") return ball.type === "colour";
    return ball.name === CLEARANCE[state.clearanceIndex];
  }

  function setMessage(text) {
    state.message = text;
  }

  function setAim(angle) {
    if (state.shotActive || state.frameOver) return;
    state.aimingAngle = angle;
  }

  function nudgeAim(amount) {
    setAim(state.aimingAngle + amount);
  }

  function setPower(value) {
    state.power = Math.max(10, Math.min(100, Number(value) || 45));
  }

  function shoot() {
    if (state.shotActive || state.paused || state.frameOver) return false;
    const cue = cueBall();
    if (!cue || cue.potted) return false;
    const speed = 250 + state.power * 7.4;
    cue.vx = Math.cos(state.aimingAngle) * speed;
    cue.vy = Math.sin(state.aimingAngle) * speed;
    state.shotActive = true;
    state.shot = {
      targetMode: state.targetMode,
      clearanceIndex: state.clearanceIndex,
      firstContact: null,
      potted: [],
      cuePotted: false,
      elapsed: 0
    };
    setMessage(`${state.players[state.current].name} takes the shot...`);
    return true;
  }

  function update(dt) {
    if (!state.shotActive || state.paused || state.frameOver) return;
    const capped = Math.min(dt, 1 / 30);
    const steps = Math.max(1, Math.ceil(capped / (1 / 180)));
    const step = capped / steps;
    for (let i = 0; i < steps; i++) physicsStep(step);
    state.shot.elapsed += capped;
    if (state.shot.elapsed > 0.35 && allStopped()) finishShot();
  }

  function physicsStep(dt) {
    const activeBalls = state.balls.filter(ball => !ball.potted);
    for (const ball of activeBalls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > 0) {
        const decel = 95 * dt;
        const next = Math.max(0, speed - decel);
        if (next === 0) { ball.vx = 0; ball.vy = 0; }
        else { ball.vx *= next / speed; ball.vy *= next / speed; }
      }
      handlePocket(ball);
      if (!ball.potted) handleCushion(ball);
    }

    for (let i = 0; i < activeBalls.length; i++) {
      for (let j = i + 1; j < activeBalls.length; j++) {
        if (!activeBalls[i].potted && !activeBalls[j].potted) collideBalls(activeBalls[i], activeBalls[j]);
      }
    }
  }

  function handlePocket(ball) {
    for (const pocket of POCKETS) {
      if (Math.hypot(ball.x - pocket.x, ball.y - pocket.y) < TABLE.pocketR) {
        ball.potted = true;
        ball.vx = 0;
        ball.vy = 0;
        if (ball.type === "cue") state.shot.cuePotted = true;
        else state.shot.potted.push(ball);
        return;
      }
    }
  }

  function handleCushion(ball) {
    const r = TABLE.ballR;
    const left = TABLE.x + r;
    const right = TABLE.x + TABLE.w - r;
    const top = TABLE.y + r;
    const bottom = TABLE.y + TABLE.h - r;
    if (ball.x < left) { ball.x = left; ball.vx = Math.abs(ball.vx) * .92; }
    if (ball.x > right) { ball.x = right; ball.vx = -Math.abs(ball.vx) * .92; }
    if (ball.y < top) { ball.y = top; ball.vy = Math.abs(ball.vy) * .92; }
    if (ball.y > bottom) { ball.y = bottom; ball.vy = -Math.abs(ball.vy) * .92; }
  }

  function collideBalls(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const minDist = TABLE.ballR * 2;
    const distSq = dx * dx + dy * dy;
    if (distSq <= 0 || distSq >= minDist * minDist) return;
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    a.x -= nx * overlap / 2;
    a.y -= ny * overlap / 2;
    b.x += nx * overlap / 2;
    b.y += ny * overlap / 2;

    const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (relative < 0) {
      const impulse = -relative * .98;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }

    if (state.shot && !state.shot.firstContact) {
      if (a.type === "cue" && b.type !== "cue") state.shot.firstContact = b;
      else if (b.type === "cue" && a.type !== "cue") state.shot.firstContact = a;
    }
  }

  function allStopped() {
    return state.balls.every(ball => ball.potted || Math.hypot(ball.vx, ball.vy) < 2.2);
  }

  function stopAll() {
    state.balls.forEach(ball => { ball.vx = 0; ball.vy = 0; });
  }

  function finishShot() {
    stopAll();
    const shot = state.shot;
    state.shotActive = false;
    state.shot = null;

    const legalFirst = shot.firstContact && isLegalForSnapshot(shot.firstContact, shot.targetMode, shot.clearanceIndex);
    const legalPots = shot.potted.filter(ball => isLegalForSnapshot(ball, shot.targetMode, shot.clearanceIndex));
    const illegalPots = shot.potted.filter(ball => !isLegalForSnapshot(ball, shot.targetMode, shot.clearanceIndex));
    const foul = shot.cuePotted || !legalFirst || illegalPots.length > 0;

    if (foul) {
      const foulValue = Math.max(
        4,
        snapshotTargetValue(shot.targetMode, shot.clearanceIndex),
        shot.firstContact ? shot.firstContact.value : 0,
        ...illegalPots.map(ball => ball.value)
      );
      state.players[1 - state.current].score += foulValue;
      respotPottedColours(shot.potted, false);
      if (shot.cuePotted) replaceCueBall();
      switchTurn();
      setMessage(`FOUL — ${foulValue} points to ${state.players[state.current].name}. On ${targetName().toLowerCase()}.`);
      return;
    }

    if (!legalPots.length) {
      respotPottedColours(shot.potted, false);
      switchTurn();
      setMessage(`No pot. ${state.players[state.current].name} to play, on ${targetName().toLowerCase()}.`);
      return;
    }

    if (shot.targetMode === "red") {
      const points = legalPots.length;
      state.players[state.current].score += points;
      state.targetMode = "colour";
      setMessage(`${points} red${points === 1 ? "" : "s"} potted. Continue on any colour.`);
      return;
    }

    if (shot.targetMode === "colour") {
      const best = legalPots.reduce((highest, ball) => ball.value > highest.value ? ball : highest, legalPots[0]);
      state.players[state.current].score += best.value;
      respotPottedColours(shot.potted, true);
      if (redsRemaining() > 0) {
        state.targetMode = "red";
        setMessage(`${best.name.toUpperCase()} scores ${best.value}. Continue on a red.`);
      } else {
        state.targetMode = "clear";
        state.clearanceIndex = 0;
        setMessage(`${best.name.toUpperCase()} scores ${best.value}. Colours clearance begins: yellow.`);
      }
      return;
    }

    const targetColour = CLEARANCE[shot.clearanceIndex];
    const targetBall = legalPots.find(ball => ball.name === targetColour);
    if (targetBall) {
      state.players[state.current].score += targetBall.value;
      state.clearanceIndex += 1;
      if (state.clearanceIndex >= CLEARANCE.length) {
        endFrame();
      } else {
        setMessage(`${targetBall.name.toUpperCase()} potted. Continue on ${CLEARANCE[state.clearanceIndex]}.`);
      }
    }
  }

  function isLegalForSnapshot(ball, mode, clearanceIndex) {
    if (!ball || ball.type === "cue") return false;
    if (mode === "red") return ball.type === "red";
    if (mode === "colour") return ball.type === "colour";
    return ball.name === CLEARANCE[clearanceIndex];
  }

  function snapshotTargetValue(mode, clearanceIndex) {
    if (mode === "red") return 1;
    if (mode === "colour") return 7;
    return VALUES[CLEARANCE[clearanceIndex]] || 7;
  }

  function respotPottedColours(potted, legalColourShot) {
    for (const ball of potted) {
      if (ball.type !== "colour") continue;
      const shouldStayDown = state.targetMode === "clear" && legalColourShot && ball.name === CLEARANCE[state.clearanceIndex];
      if (!shouldStayDown) respot(ball);
    }
  }

  function respot(ball) {
    const spot = SPOTS[ball.name];
    if (!spot) return;
    ball.potted = false;
    ball.vx = 0;
    ball.vy = 0;
    ball.x = spot.x;
    ball.y = spot.y;
    if (positionOccupied(ball.x, ball.y, ball)) {
      for (let offset = 1; offset < 16; offset++) {
        const candidates = [spot.x - offset * 14, spot.x + offset * 14];
        const found = candidates.find(x => !positionOccupied(x, spot.y, ball));
        if (found !== undefined) { ball.x = found; break; }
      }
    }
  }

  function positionOccupied(x, y, except) {
    return state.balls.some(ball => ball !== except && !ball.potted && Math.hypot(ball.x - x, ball.y - y) < TABLE.ballR * 2.05);
  }

  function replaceCueBall() {
    const cue = cueBall();
    cue.potted = false;
    cue.vx = 0;
    cue.vy = 0;
    const positions = [280, 235, 325, 190, 370];
    cue.x = 205;
    cue.y = positions.find(y => !positionOccupied(cue.x, y, cue)) || 280;
  }

  function switchTurn() {
    state.current = 1 - state.current;
  }

  function endFrame() {
    state.frameOver = true;
    state.paused = true;
    const [a, b] = state.players;
    if (a.score === b.score) state.result = `A DRAW — ${a.score} points each.`;
    else {
      const winner = a.score > b.score ? a : b;
      const loser = a.score > b.score ? b : a;
      state.result = `${winner.name} wins ${winner.score}–${loser.score}.`;
    }
    setMessage(state.result);
  }

  return {
    TABLE, POCKETS, COLOURS, VALUES, CLEARANCE, SPOTS, state,
    reset, update, shoot, setAim, nudgeAim, setPower, cueBall, redsRemaining,
    targetName, targetValue, setMessage
  };
})();
