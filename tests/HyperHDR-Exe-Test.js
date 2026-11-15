// Packaging checks only: never launches the controller or sends device commands.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const elements = new Map();
const context = {
    window: {addEventListener(){}}, Blob, TextEncoder, atob, URL,
    document: { addEventListener(){}, getElementById(id) { if (!elements.has(id)) elements.set(id, {setAttribute(){}}); return elements.get(id); } },
    localStorage: { getItem() { return null; } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'app/launcher-template.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'app/app.js'), 'utf8').replace(/render\(\);\s*$/, ''), context);
const run = code => vm.runInContext(code, context);
async function check() {
    assert.equal(run("getHyperHDREndpoint('http://localhost:8099/')"),'http://localhost:8099/json-rpc');
    assert.equal(run("getHyperHDREndpoint('http://192.168.1.10:8090/json-rpc')"),'http://192.168.1.10:8090/json-rpc');
    assert.equal(run("getHyperHDREndpoint('http://[::1]:8090/')"),'http://[::1]:8090/json-rpc');
    for(const invalid of ['', 'localhost:8099','ftp://localhost/', 'http://localhost:99999/', 'http://user:pass@localhost/', 'http://localhost/other','http://localhost/?x=1'])assert.throws(()=>run(`getHyperHDREndpoint(${JSON.stringify(invalid)})`));
    elements.get('hyperhdr-url').value='http://localhost:8090/';
    assert(run('exportScript()').includes("$Url = 'http://localhost:8090/json-rpc'"));
    const original = '# HyperHDR-ShowTray: true\n'+run('exportScript()');
    const file = Buffer.from(await run('createExecutable()').arrayBuffer());
    assert.equal(file.subarray(0, 2).toString(), 'MZ');
    assert.equal(file.subarray(-8).toString(), 'HHDRPS01');
    const length = file.readUInt32LE(file.length - 12);
    assert.equal(file.subarray(-12 - length, -12).toString('utf8'), original);
    const template = Buffer.from(context.window.hyperhdrLauncherBase64, 'base64');
    assert(file.subarray(0, template.length).equals(template));
    elements.get('show-tray').checked=false;
    const hidden = Buffer.from(await run('createExecutable()').arrayBuffer());
    const hiddenLength = hidden.readUInt32LE(hidden.length-12);
    assert.equal(hidden.subarray(-12-hiddenLength,-12).toString('utf8'),'# HyperHDR-ShowTray: false\n'+run('exportScript()'));
    run("schedule.brightness.push({minute:812,value:37});schedule.colors.push({minute:812,value:'#123456'});");
    const modified = Buffer.from(await run('createExecutable()').arrayBuffer());
    const modifiedLength = modified.readUInt32LE(modified.length - 12);
    const script = modified.subarray(-12 - modifiedLength, -12).toString('utf8');
    assert(script.includes('Minute = 812; Value = 37'));
    assert(script.includes('Minute = 812; Value = @(18,52,86)'));
    assert(!modified.equals(file));
    if (process.argv[2]) fs.writeFileSync(process.argv[2], modified);
    assert(script.includes('$now = Get-Date'));
    assert(script.includes('Start-Sleep -Seconds $UpdateSeconds'));
    assert(!script.includes('$CycleSeconds'));
    context.window.hyperhdrLauncherBase64 = '';
    assert.throws(() => run('createExecutable()'));
    console.log('Passed: PE template, both tray modes, realtime export, custom schedule, missing template.');
}
check().catch(error => { console.error(error); process.exitCode = 1; });
