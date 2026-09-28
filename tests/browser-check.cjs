/* Run with Node 20+: node --experimental-websocket tests/browser-check.cjs
   Requires a local preview on :4173 and a temporary headless Chrome on :9223. */
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

(async () => {
  const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const target = targets.find(item => item.type === 'page' && /^(about:blank|http:\/\/localhost:4173)/.test(item.url));
  assert(target, 'Temporary test tab not found');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  const failedRequests = [];
  let domReady = false;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      message.error ? request.reject(message.error) : request.resolve(message.result);
    } else if (message.method === 'Page.domContentEventFired') domReady = true;
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params);
    else if (message.method === 'Network.loadingFailed') failedRequests.push(message.params.errorText);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const waitForDocument = async () => {
    for (let i = 0; i < 80 && !domReady; i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert(domReady, 'Document did not finish loading');
  };
  const scroll = async top => { await evaluate(`window.scrollTo({top:${top},behavior:'instant'})`); await settle(); };
  const viewport = async (width, height) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await settle();
  };
  const output = path.join(os.tmpdir(), 'vilotti-qa');
  await fs.mkdir(output, { recursive: true });
  const screenshot = async name => {
    await evaluate(`Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&getComputedStyle(i).visibility==='visible'}).map(i=>i.decode().catch(()=>{})))`);
    await evaluate(`Promise.all(document.getAnimations().filter(a=>!a.effect?.target?.closest?.('.whatsapp-widget')).map(a=>a.finished.catch(()=>{})))`);
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(output, name + '.png'), Buffer.from(result.data, 'base64'));
  };
  const checks = [];
  const check = (name, condition, detail) => { checks.push({ name, pass: !!condition, detail }); };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await viewport(1440, 1000);
  await send('Page.navigate', { url: 'http://localhost:4173' });
  for (let i = 0; i < 40; i++) {
    if (await evaluate("document.readyState !== 'loading' && !!document.querySelector('.menu-ready')")) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await evaluate('document.fonts.ready.then(()=>true)');
  await settle();
  await screenshot('desktop-hero');
  const resources = await evaluate(`({
    badImages:[...document.images].filter(i=>i.complete && !i.naturalWidth).map(i=>i.src),
    missingAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.getAttribute('href').slice(1))).map(a=>a.href),
    h1:document.querySelectorAll('h1').length,
    fonts:[...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family))],
    schema:JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)
  })`);
  check('Local resources and anchors', !resources.badImages.length && !resources.missingAnchors.length && resources.h1 === 1, resources);
  check('Header initial state', await evaluate("!document.querySelector('.site-header').classList.contains('is-scrolled')"));
  const sizes = [[320,740],[360,800],[390,844],[480,900],[600,900],[768,1024],[1024,900],[1280,800],[1440,1000],[1920,1080],[1440,640]];
  for (const [width,height] of sizes) {
    await viewport(width,height);
    await scroll(0);
    const layout = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&r.width>0&&(r.right>innerWidth+1||r.left< -1)}).map(e=>e.className?.baseVal??e.className).slice(0,20)})`);
    check(`No horizontal overflow ${width}x${height}`, layout.scrollWidth <= width, layout);
    if ([390,768,1440].includes(width) && height >= 700) {
      const grid = await evaluate("({rows:getComputedStyle(document.querySelector('.environment-grid')).gridTemplateRows.split(' ').length,columns:getComputedStyle(document.querySelector('.environment-grid')).gridTemplateColumns.split(' ').length})");
      check(`Environment grid has no implicit rows at ${width}px`,grid.rows===(width>1024?2:3),grid);
    }
    if (width === 390) await screenshot('mobile-hero');
    if (width === 768) await screenshot('tablet-hero');
  }
  await viewport(1440,1000);
  const portfolioStart = await evaluate("scrollY+document.querySelector('#projetos').getBoundingClientRect().top-96");
  await scroll(portfolioStart + 50);
  await screenshot('desktop-portfolio');
  check('Portfolio fits useful viewport', await evaluate("document.querySelector('#projetos').offsetHeight<=innerHeight-document.querySelector('.site-header').offsetHeight+2"));
  for (let index=0;index<5;index++) {
    await evaluate(`document.querySelectorAll('.project-button')[${index}].click()`);
    await settle();
    check(`Portfolio stage ${index+1}`, await evaluate(`document.querySelectorAll('.project-button')[${index}].getAttribute('aria-pressed')==='true'&&document.querySelectorAll('.project-frame')[${index}].getAttribute('aria-hidden')==='false'`));
  }
  const activeProject = () => evaluate("[...document.querySelectorAll('.project-frame')].findIndex(f=>f.classList.contains('is-active'))");
  await evaluate("document.querySelector('.project-next').click()");
  check('Next wraps and updates counter', await activeProject()===0 && await evaluate("document.querySelector('.project-counter').textContent==='01 — 05'"));
  await evaluate("document.querySelector('.project-previous').click()");
  check('Previous wraps', await activeProject()===4);
  await evaluate("document.querySelector('.project-images').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  check('Keyboard navigation', await activeProject()===0);
  check('Only one accessible slide and five unique images', await evaluate("document.querySelectorAll('.project-frame[aria-hidden=false]').length===1&&[...document.querySelectorAll('.project-frame[aria-hidden=true]')].every(f=>f.inert)&&new Set([...document.querySelectorAll('.project-frame img')].map(i=>i.src)).size===5"));
  await viewport(390,844);
  await scroll(await evaluate("scrollY+document.querySelector('.project-images').getBoundingClientRect().top-100"));
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const swipe = async (start,end) => {
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y:300}]});
    await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end,y:300}]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await settle();
  };
  await swipe(280,100);
  check('Touch swipe next', await activeProject()===1);
  await swipe(100,280);
  check('Touch swipe previous', await activeProject()===0);
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await viewport(1440,1000);
  check('Scrolled header and back to top', await evaluate("document.querySelector('.site-header').classList.contains('is-scrolled')&&document.querySelector('.back-to-top').tabIndex===0"));
  for (const [selector,name] of [['#ambientes','desktop-ambientes'],['#processo','desktop-processo'],['#sobre','desktop-sobre'],['#detalhes','desktop-detalhes'],['.project-highlight','desktop-destaque'],['.final-cta','desktop-cta'],['#contato','desktop-contato']]) {
    await scroll(await evaluate(`scrollY+document.querySelector('${selector}').getBoundingClientRect().top-96`));
    await screenshot(name);
  }
  await viewport(390,844);
  await scroll(0);
  await evaluate("document.querySelector('.menu-toggle').click()");
  check('Mobile menu opens and isolates background', await evaluate("document.querySelector('.menu-toggle').getAttribute('aria-expanded')==='true'&&!document.querySelector('.main-nav').inert&&document.querySelector('main').inert&&document.body.classList.contains('menu-open')"));
  check('Mobile menu covers viewport width', await evaluate("document.querySelector('.main-nav').getBoundingClientRect().left===0&&Math.abs(document.querySelector('.main-nav').getBoundingClientRect().width-innerWidth)<=1"));
  await screenshot('mobile-menu');
  await evaluate("document.querySelector('.main-nav a:last-child').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  check('Mobile focus trap', await evaluate("document.activeElement===document.querySelector('.menu-toggle')"));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  check('Escape closes menu', await evaluate("document.querySelector('.main-nav').inert&&!document.querySelector('main').inert&&document.activeElement===document.querySelector('.menu-toggle')"));
  await evaluate("document.querySelector('.menu-toggle').click();document.querySelector('.main-nav a[href=\"#processo\"]').click()");
  await new Promise(resolve=>setTimeout(resolve,1800));
  const anchorState=await evaluate("({menuOpen:document.body.classList.contains('menu-open'),top:document.querySelector('#processo').getBoundingClientRect().top,header:document.querySelector('.site-header').offsetHeight})");
  check('Anchor offset and menu close', !anchorState.menuOpen&&anchorState.top>=anchorState.header&&anchorState.top<anchorState.header+40,anchorState);
  await screenshot('mobile-processo');
  for (const selector of ['#ambientes','#sobre','#detalhes','.project-highlight','.final-cta','#contato']) {
    await scroll(await evaluate(`scrollY+document.querySelector('${selector}').getBoundingClientRect().top-76`));
    const result=await evaluate('document.documentElement.scrollWidth<=innerWidth');
    check('Mobile section overflow '+selector,result);
    await screenshot('mobile-'+selector.replace(/^[#.]/,''));
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await viewport(1440,1000);
  await settle();
  check('Reduced motion preserves single slide', await evaluate("getComputedStyle(document.documentElement).scrollBehavior==='auto'&&getComputedStyle(document.querySelector('.hero-visual img')).animationName==='none'&&document.querySelectorAll('.project-frame[aria-hidden=false]').length===1&&parseFloat(getComputedStyle(document.querySelector('.project-frame')).transitionDuration)<0.01"));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  domReady = false;
  await send('Page.reload');
  await waitForDocument();
  await new Promise(resolve=>setTimeout(resolve,5500));
  check('WhatsApp bubble after five seconds', await evaluate("document.querySelector('.whatsapp-widget').classList.contains('show-bubble')"));
  await new Promise(resolve=>setTimeout(resolve,3200));
  check('WhatsApp bubble hides', await evaluate("!document.querySelector('.whatsapp-widget').classList.contains('show-bubble')"));
  check('No runtime exceptions', errors.length===0,errors);
  const stylesheetAudit=await evaluate(`(()=>{const rules=[...document.styleSheets].filter(s=>s.href?.startsWith(location.origin)).flatMap(s=>[...s.cssRules]);const selectors=[];const walk=rules=>rules.forEach(r=>{if(r.selectorText)selectors.push(r.selectorText);if(r.cssRules)walk([...r.cssRules])});walk(rules);return {ruleCount:selectors.length,unusedClasses:[...new Set(selectors.flatMap(s=>[...s.matchAll(/\\.([a-zA-Z_][\\w-]*)/g)].map(m=>m[1])))].filter(c=>!document.querySelector('.'+c)&&!['is-open','menu-is-open','menu-open','show-bubble','is-passed'].includes(c))}})()`);
  check('Stylesheet class references', !stylesheetAudit.unusedClasses.length,stylesheetAudit);
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await send('Page.reload');
  await new Promise(resolve=>setTimeout(resolve,1500));
  check('Without JavaScript essential content remains available', await evaluate("!document.documentElement.classList.contains('menu-ready')&&getComputedStyle(document.querySelector('.project-frame')).visibility==='visible'&&document.querySelector('.project-navigation').hidden&&getComputedStyle(document.querySelector('.hero-copy')).display!=='none'"));
  await send('Emulation.setScriptExecutionDisabled',{value:false});
  const report={checks,errors,failedRequests,output};
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  socket.close();
  process.exit(checks.some(c=>!c.pass)?1:0);
})().catch(error=>{console.error(error);process.exit(1)});
