// node --experimental-websocket tests/viewport-fit.cjs before|after
// Uses the same local preview (:4173) and temporary Chrome (:9223) as browser-check.cjs.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const phase = process.argv[2] || 'after';
  const out = path.join(os.tmpdir(), 'vilotti-viewport-fit', phase);
  await fs.mkdir(out, { recursive: true });
  const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const target = targets.find(t => t.type === 'page' && /^(about:blank|http:\/\/localhost:4173)/.test(t.url));
  if (!target) throw new Error('Temporary Chrome tab not found');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const settle = async () => {
    await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    await run('document.getAnimations().forEach(a=>{if(Number.isFinite(a.effect.getComputedTiming().endTime))a.finish()})');
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await send('Page.navigate', { url: 'http://localhost:4173/?viewport-fit=' + phase });
  for (let i = 0; i < 80; i++) {
    if (await run("document.readyState!=='loading'&&document.documentElement.classList.contains('menu-ready')")) break;
    await new Promise(r => setTimeout(r, 100));
  }
  await run('document.fonts.ready.then(()=>true)');
  const results = [];
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[390,844],[375,667]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await settle();
    const selectors = await run("[...document.querySelectorAll('main > section, .site-footer')].map(e=>e.id?'#'+e.id:'.'+e.classList[0])");
    const sections = [];
    for (const selector of selectors) {
      await run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});scrollTo({top:e.getBoundingClientRect().top+scrollY-(e.classList.contains('hero')?0:document.querySelector('.site-header').offsetHeight),behavior:'instant'})})()`);
      await settle();
      const metrics = await run(`(()=>{
        const section=document.querySelector(${JSON.stringify(selector)});
        const stage=section.classList.contains('is-enhanced')?section.querySelector('.portfolio-stage'):section;
        const r=stage.getBoundingClientRect(), header=document.querySelector('.site-header').getBoundingClientRect();
        const visible=e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getBoundingClientRect().width>0};
        const text=[...stage.querySelectorAll('h1,h2,h3,p,a,button,figcaption,small,address')].filter(visible);
        const clipped=[];
        for(const e of text){let p=e.parentElement;const er=e.getBoundingClientRect();while(p&&p!==section.parentElement){const s=getComputedStyle(p),pr=p.getBoundingClientRect();if(['hidden','clip'].includes(s.overflowY)&&(er.top<pr.top-2||er.bottom>pr.bottom+2))clipped.push(e.className||e.tagName);p=p.parentElement}}
        const contentTop=Math.min(...text.map(e=>e.getBoundingClientRect().top));
        const contentBottom=Math.max(...text.map(e=>e.getBoundingClientRect().bottom));
        return {selector:section.id||section.classList[0],height:Math.round(r.height),sectionHeight:Math.round(section.offsetHeight),available:innerHeight-(section.classList.contains('hero')?0:header.height),header:header.height,top:Math.round(r.top),contentTop:Math.round(contentTop),contentBottom:Math.round(contentBottom),fits:r.height<=innerHeight-(section.classList.contains('hero')?0:header.height)+2,clipped:[...new Set(clipped)],horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};
      })()`);
      sections.push(metrics);
      if ([1366,390].includes(width)) {
        await run("Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&getComputedStyle(i).visibility==='visible'}).map(i=>i.decode().catch(()=>{})))");
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await fs.writeFile(path.join(out, width+'-'+selector.slice(1)+'.png'), Buffer.from(shot.data, 'base64'));
      }
    }
    results.push({ width, height, sections });
    console.log(width+'x'+height+' '+sections.map(s=>s.selector+':'+s.height+(s.fits?'✓':'↑')).join(' '));
  }
  const report={phase,results,errors,output:out};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('Report: '+path.join(out,'report.json'));
  ws.close();
  const failed = results.some(v=>v.sections.some(s=>s.horizontalOverflow||s.clipped.length||
    (phase==='after'&&v.width>1024&&(!s.fits||s.contentBottom>v.height+2))));
  process.exit(errors.length||failed?1:0);
})().catch(e=>{console.error(e);process.exit(1)});

