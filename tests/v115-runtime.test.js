'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createRuntime}=require('../storm-runtime-v115.js');
test('isolated server loader exposes the actual Classic + Turbo engines',()=>{
 const runtime=createRuntime();
 assert.ok(runtime.scriptCount>=20);
 for(const name of ['SGEngine','SGV6Core','SGV72Core','Vortex83Turbo','Vortex91Core'])
   assert.ok(runtime.engines[name],name);
 assert.equal(typeof runtime.engines.SGEngine.evaluateLegacy,'function');
 assert.equal(typeof runtime.engines.Vortex83Turbo.contextForCopy,'function');
 assert.equal(typeof runtime.engines.Vortex91Core.analyze,'function');
 runtime.setNow(Date.parse('2026-11-16T17:00:00Z'));
 assert.equal(runtime.sandbox.Date.now(),Date.parse('2026-11-16T17:00:00Z'));
});
