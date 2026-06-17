// ==================== 配置缓存 ====================
const STORAGE_KEY = 'steal-game-config';
const CONFIG_IDS = [
  'cfg-white','cfg-alert-white','cfg-green','cfg-alert-green',
  'cfg-blue','cfg-alert-blue','cfg-purple','cfg-alert-purple',
  'cfg-orange','cfg-alert-orange','cfg-unknown','cfg-alert-unknown',
  'cfg-steal-rate','cfg-boost','cfg-env-param',
  'cfg-decay-rate','cfg-alert-rate','cfg-alert-max','cfg-alert-decay',
  'cfg-fov','cfg-view-dist','cfg-look-speed'
];

// 默认配置值
const CONFIG_DEFAULTS = {
  'cfg-white': 40, 'cfg-alert-white': 1,
  'cfg-green': 50, 'cfg-alert-green': 1.1,
  'cfg-blue': 65, 'cfg-alert-blue': 1.25,
  'cfg-purple': 85, 'cfg-alert-purple': 1.45,
  'cfg-orange': 120, 'cfg-alert-orange': 1.7,
  'cfg-unknown': 60, 'cfg-alert-unknown': 1.2,
  'cfg-steal-rate': 10, 'cfg-boost': 1, 'cfg-env-param': 1,
  'cfg-decay-rate': 3, 'cfg-alert-rate': 10,
  'cfg-alert-max': 100, 'cfg-alert-decay': 15,
  'cfg-fov': 90, 'cfg-view-dist': 200, 'cfg-look-speed': 1.2
};

// 从 localStorage 加载配置
function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    CONFIG_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && saved[id] !== undefined) el.value = saved[id];
    });
  } catch (e) { /* 解析失败则使用默认值 */ }
}

// 保存配置到 localStorage
function saveConfig() {
  const data = {};
  CONFIG_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) data[id] = el.value;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 绑定所有配置输入的 change 事件，实时保存
function bindConfigInputs() {
  CONFIG_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveConfig);
  });
}

// ==================== 配置读取 ====================
const CFG = {
  get stealReqs() { return {
    white: +document.getElementById('cfg-white').value,
    green: +document.getElementById('cfg-green').value,
    blue: +document.getElementById('cfg-blue').value,
    purple: +document.getElementById('cfg-purple').value,
    orange: +document.getElementById('cfg-orange').value,
    unknown: +document.getElementById('cfg-unknown').value,
  }},
  get alertMults() { return {
    white: +document.getElementById('cfg-alert-white').value,
    green: +document.getElementById('cfg-alert-green').value,
    blue: +document.getElementById('cfg-alert-blue').value,
    purple: +document.getElementById('cfg-alert-purple').value,
    orange: +document.getElementById('cfg-alert-orange').value,
    unknown: +document.getElementById('cfg-alert-unknown').value,
  }},
  get stealRate() { return +document.getElementById('cfg-steal-rate').value; },
  get boostMult() { return +document.getElementById('cfg-boost').value; },
  get envParam() { return +document.getElementById('cfg-env-param').value; },
  get alertRate() { return +document.getElementById('cfg-alert-rate').value; },
  get alertMax() { return +document.getElementById('cfg-alert-max').value; },
  get decayRate() { return +document.getElementById('cfg-decay-rate').value; },
  get alertDecay() { return +document.getElementById('cfg-alert-decay').value; },
  get fov() { return (+document.getElementById('cfg-fov').value) * Math.PI / 180; },
  get viewDist() { return +document.getElementById('cfg-view-dist').value; },
  get lookSpeed() { return +document.getElementById('cfg-look-speed').value; },
};

const QUALITY_COLORS = {
  white: '#ccc', green: '#4caf50', blue: '#2196f3', purple: '#9c27b0', orange: '#ff9800', unknown: '#8d8d8d'
};
const QUALITY_NAMES = {
  white: '白色', green: '绿色', blue: '蓝色', purple: '紫色', orange: '橙色', unknown: '未知'
};
const QUALITY_CSS = {
  white: 'quality-white', green: 'quality-green', blue: 'quality-blue',
  purple: 'quality-purple', orange: 'quality-orange', unknown: 'quality-unknown'
};

// ==================== 游戏状态 ====================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let W, H;
function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  W = canvas.width = rect.width;
  H = canvas.height = rect.height;
}
window.addEventListener('resize', resize);
resize();

// NPC道具生成
function generateItems() {
  const qualities = ['white','green','blue','purple','orange','unknown'];
  const items = [];
  const count = 4 + Math.floor(Math.random() * 4); // 4~7个道具
  for (let i = 0; i < count; i++) {
    items.push({ quality: qualities[Math.floor(Math.random() * qualities.length)] });
  }
  return items;
}

let npc, player, stealProgress, alertLevel, selectedIndex, gameState, items, inventory;
let stealTimer = 0;        // 偷窃计时（秒）
let timerRunning = false;   // 计时器是否运行
let timerFinalClass = '';   // 计时器最终样式
let modalVisible = false;   // 弹窗是否显示

function initGame() {
  npc = { x: W * 0.5, y: H * 0.4, facing: 0, lookDir: 1, lookAngle: 0 };
  player = { x: W * 0.5, y: H * 0.75, speed: 180 };
  stealProgress = 0;
  alertLevel = 0;
  selectedIndex = 0;
  gameState = 'sneaking'; // sneaking, stealing, success, failed
  items = generateItems();
  inventory = [];
  stealTimer = 0;
  timerRunning = false;
  timerFinalClass = '';
  hideModal();
  updateTimerUI();
  updateItemListUI();
  updateInventoryUI();
  updateStatusUI();
}

// ==================== 输入 ====================
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// ==================== UI更新 ====================
function updateItemListUI() {
  const el = document.getElementById('item-list');
  el.innerHTML = '';
  items.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'item-entry' + (i === selectedIndex ? ' selected' : '');
    div.innerHTML = `<span><span class="item-dot" style="background:${QUALITY_COLORS[item.quality]}"></span>
      <span class="${QUALITY_CSS[item.quality]}">${QUALITY_NAMES[item.quality]}品质</span></span>
      <span>道具 #${i + 1}</span>`;
    el.appendChild(div);
  });
}

function updateInventoryUI() {
  const el = document.getElementById('inventory');
  if (inventory.length === 0) { el.innerHTML = '空空如也'; return; }
  el.innerHTML = inventory.map((q, i) =>
    `<div class="inv-item"><span class="item-dot" style="background:${QUALITY_COLORS[q]}"></span>
     <span class="${QUALITY_CSS[q]}">${QUALITY_NAMES[q]}品质道具</span></div>`
  ).join('');
}

function updateStatusUI() {
  const stateMap = { sneaking: '潜行中', stealing: '偷窃中...', success: '偷窃成功！', failed: '被发现了！' };
  document.getElementById('state-text').textContent = stateMap[gameState] || gameState;
  const target = items[selectedIndex];
  document.getElementById('target-text').innerHTML = target
    ? `道具 #${selectedIndex + 1} (<span class="${QUALITY_CSS[target.quality]}">${QUALITY_NAMES[target.quality]}品质</span>)`
    : '无';
}

function showModal(text, type) {
  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');
  const timeVal = document.getElementById('modal-time-val');
  title.textContent = text;
  title.className = 'modal-title ' + type;
  timeVal.textContent = stealTimer.toFixed(1) + '秒';
  overlay.classList.add('show');
  modalVisible = true;
}

function hideModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  modalVisible = false;
}

let toastTimer = null;
function showToast(text, duration = 1500) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

function updateBars() {
  const req = items[selectedIndex] ? CFG.stealReqs[items[selectedIndex].quality] : 100;
  const pct = Math.min(100, (stealProgress / req) * 100);
  document.getElementById('steal-bar').style.width = pct + '%';
  document.getElementById('steal-pct').textContent = Math.floor(pct) + '%';

  const aPct = Math.min(100, (alertLevel / CFG.alertMax) * 100);
  document.getElementById('alert-bar').style.width = aPct + '%';
  document.getElementById('alert-pct').textContent = Math.floor(aPct) + '%';
}

// ==================== 游戏逻辑 ====================
let lastTime = performance.now();

function update(dt) {
  if (gameState === 'success' || gameState === 'failed') {
    return; // 弹窗显示时游戏暂停，等待玩家点击重新开始
  }

  // 玩家移动
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (dx || dy) {
    const len = Math.sqrt(dx * dx + dy * dy);
    player.x += (dx / len) * player.speed * dt;
    player.y += (dy / len) * player.speed * dt;
    player.x = Math.max(20, Math.min(W - 20, player.x));
    player.y = Math.max(20, Math.min(H - 20, player.y));
  }

  const isPressingQ = keys['q'];
  const isPressingE = keys['e'];
  const isPressingF = keys['f'];
  const isActionHeld = isPressingQ || isPressingE || isPressingF;

  // Q/E切换目标（长按触发重复切换）
  if (isPressingQ) { handleSwitch(-1, dt); }
  if (isPressingE) { handleSwitch(1, dt); }

  // 偷窃逻辑：F长按时增加进度
  if (isPressingF && items.length > 0) {
    gameState = 'stealing';
    timerRunning = true; // 按F时启动计时
    const rate = CFG.stealRate * CFG.boostMult;
    stealProgress += rate * dt;
    const req = CFG.stealReqs[items[selectedIndex].quality];
    if (stealProgress >= req) {
      // 偷窃成功
      inventory.push(items[selectedIndex].quality);
      items.splice(selectedIndex, 1);
      if (selectedIndex >= items.length) selectedIndex = Math.max(0, items.length - 1);
      stealProgress = 0;
      alertLevel = 0;
      timerRunning = false;
      timerFinalClass = 'final-success';
      if (items.length === 0) {
        gameState = 'success';
        showModal('全部偷窃完成！', 'success');
      } else {
        gameState = 'success';
        showModal('偷窃成功！', 'success');
      }
      updateItemListUI();
      updateInventoryUI();
      updateStatusUI();
      updateTimerUI();
      return;
    }
  } else {
    // 松手时进度衰减
    if (stealProgress > 0) {
      stealProgress = Math.max(0, stealProgress - CFG.decayRate * dt);
    }
    gameState = 'sneaking';
  }

  // 警觉度系统（受品质警戒倍率和环境参数影响）
  if (isActionHeld) {
    const qualityMult = CFG.alertMults[items[selectedIndex] ? items[selectedIndex].quality : 'white'];
    alertLevel += CFG.alertRate * CFG.envParam * qualityMult * dt;
    if (alertLevel >= CFG.alertMax) {
      alertLevel = CFG.alertMax;
      gameState = 'failed';
      timerRunning = false;
      timerFinalClass = 'final-fail';
      showModal('被发现了！偷窃失败！', 'fail');
      updateStatusUI();
      updateTimerUI();
      return;
    }
  } else {
    alertLevel = Math.max(0, alertLevel - CFG.alertDecay * dt);
  }

  // NPC视野检测
  updateNPCVision(dt);

  // 检查NPC是否看到玩家正在偷窃
  if (isInViewCone() && isPressingF) {
    gameState = 'failed';
    timerRunning = false;
    timerFinalClass = 'final-fail';
    showModal('被NPC看到了！偷窃失败！', 'fail');
    updateStatusUI();
    updateTimerUI();
    return;
  }

  updateStatusUI();
  updateBars();
}

let switchCooldown = 0;
function handleSwitch(dir, dt) {
  switchCooldown -= dt;
  if (switchCooldown <= 0) {
    selectedIndex = (selectedIndex + dir + items.length) % items.length;
    stealProgress = 0; // 切换目标清零进度
    stealTimer = 0;    // 切换目标重置计时
    timerRunning = false;
    timerFinalClass = '';
    updateTimerUI();
    updateItemListUI();
    switchCooldown = 0.3; // 切换冷却
  }
}

function updateNPCVision(dt) {
  // NPC左右摆动视角
  npc.lookAngle += npc.lookDir * CFG.lookSpeed * dt;
  const maxSwing = Math.PI / 3; // 左右摆动幅度
  if (npc.lookAngle > maxSwing) { npc.lookAngle = maxSwing; npc.lookDir = -1; }
  if (npc.lookAngle < -maxSwing) { npc.lookAngle = -maxSwing; npc.lookDir = 1; }

  // NPC面朝下方（朝向玩家初始位置）
  npc.facing = Math.PI / 2 + npc.lookAngle;
}

function isInViewCone() {
  const dx = player.x - npc.x;
  const dy = player.y - npc.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > CFG.viewDist) return false;

  const angle = Math.atan2(dy, dx);
  let diff = angle - npc.facing;
  // 归一化到 -PI ~ PI
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  return Math.abs(diff) < CFG.fov / 2;
}

// ==================== 渲染 ====================
function render() {
  ctx.clearRect(0, 0, W, H);

  // 背景网格
  ctx.strokeStyle = '#1a2744';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // NPC视野锥
  drawVisionCone();

  // NPC
  ctx.save();
  ctx.translate(npc.x, npc.y);
  // NPC身体
  ctx.fillStyle = '#e94560';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NPC', 0, 5);
  // 朝向指示
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(npc.facing) * 30, Math.sin(npc.facing) * 30);
  ctx.stroke();
  ctx.restore();

  // 道具数量指示（NPC头顶）
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`道具: ${items.length}个`, npc.x, npc.y - 35);

  // 玩家
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = '#00b4d8';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('玩家', 0, 5);
  ctx.restore();

  // 偷窃连接线
  if (keys['f'] && gameState !== 'failed' && gameState !== 'success') {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(0,180,216,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(npc.x, npc.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 在视野中的警告
  if (isInViewCone()) {
    ctx.fillStyle = 'rgba(244,67,54,0.15)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f44336';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ 在视野内!', player.x, player.y - 30);
  }
}

function drawVisionCone() {
  const halfFov = CFG.fov / 2;
  const dist = CFG.viewDist;

  ctx.save();
  ctx.translate(npc.x, npc.y);

  // 视野扇形
  ctx.fillStyle = 'rgba(233,69,96,0.1)';
  ctx.strokeStyle = 'rgba(233,69,96,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, dist, npc.facing - halfFov, npc.facing + halfFov);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// ==================== 计时器UI ====================
function updateTimerUI() {
  const el = document.getElementById('timer-display');
  if (!timerRunning && stealTimer === 0 && timerFinalClass === '') {
    el.textContent = '等待开始...';
    el.className = 'timer-value waiting';
  } else {
    el.textContent = stealTimer.toFixed(1) + '秒';
    el.className = 'timer-value' + (timerFinalClass ? ' ' + timerFinalClass : '');
  }
}

// ==================== 主循环 ====================
function gameLoop(time) {
  const dt = Math.min(0.1, (time - lastTime) / 1000);
  lastTime = time;
  update(dt);
  // 计时器递增
  if (timerRunning) {
    stealTimer += dt;
    updateTimerUI();
  }
  render();
  updateBars();
  requestAnimationFrame(gameLoop);
}

// ==================== 初始化 ====================
// 先加载缓存配置，再绑定事件，再启动游戏
loadConfig();
bindConfigInputs();

document.getElementById('btn-reset').addEventListener('click', initGame);
document.getElementById('modal-btn-restart').addEventListener('click', initGame);

// 还原默认配置
document.getElementById('btn-reset-config').addEventListener('click', () => {
  CONFIG_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && CONFIG_DEFAULTS[id] !== undefined) el.value = CONFIG_DEFAULTS[id];
  });
  localStorage.removeItem(STORAGE_KEY);
  showToast('已还原默认配置');
});

initGame();
requestAnimationFrame(gameLoop);
