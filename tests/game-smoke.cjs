const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { artifactPath } = require('./artifacts.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'typist-game-'));
process.env.TYPIST_TEST_USER_DATA = dir;
app.setAppPath(path.resolve(__dirname, '..'));
require('../dist/main/index');

const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => { console.error('Game smoke timed out'); app.exit(1); }, 40000);

app.whenReady().then(async () => {
  try {
    await wait(800);
    const main = BrowserWindow.getAllWindows()[0];
    const call = code => main.webContents.executeJavaScript(code);
    const click = async selector => {
      await call(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await wait();
    };
    const key = keyCode => {
      main.webContents.sendInputEvent({ type: 'keyDown', keyCode });
      main.webContents.sendInputEvent({ type: 'keyUp', keyCode });
    };
    const keys = async code => {
      for (const letter of code) key(letter === ' ' ? 'Space' : letter);
      await wait();
    };
    const read = selector => call(`document.querySelector(${JSON.stringify(selector)}).textContent`);
    const phase = () => read('.game-status');
    const focus = async () => {
      app.focus({ steal: true });
      main.show();
      main.focus();
      await wait();
    };
    const ensureRunning = async () => {
      for (let attempt = 0; attempt < 12; attempt++) {
        if (await phase() === '游戏中' && main.isFocused()) return;
        await focus();
        if (await phase() === '已暂停') await click('[data-game=resume]');
      }
      assert.equal(await phase(), '游戏中');
    };
    const capture = async name => {
      fs.writeFileSync(artifactPath(`typist-defense-${name}.png`), (await main.webContents.capturePage()).toPNG());
    };
    const select = (label, value) => call(`(() => {
      const element = document.querySelector('[aria-label="${label}"]');
      element.value = '${value}';
      element.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const snapshot = async () => (await call('window.typist.getSnapshot()')).value;
    const before = await snapshot();

    await click('.studio-header [data-page=settings]');
    assert.equal(await call('document.querySelector(".settings-page").innerText.includes("游戏难度")'), false);
    await click('.studio-logo');
    await click('[data-page=game]');
    assert.equal(await call('!!document.querySelector("[aria-label=游戏难度]")'), false);
    assert.match(await read('.mission-options'), /难度标准/);
    const briefingFits = () => call(`(() => {
      const overlay = document.querySelector('.briefing');
      const bounds = overlay.getBoundingClientRect();
      const card = overlay.querySelector('.mission-card').getBoundingClientRect();
      return bounds.left === 0 && bounds.top === 0 && bounds.right === innerWidth &&
        Math.abs(bounds.bottom - innerHeight) < 2 && card.left >= bounds.left &&
        card.right <= bounds.right && overlay.scrollWidth === overlay.clientWidth;
    })()`);
    assert.ok(await briefingFits(), 'briefing fills the default window without clipping the card');
    const [initialWidth, initialHeight] = main.getSize();
    main.setSize(760, 640);
    await wait();
    assert.ok(await briefingFits(), 'briefing fits the minimum window');
    main.setSize(initialWidth, initialHeight);
    await wait();
    await select('游戏时长', '2');
    await capture('briefing');

    await call('window.gameNow=0; Object.defineProperty(performance, "now", {value: () => window.gameNow}); true');
    const clock = async time => { await call(`window.gameNow=${time}`); await wait(); };
    const fullViewport = () => call(`(() => {
      const arena = document.querySelector('.game-arena').getBoundingClientRect();
      const hud = document.querySelector('.combat-hud').getBoundingClientRect();
      const ship = document.querySelector('.player').getBoundingClientRect();
      const plumes = [...document.querySelectorAll('.player .exhaust')].map(e => e.getBoundingClientRect());
      const target = document.querySelector('.enemy-ship')?.getBoundingClientRect();
      return arena.x === 0 && arena.y === 0 && arena.width === innerWidth && Math.abs(arena.height-innerHeight)<2 &&
        hud.right <= innerWidth && ship.bottom < innerHeight && plumes.every(p => p.bottom <= innerHeight) &&
        (!target || target.top >= hud.bottom) && document.documentElement.scrollWidth <= innerWidth &&
        !document.querySelector('.studio-header,.game-panel .practice-options,.game-panel .practice-stats');
    })()`);

    await focus();
    await click('[data-game=start]');
    if (await phase() === '已暂停') await click('[data-game=resume]');
    else assert.equal(await phase(), '准备中');
    await clock(5100);
    await ensureRunning();
    assert.equal(await call('document.activeElement.getAttribute("aria-label")'), '游戏编码');
    assert.equal(await read('[data-game=defense]'), '10 / 10');
    assert.equal((await snapshot()).settings.duration, 2);
    assert.equal(await call('document.querySelector(".game-panel").innerText.includes("准确率")'), false);
    await capture('default');
    assert.ok(await fullViewport(), JSON.stringify(await call(`[innerWidth,innerHeight,document.documentElement.scrollWidth,...['.game-arena','.combat-hud','.player','.player .exhaust','.enemy-ship'].map(s=>document.querySelector(s)?.getBoundingClientRect().toJSON())]`)));
    assert.ok(await call('[".player-ship",".enemy-ship",".defense-line",".asteroids"].every(s => document.querySelector(s).naturalWidth > 0)'));

    await ensureRunning();
    await keys('ab');
    assert.equal(await read('[data-game=letters]'), 'ab');
    key('Escape');
    await wait();
    assert.equal(await phase(), '已暂停');
    assert.equal(await read('[data-game=letters]'), '—');
    const frozen = () => call(`JSON.stringify([
      document.querySelector('[data-game=time]').textContent,
      ...[...document.querySelectorAll('.game-target')].map(e=>e.style.top)
    ])`);
    const state = await frozen();
    await clock(13000);
    await keys('abcd');
    assert.equal(await frozen(), state);
    assert.equal(await call('getComputedStyle(document.querySelector(".player .exhaust")).animationPlayState'), 'paused');
    await capture('paused');
    await focus();
    key('Escape');
    await wait();
    assert.equal(await phase(), '游戏中');
    assert.equal(await call('document.activeElement.getAttribute("aria-label")'), '游戏编码');
    assert.equal(await frozen(), state);
    const word = await call('document.querySelector(".game-target").dataset.word');
    const code = await call(`(async () => {
      for (let offset=0; ; offset+=200) {
        const {value} = await window.typist.getCourse({course:"1",offset,limit:200});
        const item = value.items.find(i => i.word === ${JSON.stringify(word)});
        if (item) return item.codes[0];
        if (offset+200>=value.total) throw Error("Missing target");
      }
    })()`);
    await call('document.activeElement.dispatchEvent(new Event("paste", {bubbles:true,cancelable:true}))');
    assert.equal(await read('[data-game=score]'), '0');
    await keys(code.length === 4 ? code : code + ' ');
    assert.equal(await read('[data-game=score]'), '100');
    assert.equal(await read('[data-game=combo]'), '1');
    assert.ok(await call('!!document.querySelector(".shot.bullet,.muzzle")'));
    await clock(13295);
    if (await phase() === '已暂停') {
      await ensureRunning();
      if (await call('!!document.querySelector(".shot.bullet")')) await clock(13590);
    }
    assert.ok(await call('!!document.querySelector(".shot.blast,.shot-points")'));
    await capture('explosion');

    await click('[data-game=pause]');
    await click('[data-game=exit]');
    assert.ok(await call('!!document.querySelector("[aria-label=游戏课程]") && !document.querySelector(".combat-hud")'));
    assert.deepEqual((await snapshot()).learning, before.learning);
    assert.match(await read('.game-panel [data-page=home]'), /返回主界面/);
    await click('.game-panel [data-page=home]');
    assert.ok(await call('!!document.querySelector(".studio-home") && !!document.querySelector(".studio-header [aria-label=主导航]")'));
    await click('[data-page=game]');

    const write = async (method, value) => {
      const { revision } = await call('window.typist.getSnapshot()');
      const response = await call(`window.typist.${method}(${JSON.stringify({ requestId: crypto.randomUUID(), expectedRevision: revision, value })})`);
      assert.equal(response.ok, true, JSON.stringify(response));
    };
    await write('mutateSupplemental', [
      { kind: 'add', entry: { word: '游戏同步测试词', code: 'abcd', level: 5 } },
      { kind: 'add', entry: { word: '防线同步测试词', code: 'wxyz', level: 5 } },
    ]);
    await write('addVocabularyText', '游戏同步测试词 防线同步测试词');
    await select('游戏课程', 'vocabulary');
    await focus();
    await click('[data-game=start]');
    if (await phase() === '已暂停') await click('[data-game=resume]');
    await clock(18700);
    await ensureRunning();
    assert.equal(await call('document.querySelectorAll(".game-target").length'), 2);
    main.setContentSize(1120, 630);
    await wait();
    assert.ok(await fullViewport(), '16:9 viewport fits');
    await capture('widescreen');
    main.setSize(760, 640);
    await wait();
    await ensureRunning();
    assert.ok(await fullViewport(), 'minimum viewport fits');
    await capture('narrow');
    await ensureRunning();
    await keys('abcdwxyz');
    assert.equal(await read('[data-game=combo]'), '2');
    assert.equal(await read('[data-game=score]'), '200');
    await clock(21300);
    assert.ok(await call('!!document.querySelector(".game-target")'));

    await call('window.typist.openText()');
    await wait(300);
    const text = BrowserWindow.getAllWindows().find(win => win !== main);
    if (text.webContents.isLoading()) await new Promise(resolve => text.webContents.once('did-finish-load', resolve));
    const { revision } = await call('window.typist.getSnapshot()');
    const removed = await text.webContents.executeJavaScript(`window.typist.deleteVocabulary({
      requestId: 'game-remove', expectedRevision: ${revision},
      value: {words: ['游戏同步测试词', '防线同步测试词'], pairs: []}
    })`);
    assert.equal(removed.ok, true);
    await wait(350);
    assert.equal(await phase(), '本次游戏结束');
    assert.equal(await read('[data-game=correct]'), '2');
    assert.match(await read('.results'), /准确率100\.0%/);
    await capture('results');
    const after = await snapshot();
    assert.deepEqual(after.learning, before.learning);
    assert.deepEqual(after.courseProgress, before.courseProgress);
    await click('[data-game=exit]');
    assert.ok(await call('!!document.querySelector(".briefing")'));
    await write('addVocabularyText', '游戏同步测试词');
    await focus();
    await click('[data-game=start]');
    await clock(26700);
    await ensureRunning();
    await keys('abcd');
    assert.equal(await read('[data-game=score]'), '100');
    await click('[data-game=pause]');
    await call('window.confirm=()=>true; true');
    await click('[data-game=restart]');
    assert.equal(await read('[data-game=score]'), '0');
    assert.equal(await read('[data-game=combo]'), '0');
    if (await phase() !== '已暂停') await click('[data-game=pause]');
    await click('[data-game=exit]');
    console.log('PASS immersive viewport, ESC freeze and resume, short/four-key input, battle effects, exit, course sync, results and learning isolation');
    clearTimeout(deadline);
    app.quit();
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
app.on('quit', () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
