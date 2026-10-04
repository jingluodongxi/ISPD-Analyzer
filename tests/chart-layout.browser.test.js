// Optional real-data UI QA. Data stays local and is never added to the repository.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'..');
const dataDir = process.env.ISPD_TEST_DATA_DIR;
if (!dataDir) throw new Error('Set ISPD_TEST_DATA_DIR to the seven local measurement workbooks.');
const files = fs.readdirSync(dataDir).filter(n => !n.startsWith('~') && n.endsWith('.xlsx')).sort((a,b) => Number(a.split(',')[1].replace('s',''))-Number(b.split(',')[1].replace('s','')));
assert.equal(files.length,7);
const output = process.env.ISPD_QA_DIR;
if (output) fs.mkdirSync(output,{recursive:true});
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  const file = path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
  if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(file,(err,data) => {
    if (err) {res.writeHead(404).end();return;}
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream');res.end(data);
  });
});
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(()=>{window.print=()=>{};});
    const page = await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/analyzer/`);
    await page.evaluate(()=>{
      window.qa={calls:0};
      for(const key of ['compute','computeSingle']) {
        const orig=ISPD[key]; ISPD[key]=function(...args){qa.calls++;return orig(...args);};
      }
      for(const key of ['drawVtChart','drawEtNtChart']) {
        const orig=ChartRenderer[key];ChartRenderer[key]=function(canvas,sets,colors,...rest){
          qa[key]={sets:JSON.parse(JSON.stringify(sets)),colors:colors.slice()};return orig(canvas,sets,colors,...rest);
        };
      }
    });
    for(const name of files) {
      await page.locator('#file-input').setInputFiles(path.join(dataDir,name));
      await page.waitForFunction(n=>document.querySelectorAll('.legend-name').length===n,files.indexOf(name)+1);
    }
    for(const [i,name] of files.entries()) await page.locator('.legend-name').nth(i).fill(name.split(',')[1].replace('s',' s'));
    await page.locator('#input-T').fill('297');await page.locator('#input-epsr').fill('2.1');await page.locator('#input-d').fill('100');
    await page.locator('#btn-compute').click();
    await page.waitForFunction(()=>qa.calls===7 && document.querySelectorAll('#result-tbody tr').length===7);
    const numeric = await page.evaluate(()=>JSON.stringify([qa.drawVtChart,qa.drawEtNtChart]));

    async function inspectSvg(svg) {
      return page.evaluate(svg=>{
        const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;';
        host.innerHTML=svg.replace(/^<\?xml[^>]*>\s*/,'');document.body.appendChild(host);
        const s=host.querySelector('svg'), w=+s.getAttribute('width'),h=+s.getAttribute('height');
        const clip=s.querySelector('clipPath rect'),right=+clip.getAttribute('x')+(+clip.getAttribute('width'));
        const issues=[];
        for(const t of s.querySelectorAll('text')) {
          let b=t.getBBox();
          const m=t.getCTM(), points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));
          if(points.some(p=>p.x< -1||p.y< -1||p.x>w+1||p.y>h+1))issues.push('text clipped: '+t.textContent);
        }
        const swatches=[...s.querySelectorAll(':scope > rect')].slice(1);
        if(swatches.length!==7)issues.push('missing legend entries');
        if(swatches.some(r=>+r.getAttribute('x')<=right))issues.push('legend overlaps plot');
        const texts=[...s.querySelectorAll('text')].map(t=>t.textContent).join('');
        host.remove();return {issues,w,h,texts};
      },svg);
    }
    for(const lang of ['zh','en']) {
      await page.evaluate(lang=>ISPD_I18N.setLanguage(lang),lang);
      assert.equal(await page.evaluate(()=>JSON.stringify([qa.drawVtChart,qa.drawEtNtChart])),numeric);
      for(const tab of [0,1]) {
        await page.locator(`.tab-btn[data-tab="${tab}"]`).click();
        const promise=page.waitForEvent('download');await page.locator(`#tbtn-svg${tab+1}`).click();
        const svg=fs.readFileSync(await (await promise).path(),'utf8'), report=await inspectSvg(svg);
        assert.deepEqual(report.issues,[]);
        if(lang==='en') assert(!/[\u4e00-\u9fff]/.test(report.texts));
        if(output)fs.writeFileSync(path.join(output,`${lang}-${tab}.svg`),svg);
        const pngPromise=page.waitForEvent('download');await page.locator(`#tbtn-png${tab+1}`).click();
        const png=await pngPromise;assert.equal(fs.readFileSync(await png.path()).subarray(1,4).toString(),'PNG');
        const popupPromise=page.waitForEvent('popup');await page.locator(`#tbtn-pdf${tab+1}`).click();
        const popup=await popupPromise;await popup.waitForSelector('svg');
        assert.equal((await popup.locator('svg').textContent()).includes('Surface Trap Energy Distribution'),lang==='en'&&tab===1);
        if(output)await popup.pdf({path:path.join(output,`${lang}-${tab}.pdf`),preferCSSPageSize:true});
        await popup.close();
        if(output) await page.screenshot({path:path.join(output,`${lang}-${tab}.png`)});
      }
    }
    // Browser zoom-equivalent CSS viewport and DPR at each physical window size.
    const cdp=await context.newCDPSession(page);
    for(const width of [1024,1440,1920]) for(const zoom of [1,1.25,1.5]) {
      await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(width/zoom),height:Math.round(1000/zoom),deviceScaleFactor:zoom,mobile:false});
      for(const tab of [0,1]) {
        await page.locator(`.tab-btn[data-tab="${tab}"]`).click();
        await page.waitForTimeout(180);
        const svg=await page.evaluate(tab=>{
          const key=tab?'drawEtNtChart':'drawVtChart',q=qa[key],canvas=document.querySelector(`#chart${tab+1}-canvas`);
          return ChartRenderer[tab?'exportEtNtSvg':'exportVtSvg'](q.sets,q.colors,{width:parseFloat(canvas.style.width),height:Math.max(420,canvas.parentElement.clientHeight)});
        },tab);
        assert.deepEqual((await inspectSvg(svg)).issues,[],`viewport ${width} zoom ${zoom} tab ${tab}`);
      }
    }
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    const longName='样品 <A> & PTFE 自由名称 '.repeat(30);
    for(let i=0;i<7;i++)await page.locator('.legend-name').nth(i).fill(`${longName}${i}`);
    const longSvg=await page.evaluate(()=>ChartRenderer.exportEtNtSvg(qa.drawEtNtChart.sets,qa.drawEtNtChart.colors));
    const report=await inspectSvg(longSvg);assert.deepEqual(report.issues,[]);assert(report.h>800);assert(report.texts.includes(longName+'6'));
    const popupPromise=page.waitForEvent('popup');await page.locator('#tbtn-pdf2').click();
    const popup=await popupPromise;await popup.waitForSelector('svg');
    const dimensions=await popup.locator('svg').evaluate(s=>({h:s.getBoundingClientRect().height,w:s.getBoundingClientRect().width}));
    assert(Math.abs(dimensions.h/dimensions.w-report.h/report.w)<0.001);await popup.close();
    assert(await page.locator('#chart2-container').evaluate(c=>c.scrollHeight>c.clientHeight));
    assert.equal(await page.evaluate(()=>qa.calls),7,'Layout and language must never refit');
    assert.deepEqual(errors,[]);
    console.log('Chart layout/i18n: PASS (7 real datasets, both languages, all exports, 9 viewport/zoom combinations, long legends)');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
