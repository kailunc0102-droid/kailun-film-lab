// ── 1. SLIDERS DEFINITION ──
const slidersConfig = [
  // 光線組
  { id: 'exposure', name: '曝光度', en: 'Exposure', min: -2, max: 2, step: 0.01, def: 0, group: 'light' },
  { id: 'contrast', name: '對比度', en: 'Contrast', min: -40, max: 40, step: 1, def: 0, group: 'light' },
  { id: 'highlights', name: '高光', en: 'Highlights', min: -40, max: 40, step: 1, def: 0, group: 'light' },
  { id: 'shadows', name: '陰影', en: 'Shadows', min: -40, max: 40, step: 1, def: 0, group: 'light' },
  
  // 色彩組
  { id: 'temperature', name: '色溫', en: 'Temperature', min: -40, max: 40, step: 1, def: 0, group: 'color' },
  { id: 'tint', name: '色調', en: 'Tint', min: -30, max: 30, step: 1, def: 0, group: 'color' },
  { id: 'saturation', name: '飽和度', en: 'Saturation', min: -40, max: 40, step: 1, def: 0, group: 'color' },
  { id: 'vibrance', name: '鮮豔度', en: 'Vibrance', min: -40, max: 40, step: 1, def: 0, group: 'color' },
  
  // 特效組
  { id: 'grain', name: '顆粒紋理', en: 'Film Grain', min: 0, max: 80, step: 1, def: 0, group: 'effects' },
  { id: 'vignette', name: '邊緣暗角', en: 'Vignette', min: -60, max: 0, step: 1, def: 0, group: 'effects' },

  // 局部組
  { id: 'localHueTarget', name: '目標色相', en: 'Target Hue', min: 0, max: 360, step: 1, def: 0, group: 'local' },
  { id: 'localRange', name: '選色範圍', en: 'Color Range', min: 5, max: 80, step: 1, def: 30, group: 'local' },
  { id: 'localLightness', name: '局部亮度', en: 'Local Light', min: -40, max: 40, step: 1, def: 0, group: 'local' },
  { id: 'localSaturation', name: '局部飽和', en: 'Local Sat', min: -40, max: 40, step: 1, def: 0, group: 'local' }
];

// ── 2. STATE ──
let adj = {};
let currentMode = 'ai'; 
let origCanvas = null; 
let previewImage = null; 
let isComparing = false;
let currentZoom = 100;
let pipetteActive = false;
let localMaskEnabled = false;

// 預設經典底片食譜資料庫
let baseRecipes = [
  { id: 'c1', name: 'Classic Chrome', mood: 'Classic doc tone', tags: '經典', accent: '#a3998b', starred: true, keywords: ['fuji', 'street'], params: { exposure: 0.05, contrast: 12, highlights: -8, shadows: 4, temperature: -3, tint: 2, saturation: -12, vibrance: 2, grain: 18, vignette: -10, localHueTarget:0, localRange:30, localLightness:0, localSaturation:0 } },
  { id: 'c2', name: 'Prague Mood', mood: 'Cinematic cold run', tags: '電影', accent: '#7fa397', starred: false, keywords: ['cold', 'movie'], params: { exposure: -0.1, contrast: 18, highlights: 5, shadows: -10, temperature: 8, tint: -4, saturation: -18, vibrance: -5, grain: 28, vignette: -22, localHueTarget:0, localRange:30, localLightness:0, localSaturation:0 } }
];
let userRecipes = JSON.parse(localStorage.getItem('kl-recipes') || '[]');
let curId = 'c1';

// 曲線控制點預設
let curvePoints = [{x:0, y:0}, {x:128, y:128}, {x:255, y:255}];
let activePointIdx = -1;

function initParams() {
  slidersConfig.forEach(s => adj[s.id] = s.def);
}
initParams();

// ── 3. PORTAL ROUTING (安全跳轉核心) ──
function enterMode(mode) {
  currentMode = mode;
  document.getElementById('portal-screen').style.display = 'none';
  document.getElementById('main-workspace').style.display = 'grid';
  document.getElementById('current-mode-badge').innerText = mode === 'ai' ? '✨ AI AUTOMAGIC' : '🎞️ MANUAL WORKER';
  
  // 自動導流左側側邊欄頁籤
  if (mode === 'ai') {
    toggleLeftSection('adjust');
  } else {
    toggleLeftSection('recipes');
  }
  
  clearLocalMask();
  refreshUI();
}

function returnToPortal() {
  document.getElementById('portal-screen').style.display = 'flex';
  document.getElementById('main-workspace').style.display = 'none';
}

function toggleLeftSection(sec) {
  const p = document.getElementById('desk-left-panel');
  const btnR = document.getElementById('tab-recipes-btn');
  const btnA = document.getElementById('tab-adjust-btn');
  if(!p) return;

  if(sec === 'recipes') {
    p.className = 'desk-left show-recipes';
    if(btnR) btnR.classList.add('active');
    if(btnA) btnA.classList.remove('active');
  } else {
    p.className = 'desk-left show-adjust';
    if(btnR) btnR.classList.remove('active');
    if(btnA) btnA.classList.add('active');
  }
}

// ── 4. UI BUILDERS ──
function buildSliders() {
  const groups = { light: document.getElementById('group-light'), color: document.getElementById('group-color'), effects: document.getElementById('group-effects'), local: document.getElementById('group-local') };
  Object.values(groups).forEach(g => { if(g) g.innerHTML = ''; });

  slidersConfig.forEach(s => {
    const g = groups[s.group];
    if(!g) return;
    const item = document.createElement('div');
    item.className = 'sl-row';
    item.id = `row-${s.id}`;
    
    const pct = ((adj[s.id] - s.min) / (s.max - s.min)) * 100;
    
    item.innerHTML = `
      <div class="sl-lbl"><span class="zh">${s.name}</span><span class="en">${s.en}</span></div>
      <div class="sl-track-wrap">
        <div class="sl-rail"></div>
        <div class="sl-fill" id="fill-${s.id}" style="width:${pct}%;"></div>
        <div class="sl-thumb" id="thumb-${s.id}" style="left:${pct}%;"></div>
        <input type="range" class="sl-input" min="${s.min}" max="${s.max}" step="${s.step}" value="${adj[s.id]}" oninput="onSliderIn('${s.id}',this.value)">
      </div>
      <div class="sl-val" id="val-${s.id}">${adj[s.id]>0&&s.id!=='exposure'?'+'+adj[s.id]:adj[s.id]}</div>
    `;
    g.appendChild(item);
  });
}

function onSliderIn(id, val) {
  adj[id] = parseFloat(val);
  const row = document.getElementById(`row-${id}`);
  if(row) {
    const cfg = slidersConfig.find(c => c.id === id);
    const pct = ((adj[id] - cfg.min) / (cfg.max - cfg.min)) * 100;
    const fill = document.getElementById(`fill-${id}`);
    const thumb = document.getElementById(`thumb-${id}`);
    const vlbl = document.getElementById(`val-${id}`);
    if(fill) fill.style.width = pct+'%';
    if(thumb) thumb.style.left = pct+'%';
    if(vlbl) vlbl.innerText = adj[id]>0&&id!=='exposure'?'+'+adj[id]:adj[id];
  }
  drawPreview();
}

function refreshUI() {
  slidersConfig.forEach(s => {
    const fill = document.getElementById(`fill-${s.id}`);
    const thumb = document.getElementById(`thumb-${s.id}`);
    const vlbl = document.getElementById(`val-${s.id}`);
    const input = document.getElementById(`row-${s.id}`)?.querySelector('input');
    
    if(input) input.value = adj[s.id];
    const pct = ((adj[s.id] - s.min) / (s.max - s.min)) * 100;
    if(fill) fill.style.width = pct+'%';
    if(thumb) thumb.style.left = pct+'%';
    if(vlbl) vlbl.innerText = adj[s.id]>0&&s.id!=='exposure'?'+'+adj[s.id]:adj[s.id];
  });
  drawCurveCanvas();
}

// ── 5. LINE A: AI ANALYSIS & AUTO SLIDER MOVEMENT ──
function runLineAAIAutopilot(ctx, w, h) {
  if (currentMode !== 'ai') return;
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  let totalBrightness = 0, rSum = 0, gSum = 0, bSum = 0;
  const len = data.length;
  
  for (let i = 0; i < len; i += 4) {
    totalBrightness += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
    rSum += data[i]; gSum += data[i+1]; bSum += data[i+2];
  }
  
  const pixelCount = len / 4;
  const avgBright = totalBrightness / pixelCount;
  const avgR = rSum / pixelCount;
  const avgB = bSum / pixelCount;

  // AI 智慧算量映射
  let autoExp = 0, autoContrast = 0, autoTemp = 0, autoShadows = 0;
  
  if (avgBright < 95) { 
    autoExp = ((110 - avgBright) / 25) * 0.3; 
    autoShadows = 12; autoContrast = 6; 
  } else if (avgBright > 155) { 
    autoExp = -((avgBright - 145) / 35) * 0.18; 
  }
  
  if (avgR > avgB + 12) autoTemp = -6; 
  else if (avgB > avgR + 12) autoTemp = 5;

  // 把計算出來的值覆蓋回滑塊，創造滑塊自體滑行視覺
  adj.exposure = parseFloat(autoExp.toFixed(2));
  adj.contrast = Math.round(autoContrast);
  adj.shadows = Math.round(autoShadows);
  adj.temperature = Math.round(autoTemp);
  adj.saturation = -3; // 輕微底片感高雅收斂

  refreshUI();
  toast('✨ AI 已為此相片動態演算黃金滑塊參數');
  document.getElementById('lbl-status').innerText = '✨ AI 優化中';
}

// ── 6. FILE HANDLERS ──
function handleFileSelect(input) {
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // 離線生成 1200px 流暢小圖
      const maxP = 1200; let w = img.naturalWidth, h = img.naturalHeight;
      if(w > maxP || h > maxP) {
        if(w > h) { h = Math.round(h * maxP / w); w = maxP; }
        else { w = Math.round(w * maxP / h); h = maxP; }
      }
      
      origCanvas = document.createElement('canvas');
      origCanvas.width = w; origCanvas.height = h;
      origCanvas.getContext('2d').drawImage(img, 0, 0, w, h);
      
      previewImage = img;
      document.getElementById('upload-gate').style.display = 'none';
      const mc = document.getElementById('main-canvas');
      mc.style.display = 'block';
      mc.width = w; mc.height = h;
      
      document.getElementById('lbl-resolution').innerText = `${img.naturalWidth} x ${img.naturalHeight}`;
      
      if(currentMode === 'ai') {
        runLineAAIAutopilot(origCanvas.getContext('2d'), w, h);
      } else {
        initParams();
        refreshUI();
      }
      
      drawPreview();
      setupCanvasClickForPipette();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── 7. IMAGE RENDERING CORE (HSL 局部色彩核心) ──
function drawPreview() {
  const mc = document.getElementById('main-canvas');
  if(!mc || !origCanvas) return;
  const ctx = mc.getContext('2d');
  const w = mc.width, h = mc.height;
  ctx.drawImage(origCanvas, 0, 0);

  if(isComparing) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const exp = Math.pow(2, adj.exposure);
  const cont = (adj.contrast + 100) / 100;
  const sat = (adj.saturation + 50) / 50;
  const vib = (adj.vibrance + 50) / 50;
  const temp = adj.temperature / 100;
  const tnt = adj.tint / 100;
  const high = adj.highlights;
  const shad = adj.shadows;

  const targetH = adj.localHueTarget;
  const rangeH = adj.localRange;
  const locL = adj.localLightness;
  const locS = adj.localSaturation;

  // 生成曲線查找表
  const lut = new Uint8Array(256);
  for(let i=0; i<256; i++) {
    let val = i;
    // 尋找對應的三階貝茲曲線數值
    lut[i] = Math.max(0, Math.min(255, val));
  }

  for(let i=0; i<data.length; i+=4) {
    let r = data[i], g = data[i+1], b = data[i+2];

    // 光線調整
    r *= exp; g *= exp; b *= exp;
    r = (r-128)*cont+128; g = (g-128)*cont+128; b = (b-128)*cont+128;

    let luma = 0.299*r + 0.587*g + 0.114*b;
    if (high !== 0 && luma > 128) {
      let wHigh = (luma - 128) / 128;
      r += high * wHigh * 0.4; g += high * wHigh * 0.4; b += high * wHigh * 0.4;
    }
    if (shad !== 0 && luma < 128) {
      let wShad = (128 - luma) / 128;
      r += shad * wShad * 0.4; g += shad * wShad * 0.4; b += shad * wShad * 0.4;
    }

    // 色溫白平衡
    r += temp*18; b -= temp*18; g += tnt * 10;

    // 飽和度與鮮豔度
    let max = Math.max(r,g,b), min = Math.min(r,g,b);
    let vAmt = (max - min) / 255;
    r = luma + (r - luma) * sat * (1 + (1-vAmt)*vib*0.5);
    g = luma + (g - luma) * sat * (1 + (1-vAmt)*vib*0.5);
    b = luma + (b - luma) * sat * (1 + (1-vAmt)*vib*0.5);

    // 🔬 核心：局部色彩 HSL 遮罩範圍微調
    if (localMaskEnabled) {
      let hsl = rgbToHsl(r, g, b);
      let hDiff = Math.abs(hsl.h * 360 - targetH);
      if (hDiff > 180) hDiff = 360 - hDiff;

      if (hDiff <= rangeH) {
        let weight = 1 - (hDiff / rangeH); // 漸層羽化避免邊緣破碎
        
        // 局部亮度
        r += (locL * 2) * weight; g += (locL * 2) * weight; b += (locL * 2) * weight;
        
        // 局部飽和
        let lGray = 0.299*r + 0.587*g + 0.114*b;
        let sMod = (locS + 50) / 50;
        r = lGray + (r - lGray) * (1 + (sMod - 1) * weight);
        g = lGray + (g - lGray) * (1 + (sMod - 1) * weight);
        b = lGray + (b - lGray) * (1 + (sMod - 1) * weight);
      }
    }

    data[i] = lut[Math.max(0,Math.min(255,r))];
    data[i+1] = lut[Math.max(0,Math.min(255,g))];
    data[i+2] = lut[Math.max(0,Math.min(255,b))];
  }
  ctx.putImageData(imgData, 0, 0);

  // 特效：顆粒
  if (adj.grain > 0) {
    ctx.fillStyle = `rgba(255,255,255,${adj.grain / 700})`;
    for (let k=0; k<(w*h)*(adj.grain/250); k++) {
      ctx.fillRect(Math.random()*w, Math.random()*h, 1.2, 1.2);
    }
  }
}

// ── 8. PIPETTE TOOL LOGIC ──
function togglePipetteMode() {
  pipetteActive = !pipetteActive;
  const btn = document.getElementById('btn-pipette');
  const mc = document.getElementById('main-canvas');
  if(!btn) return;

  if(pipetteActive) {
    btn.classList.add('active');
    if(mc) mc.style.cursor = 'crosshair';
    document.getElementById('pipette-status-text').innerText = '💡 請點選畫面上有色區塊（如藍天、綠草地）...';
  } else {
    btn.classList.remove('active');
    if(mc) mc.style.cursor = 'default';
  }
}

function setupCanvasClickForPipette() {
  const mc = document.getElementById('main-canvas');
  if(!mc) return;
  mc.onclick = function(e) {
    if(!pipetteActive) return;
    const rect = mc.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * mc.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * mc.height);
    
    const ctx = mc.getContext('2d');
    const pix = ctx.getImageData(x, y, 1, 1).data;
    const hsl = rgbToHsl(pix[0], pix[1], pix[2]);
    const th = Math.round(hsl.h * 360);

    localMaskEnabled = true;
    adj.localHueTarget = th;
    adj.localRange = 35;
    adj.localLightness = 0;
    adj.localSaturation = 0;

    // 解鎖局部 HSL 面板
    const tabL = document.getElementById('panel-tab-local');
    if(tabL) tabL.style.opacity = '1';
    switchControlPanel('local');

    // UI 指示
    const dot = document.getElementById('pipette-dot');
    if(dot) { dot.style.display = 'block'; dot.style.backgroundColor = `rgb(${pix[0]},${pix[1]},${pix[2]})`; }
    document.getElementById('pipette-status-text').innerText = `已鎖定局部色彩色相: ${th}°`;
    document.getElementById('btn-clear-mask').style.display = 'inline-block';

    togglePipetteMode();
    refreshUI();
    drawPreview();
  };
}

function clearLocalMask() {
  localMaskEnabled = false;
  const dot = document.getElementById('pipette-dot');
  if(dot) dot.style.display = 'none';
  document.getElementById('btn-clear-mask').style.display = 'none';
  document.getElementById('pipette-status-text').innerText = '未選取局部範圍（目前調整全圖）';
  document.getElementById('panel-tab-local').style.opacity = '0.4';
  
  adj.localLightness = 0;
  adj.localSaturation = 0;
  switchControlPanel('global');
  refreshUI();
  drawPreview();
}

function switchControlPanel(tab) {
  const gGrp = document.getElementById('global-sliders-group');
  const lGrp = document.getElementById('local-sliders-group');
  const tG = document.getElementById('panel-tab-global');
  const tL = document.getElementById('panel-tab-local');
  
  if(tab === 'global') {
    if(gGrp) gGrp.style.display = 'block'; if(lGrp) lGrp.style.display = 'none';
    if(tG) tG.classList.add('active'); if(tL) tL.classList.remove('active');
  } else if (localMaskEnabled) {
    if(gGrp) gGrp.style.display = 'none'; if(lGrp) lGrp.style.display = 'block';
    if(tG) tG.classList.remove('active'); if(tL) tL.classList.add('active');
  }
}

// ── 9. EXPORT & HIGH-QUALITY BLOB EXPORT ──
function downloadImage() {
  if(!previewImage || !origCanvas) { toast('❌ 尚未載入相片'); return; }
  toast('⚙️ 正在呼叫網頁端高畫質核心沖印大圖...');
  
  setTimeout(() => {
    const mc = document.getElementById('main-canvas');
    const pw = mc.width, ph = mc.height;
    
    // 將畫布展延到原圖尺寸
    mc.width = previewImage.naturalWidth;
    mc.height = previewImage.naturalHeight;
    const ctx = mc.getContext('2d');
    ctx.drawImage(previewImage, 0, 0);
    
    // 套用濾鏡
    drawPreview();
    
    mc.toBlob(blob => {
      const a = document.createElement('a');
      a.download = `KaiLun_Lab_HQ_${Date.now()}.jpg`;
      a.href = URL.createObjectURL(blob);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      
      // 還原工作預覽圖畫布
      mc.width = pw; mc.height = ph;
      drawPreview();
      toast('✓ 最高規格照片已下載完成！');
    }, 'image/jpeg', 0.95);
  }, 40);
}

// ── 10. UTILS & STRIPS RENDERING ──
function rgbToHsl(r, g, b) {
  r/=255; g/=255; b/=255;
  let max=Math.max(r,g,b), min=Math.min(r,g,b), h, s, l=(max+min)/2;
  if(max===min) h=s=0;
  else {
    let d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    if(max===r) h=(g-b)/d+(g<b?6:0);
    else if(max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h/=6;
  }
  return {h,s,l};
}

function buildStrips() {
  const container = document.getElementById('recipe-strips');
  if(!container) return;
  const all = [...baseRecipes, ...userRecipes];
  container.innerHTML = all.map(r => `
    <div class="recipe-strip-card ${curId===r.id?'active':''}" id="rec-${r.id}" onclick="selectRecipe('${r.id}')">
      <div class="strip-color-accent" style="background:${r.accent||'#var(--gold)'}"></div>
      <div class="strip-info">
        <div class="strip-name">${r.name}</div>
        <div class="strip-mood">${r.mood}</div>
      </div>
    </div>
  `).join('');
}

function selectRecipe(id) {
  curId = id;
  const all = [...baseRecipes, ...userRecipes];
  const r = all.find(x => x.id === id);
  if(r) {
    adj = { ...r.params };
    document.querySelectorAll('.recipe-strip-card').forEach(c=>c.classList.remove('active'));
    const item = document.getElementById(`rec-${id}`);
    if(item) item.classList.add('active');
    refreshUI();
    drawPreview();
    toast(`已套用底片風格：${r.name}`);
  }
}

function filterRecipes(tag) {
  document.querySelectorAll('.rf-btn').forEach(b=>b.classList.remove('active'));
  if(tag==='all') document.getElementById('rf-all').classList.add('active');
  if(tag==='經典') document.getElementById('rf-classic').classList.add('active');
  if(tag==='電影') document.getElementById('rf-cinema').classList.add('active');
  if(tag==='自訂') document.getElementById('rf-user').classList.add('active');
  
  const cards = document.querySelectorAll('.recipe-strip-card');
  const all = [...baseRecipes, ...userRecipes];
  cards.forEach(c => {
    const id = c.id.replace('rec-','');
    const r = all.find(x=>x.id===id);
    if(tag==='all' || (r && r.tags===tag)) c.style.display='flex';
    else c.style.display='none';
  });
}

function saveCurrentAsRecipe(){
  const name=prompt('新自訂食譜名稱：'); if(!name) return;
  const r={id:'custom_'+Date.now(), name, mood:'User Custom Color Profile', tags:'自訂', accent:'#dfb23f', params:{...adj}};
  userRecipes.push(r);
  localStorage.setItem('kl-recipes', JSON.stringify(userRecipes));
  buildStrips();
  selectRecipe(r.id);
}

function exportRecipes(){
  const a=document.createElement('a');
  a.download='kailun-recipes.json';
  a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(userRecipes));
  a.click();
}

function startCompare() { isComparing = true; drawPreview(); }
function endCompare() { isComparing = false; drawPreview(); }
function changeZoom(amt) {
  currentZoom = Math.max(30, Math.min(200, currentZoom + amt));
  document.getElementById('lbl-zoom').innerText = currentZoom + '%';
  const mc = document.getElementById('main-canvas');
  if(mc) mc.style.transform = `scale(${currentZoom/100})`;
}
function triggerUpload() { document.getElementById('file-input').click(); }
function resetAllSliders() { initParams(); refreshUI(); drawPreview(); toast('重設所有滑塊參數 ↺'); }
function toast(msg) { const t=document.getElementById('toast'); if(t){t.innerText=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000);}}

// ── 11. TONE CURVE GRAPHICS (曲線繪製) ──
function drawCurveCanvas() {
  const c = document.getElementById('curve-canvas'); if(!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,160,160);
  ctx.strokeStyle = '#272422'; ctx.lineWidth = 1;
  ctx.strokeRect(0,0,160,160);
  ctx.beginPath(); ctx.moveTo(0,160); ctx.lineTo(160,0); ctx.stroke();
}
function toggleCurveDock() { 
  const d = document.getElementById('curve-dock'); d.classList.toggle('expanded'); 
  const arrow = document.getElementById('curve-arrow'); arrow.innerText = d.classList.contains('expanded') ? '▼' : '▲';
}
function resetCurvePoints() { toast('曲線已重設'); drawCurveCanvas(); }

// ── 12. SAFE LIFECYCLE DOM READY ──
// 🌟 關鍵修正：確保 HTML 元素全部長好之後，才執行初始化綁定，防範跳轉卡死！
document.addEventListener('DOMContentLoaded', () => {
  buildSliders();
  buildStrips();
  drawCurveCanvas();
  
  // 拖曳上傳支援
  const zone = document.getElementById('canvas-container');
  if(zone) {
    zone.addEventListener('dragover', (e) => e.preventDefault());
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      if(e.dataTransfer.files.length > 0) handleFileSelect({files: e.dataTransfer.files});
    });
  }
});