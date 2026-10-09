const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('download queue keeps three active and assigns ordered filenames', async () => {
  const data = { 'job:7': { tabId: 7, phase: 'ready', metadata: { title: 'Club / Day' },
    photos: Array.from({ length: 5 }, (_, n) => ({ index: n + 1, photoId: String(n + 1),
      imageUrl: `https://x.fbcdn.net/${n + 1}.jpg`, status: 'resolved' })) } };
  const calls = [];
  const cancelled = [];
  const listeners = {};
  const chrome = {
    storage: {
      session: {
        async get(name) { return name === null ? { ...data } : { [name]: data[name] }; },
        async set(values) { Object.assign(data, values); },
        async remove(name) { delete data[name]; }
      }, local: { async get() { return {}; } }
    },
    downloads: {
      async download(options) { calls.push(options); return calls.length; },
      async cancel(id) { cancelled.push(id); }, onChanged: { addListener(fn) { listeners.download = fn; } }
    },
    alarms: { async create() {}, async clear() {}, onAlarm: { addListener(fn) { listeners.alarm = fn; } } },
    sidePanel: { async setPanelBehavior() {} },
    runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} },
      onMessage: { addListener(fn) { listeners.message = fn; } } },
    tabs: { async get() { return { url: 'https://www.facebook.com/media/set/?set=a.1' }; } }
  };
  const context = vm.createContext({ chrome, FBAD: { ...require('../shared/utils.js'),
    M: require('../shared/messages.js') }, importScripts() {}, console, setTimeout });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8'), context);
  const send = message => new Promise(resolve => listeners.message(message, {}, resolve));
  assert.equal((await send({ type: 'START_DOWNLOAD', tabId: 7, concurrency: 3 })).ok, true);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(c => c.filename), [
    'Facebook Albums/Club _ Day/001.jpg', 'Facebook Albums/Club _ Day/002.jpg',
    'Facebook Albums/Club _ Day/003.jpg'
  ]);
  await listeners.download({ id: 1, state: { current: 'complete' } });
  assert.equal(calls.length, 4);
  await listeners.download({ id: 2, state: { current: 'complete' } });
  assert.equal(calls.length, 5);
  assert.equal(data['job:7'].photos[0].status, 'downloaded');
  await send({ type: 'STOP_JOB', tabId: 7 });
  assert.equal(data['job:7'].phase, 'stopped');
  assert.deepEqual(cancelled, [3, 4, 5]);
});
