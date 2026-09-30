const $ = id => document.getElementById(id);

const STEM_EL = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
const BRANCH_EL = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
const EL_COLOR = {'木':'#0C9C3C','火':'#A8230C','土':'#8F5A09','金':'#F2D00F','水':'#0C71A8'};

function col(ch) {
  const el = STEM_EL[ch] || BRANCH_EL[ch];
  return el ? `<span style="color:${EL_COLOR[el]};font-weight:700;text-shadow:0 0 2px rgba(0,0,0,.2)">${ch}</span>` : ch;
}

let persons = [];
let curId = null;
let curAvatar = null;

const SVG_PERSON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';

window.addEventListener('DOMContentLoaded', async () => {
  $('sidebar-list').onclick = e => {
    const item = e.target.closest('.person-item');
    if (!item) return;
    $('sec-divine').hidden = true;
    $('sec-input').hidden = false;
    if (item.dataset.action === 'add') { newPerson(); return; }
    const id = Number(item.dataset.id);
    if (id) selectPerson(id);
  };

  $('avatar-area').onclick = uploadAvatar;
  $('btn-paipan').onclick = doPaipan;
  $('btn-tuili').onclick = doTuili;
  $('btn-import').onclick = doImport;
  $('btn-export').onclick = doExport;
  $('btn-export-pdf').onclick = openExportDialog;
  $('btn-export-cancel').onclick = () => $('dlg-export').close();
  $('btn-export-confirm').onclick = doExportPdf;
  $('sel-year').onchange = onYearChange;
  $('btn-divine').onclick = enterDivineMode;
  $('btn-divine-start').onclick = doDivine;
  $('btn-divine-export').onclick = doExportDivine;
  $('btn-divine-history').onclick = openDivineHistory;
  $('btn-history-close').onclick = () => $('dlg-divine-history').close();
  initCoinGrid();

  const saved = await api.autoLoad();
  if (saved && saved.length) {
    persons = saved;
    renderSidebar();
  }
  divineHistory = await api.loadDivineHistory() || [];

  setInterval(updateExportBtn, 1000);
});

function save() { api.autoSave(persons); }

function updateExportBtn() {
  $('btn-export-pdf').disabled = $('sec-chart').hidden;
}

function newPerson() {
  curId = null;
  curAvatar = null;
  ['f-name','f-year','f-month','f-day','f-birthplace','f-residence'].forEach(id => $(id).value = '');
  $('f-gender').value = '男';
  $('f-hour').value = '子时';
  $('form-avatar').innerHTML = SVG_PERSON;
  $('sec-chart').hidden = true;
  $('sec-infer').hidden = true;
  $('loading-paipan').hidden = true;
  $('loading-tuili').hidden = true;
  $('panel').scrollTop = 0;
  renderSidebar();
  updateExportBtn();
}

async function uploadAvatar() {
  const data = await api.uploadAvatar();
  if (!data) return;
  curAvatar = data;
  $('form-avatar').innerHTML = `<img src="${data}">`;
  if (curId) {
    const p = persons.find(p => p.id === curId);
    if (p) { p.avatar = data; renderSidebar(); save(); }
  }
}

function getInfo() {
  return {
    name: $('f-name').value.trim(),
    gender: $('f-gender').value,
    year: parseInt($('f-year').value),
    month: parseInt($('f-month').value),
    day: parseInt($('f-day').value),
    hour: $('f-hour').value,
    birthplace: $('f-birthplace').value.trim(),
    residence: $('f-residence').value.trim()
  };
}

function fillForm(p) {
  $('f-name').value = p.name;
  $('f-gender').value = p.gender;
  $('f-year').value = p.year;
  $('f-month').value = p.month;
  $('f-day').value = p.day;
  $('f-hour').value = p.hour;
  $('f-birthplace').value = p.birthplace || '';
  $('f-residence').value = p.residence || '';
  curAvatar = p.avatar;
  $('form-avatar').innerHTML = p.avatar ? `<img src="${p.avatar}">` : SVG_PERSON;
}

function selectPerson(id) {
  curId = id;
  const p = persons.find(p => p.id === id);
  if (!p) return;
  fillForm(p);
  $('loading-paipan').hidden = true;
  $('loading-tuili').hidden = true;

  if (p.chart) {
    renderChart(p.chart);
    $('sec-chart').hidden = false;
  } else {
    $('sec-chart').hidden = true;
  }

  if (p.inference) {
    renderInference(p);
    $('sec-infer').hidden = false;
  } else {
    $('sec-infer').hidden = true;
  }

  $('panel').scrollTop = 0;
  renderSidebar();
}

function renderSidebar() {
  const list = $('sidebar-list');
  let h = '<div class="person-item" data-action="add"><div class="avatar add-avatar"><span>+</span></div></div>';
  persons.forEach(p => {
    const cls = p.id === curId ? ' active' : '';
    const av = p.avatar ? `<img src="${p.avatar}">` : SVG_PERSON;
    h += `<div class="person-item${cls}" data-id="${p.id}"><div class="avatar">${av}</div><div class="person-name">${p.name}</div></div>`;
  });
  list.innerHTML = h;
}

// ===== 排盘 =====
async function doPaipan() {
  const info = getInfo();
  if (!info.name || !info.year || !info.month || !info.day) {
    alert('请填写姓名和完整的出生日期'); return;
  }
  $('loading-paipan').hidden = false;
  $('btn-paipan').disabled = true;
  $('sec-chart').hidden = true;
  $('sec-infer').hidden = true;

  try {
    const chart = await api.paipan(info);
    const person = { id: curId || Date.now(), ...info, avatar: curAvatar, chart, inference: null, yearAnalysis: {} };
    if (curId) {
      const idx = persons.findIndex(p => p.id === curId);
      if (idx >= 0) persons[idx] = person; else persons.push(person);
    } else {
      persons.push(person);
      curId = person.id;
    }
    renderSidebar();
    renderChart(chart);
    $('sec-chart').hidden = false;
    save();
    updateExportBtn();
  } catch (e) {
    alert('排盘失败: ' + e.message);
  } finally {
    $('loading-paipan').hidden = true;
    $('btn-paipan').disabled = false;
  }
}

// ===== 推理（含全部流年） =====
async function doTuili() {
  const p = persons.find(p => p.id === curId);
  if (!p || !p.chart) return;
  const info = getInfo();

  $('loading-tuili').hidden = false;
  $('loading-tuili').textContent = '推理中... (分析命局)';
  $('btn-tuili').disabled = true;

  try {
    const inference = await api.tuili(p.chart, info);
    p.inference = inference;
    save();
  } catch (e) {
    alert('推理失败: ' + e.message);
    $('loading-tuili').hidden = true;
    $('btn-tuili').disabled = false;
    return;
  }

  // 批量生成所有流年（每批独立，失败不影响其他）
  const birthYear = p.year;
  const endYear = Math.max(new Date().getFullYear() + 5, birthYear + 80);
  const batches = [];
  for (let y = birthYear; y <= endYear; y += 5) batches.push([y, Math.min(y + 4, endYear)]);

  p.yearAnalysis = p.yearAnalysis || {};
  let failCount = 0;
  for (let i = 0; i < batches.length; i++) {
    $('loading-tuili').textContent = `推理中... (流年 ${batches[i][0]}-${batches[i][1]}, ${i + 1}/${batches.length})`;
    try {
      const result = await api.liunianBatch(p.chart, info, batches[i][0], batches[i][1]);
      if (result && result.years) {
        result.years.forEach(ya => { p.yearAnalysis[ya.year] = ya; });
        save();
      }
    } catch (e) {
      failCount++;
    }
    renderInference(p);
    $('sec-infer').hidden = false;
  }

  $('loading-tuili').hidden = true;
  $('btn-tuili').disabled = false;
  updateExportBtn();
  if (failCount) alert(`${failCount}个流年批次生成失败，已显示成功部分`);
}

// ===== 渲染排盘 =====
function renderChart(c) {
  const keys = ['year', 'month', 'day', 'hour'];
  const labels = ['年柱', '月柱', '日柱', '时柱'];
  let h = '<table class="bazi-table"><thead><tr><th></th>';
  labels.forEach(l => h += `<th>${l}</th>`);
  h += '</tr></thead><tbody>';

  h += '<tr><td class="row-label">主星</td>';
  keys.forEach(k => h += `<td>${c.tenGods[k + 'Stem'] || ''}</td>`);
  h += '</tr>';

  h += '<tr><td class="row-label">天干</td>';
  keys.forEach(k => h += `<td class="big-char">${col(c.pillars[k].stem)}</td>`);
  h += '</tr>';

  h += '<tr><td class="row-label">地支</td>';
  keys.forEach(k => h += `<td class="big-char">${col(c.pillars[k].branch)}</td>`);
  h += '</tr>';

  h += '<tr><td class="row-label">藏干</td>';
  keys.forEach(k => {
    const s = c.hiddenStems[k] || [];
    h += `<td>${s.map(col).join(' ')}</td>`;
  });
  h += '</tr>';

  if (c.hiddenStemGods) {
    h += '<tr><td class="row-label">藏干十神</td>';
    keys.forEach(k => h += `<td style="font-size:12px">${(c.hiddenStemGods[k] || []).join(' ')}</td>`);
    h += '</tr>';
  }

  h += '<tr><td class="row-label">地势</td>';
  keys.forEach(k => h += `<td>${c.earthPhase[k] || ''}</td>`);
  h += '</tr>';

  if (c.nayin) {
    h += '<tr><td class="row-label">纳音</td>';
    keys.forEach(k => h += `<td>${c.nayin[k] || ''}</td>`);
    h += '</tr>';
  }

  h += '<tr><td class="row-label">神煞</td>';
  keys.forEach(k => h += `<td style="font-size:12px">${(c.spirits[k] || []).join('<br>')}</td>`);
  h += '</tr></tbody></table>';

  if (c.selfSitting) h += `<div class="day-master">自坐：${c.selfSitting}</div>`;

  const dm = c.dayMaster;
  h += `<div class="day-master">日主：${col(dm.stem)} ${dm.element}（${dm.yinYang}）| ${dm.strength}</div>`;

  h += '<div class="wuxing">';
  ['木','火','土','金','水'].forEach(el => {
    h += `<span style="color:${EL_COLOR[el]};text-shadow:0 0 2px rgba(0,0,0,.15)">${el}: ${c.fiveElements[el]}</span>`;
  });
  h += '</div>';

  h += '<div class="dayun-title">大运</div><div class="dayun-list">';
  (c.majorLuck || []).forEach(ml => {
    h += `<div class="dayun-item"><div class="dayun-age">${ml.startAge}-${ml.endAge}岁</div>` +
         `<div class="dayun-pillar">${col(ml.stem)}${col(ml.branch)}</div>` +
         `<div class="dayun-year">${ml.startYear}年起</div></div>`;
  });
  h += '</div>';

  $('chart-content').innerHTML = h;
}

// ===== 渲染推理 =====
function renderInference(p) {
  const inf = p.inference;
  let left = '';

  [['性格分析', inf.personality], ['事业运', inf.career], ['财运', inf.wealth],
   ['学业', inf.education], ['爱情姻缘', inf.love], ['人生建议', inf.advice]
  ].forEach(([t, c]) => {
    if (c) left += `<div class="infer-section"><h3>${t}</h3><p>${c}</p></div>`;
  });

  if (inf.lifePeriods) {
    left += '<div class="infer-section"><h3>人生阶段</h3>';
    [['幼时', inf.lifePeriods.childhood], ['少年', inf.lifePeriods.youth],
     ['中年', inf.lifePeriods.middleAge], ['晚年', inf.lifePeriods.oldAge]
    ].forEach(([l, c]) => { if (c) left += `<p><strong>${l}：</strong>${c}</p>`; });
    left += '</div>';
  }

  if (inf.majorLuckAnalysis && inf.majorLuckAnalysis.length) {
    left += '<div class="infer-section"><h3>大运详解</h3>';
    inf.majorLuckAnalysis.forEach(ml => {
      left += `<div class="dayun-analysis-item"><h4>${ml.period} ${ml.pillar} — ${ml.theme}</h4>` +
              `<p>${ml.analysis}</p>` +
              (ml.events ? `<p><strong>可能事件：</strong>${ml.events}</p>` : '') +
              (ml.advice ? `<p><strong>建议：</strong>${ml.advice}</p>` : '') +
              '</div>';
    });
    left += '</div>';
  }

  $('infer-left').innerHTML = left;

  // 年份选择器
  const ya = p.yearAnalysis || {};
  const years = Object.keys(ya).map(Number).sort((a, b) => a - b);
  const curYear = new Date().getFullYear();
  let opts = '';
  years.forEach(y => {
    const sel = y === curYear ? ' selected' : '';
    opts += `<option value="${y}"${sel}>${y}年</option>`;
  });
  $('sel-year').innerHTML = opts;

  // 默认显示当年
  const defaultYear = years.includes(curYear) ? curYear : years[0];
  if (defaultYear && ya[defaultYear]) {
    $('sel-year').value = defaultYear;
    renderYearAnalysis(ya[defaultYear]);
  } else {
    $('year-content').innerHTML = '<p style="color:#8B8468;text-align:center">暂无流年数据</p>';
  }
}

function onYearChange() {
  const year = parseInt($('sel-year').value);
  const p = persons.find(p => p.id === curId);
  if (p && p.yearAnalysis && p.yearAnalysis[year]) {
    renderYearAnalysis(p.yearAnalysis[year]);
  }
}

function renderYearAnalysis(d) {
  const ratingMap = { '吉': 'ji', '平': 'ping', '凶': 'xiong' };
  let h = `<div class="year-overview"><h3>${d.year}年 ${col(d.stem)}${col(d.branch)}年</h3><p>${d.overview || ''}</p></div>`;

  if (d.themes && d.themes.length) h += `<p style="margin-bottom:12px"><strong>年度主题：</strong>${d.themes.join('、')}</p>`;
  if (d.analysis) h += `<div class="infer-section"><h3>详细分析</h3><p>${d.analysis}</p></div>`;
  if (d.advice) h += `<div class="infer-section"><h3>年度建议</h3><p>${d.advice}</p></div>`;

  if (d.months && d.months.length) {
    h += '<div class="infer-section"><h3>每月运势</h3><div class="month-grid">';
    d.months.forEach(m => {
      const rc = ratingMap[m.rating] || 'ping';
      h += `<div class="month-item"><h4>${m.name || m.month + '月'} ${col(m.stem || '')}${col(m.branch || '')}` +
           (m.rating ? ` <span class="rating rating-${rc}">${m.rating}</span>` : '') +
           `</h4><p>${m.summary || m.analysis || ''}</p></div>`;
    });
    h += '</div></div>';
  }

  $('year-content').innerHTML = h;
}

// ===== 六爻占卜 =====
let divineCoins = [[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1]]; // 1=正, 0=反
let divineHistory = [];
let curDivineResult = null;

function initCoinGrid() {
  const labels = ['第一次（初爻）','第二次（二爻）','第三次（三爻）','第四次（四爻）','第五次（五爻）','第六次（上爻）'];
  let h = '';
  for (let r = 0; r < 6; r++) {
    h += `<div class="coin-row"><span class="throw-label">${labels[r]}</span>`;
    for (let c = 0; c < 3; c++) {
      h += `<button class="coin coin-front" data-r="${r}" data-c="${c}">正</button>`;
    }
    h += '</div>';
  }
  $('coin-grid').innerHTML = h;
  $('coin-grid').onclick = e => {
    const btn = e.target.closest('.coin');
    if (!btn) return;
    const r = +btn.dataset.r, c = +btn.dataset.c;
    divineCoins[r][c] = divineCoins[r][c] ? 0 : 1;
    btn.textContent = divineCoins[r][c] ? '正' : '反';
    btn.className = 'coin ' + (divineCoins[r][c] ? 'coin-front' : 'coin-back');
  };
}

function enterDivineMode() {
  ['sec-input','sec-chart','sec-infer','loading-paipan','loading-tuili'].forEach(id => $(id).hidden = true);
  $('sec-divine').hidden = false;
  $('panel').scrollTop = 0;
}

function exitDivineMode() {
  $('sec-divine').hidden = true;
  $('sec-input').hidden = false;
  if (curId) selectPerson(curId); else newPerson();
}

function getLineValues() {
  return divineCoins.map(row => {
    const sum = row.reduce((a, v) => a + (v ? 3 : 2), 0);
    return sum; // 6=老阴, 7=少阳, 8=少阴, 9=老阳
  });
}

async function doDivine() {
  const question = $('divine-question').value.trim();
  if (!question) { alert('请输入问题'); return; }

  $('divine-loading').hidden = false;
  $('btn-divine-start').disabled = true;
  $('divine-result').innerHTML = '';
  $('btn-divine-export').disabled = true;

  const lines = getLineValues();
  try {
    const result = await api.divine(question, lines);
    curDivineResult = { id: Date.now(), date: new Date().toLocaleDateString('zh-CN'), question, coins: divineCoins.map(r => [...r]), lines, result };
    divineHistory.unshift(curDivineResult);
    api.saveDivineHistory(divineHistory);
    renderDivineResult(result);
    $('btn-divine-export').disabled = false;
  } catch (e) {
    alert('占卜分析失败: ' + e.message);
  } finally {
    $('divine-loading').hidden = true;
    $('btn-divine-start').disabled = false;
  }
}

function renderDivineResult(r) {
  let h = '<div class="divine-hexagram">';
  h += `<div class="hex-name">${r.originalHex}</div>`;
  if (r.changedHex) h += `<div style="font-size:14px;color:#8B8468">→ 变卦：${r.changedHex}</div>`;
  if (r.originalUpper && r.originalLower) h += `<div style="font-size:13px;color:#5A5638;margin-top:4px">上卦：${r.originalUpper}　下卦：${r.originalLower}</div>`;
  if (r.worldLine) h += `<div style="font-size:13px;color:#5A5638">世爻：${r.worldLine}　应爻：${r.responseLine || ''}</div>`;
  h += '</div>';

  if (r.lines && r.lines.length) {
    h += '<div class="divine-lines">';
    [...r.lines].reverse().forEach(l => {
      const isYang = l.yinYang === '阳';
      const cls = (isYang ? '' : 'yin') + (l.changing ? ' changing' : '');
      h += `<div class="divine-line"><span class="pos">${l.position}</span>` +
        `<span class="type">${l.changing ? (isYang ? '老阳' : '老阴') : (isYang ? '少阳' : '少阴')}</span>` +
        `<span class="rel">${l.sixRelative || ''}</span>` +
        `<div class="bar ${cls}"></div></div>`;
    });
    h += '</div>';
  }

  if (r.analysis) h += `<div class="infer-section"><h3>详细分析</h3><p>${r.analysis}</p></div>`;
  if (r.conclusion) h += `<div class="infer-section"><h3>结论</h3><p>${r.conclusion}</p></div>`;
  if (r.advice) h += `<div class="infer-section"><h3>建议</h3><p>${r.advice}</p></div>`;

  $('divine-result').innerHTML = h;
}

async function openDivineHistory() {
  if (!divineHistory.length) divineHistory = await api.loadDivineHistory() || [];
  let h = '';
  if (!divineHistory.length) {
    h = '<p style="color:#8B8468;text-align:center;padding:20px">暂无历史记录</p>';
  } else {
    divineHistory.forEach((item, i) => {
      h += `<div class="history-item" data-idx="${i}">` +
        `<div class="hi-date">${item.date}</div>` +
        `<div class="hi-question">${item.question}</div>` +
        `<div class="hi-hex">${item.result?.originalHex || ''}${item.result?.changedHex ? ' → ' + item.result.changedHex : ''}</div></div>`;
    });
  }
  $('divine-history-list').innerHTML = h;
  $('divine-history-list').onclick = e => {
    const item = e.target.closest('.history-item');
    if (!item) return;
    const rec = divineHistory[+item.dataset.idx];
    if (!rec) return;
    $('dlg-divine-history').close();
    $('divine-question').value = rec.question;
    if (rec.coins) {
      divineCoins = rec.coins.map(r => [...r]);
      const btns = $('coin-grid').querySelectorAll('.coin');
      btns.forEach(btn => {
        const r = +btn.dataset.r, c = +btn.dataset.c;
        btn.textContent = divineCoins[r][c] ? '正' : '反';
        btn.className = 'coin ' + (divineCoins[r][c] ? 'coin-front' : 'coin-back');
      });
    }
    curDivineResult = rec;
    renderDivineResult(rec.result);
    $('btn-divine-export').disabled = false;
  };
  $('dlg-divine-history').showModal();
}

async function doExportDivine() {
  if (!curDivineResult) return;
  const r = curDivineResult.result;
  let h = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:'Microsoft YaHei','SimSun',sans-serif;background:#F7F5D7;color:#2C2C2C;padding:30px 40px;font-size:13px;line-height:1.8;}
h1{text-align:center;color:#8B6914;font-size:24px;margin-bottom:4px;}
.sub{text-align:center;color:#8B8468;font-size:13px;margin-bottom:20px;}
.box{border:2px solid #D4D0A8;border-radius:10px;padding:16px 20px;margin-bottom:18px;text-align:center;}
.hex-name{font-size:20px;font-weight:700;color:#8B6914;}
.line-row{display:flex;align-items:center;gap:8px;padding:4px 8px;background:#EDE9C0;border-radius:4px;margin:3px auto;max-width:400px;font-size:12px;}
.line-row .pos{font-weight:600;width:36px;}
.line-row .tp{width:45px;color:#8B6914;}
.line-row .rl{width:45px;}
.line-row .br{flex:1;height:5px;border-radius:2px;background:#8B6914;}
.line-row .br.yin{background:transparent;border-top:2px solid #8B6914;border-bottom:2px solid #8B6914;}
.line-row .br.chg{background:#A8230C;}
.line-row .br.yin.chg{border-color:#A8230C;}
.sec{margin-bottom:14px;page-break-inside:avoid;}
.sec h2{font-size:15px;color:#8B6914;border-bottom:2px solid #EDE9C0;padding-bottom:3px;margin-bottom:6px;}
.sec p{text-align:justify;}
</style></head><body>`;

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
  h += `<h1>☰ 六爻占卜 ☰</h1>`;
  h += `<div class="sub">${dateStr}</div>`;
  h += `<div class="sec"><h2>问题</h2><p>${curDivineResult.question}</p></div>`;

  h += '<div class="box">';
  h += `<div class="hex-name">${r.originalHex}${r.changedHex ? ' → ' + r.changedHex : ''}</div>`;
  if (r.originalUpper && r.originalLower) h += `<div style="font-size:12px;color:#5A5638;margin:4px 0">上卦：${r.originalUpper}　下卦：${r.originalLower}</div>`;
  if (r.worldLine) h += `<div style="font-size:12px;color:#5A5638">世爻：${r.worldLine}　应爻：${r.responseLine||''}</div>`;
  if (r.lines && r.lines.length) {
    h += '<div style="margin-top:8px">';
    [...r.lines].reverse().forEach(l => {
      const isYang = l.yinYang === '阳';
      const cls = (isYang ? '' : 'yin') + (l.changing ? ' chg' : '');
      h += `<div class="line-row"><span class="pos">${l.position}</span><span class="tp">${l.changing?(isYang?'老阳':'老阴'):(isYang?'少阳':'少阴')}</span><span class="rl">${l.sixRelative||''}</span><div class="br ${cls}"></div></div>`;
    });
    h += '</div>';
  }
  h += '</div>';

  if (r.analysis) h += `<div class="sec"><h2>详细分析</h2><p>${r.analysis}</p></div>`;
  if (r.conclusion) h += `<div class="sec"><h2>结论</h2><p>${r.conclusion}</p></div>`;
  if (r.advice) h += `<div class="sec"><h2>建议</h2><p>${r.advice}</p></div>`;
  h += '</body></html>';

  const fileName = `${dateStr}占卜`;
  const filePath = await api.exportPdf(h, fileName);
  if (filePath) alert('PDF已保存至：' + filePath);
}

// ===== 导入导出 =====
async function doExport() {
  if (!persons.length) { alert('没有数据可导出'); return; }
  await api.saveData(persons);
}

async function doImport() {
  const data = await api.loadData();
  if (data && Array.isArray(data)) {
    persons = data;
    curId = null;
    renderSidebar();
    newPerson();
    save();
  }
}

// ===== PDF导出 =====
function openExportDialog() {
  const p = persons.find(p => p.id === curId);
  if (!p || !p.chart) { alert('请先选择一个已排盘的人'); return; }
  const ya = p.yearAnalysis || {};
  const years = Object.keys(ya).map(Number).sort((a, b) => a - b);
  const curYear = new Date().getFullYear();
  const liunianCb = document.querySelector('#dlg-export input[value="liunian"]');
  if (years.length) {
    let opts = '';
    years.forEach(y => {
      opts += `<option value="${y}"${y === curYear ? ' selected' : ''}>${y}年</option>`;
    });
    $('export-year').innerHTML = opts;
    liunianCb.disabled = false;
    liunianCb.checked = true;
  } else {
    $('export-year').innerHTML = '<option>暂无数据</option>';
    liunianCb.disabled = true;
    liunianCb.checked = false;
  }
  $('dlg-export').showModal();
}

async function doExportPdf() {
  const p = persons.find(p => p.id === curId);
  if (!p) return;
  const checks = Array.from(document.querySelectorAll('#dlg-export input[name="exp"]:checked')).map(cb => cb.value);
  const selYear = parseInt($('export-year').value);
  $('dlg-export').close();

  const html = buildPdfHtml(p, checks, selYear);
  const filePath = await api.exportPdf(html, p.name);
  if (filePath) alert('PDF已保存至：' + filePath);
}

function buildPdfHtml(p, sections, selYear) {
  const c = p.chart;
  const inf = p.inference;
  const keys = ['year','month','day','hour'];
  const labels = ['年柱','月柱','日柱','时柱'];

  const elColor = {'木':'#0C9C3C','火':'#A8230C','土':'#8F5A09','金':'#F2D00F','水':'#0C71A8'};
  const stemEl = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  const branchEl = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
  const pc = ch => { const e = stemEl[ch]||branchEl[ch]; return e ? `<span style="color:${elColor[e]};font-weight:700">${ch}</span>` : ch; };

  let h = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:'Microsoft YaHei','SimSun',sans-serif;background:#F7F5D7;color:#2C2C2C;padding:30px 40px;font-size:13px;line-height:1.8;}
h1{text-align:center;color:#8B6914;font-size:26px;margin:0 0 4px;padding-top:10px;}
.sub{text-align:center;color:#8B8468;font-size:13px;margin-bottom:20px;}
.box{border:2px solid #D4D0A8;border-radius:10px;padding:16px 20px;margin-bottom:18px;}
table{width:100%;border-collapse:collapse;margin-bottom:12px;}
th,td{padding:7px 6px;text-align:center;border:1px solid #D4D0A8;font-size:12px;}
th{background:#EDE9C0;font-weight:600;}
.rl{background:#EDE9C0;font-weight:600;width:56px;}
.big{font-size:20px;font-weight:700;}
.center{text-align:center;margin:8px 0;font-size:13px;}
.wu{text-align:center;margin:6px 0;font-size:13px;font-weight:600;}
.dl{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0 4px;}
.di{text-align:center;padding:5px 10px;background:#EDE9C0;border-radius:6px;min-width:64px;}
.di .age{font-size:10px;color:#8B8468;}
.di .pl{font-size:16px;font-weight:700;margin:2px 0;}
.di .yr{font-size:10px;color:#8B8468;}
.sec{margin-bottom:16px;page-break-inside:avoid;}
.sec h2{font-size:15px;color:#8B6914;border-bottom:2px solid #EDE9C0;padding-bottom:3px;margin:0 0 6px;}
.sec p{text-align:justify;margin:0 0 4px;}
.da{background:#EDE9C0;border-radius:6px;padding:8px 10px;margin-bottom:6px;page-break-inside:avoid;}
.da h3{font-size:13px;color:#8B6914;margin:0 0 3px;}
.da p{font-size:12px;line-height:1.6;margin:2px 0;}
.mg{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.mi{background:#EDE9C0;border-radius:6px;padding:5px 8px;}
.mi h4{font-size:11px;margin:0 0 2px;}
.mi p{font-size:11px;line-height:1.5;margin:0;}
.rt{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;margin-left:4px;}
.rt-ji{background:#D4EDDA;color:#155724;}
.rt-ping{background:#FFF3CD;color:#856404;}
.rt-xiong{background:#F8D7DA;color:#721C24;}
.hdr{text-align:center;border-bottom:3px double #8B6914;padding-bottom:6px;margin-bottom:18px;}
</style></head><body>`;

  // Header
  h += `<div class="hdr"><h1>${p.name} 八字命盘</h1>`;
  h += `<div class="sub">${p.gender} | 公历${p.year}年${p.month}月${p.day}日 ${p.hour} | ${p.birthplace||''}${p.residence?(' | 居'+p.residence):''}</div></div>`;

  // Chart (always included)
  h += '<div class="box"><table><thead><tr><th></th>';
  labels.forEach(l => h += `<th>${l}</th>`);
  h += '</tr></thead><tbody>';
  h += '<tr><td class="rl">主星</td>';
  keys.forEach(k => h += `<td>${c.tenGods[k+'Stem']||''}</td>`);
  h += '</tr><tr><td class="rl">天干</td>';
  keys.forEach(k => h += `<td class="big">${pc(c.pillars[k].stem)}</td>`);
  h += '</tr><tr><td class="rl">地支</td>';
  keys.forEach(k => h += `<td class="big">${pc(c.pillars[k].branch)}</td>`);
  h += '</tr><tr><td class="rl">藏干</td>';
  keys.forEach(k => h += `<td>${(c.hiddenStems[k]||[]).map(pc).join(' ')}</td>`);
  h += '</tr>';
  if (c.hiddenStemGods) {
    h += '<tr><td class="rl">藏干十神</td>';
    keys.forEach(k => h += `<td style="font-size:11px">${(c.hiddenStemGods[k]||[]).join(' ')}</td>`);
    h += '</tr>';
  }
  h += '<tr><td class="rl">地势</td>';
  keys.forEach(k => h += `<td>${c.earthPhase[k]||''}</td>`);
  h += '</tr>';
  if (c.nayin) {
    h += '<tr><td class="rl">纳音</td>';
    keys.forEach(k => h += `<td>${c.nayin[k]||''}</td>`);
    h += '</tr>';
  }
  h += '<tr><td class="rl">神煞</td>';
  keys.forEach(k => h += `<td style="font-size:11px">${(c.spirits[k]||[]).join(' ')}</td>`);
  h += '</tr></tbody></table>';

  if (c.selfSitting) h += `<div class="center">自坐：${c.selfSitting}</div>`;
  const dm = c.dayMaster;
  h += `<div class="center">日主：${pc(dm.stem)} ${dm.element}（${dm.yinYang}）| ${dm.strength}</div>`;
  h += '<div class="wu">';
  ['木','火','土','金','水'].forEach(el => h += `<span style="color:${elColor[el]};margin:0 8px">${el}:${c.fiveElements[el]}</span>`);
  h += '</div>';

  h += '<div class="center" style="font-weight:600;margin-top:10px">大运</div><div class="dl">';
  (c.majorLuck||[]).forEach(ml => {
    h += `<div class="di"><div class="age">${ml.startAge}-${ml.endAge}岁</div><div class="pl">${pc(ml.stem)}${pc(ml.branch)}</div><div class="yr">${ml.startYear}年起</div></div>`;
  });
  h += '</div></div>';

  // Selected sections
  const secMap = {
    personality: ['性格分析', inf.personality],
    career: ['事业运', inf.career],
    wealth: ['财运', inf.wealth],
    education: ['学业', inf.education],
    love: ['爱情婚姻', inf.love]
  };

  sections.forEach(key => {
    if (secMap[key] && secMap[key][1]) {
      h += `<div class="sec"><h2>${secMap[key][0]}</h2><p>${secMap[key][1]}</p></div>`;
    }
    if (key === 'majorLuck' && inf.majorLuckAnalysis && inf.majorLuckAnalysis.length) {
      h += '<div class="sec"><h2>大运详解</h2>';
      inf.majorLuckAnalysis.forEach(ml => {
        h += `<div class="da"><h3>${ml.period} ${ml.pillar} — ${ml.theme}</h3><p>${ml.analysis}</p>`;
        if (ml.events) h += `<p><b>可能事件：</b>${ml.events}</p>`;
        if (ml.advice) h += `<p><b>建议：</b>${ml.advice}</p>`;
        h += '</div>';
      });
      h += '</div>';
    }
    if (key === 'liunian') {
      const ya = p.yearAnalysis || {};
      const d = ya[selYear];
      if (d) {
        const rMap = {'吉':'ji','平':'ping','凶':'xiong'};
        h += `<div class="sec"><h2>${d.year}年 流年运势</h2>`;
        h += `<p><b>${pc(d.stem)}${pc(d.branch)}年</b> — ${d.overview||''}</p>`;
        if (d.themes && d.themes.length) h += `<p><b>年度主题：</b>${d.themes.join('、')}</p>`;
        if (d.analysis) h += `<p>${d.analysis}</p>`;
        if (d.advice) h += `<p><b>建议：</b>${d.advice}</p>`;
        if (d.months && d.months.length) {
          h += '<div class="mg" style="margin-top:8px">';
          d.months.forEach(m => {
            const rc = rMap[m.rating]||'ping';
            h += `<div class="mi"><h4>${m.name||m.month+'月'} ${pc(m.stem||'')}${pc(m.branch||'')}`;
            if (m.rating) h += ` <span class="rt rt-${rc}">${m.rating}</span>`;
            h += `</h4><p>${m.summary||m.analysis||''}</p></div>`;
          });
          h += '</div>';
        }
        h += '</div>';
      }
    }
  });

  h += '</body></html>';
  return h;
}
