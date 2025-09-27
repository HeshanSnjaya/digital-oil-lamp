// 10-wick state
let wickStates = {};
for (let i = 1; i <= 10; i++) wickStates[i] = false;

let isAutoLighting = false;
let isCalibrating = false;
let currentSelectedWick = 1;
let controlsVisible = false;

// Default positions
const defaultPositions = {
  1: { x: 39, y: 20 }, 2: { x: 55, y: 20 }, 3: { x: 35, y: 32 }, 4: { x: 59, y: 32 }, 5: { x: 32, y: 46 },
  6: { x: 62, y: 46 }, 7: { x: 31, y: 62 }, 8: { x: 63, y: 62 }, 9: { x: 39, y: 64 }, 10: { x: 55, y: 64 }
};
const defaultOffsets = { x: 19, y: 19 };

document.addEventListener('DOMContentLoaded', () => {
  initializeWicks();
  setupTouchHandling();
  loadSavedStates();
  preloadAudio();
  updateProgressDisplay();
  updateCeremonyStatus();
  loadSavedPositions();

  const img = document.getElementById('mainLamp');
  if (img && !img.complete) {
    img.addEventListener('load', applyPercentagePositionsOnce);
  } else {
    applyPercentagePositionsOnce();
  }

  // Hamburger menu toggle
  document.getElementById('hamburgerBtn')?.addEventListener('click', toggleControlPanel);

  // Main controls
  document.getElementById('resetBtn')?.addEventListener('click', resetAllWicks);
  document.getElementById('autoLightBtn')?.addEventListener('click', autoLightRemaining);
  document.getElementById('calibrateBtn')?.addEventListener('click', openCalibration);

  // Calibration controls
  document.getElementById('calibrationClose')?.addEventListener('click', closeCalibration);
  document.getElementById('calibrationOverlay')?.addEventListener('click', closeCalibration);
  document.getElementById('savePositions')?.addEventListener('click', saveAndCloseCalibration);
  document.getElementById('resetCurrentWick')?.addEventListener('click', resetCurrentWickPosition);
  document.getElementById('resetAllPositions')?.addEventListener('click', resetAllPositions);

  // Wick selector buttons
  document.querySelectorAll('.wick-select-btn').forEach(btn => {
    btn.addEventListener('click', () => selectWick(parseInt(btn.dataset.wick)));
  });

  // Sliders
  document.getElementById('xSlider')?.addEventListener('input', updateWickPosition);
  document.getElementById('ySlider')?.addEventListener('input', updateWickPosition);
  document.getElementById('xOffsetSlider')?.addEventListener('input', updateGlobalOffset);
  document.getElementById('yOffsetSlider')?.addEventListener('input', updateGlobalOffset);

  // Close control panel when clicking outside
  document.addEventListener('click', (e) => {
    const controlsContainer = document.querySelector('.collapsible-controls');
    if (controlsVisible && !controlsContainer.contains(e.target)) {
      hideControlPanel();
    }
  });
});

// ===== HAMBURGER MENU CONTROLS =====
function toggleControlPanel() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const controlPanel = document.getElementById('controlPanel');
  
  controlsVisible = !controlsVisible;
  
  if (controlsVisible) {
    showControlPanel();
  } else {
    hideControlPanel();
  }
  
  // Toggle hamburger animation
  hamburgerBtn.classList.toggle('active', controlsVisible);
}

function showControlPanel() {
  const controlPanel = document.getElementById('controlPanel');
  controlPanel.classList.add('show');
  controlsVisible = true;
}

function hideControlPanel() {
  const controlPanel = document.getElementById('controlPanel');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  
  controlPanel.classList.remove('show');
  hamburgerBtn.classList.remove('active');
  controlsVisible = false;
}

function initializeWicks(){
  document.querySelectorAll('.wick-point').forEach(w => {
    w.addEventListener('touchstart', onTouchStart, {passive:false});
    w.addEventListener('touchend', onTouchEnd, {passive:false});
    w.addEventListener('click', onClickWick);
    w.addEventListener('contextmenu', e => e.preventDefault());
  });
}

function onTouchStart(e){ e.preventDefault(); e.currentTarget.style.transform = 'translate(-50%, -50%) scale(0.9)'; }
function onTouchEnd(e){
  e.preventDefault();
  const el = e.currentTarget;
  const id = parseInt(el.dataset.wick);
  setTimeout(()=>{ el.style.transform = 'translate(-50%, -50%)'; }, 120);
  if (!isCalibrating) toggleWick(id);
}
function onClickWick(e){
  if ('ontouchstart' in window) return;
  const el = e.currentTarget;
  el.style.transform = 'translate(-50%, -50%) scale(0.9)'; setTimeout(()=>{ el.style.transform = 'translate(-50%, -50%)'; }, 80);
  if (!isCalibrating) toggleWick(parseInt(el.dataset.wick));
}

function toggleWick(id){
  const wickEl = document.querySelector(`.wick-point[data-wick="${id}"]`);
  if (!wickEl) return;

  const isLit = wickStates[id];
  if (!isLit){
    wickStates[id] = true;
    wickEl.classList.add('lit');
    animateWickLighting(wickEl);
    incrementBackgroundGlow();
    playBellSound();
  } else {
    wickStates[id] = false;
    wickEl.classList.remove('lit');
    decrementBackgroundGlow();
  }

  updateProgressDisplay();
  updateCeremonyStatus();
  saveStates();
}

function animateWickLighting(el){
  el.style.animation='none'; el.offsetHeight; el.style.animation='wickLighting 900ms ease-out';
  setTimeout(()=>{ el.style.animation=''; }, 920);
}
(() => {
  const style = document.createElement('style');
  style.textContent = `
  @keyframes wickLighting { 0%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.12)} 100%{transform:translate(-50%,-50%) scale(1)} }
  `;
  document.head.appendChild(style);
})();

function updateProgressDisplay(){
  const lit = Object.values(wickStates).filter(Boolean).length;
  const el = document.getElementById('progress-count'); if (el) el.textContent = lit;
}

function updateCeremonyStatus(){
  const container = document.querySelector('.main-lamp-container');
  const lit = Object.values(wickStates).filter(Boolean).length;
  if (lit > 0) container.classList.add('ceremony-active'); else container.classList.remove('ceremony-active');

  if (lit === 10){
    container.style.animation = 'ceremonyLighting 1800ms ease-in-out';
    setTimeout(()=>{ container.style.animation=''; }, 1850);
  }
}

function setGlowByLitCount(){
  const lit = Object.values(wickStates).filter(Boolean).length;
  const ratio = lit / 10;
  document.documentElement.style.setProperty('--glow-mult', String(ratio));
}
function incrementBackgroundGlow(){ setGlowByLitCount(); }
function decrementBackgroundGlow(){ setGlowByLitCount(); }

async function autoLightRemaining(){
  if (isAutoLighting) return;
  isAutoLighting = true;
  hideControlPanel(); // Hide controls during auto-lighting

  const order = [];
  for (let i = 1; i <= 10; i++){
    if (!wickStates[i]) order.push(i);
  }
  const delayMs = 550;

  for (let i = 0; i < order.length; i++){
    const id = order[i];
    const wickEl = document.querySelector(`.wick-point[data-wick="${id}"]`);
    if (!wickEl) continue;
    if (!wickStates[id]){
      wickStates[id] = true;
      wickEl.classList.add('lit');
      animateWickLighting(wickEl);
      incrementBackgroundGlow();
      playBellSound();
      updateProgressDisplay();
      updateCeremonyStatus();
      saveStates();
      await sleep(delayMs);
    }
  }

  isAutoLighting = false;
}
function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }

function preloadAudio(){ const a = document.getElementById('bell-sound'); if (a) a.load(); }
function playBellSound(){
  const a = document.getElementById('bell-sound'); if (!a) return;
  a.currentTime = 0; a.volume = .6; a.play().catch(()=>{});
}

function saveStates(){
  localStorage.setItem('wickStates', JSON.stringify(wickStates));
}
function loadSavedStates(){
  const s = localStorage.getItem('wickStates');
  if (s){
    wickStates = JSON.parse(s);
    Object.keys(wickStates).forEach(key => {
      const id = parseInt(key);
      if (wickStates[id]){
        const el = document.querySelector(`.wick-point[data-wick="${id}"]`);
        el?.classList.add('lit');
      }
    });
    setGlowByLitCount();
  }
}

function setupTouchHandling(){
  let lastTouchEnd=0;
  document.addEventListener('touchend', e => {
    const now=Date.now();
    if (now-lastTouchEnd<=300) e.preventDefault();
    lastTouchEnd=now;
  }, false);
  document.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
  document.addEventListener('gesturestart', e => e.preventDefault());
}

document.addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '9') toggleWick(parseInt(e.key,10));
  if (e.key === '0') toggleWick(10);
  else if (e.key.toLowerCase()==='r') resetAllWicks();
  else if (e.key.toLowerCase()==='a') autoLightRemaining();
  else if (e.key.toLowerCase()==='c') openCalibration();
  else if (e.key.toLowerCase()==='m') toggleControlPanel();
});
document.addEventListener('keydown', e => {
  if (e.key === 'F11'){
    e.preventDefault();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }
});

function resetAllWicks(){
  document.querySelectorAll('.wick-point').forEach(w => w.classList.remove('lit'));
  for (let i = 1; i <= 10; i++) wickStates[i] = false;
  updateProgressDisplay();
  updateCeremonyStatus();
  setGlowByLitCount();
  saveStates();
  hideControlPanel();
}

function applyPercentagePositionsOnce(){}

// ===== CALIBRATION SYSTEM =====
function openCalibration(){
  isCalibrating = true;
  hideControlPanel();
  document.getElementById('calibrationModal').classList.add('active');
  selectWick(1);
  updateSliderValues();
}

function closeCalibration(){
  isCalibrating = false;
  document.getElementById('calibrationModal').classList.remove('active');
  document.querySelectorAll('.wick-point').forEach(w => w.classList.remove('calibration-highlight'));
}

function saveAndCloseCalibration(){
  savePositions();
  closeCalibration();
}

function selectWick(wickNum){
  currentSelectedWick = wickNum;
  
  document.querySelectorAll('.wick-select-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.wick) === wickNum);
  });
  
  document.querySelectorAll('.wick-point').forEach(w => w.classList.remove('calibration-highlight'));
  document.querySelector(`.wick-point[data-wick="${wickNum}"]`)?.classList.add('calibration-highlight');
  
  updateSliderValues();
}

function updateSliderValues(){
  const positions = getSavedPositions();
  const offsets = getSavedOffsets();
  
  const xSlider = document.getElementById('xSlider');
  const ySlider = document.getElementById('ySlider');
  const xOffsetSlider = document.getElementById('xOffsetSlider');
  const yOffsetSlider = document.getElementById('yOffsetSlider');
  
  if (positions[currentSelectedWick]) {
    xSlider.value = positions[currentSelectedWick].x;
    ySlider.value = positions[currentSelectedWick].y;
  }
  
  xOffsetSlider.value = offsets.x;
  yOffsetSlider.value = offsets.y;
  
  updateSliderDisplays();
}

function updateSliderDisplays(){
  document.getElementById('xValue').textContent = document.getElementById('xSlider').value + '%';
  document.getElementById('yValue').textContent = document.getElementById('ySlider').value + '%';
  document.getElementById('xOffsetValue').textContent = document.getElementById('xOffsetSlider').value + 'px';
  document.getElementById('yOffsetValue').textContent = document.getElementById('yOffsetSlider').value + 'px';
}

function updateWickPosition(){
  const xSlider = document.getElementById('xSlider');
  const ySlider = document.getElementById('ySlider');
  
  const x = parseFloat(xSlider.value);
  const y = parseFloat(ySlider.value);
  
  document.documentElement.style.setProperty(`--wick-${currentSelectedWick}-x`, `${x}%`);
  document.documentElement.style.setProperty(`--wick-${currentSelectedWick}-y`, `${y}%`);
  
  updateSliderDisplays();
}

function updateGlobalOffset(){
  const xOffsetSlider = document.getElementById('xOffsetSlider');
  const yOffsetSlider = document.getElementById('yOffsetSlider');
  
  const x = parseInt(xOffsetSlider.value);
  const y = parseInt(yOffsetSlider.value);
  
  document.documentElement.style.setProperty('--wick-offset-x', `${x}px`);
  document.documentElement.style.setProperty('--wick-offset-y', `${y}px`);
  
  updateSliderDisplays();
}

function resetCurrentWickPosition(){
  const defaultPos = defaultPositions[currentSelectedWick];
  if (defaultPos) {
    document.documentElement.style.setProperty(`--wick-${currentSelectedWick}-x`, `${defaultPos.x}%`);
    document.documentElement.style.setProperty(`--wick-${currentSelectedWick}-y`, `${defaultPos.y}%`);
    updateSliderValues();
  }
}

function resetAllPositions(){
  Object.entries(defaultPositions).forEach(([id, pos]) => {
    document.documentElement.style.setProperty(`--wick-${id}-x`, `${pos.x}%`);
    document.documentElement.style.setProperty(`--wick-${id}-y`, `${pos.y}%`);
  });
  
  document.documentElement.style.setProperty('--wick-offset-x', `${defaultOffsets.x}px`);
  document.documentElement.style.setProperty('--wick-offset-y', `${defaultOffsets.y}px`);
  
  updateSliderValues();
}

function getSavedPositions(){
  const positions = {};
  for (let i = 1; i <= 10; i++) {
    const cs = getComputedStyle(document.documentElement);
    const x = parseFloat(cs.getPropertyValue(`--wick-${i}-x`)) || defaultPositions[i].x;
    const y = parseFloat(cs.getPropertyValue(`--wick-${i}-y`)) || defaultPositions[i].y;
    positions[i] = { x, y };
  }
  return positions;
}

function getSavedOffsets(){
  const cs = getComputedStyle(document.documentElement);
  const x = parseInt(cs.getPropertyValue('--wick-offset-x')) || defaultOffsets.x;
  const y = parseInt(cs.getPropertyValue('--wick-offset-y')) || defaultOffsets.y;
  return { x, y };
}

function savePositions(){
  const positions = getSavedPositions();
  const offsets = getSavedOffsets();
  
  localStorage.setItem('wickPositions', JSON.stringify(positions));
  localStorage.setItem('wickOffsets', JSON.stringify(offsets));
}

function loadSavedPositions(){
  const savedPositions = localStorage.getItem('wickPositions');
  const savedOffsets = localStorage.getItem('wickOffsets');
  
  if (savedPositions) {
    const positions = JSON.parse(savedPositions);
    Object.entries(positions).forEach(([id, pos]) => {
      document.documentElement.style.setProperty(`--wick-${id}-x`, `${pos.x}%`);
      document.documentElement.style.setProperty(`--wick-${id}-y`, `${pos.y}%`);
    });
  }
  
  if (savedOffsets) {
    const offsets = JSON.parse(savedOffsets);
    document.documentElement.style.setProperty('--wick-offset-x', `${offsets.x}px`);
    document.documentElement.style.setProperty('--wick-offset-y', `${offsets.y}px`);
  }
}
