/* Optional browser regression: requires Playwright and an installed Chromium browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const XLSX = require('../assets/js/vendor/xlsx.full.min.js');
const root = path.resolve(__dirname, '..');
const artifacts = process.env.ISPD_QA_DIR;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true, ...(process.env.ISPD_BROWSER_PATH ? {executablePath:process.env.ISPD_BROWSER_PATH} : {channel:'chrome'})});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1050}, acceptDownloads:true});
    await context.addInitScript(() => { window.print = () => {}; });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/analyzer/`);
    await page.evaluate(() => {
      window.qa = {calls:0};
      ['compute','computeSingle'].forEach(key => {
        const original = ISPD[key];
        ISPD[key] = function(...args) { qa.calls++; return original.apply(this,args); };
      });
      ['drawVtChart','drawEtNtChart'].forEach(key => {
        const original = ChartRenderer[key];
        ChartRenderer[key] = function(canvas,sets,colors) {
          qa[key] = {sets:JSON.parse(JSON.stringify(sets)),colors:colors.slice()};
          return original.apply(this,arguments);
        };
      });
    });
    const rows = [['Time','Potential'], ...Array.from({length:60}, (_,i) => {
      const t = 10 + i*45; return [t, 250 + 900*Math.exp(-t/120) + 600*Math.exp(-t/2400)];
    })];
    for (const ext of ['csv','xlsx','xls']) {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'Data');
      const buffer = Buffer.from(XLSX.write(book,{type:'array',bookType:ext === 'xls' ? 'biff8' : ext}));
      await page.locator('#file-input').setInputFiles({name:`original.${ext}`,mimeType:'application/octet-stream',buffer});
      await page.waitForFunction(n => document.querySelectorAll('.legend-name').length === n, ['csv','xlsx','xls'].indexOf(ext)+1);
    }
    const editor = name => page.locator(`.legend-name[data-filename="${name}"]`);
    await editor('original.csv').fill('DC 30 s');
    await page.locator('#btn-compute').click();
    await page.waitForFunction(() => document.querySelectorAll('#result-tbody tr').length === 3 && window.qa.drawEtNtChart);
    const before = await page.evaluate(() => ({qa:JSON.parse(JSON.stringify(qa)), table:document.getElementById('result-tbody').textContent,
      svg:ChartRenderer.exportVtSvg(qa.drawVtChart.sets,qa.drawVtChart.colors)}));
    assert.equal(before.qa.calls,3);
    const custom = '样品A <正极> & 60 s';
    await editor('original.csv').fill(custom);
    await editor('original.xlsx').fill('DC 75 s');
    await editor('original.xls').fill('DC 75 s');
    const after = await page.evaluate(() => ({qa:JSON.parse(JSON.stringify(qa)),table:document.getElementById('result-tbody').textContent,
      svg:ChartRenderer.exportVtSvg(qa.drawVtChart.sets,qa.drawVtChart.colors)}));
    assert.equal(after.qa.calls,3,'Rename must not recompute');
    assert.equal(after.table,before.table,'Numeric table must not change');
    for (const chart of ['drawVtChart','drawEtNtChart']) {
      const stripLabels = state => state.sets.map(({label,...rest}) => rest);
      assert.deepEqual(stripLabels(before.qa[chart]),stripLabels(after.qa[chart]));
      assert.deepEqual(after.qa[chart].colors,before.qa[chart].colors);
      assert.deepEqual(after.qa[chart].sets.map(s => s.label),[custom,'DC 75 s','DC 75 s']);
    }
    const geometry = svg => svg.match(/<(?:polyline|circle|path|line)\b[^>]*>/g);
    assert.deepEqual(geometry(before.svg),geometry(after.svg),'Vector geometry must not change');
    for (const tab of [0,1]) {
      await page.locator(`.tab-btn[data-tab="${tab}"]`).click();
      const downloadPromise = page.waitForEvent('download');
      await page.locator(`#tbtn-svg${tab+1}`).click();
      const download = await downloadPromise, svg = fs.readFileSync(await download.path(),'utf8');
      assert(svg.includes('样品A &lt;正极&gt; &amp; 60 s'));
      assert(!svg.includes('original.') && !svg.includes('R²='));
      const pngPromise = page.waitForEvent('download');
      await page.locator(`#tbtn-png${tab+1}`).click();
      const png = fs.readFileSync(await (await pngPromise).path());
      assert.equal(png.subarray(1,4).toString(),'PNG');
      const popupPromise = page.waitForEvent('popup');
      await page.locator(`#tbtn-pdf${tab+1}`).click();
      const popup = await popupPromise;
      await popup.waitForSelector('svg');
      assert((await popup.locator('svg').textContent()).includes(custom));
      await popup.close();
    }
    await editor('original.csv').fill('   ');
    assert.equal(await page.evaluate(() => qa.drawVtChart.sets[0].label),'original.csv');
    await page.locator('.legend-reset[data-filename="original.xlsx"]').click();
    assert.equal(await editor('original.xlsx').inputValue(),'original.xlsx');
    const longName = '这是用于验证自由图例名称不会被截断的较长中文样品名称_75秒';
    await editor('original.csv').fill(longName);
    await page.evaluate(() => ISPD_I18N.setLanguage('en'));
    assert.equal(await editor('original.csv').inputValue(),longName);
    const longSvg = await page.evaluate(() => ChartRenderer.exportVtSvg(qa.drawVtChart.sets,qa.drawVtChart.colors));
    const texts = [...longSvg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map(m => m[1]).join('');
    assert(texts.includes(longName),'Long legend must wrap without truncation');
    await page.locator('label').filter({has:page.locator('input[name="fit-model"][value="single"]')}).click();
    assert.equal(await editor('original.csv').inputValue(),longName);
    await page.locator('#btn-compute').click();
    await page.waitForFunction(() => qa.calls === 6 && document.querySelectorAll('#result-tbody tr').length === 3);
    await editor('original.csv').fill('DC 30 s');
    await editor('original.xlsx').fill('DC 60 s');
    await page.evaluate(() => ISPD_I18N.setLanguage('zh'));
    if (artifacts) {
      fs.mkdirSync(artifacts,{recursive:true});
      await page.screenshot({path:path.join(artifacts,'legend-ui.png'),fullPage:true});
    }
    await page.locator('#file-list input[type="checkbox"][data-filename="original.xls"]').uncheck();
    await page.locator('#btn-compute').click();
    await page.waitForFunction(() => qa.calls === 8 && document.querySelectorAll('#result-tbody tr').length === 2);
    assert.deepEqual(await page.evaluate(() => qa.drawVtChart.sets.map(s => s.label)),['DC 30 s','DC 60 s']);
    await page.locator('.remove-file[data-filename="original.xlsx"]').click();
    assert.equal(await page.locator('.legend-name').count(),2);
    await page.locator('#btn-clear-files').click();
    assert.equal(await page.locator('.legend-name').count(),0);
    assert.deepEqual(errors,[]);
    console.log('Editable legends browser regression: PASS (CSV/XLSX/XLS, no refit, SVG/PNG/PDF, reset, language/model, filtering)');
  } finally { await browser.close(); }
}
main().catch(error => {console.error(error);process.exitCode=1;}).finally(() => server.close());
