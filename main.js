const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let win;

let claudePath = 'claude';
try {
  claudePath = execSync('where claude', { encoding: 'utf8', timeout: 5000 }).trim().split(/\r?\n/)[0].trim();
} catch {}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    const proc = spawn(claudePath, ['-p', '--output-format', 'json'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    proc.stdin.write(prompt, 'utf8');
    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => stdout += d.toString('utf8'));
    proc.stderr.on('data', d => stderr += d.toString('utf8'));
    proc.on('error', e => done(reject, e));

    const timer = setTimeout(() => {
      proc.kill();
      done(reject, new Error('调用超时 (10分钟)'));
    }, 600000);

    proc.on('close', code => {
      clearTimeout(timer);
      try {
        fs.appendFileSync(path.join(os.tmpdir(), 'bazi_debug.log'),
          `\n===== ${new Date().toISOString()} =====\nPATH: ${claudePath}\nCODE: ${code}\nSTDOUT(500): ${stdout.substring(0, 500)}\nSTDERR(200): ${stderr.substring(0, 200)}\n`);
      } catch {}

      if (code !== 0 && !stdout.trim()) {
        done(reject, new Error(stderr || `Exit ${code}`));
        return;
      }
      try {
        const resp = JSON.parse(stdout.trim());
        if (resp.is_error) { done(reject, new Error(resp.result || '调用失败')); return; }
        const text = resp.result;
        try { done(resolve, JSON.parse(text)); return; } catch {}
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('返回格式错误：' + text.substring(0, 200));
        done(resolve, JSON.parse(m[0]));
      } catch (e) {
        if (e.message.startsWith('返回格式错误')) { done(reject, e); return; }
        const m = stdout.match(/\{[\s\S]*\}/);
        if (m) { try { done(resolve, JSON.parse(m[0])); return; } catch {} }
        done(reject, new Error('无法解析: ' + stdout.substring(0, 200)));
      }
    });
  });
}

app.whenReady().then(() => {
  win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.maximize();
  win.show();
  win.loadFile('index.html');
});
app.on('window-all-closed', () => app.quit());

const dataFile = path.join(app.getPath('userData'), 'bazi-persons.json');

ipcMain.handle('auto-load', () => {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return []; }
});

ipcMain.handle('auto-save', (_, data) => {
  fs.writeFileSync(dataFile, JSON.stringify(data), 'utf8');
});

ipcMain.handle('upload-avatar', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const buf = fs.readFileSync(filePaths[0]);
  const ext = path.extname(filePaths[0]).slice(1).replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${buf.toString('base64')}`;
});

ipcMain.handle('save-data', async (_, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    filters: [{ name: 'JSON', extensions: ['json'] }], defaultPath: 'bazi-data.json'
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('load-data', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  return JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
});

// ===== 排盘 =====
const PAIPAN_PROMPT = (info) => `你是精通中国传统八字命理学和易经的命理大师，精通万年历、天干地支推算、藏干、十神、纳音、神煞、大运排法。
严格按照传统命理学规则进行八字排盘：
1. 准确将公历转农历，正确推算四柱（月柱以节气为准）
2. 十神以日干为主推算与其他干支的关系
3. 藏干按地支藏干规则（本气、中气、余气）
4. 地势按十二长生推算日干在各地支的状态
5. 大运根据性别和年干阴阳决定顺逆，从月柱起排，排8个大运
6. 起运岁数=出生日到最近节气天数÷3

请为以下信息排盘：
姓名：${info.name}
性别：${info.gender}
出生日期：公历${info.year}年${info.month}月${info.day}日
出生时辰：${info.hour}
出生地：${info.birthplace}
常居地：${info.residence}

只返回有效JSON，不要任何其他文字。请返回如下JSON（所有字段必须填写，不要省略）：
{
  "pillars":{"year":{"stem":"天干","branch":"地支"},"month":{"stem":"","branch":""},"day":{"stem":"","branch":""},"hour":{"stem":"","branch":""}},
  "tenGods":{"yearStem":"十神","yearBranch":"地支藏干主气对应十神","monthStem":"十神","monthBranch":"","dayStem":"日主","dayBranch":"","hourStem":"","hourBranch":""},
  "hiddenStems":{"year":["藏干1","藏干2"],"month":[""],"day":[""],"hour":[""]},
  "hiddenStemGods":{"year":["对应十神"],"month":[""],"day":[""],"hour":[""]},
  "earthPhase":{"year":"十二长生","month":"","day":"","hour":""},
  "selfSitting":"日柱自坐描述",
  "spirits":{"year":["神煞名"],"month":[""],"day":[""],"hour":[""]},
  "dayMaster":{"stem":"日干","element":"五行","yinYang":"阴或阳","strength":"身强或身弱及原因"},
  "nayin":{"year":"纳音","month":"","day":"","hour":""},
  "majorLuck":[{"startAge":3,"endAge":12,"stem":"天干","branch":"地支","startYear":2000}],
  "fiveElements":{"木":0,"火":0,"土":0,"金":0,"水":0}
}`;

ipcMain.handle('paipan', async (_, info) => {
  return await callClaude(PAIPAN_PROMPT(info));
});

// ===== 推理 =====
const TUILI_PROMPT = (chart, info) => `你是精通中国传统八字命理学和易经的命理大师。根据八字排盘结果，运用命理学和易经理论进行全面命理分析。
要求：结合日主强弱、用神忌神、十神组合、地势自坐神煞综合判断。分析幼时少年中年晚年各阶段。大运逐个分析。使用专业命理术语（比肩偏财正官等）。给出具体建议。

${info.name}（${info.gender}，公历${info.year}年${info.month}月${info.day}日${info.hour}生）的八字排盘：
${JSON.stringify(chart)}

只返回有效JSON。请返回如下JSON：
{
  "personality":"性格分析（300字以上，引用具体十神五行）",
  "career":"事业分析（200字以上）",
  "wealth":"财运分析",
  "education":"学业分析",
  "love":"爱情姻缘分析",
  "advice":"人生建议（具体可操作）",
  "lifePeriods":{"childhood":"幼时(0-12)","youth":"少年(12-25)","middleAge":"中年(25-50)","oldAge":"晚年(50+)"},
  "majorLuckAnalysis":[{"period":"3-12岁","pillar":"辛丑","theme":"主题","analysis":"详细分析含十神五行","events":"可能事件","advice":"建议"}]
}`;

ipcMain.handle('tuili', async (_, chart, info) => {
  return await callClaude(TUILI_PROMPT(chart, info));
});

// ===== 流年批量 =====
const LIUNIAN_PROMPT = (chart, info, startYear, endYear) => `你是八字命理大师，用通俗易懂的白话文分析${startYear}-${endYear}年流年运势。不要用晦涩的命理术语，用普通人能听懂的话来说。

${info.name}（${info.gender}，${info.year}年${info.month}月${info.day}日${info.hour}）八字：
${JSON.stringify(chart)}

要求：白话通俗，像朋友聊天一样。每年总评50字以内，每月一句大白话。只返回有效JSON：
{"years":[{"year":${startYear},"stem":"天干","branch":"地支","overview":"年度总评(50字白话)","themes":["主题"],"analysis":"通俗分析(80字白话)","advice":"实用建议(30字)","months":[{"month":1,"name":"正月","stem":"天干","branch":"地支","summary":"一句大白话","rating":"吉或平或凶"}]}]}`;

ipcMain.handle('liunian-batch', async (_, chart, info, startYear, endYear) => {
  return await callClaude(LIUNIAN_PROMPT(chart, info, startYear, endYear));
});

// ===== 六爻占卜 =====
const DIVINE_PROMPT = (question, lines) => {
  const posNames = ['初爻','二爻','三爻','四爻','五爻','上爻'];
  const typeNames = {6:'老阴（变爻）',7:'少阳',8:'少阴',9:'老阳（变爻）'};
  let lineDesc = '';
  lines.forEach((v, i) => { lineDesc += `${posNames[i]}：${typeNames[v]}（数值${v}）\n`; });

  return `你是精通易经六爻占卜的大师。请根据以下摇卦结果进行详细的六爻分析。

问题：${question}

摇卦结果（从初爻到上爻）：
${lineDesc}

请严格按照六爻规则：
1. 根据数值确定阴阳和动爻（6=老阴变爻，7=少阳，8=少阴，9=老阳变爻）
2. 从初爻到上爻组成本卦（下三爻为下卦，上三爻为上卦）
3. 动爻变化后得变卦（无动爻则无变卦）
4. 装六亲、世应、分析用神

只返回有效JSON：
{
  "originalHex":"本卦名（如：天火同人）",
  "changedHex":"变卦名（无变爻则为空字符串）",
  "originalUpper":"上卦名",
  "originalLower":"下卦名",
  "lines":[
    {"position":"初爻","value":7,"yinYang":"阳或阴","changing":false,"sixRelative":"六亲（父母/兄弟/子孙/妻财/官鬼）","note":"简要说明"}
  ],
  "worldLine":"世爻位置（如：四爻）",
  "responseLine":"应爻位置",
  "analysis":"详细分析（400字以上，结合卦象、爻辞、六亲、世应、用神、动爻变化综合判断）",
  "conclusion":"结论（针对问题直接回答）",
  "advice":"建议（具体可操作）"
}`;
};

ipcMain.handle('divine', async (_, question, lines) => {
  return await callClaude(DIVINE_PROMPT(question, lines));
});

const divineFile = path.join(app.getPath('userData'), 'divine-history.json');

ipcMain.handle('divine-history-load', () => {
  try { return JSON.parse(fs.readFileSync(divineFile, 'utf8')); } catch { return []; }
});

ipcMain.handle('divine-history-save', (_, data) => {
  fs.writeFileSync(divineFile, JSON.stringify(data), 'utf8');
});

// ===== PDF导出 =====
ipcMain.handle('export-pdf', async (_, html, name) => {
  const tmpFile = path.join(os.tmpdir(), `bazi_pdf_${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf8');

  const pdfWin = new BrowserWindow({ show: false, width: 794, height: 1123 });
  await pdfWin.loadFile(tmpFile);
  await new Promise(r => setTimeout(r, 800));

  const buf = await pdfWin.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { top: 0.4, bottom: 0.4, left: 0.5, right: 0.5 }
  });
  pdfWin.close();
  try { fs.unlinkSync(tmpFile); } catch {}

  const dir = 'F:\\八字';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}-八字命盘.pdf`);
  fs.writeFileSync(filePath, buf);
  return filePath;
});
