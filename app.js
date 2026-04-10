let device = null;
let server = null;
let service = null;
let characteristic = null;
let isListening = false;
let lastUpdate = 0;

const SERVICE_UUID = "674219bc-d86b-4b65-8ea4-9c3e64b857c8";
const CHAR_UUID = "329c75cc-17ff-4de5-affd-69c80311a66f";

let TOTAL_QUESTIONS = 20;
let TERMS_PER_QUESTION = 5;
let SHOW_MS = 1000;
let DIGIT_LEVEL = 2;

let currentInput = 0;
let currentAnswer = 0;
let currentSequence = [];
let currentProblem = 0;
let bossHp = TOTAL_QUESTIONS;

let gameStarted = false;
let acceptingAnswer = false;
let presenting = false;

let correctCount = 0;
let wrongCount = 0;

const statusEl = document.getElementById("status");
const problemIndexEl = document.getElementById("problemIndex");
const problemTotalEl = document.getElementById("problemTotal");
const bossHpEl = document.getElementById("bossHp");
const currentInputMiniEl = document.getElementById("currentInputMini");
const phaseMiniEl = document.getElementById("phaseMini");

const currentTermEl = document.getElementById("currentTerm");
const historyEl = document.getElementById("history");
const phaseTextEl = document.getElementById("phaseText");

const playerDinoEl = document.getElementById("playerDino");
const bossDinoEl = document.getElementById("bossDino");
const centerEffectEl = document.getElementById("centerEffect");

const effectTextEl = document.getElementById("effectText");
const hpBarFillEl = document.getElementById("hpBarFill");
const hpTextEl = document.getElementById("hpText");

const currentInputEl = document.getElementById("currentInput");
const judgeTextEl = document.getElementById("judgeText");

const rawBoxEl = document.getElementById("rawBox");
const logBoxEl = document.getElementById("logBox");

const digitLevelEl = document.getElementById("digitLevel");
const termCountEl = document.getElementById("termCount");
const totalQuestionsEl = document.getElementById("totalQuestions");
const showModeEl = document.getElementById("showMode");

const hitFlashEl = document.getElementById("hitFlash");
const damagePopEl = document.getElementById("damagePop");

const resultCardEl = document.getElementById("resultCard");
const resultTitleEl = document.getElementById("resultTitle");
const summaryTotalEl = document.getElementById("summaryTotal");
const summaryCorrectEl = document.getElementById("summaryCorrect");
const summaryWrongEl = document.getElementById("summaryWrong");
const summaryRateEl = document.getElementById("summaryRate");
const summaryMessageEl = document.getElementById("summaryMessage");
const restartBtnEl = document.getElementById("restartBtn");

// 정답 시 공룡 울음소리
const dinoRoarSound = new Audio("https://actions.google.com/sounds/v1/animals/lion_roar.ogg");
// 오답 시 약한 충격감
const wrongHitSound = new Audio("https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg");
const winSound = new Audio("https://actions.google.com/sounds/v1/cartoon/concussive_drum_hit.ogg");

dinoRoarSound.preload = "auto";
wrongHitSound.preload = "auto";
winSound.preload = "auto";

document.getElementById("connectBtn").addEventListener("click", connectBLE);
document.getElementById("disconnectBtn").addEventListener("click", disconnectBLE);
document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("checkBtn").addEventListener("click", checkAnswer);
restartBtnEl.addEventListener("click", startGame);

window.addEventListener("pagehide", disconnectBLE);
window.addEventListener("beforeunload", disconnectBLE);

function playSound(audio, volume = 1) {
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch (e) {}
}

function readOptions() {
  DIGIT_LEVEL = parseInt(digitLevelEl.value, 10);
  TERMS_PER_QUESTION = parseInt(termCountEl.value, 10);
  TOTAL_QUESTIONS = parseInt(totalQuestionsEl.value, 10);
  SHOW_MS = parseInt(showModeEl.value, 10);
}

function updateBossMood() {
  bossDinoEl.classList.remove("mood-normal", "mood-angry", "mood-rage");

  const hpRatio = bossHp / TOTAL_QUESTIONS;
  if (hpRatio <= 0.3) {
    bossDinoEl.classList.add("mood-rage");
  } else if (hpRatio <= 0.65) {
    bossDinoEl.classList.add("mood-angry");
  } else {
    bossDinoEl.classList.add("mood-normal");
  }
}

function updateHpBar() {
  const ratio = Math.max(0, bossHp / TOTAL_QUESTIONS);
  hpBarFillEl.style.width = `${ratio * 100}%`;
  hpTextEl.textContent = `${bossHp} / ${TOTAL_QUESTIONS}`;
}

function updateHud() {
  problemIndexEl.textContent = currentProblem;
  problemTotalEl.textContent = TOTAL_QUESTIONS;
  bossHpEl.textContent = bossHp;
  currentInputMiniEl.textContent = currentInput;
  phaseMiniEl.textContent = presenting ? "제시 중" : (acceptingAnswer ? "입력 대기" : "대기");
  currentInputEl.textContent = currentInput;
  updateBossMood();
  updateHpBar();
}

function resetJudgeText() {
  judgeTextEl.textContent = "";
  judgeTextEl.className = "";
}

function clearEffects() {
  effectTextEl.textContent = "";
  effectTextEl.className = "effect-text";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function triggerHitFlash() {
  hitFlashEl.classList.remove("active");
  void hitFlashEl.offsetWidth;
  hitFlashEl.classList.add("active");
}

function triggerDamagePop(text = "CRITICAL!") {
  damagePopEl.textContent = text;
  damagePopEl.classList.remove("show");
  void damagePopEl.offsetWidth;
  damagePopEl.classList.add("show");
}

function triggerCenterBurst() {
  centerEffectEl.classList.remove("show");
  void centerEffectEl.offsetWidth;
  centerEffectEl.classList.add("show");
}

function clearBattleClasses() {
  playerDinoEl.classList.remove("attack-right", "hit");
  bossDinoEl.classList.remove("attack-left", "hit");
}

function triggerCorrectAttack() {
  clearBattleClasses();
  void playerDinoEl.offsetWidth;

  playerDinoEl.classList.add("attack-right");
  triggerCenterBurst();
  triggerDamagePop("CRITICAL!");
  triggerHitFlash();

  setTimeout(() => {
    bossDinoEl.classList.add("hit");
  }, 160);

  playSound(dinoRoarSound, 0.72);
}

function triggerWrongAttack() {
  clearBattleClasses();
  void bossDinoEl.offsetWidth;

  bossDinoEl.classList.add("attack-left");
  triggerCenterBurst();
  triggerDamagePop("OUCH!");

  setTimeout(() => {
    playerDinoEl.classList.add("hit");
  }, 160);

  playSound(wrongHitSound, 0.65);
}

function getRandomValueByDigitLevel() {
  if (DIGIT_LEVEL === 1) {
    return Math.floor(Math.random() * 9) + 1;
  }
  if (DIGIT_LEVEL === 2) {
    return Math.floor(Math.random() * 90) + 10;
  }
  return Math.floor(Math.random() * 900) + 100;
}

function randomSignedTerm() {
  const value = getRandomValueByDigitLevel();
  const sign = Math.random() > 0.5 ? 1 : -1;
  return value * sign;
}

function getAnswerLimit() {
  // 현재 BLE 디코딩은 0~99 제출 기준
  return 99;
}

function generateSequence() {
  let seq = [];
  let sum = 0;
  const limit = getAnswerLimit();

  while (seq.length < TERMS_PER_QUESTION) {
    const term = randomSignedTerm();
    const nextSum = sum + term;

    if (nextSum >= 0 && nextSum <= limit) {
      seq.push(term);
      sum = nextSum;
    }
  }

  return { seq, sum };
}

async function presentSequence(sequence) {
  presenting = true;
  acceptingAnswer = false;
  updateHud();

  historyEl.textContent = "";
  currentTermEl.textContent = "3";
  currentTermEl.className = "";
  phaseTextEl.textContent = "준비";
  await sleep(700);

  currentTermEl.textContent = "2";
  await sleep(700);

  currentTermEl.textContent = "1";
  await sleep(700);

  let shown = [];

  for (let i = 0; i < sequence.length; i++) {
    const value = sequence[i];
    const text = value > 0 ? `+${value}` : `${value}`;

    currentTermEl.textContent = text;
    currentTermEl.className = value > 0 ? "positive" : "negative";

    shown.push(text);
    historyEl.textContent = shown.join("   ");

    phaseTextEl.textContent = `${i + 1} / ${sequence.length} 제시 중`;
    await sleep(SHOW_MS);

    currentTermEl.textContent = "";
    await sleep(200);
  }

  currentTermEl.className = "";
  currentTermEl.textContent = "?";
  phaseTextEl.textContent = "정답을 주판으로 입력하고 OK를 누르세요";
  presenting = false;
  acceptingAnswer = true;
  updateHud();
}

async function startGame() {
  readOptions();

  gameStarted = true;
  currentProblem = 0;
  bossHp = TOTAL_QUESTIONS;
  currentInput = 0;
  correctCount = 0;
  wrongCount = 0;

  resultCardEl.classList.add("hidden");

  updateHud();
  resetJudgeText();
  clearEffects();

  clearBattleClasses();
  playerDinoEl.classList.remove("dead");
  bossDinoEl.classList.remove("dead");

  playerDinoEl.style.opacity = "1";
  bossDinoEl.style.opacity = "1";

  statusEl.textContent = "게임 시작";
  await nextProblem();

  document.querySelector('.play-stage')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function nextProblem() {
  if (!gameStarted) return;

  if (currentProblem >= TOTAL_QUESTIONS) {
    phaseTextEl.textContent = "모든 문제 완료!";
    currentTermEl.textContent = "CLEAR";
    historyEl.textContent = "";
    showSummary(true);
    return;
  }

  currentProblem += 1;
  currentInput = 0;
  updateHud();
  resetJudgeText();
  clearEffects();

  const generated = generateSequence();
  currentSequence = generated.seq;
  currentAnswer = generated.sum;

  await presentSequence(currentSequence);
}

async function checkAnswer() {
  if (!acceptingAnswer) return;

  acceptingAnswer = false;
  updateHud();

  if (currentInput === currentAnswer) {
    correctCount += 1;

    judgeTextEl.textContent = "정답!";
    judgeTextEl.className = "judge-ok";

    effectTextEl.textContent = "플레이어 공격!";
    effectTextEl.className = "effect-text effect-hit";

    triggerCorrectAttack();

    bossHp -= 1;
    updateHud();

    currentTermEl.textContent = "정답!";
    historyEl.textContent = "";
    phaseTextEl.textContent = `${currentProblem}번 문제 성공`;

    await sleep(900);

    if (bossHp <= 0) {
      effectTextEl.textContent = "보스 격파!";
      effectTextEl.className = "effect-text effect-clear";
      bossDinoEl.classList.remove("hit");
      bossDinoEl.classList.add("dead");
      currentTermEl.textContent = "WIN";
      phaseTextEl.textContent = `${TOTAL_QUESTIONS}문제를 모두 해결했습니다!`;
      historyEl.textContent = "";
      playSound(winSound, 0.7);
      showSummary(true);
      return;
    }

    await nextProblem();
  } else {
    wrongCount += 1;

    judgeTextEl.textContent = `오답 (${currentInput})`;
    judgeTextEl.className = "judge-bad";

    effectTextEl.textContent = "보스 반격!";
    effectTextEl.className = "effect-text";

    triggerWrongAttack();

    currentTermEl.textContent = "다시 입력";
    phaseTextEl.textContent = "주판으로 다시 계산해서 OK를 누르세요";

    acceptingAnswer = true;
    updateHud();
  }
}

function showSummary(isWin) {
  gameStarted = false;
  acceptingAnswer = false;
  presenting = false;

  const totalSolved = correctCount + wrongCount;
  const rate = totalSolved > 0 ? Math.round((correctCount / totalSolved) * 100) : 0;

  resultTitleEl.textContent = isWin ? "🎉 게임 클리어!" : "📊 결과 요약";
  summaryTotalEl.textContent = TOTAL_QUESTIONS;
  summaryCorrectEl.textContent = correctCount;
  summaryWrongEl.textContent = wrongCount;
  summaryRateEl.textContent = rate + "%";

  if (isWin) {
    summaryMessageEl.textContent = "플레이어 공룡이 이겼습니다. 아주 잘했습니다!";
  } else {
    summaryMessageEl.textContent = "이번 결과를 확인하고 다시 도전해보세요.";
  }

  resultCardEl.classList.remove("hidden");
  resultCardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function cleanupConnection() {
  try {
    if (characteristic && isListening) {
      try {
        await characteristic.stopNotifications();
      } catch (e) {}
      characteristic.removeEventListener("characteristicvaluechanged", handleBLE);
      isListening = false;
    }
  } catch (e) {}

  try {
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
  } catch (e) {}

  server = null;
  service = null;
  characteristic = null;
}

async function disconnectBLE() {
  await cleanupConnection();
  statusEl.textContent = "연결 해제됨";
}

function onDisconnected() {
  statusEl.textContent = "기기 연결이 끊어졌습니다.";
  server = null;
  service = null;
  characteristic = null;
  isListening = false;
}

async function connectBLE() {
  try {
    statusEl.textContent = "0) 기존 연결 정리 중...";
    await cleanupConnection();

    statusEl.textContent = "1) 기기 선택창 여는 중...";

    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "FLEDU_" }],
      optionalServices: [SERVICE_UUID]
    });

    statusEl.textContent = "2) 선택된 기기: " + (device.name || "이름 없음");

    device.removeEventListener("gattserverdisconnected", onDisconnected);
    device.addEventListener("gattserverdisconnected", onDisconnected);

    statusEl.textContent = "3) GATT 연결 중...";
    server = await device.gatt.connect();

    statusEl.textContent = "4) 서비스 가져오는 중...";
    service = await server.getPrimaryService(SERVICE_UUID);

    statusEl.textContent = "5) 캐릭터리스틱 가져오는 중...";
    characteristic = await service.getCharacteristic(CHAR_UUID);

    statusEl.textContent = "6) Notify 시작 중...";
    await characteristic.startNotifications();

    characteristic.removeEventListener("characteristicvaluechanged", handleBLE);
    characteristic.addEventListener("characteristicvaluechanged", handleBLE);
    isListening = true;

    statusEl.textContent = "연결 성공! 숫자 입력 후 디바이스의 OK 버튼으로 제출하세요.";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "BLE 연결 실패: " + err.name + " / " + err.message;
  }
}

function handleBLE(event) {
  const now = Date.now();
  if (now - lastUpdate < 120) return;
  lastUpdate = now;

  const data = new Uint8Array(event.target.value.buffer);
  const hex = toHexString(data);
  rawBoxEl.textContent = hex;

  const decoded = decodeAbacusPacket(data);
  currentInput = decoded.number;
  updateHud();

  logBoxEl.textContent =
    "패킷 길이: " + data.length + "\n" +
    "십의 자리 코드: " + decoded.tensHex + " → " + decoded.tens + "\n" +
    "일의 자리 코드: " + decoded.onesHex + " → " + decoded.ones + "\n" +
    "해석 숫자: " + decoded.number + "\n" +
    "마지막 바이트: " + decoded.lastByteHex;

  if (acceptingAnswer) {
    checkAnswer();
  }
}

function toHexString(arr) {
  return Array.from(arr)
    .map(v => v.toString(16).padStart(2, "0").toUpperCase())
    .join("-");
}

function mapDigit(byteValue) {
  const map = {
    0x1F: 0,
    0x17: 1,
    0x13: 2,
    0x11: 3,
    0x10: 4,
    0x0F: 5,
    0x07: 6,
    0x03: 7,
    0x01: 8,
    0x00: 9
  };
  return map[byteValue] ?? -1;
}

function decodeAbacusPacket(data) {
  const tensCode = data[7] ?? 0x1F;
  const onesCode = data[8] ?? 0x1F;

  const tens = mapDigit(tensCode);
  const ones = mapDigit(onesCode);
  const number = tens * 10 + ones;

  const lastByte = data[data.length - 1] ?? 0x00;

  return {
    tens,
    ones,
    number,
    tensHex: "0x" + tensCode.toString(16).toUpperCase().padStart(2, "0"),
    onesHex: "0x" + onesCode.toString(16).toUpperCase().padStart(2, "0"),
    lastByteHex: "0x" + lastByte.toString(16).toUpperCase().padStart(2, "0")
  };
}

readOptions();
updateHud();
