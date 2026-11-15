'use strict';
const defaults = {
    brightness: [{minute:0,value:100},{minute:60,value:50},{minute:360,value:50},{minute:420,value:100}],
    colors: [{minute:60,value:'#ff4112'},{minute:420,value:'#dcebff'},{minute:780,value:'#4bafff'},{minute:1140,value:'#ffaa55'},{minute:1380,value:'#ff4112'}]
};
const storageKey = 'hyperhdr-schedule-v1';
const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
function validate(data) {
    for (const kind of ['brightness','colors']) {
        if (!Array.isArray(data?.[kind]) || data[kind].length < 2 || data[kind].length > 100) throw Error('Нужно от 2 до 100 точек каждого типа.');
        const minutes = new Set();
        for (const point of data[kind]) {
            if (!Number.isInteger(point.minute) || point.minute < 0 || point.minute > 1439 || minutes.has(point.minute)) throw Error('Время точек должно быть уникальным, от 00:00 до 23:59.');
            minutes.add(point.minute);
            if (kind === 'brightness' ? !Number.isFinite(point.value) || point.value < 0 || point.value > 100 : !/^#[0-9a-f]{6}$/i.test(point.value)) throw Error('Некорректная яркость или цвет.');
        }
    }
    return {brightness:clone(data.brightness),colors:clone(data.colors)};
}
let schedule = clone(defaults);
try { const saved = localStorage.getItem(storageKey); if (saved) schedule = validate(JSON.parse(saved)); } catch { /* Keep usable defaults if storage is unavailable or invalid. */ }
const sorted = points => [...points].sort((a,b) => a.minute-b.minute);
const time = minute => `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(Math.floor(minute%60)).padStart(2,'0')}`;
const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
function sample(points, minute, color = false) {
    const list = sorted(points);
    minute = ((minute % 1440) + 1440) % 1440;
    let a = list[list.length-1], b = list[0], start = a.minute, end = b.minute + 1440;
    if (minute < b.minute) minute += 1440;
    else for (let i=0;i<list.length-1;i++) if (minute >= list[i].minute && minute < list[i+1].minute) { a=list[i]; b=list[i+1]; start=a.minute; end=b.minute; break; }
    let t = (minute-start)/(end-start);
    if (color) { t=t*t*(3-2*t); const left=rgb(a.value), right=rgb(b.value); return left.map((v,i)=>Math.round(v+(right[i]-v)*t)); }
    return a.value+(b.value-a.value)*t;
}
function status(message) { $('status').textContent=message; }
function save() {
    try { localStorage.setItem(storageKey,JSON.stringify(schedule)); status('Сохранено в этом браузере'); }
    catch { status('Хранилище недоступно — сохраните настройки через экспорт JSON'); }
}
function preview() {
    const minute=Number($('scrub').value), color=sample(schedule.colors,minute,true), brightness=sample(schedule.brightness,minute);
    $('clock').textContent=time(minute);
    $('readout').textContent=`Яркость ${Math.round(brightness)}% · RGB ${color.join(', ')}`;
    $('lamp').style.setProperty('--light',`rgb(${color.join(',')})`);
    $('lamp').style.setProperty('--power',brightness/100);
    const cursor=$('cursor'); if(cursor) cursor.setAttribute('transform',`translate(${50+minute/1440*930},0)`);
    if($('cursor-label')) $('cursor-label').textContent=time(minute);
    $('moment-time').value=time(minute);
    $('moment-brightness').value=Math.round(brightness);
    $('moment-color').value='#'+color.map(c=>c.toString(16).padStart(2,'0')).join('');
}
function drawChart() {
    const x=m=>50+m/1440*930, y=v=>210-v*1.8;
    let svg='';
    for(const v of [0,25,50,75,100]) svg+=`<line x1="50" x2="980" y1="${y(v)}" y2="${y(v)}" stroke="#303737"/><text x="5" y="${y(v)+4}" fill="#9ba8a4" font-size="11">${v}%</text>`;
    for(const m of [0,360,720,1080,1440]) svg+=`<text x="${x(m)}" y="240" text-anchor="middle" fill="#9ba8a4" font-size="11">${time(m)}</text>`;
    const line=[{minute:0,value:sample(schedule.brightness,0)},...sorted(schedule.brightness),{minute:1440,value:sample(schedule.brightness,0)}];
    const path=line.map((p,i)=>`${i?'L':'M'}${x(p.minute)},${y(p.value)}`).join(' ');
    svg+=`<path d="${path} L980,210 L50,210 Z" fill="#c7f59a" opacity="0.07"/><path d="${path}" fill="none" stroke="#c7f59a" stroke-width="3"/>`;
    schedule.brightness.forEach((p,i)=>{svg+=`<circle data-index="${i}" cx="${x(p.minute)}" cy="${y(p.value)}" r="6" fill="#c7f59a" stroke="#191d1d" stroke-width="3"><title>${time(p.minute)} · ${p.value}%</title></circle>`;});
    svg+=`<g id="cursor"><line y1="25" y2="210" stroke="#eef4ef" stroke-dasharray="4 5" pointer-events="none"/><line y1="25" y2="210" stroke="transparent" stroke-width="18" class="timeline-hit"/><rect x="-25" y="2" width="50" height="22" rx="5" fill="#eff4ef" class="timeline-hit"/><text id="cursor-label" y="17" text-anchor="middle" fill="#101313" font-size="12" pointer-events="none"></text></g>`;
    $('chart').innerHTML=svg;
}
function renderPoints(kind) {
    const container=$(kind==='colors'?'color-points':'brightness-points');
    container.replaceChildren();
    sorted(schedule[kind]).forEach(point=>{
        const row=document.createElement('div'); row.className='point';
        const input=document.createElement('input'); input.type='time'; input.value=time(point.minute); input.setAttribute('aria-label','Время точки');
        input.onchange=()=>{
            const parts=input.value.split(':').map(Number), minute=parts[0]*60+parts[1];
            if (!input.value || !Number.isInteger(minute) || schedule[kind].some(p=>p!==point&&p.minute===minute)) { status('Выберите уникальное время точки'); input.value=time(point.minute); return; }
            point.minute=minute; changed();
        };
        const value=document.createElement('input'); value.type=kind==='colors'?'color':'number'; value.value=point.value;
        value.setAttribute('aria-label',kind==='colors'?'Цвет точки':'Яркость в процентах');
        if(kind==='brightness') { value.min=0; value.max=100; value.step=1; }
        value.oninput=()=>{if(kind==='brightness' && (value.value==='' || !value.validity.valid)) return; point.value=kind==='colors'?value.value:Number(value.value); save(); drawChart(); drawGradient(); preview();};
        value.onchange=()=>{if(kind==='brightness' && (value.value==='' || !value.validity.valid)) value.value=point.value;};
        const remove=document.createElement('button'); remove.textContent='×'; remove.title='Удалить точку'; remove.setAttribute('aria-label',`Удалить точку ${time(point.minute)}`); remove.disabled=schedule[kind].length<=2;
        remove.onclick=()=>{schedule[kind]=schedule[kind].filter(p=>p!==point);changed();};
        row.append(input,value); if(kind==='brightness') row.append('%'); row.append(remove);container.append(row);
    });
}
function drawGradient() {
    const stops=[];for(let m=0;m<=1440;m+=10) stops.push(`rgb(${sample(schedule.colors,m,true).join(',')}) ${m/1440*100}%`);
    $('gradient').style.background=`linear-gradient(to right,${stops.join(',')})`;
}
function render() {drawChart();drawGradient();renderPoints('brightness');renderPoints('colors');preview();}
function changed() {save();render();}
function add(kind, preferred=720, value) {
    if(schedule[kind].length>=100) {status('Максимум 100 точек');return;}
    let minute=preferred;
    while(schedule[kind].some(p=>p.minute===minute)) minute=(minute+1)%1440;
    schedule[kind].push({minute,value:value??(kind==='colors'?'#'+sample(schedule.colors,minute,true).map(c=>c.toString(16).padStart(2,'0')).join(''):Math.round(sample(schedule.brightness,minute)))});changed();
}
let drag=null, timelineDrag=false;
function pausePlayback() {
    if(animation!==null) {cancelAnimationFrame(animation);animation=null;}
    $('play').textContent='▶ Проиграть сутки';
}
function selectMinute(minute) {
    pausePlayback();
    $('scrub').value=Math.max(0,Math.min(1439,Math.round(minute)));
    preview();
}
function chartPosition(event) {
    const chart=$('chart'), point=chart.createSVGPoint();
    point.x=event.clientX;point.y=event.clientY;
    return point.matrixTransform(chart.getScreenCTM().inverse());
}
$('chart').onpointerdown=event=>{
    if(event.button!==0)return;
    const {x:px,y:py}=chartPosition(event);
    const cursorHit=Boolean(event.target.closest('#cursor'));
    if(!cursorHit&&(px<50||px>980||py<25||py>210))return;
    pausePlayback();
    if(event.target.dataset.index!==undefined) drag=schedule.brightness[Number(event.target.dataset.index)];
    else {timelineDrag=true;selectMinute((px-50)/930*1440);}
    $('chart').setPointerCapture(event.pointerId);
    event.preventDefault();
};
$('chart').onpointermove=event=>{
    if(!drag&&!timelineDrag)return;
    const {x:px,y:py}=chartPosition(event);
    const minute=Math.max(0,Math.min(1439,Math.round((px-50)/930*1440)));
    if(timelineDrag){selectMinute(minute);return;}
    if(!schedule.brightness.some(p=>p!==drag&&p.minute===minute))drag.minute=minute;
    drag.value=Math.max(0,Math.min(100,Math.round((210-py)/1.8)));
    drawChart();preview();
};
function endDrag(){timelineDrag=false;if(drag){drag=null;changed();}}
$('chart').onpointerup=endDrag;$('chart').onpointercancel=endDrag;$('chart').onlostpointercapture=endDrag;
$('scrub').oninput=()=>selectMinute(Number($('scrub').value));
$('moment-time').onchange=()=>{
    const value=$('moment-time').value;
    if(!/^\d{2}:\d{2}$/.test(value)){preview();return;}
    const [hour,minute]=value.split(':').map(Number);selectMinute(hour*60+minute);
};
for(const id of ['moment-brightness','moment-color']) $(id).onfocus=pausePlayback;
$('apply-moment').onclick=()=>{
    pausePlayback();
    const input=$('moment-brightness'), value=Number(input.value), color=$('moment-color').value;
    if(input.value===''||!input.validity.valid||!Number.isFinite(value)||value<0||value>100||!/^#[0-9a-f]{6}$/i.test(color)) {status('Укажите яркость от 0 до 100 и корректный цвет');return;}
    const minute=Number($('scrub').value);
    for(const kind of ['brightness','colors']) if(!schedule[kind].some(p=>p.minute===minute)&&schedule[kind].length>=100){status('Максимум 100 точек каждого типа');return;}
    for(const [kind,newValue] of [['brightness',value],['colors',color]]) {
        const point=schedule[kind].find(p=>p.minute===minute);
        if(point) point.value=newValue;else schedule[kind].push({minute,value:newValue});
    }
    changed();status(`Настройки на ${time(minute)} сохранены`);
};
let animation=null, previous=0;
$('play').onclick=()=>{
    if(animation!==null){cancelAnimationFrame(animation);animation=null;$('play').textContent='▶ Проиграть сутки';return;}
    $('play').textContent='Ⅱ Пауза';previous=performance.now();let minute=Number($('scrub').value);
    function frame(now){minute=(minute+(now-previous)*1440/24000)%1440;previous=now;$('scrub').value=Math.floor(minute);preview();animation=requestAnimationFrame(frame);}
    animation=requestAnimationFrame(frame);
};
$('add-color').onclick=()=>add('colors',Number($('scrub').value));$('add-brightness').onclick=()=>add('brightness',Number($('scrub').value));
$('reset').onclick=()=>{if(confirm('Вернуть исходное расписание?')){schedule=clone(defaults);changed();}};
function download(name,content,type) {
    const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export-json').onclick=()=>download('HyperHDR-Schedule.json',JSON.stringify(schedule,null,4),'application/json');
$('import').onclick=()=>$('file').click();
$('file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try {if(file.size>100000)throw Error('Файл слишком большой.');schedule=validate(JSON.parse(await file.text()));changed();status('Расписание импортировано');}catch(error){status(`Ошибка импорта: ${error.message}`);}event.target.value='';};
function getHyperHDREndpoint(value) {
    let url;
    try { url=new URL(value.trim()); } catch { throw Error('Укажите полный адрес HyperHDR, например http://localhost:8099/'); }
    if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password||url.search||url.hash||!['/','/json-rpc','/json-rpc/'].includes(url.pathname)) throw Error('Нужен HTTP(S)-адрес с портом, без пароля, параметров и дополнительных путей.');
    return url.origin+'/json-rpc';
}
try { $('hyperhdr-url').value=localStorage.getItem('hyperhdr-url')||'http://localhost:8099/'; } catch { $('hyperhdr-url').value='http://localhost:8099/'; }
function checkHyperHDRAddress() {
    try {
        const endpoint=getHyperHDREndpoint($('hyperhdr-url').value);
        $('hyperhdr-url').setAttribute('aria-invalid','false');
        $('hyperhdr-url-error').hidden=true;
        return endpoint;
    } catch(error) {
        $('hyperhdr-url').setAttribute('aria-invalid','true');
        $('hyperhdr-url-error').textContent=error.message;
        $('hyperhdr-url-error').hidden=false;
        throw error;
    }
}
$('hyperhdr-url').onchange=()=>{
    try {
        const endpoint=checkHyperHDRAddress();
        try {localStorage.setItem('hyperhdr-url',endpoint.replace(/json-rpc$/,''));status('Адрес HyperHDR сохранён для следующих скачиваний');}
        catch {status('Адрес применён; хранилище браузера недоступно');}
    } catch(error) {status(error.message);}
};
function exportScript(testMode=false) {
    const endpoint=checkHyperHDRAddress().replace(/'/g,"''");
    const colorPoints=sorted(schedule.colors).map(p=>`    @{ Minute = ${p.minute}; Value = @(${rgb(p.value).join(',')}) }`).join('\r\n');
    const brightnessPoints=sorted(schedule.brightness).map(p=>`    @{ Minute = ${p.minute}; Value = ${p.value} }`).join('\r\n');
    return `# HyperHDR - exported ${testMode?'24-second test':'daily schedule'}. Windows PowerShell 5.1+
# Run one controller at a time. Press Ctrl+C to stop.
$Url = '${endpoint}'
$Priority = 50
$UpdateSeconds = 1
${testMode?'$CycleSeconds = 24\n$UpdateMs = 50\n':''}
$ColorPoints = @(
${colorPoints}
)
$BrightnessPoints = @(
${brightnessPoints}
)

function Get-ScheduleValue($Points, [double]$Minute, [switch]$Smooth) {
    $a = $Points[-1]
    $b = $Points[0]
    $start = $a.Minute
    $end = $b.Minute + 1440
    if ($Minute -lt $b.Minute) {
        $Minute += 1440
    }
    else {
        for ($i = 0; $i -lt ($Points.Count - 1); $i++) {
            if ($Minute -ge $Points[$i].Minute -and $Minute -lt $Points[$i + 1].Minute) {
                $a = $Points[$i]
                $b = $Points[$i + 1]
                $start = $a.Minute
                $end = $b.Minute
                break
            }
        }
    }
    $t = ($Minute - $start) / ($end - $start)
    if ($Smooth) {
        $t = $t * $t * (3 - 2 * $t)
        $rgb = @()
        for ($c = 0; $c -lt 3; $c++) {
            $rgb += [int][Math]::Round($a.Value[$c] + ($b.Value[$c] - $a.Value[$c]) * $t)
        }
        return ,$rgb
    }
    return $a.Value + ($b.Value - $a.Value) * $t
}

function Send-Request($Body) {
    $response = Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json" -Body ($Body | ConvertTo-Json -Compress) -TimeoutSec 5
    if ($response.success -eq $false) {
        throw ("HyperHDR rejected command: " + ($response | ConvertTo-Json -Compress))
    }
}

${testMode?`function Get-VirtualMinute([double]$ElapsedSeconds) {
    return (($ElapsedSeconds % $CycleSeconds) / $CycleSeconds) * 1440
}

`:''}Write-Host "HyperHDR ${testMode?'24-second test':'schedule'} started. Press Ctrl+C to stop."
${testMode?'$timer = [Diagnostics.Stopwatch]::StartNew()\n':''}
try {
    while ($true) {
        try {
${testMode?'            $minute = Get-VirtualMinute $timer.Elapsed.TotalSeconds':'            $now = Get-Date\n            $minute = $now.Hour * 60 + $now.Minute + $now.Second / 60.0'}
            $color = Get-ScheduleValue $ColorPoints $minute -Smooth
            $brightness = Get-ScheduleValue $BrightnessPoints $minute
            $finalColor = @(foreach ($channel in $color) { [int][Math]::Round($channel * $brightness / 100) })
            # Renew the finite lease even when the color is unchanged.
            Send-Request @{ command = "color"; color = $finalColor; priority = $Priority; duration = 4000 }
        }
        catch {
            Write-Host "Error: $_" -ForegroundColor Red
        }
        Start-Sleep ${testMode?'-Milliseconds $UpdateMs':'-Seconds $UpdateSeconds'}
    }
}
finally {
${testMode?'    $timer.Stop()\n':''}
    try { Send-Request @{ command = "clear"; priority = $Priority } }
    catch { Write-Warning "Could not clear priority: $_" }
}
`.replace(/\r?\n/g,'\r\n');
}
$('export-script').onclick=()=>{
    try {download('HyperHDR-CustomCycle.ps1','\ufeff'+exportScript(),'text/plain;charset=utf-8');}
    catch(error) {status(error.message);$('export-exe').onclick();$('hyperhdr-url').focus();}
};
try { $('show-tray').checked=localStorage.getItem('hyperhdr-show-tray')!=='false'; } catch { $('show-tray').checked=true; }
$('show-tray').onchange=()=>{
    try { localStorage.setItem('hyperhdr-show-tray',String($('show-tray').checked)); }
    catch { status('Настройка трея применена; хранилище браузера недоступно'); }
};
function createExecutable(testMode=false) {
    if(!window.hyperhdrLauncherBase64) throw Error('Шаблон EXE недоступен. Проверьте файл launcher-template.js рядом с приложением.');
    const template=Uint8Array.from(atob(window.hyperhdrLauncherBase64),c=>c.charCodeAt(0));
    const script=new TextEncoder().encode(`# HyperHDR-ShowTray: ${$('show-tray').checked?'true':'false'}\n`+exportScript(testMode));
    const trailer=new Uint8Array(12);
    new DataView(trailer.buffer).setUint32(0,script.length,true);
    trailer.set(new TextEncoder().encode('HHDRPS01'),4);
    return new Blob([template,script,trailer],{type:'application/vnd.microsoft.portable-executable'});
}
$('export-exe').onclick=()=>{
    $('exe-dialog-error').hidden=true;
    $('exe-dialog').showModal();
};
$('close-exe-dialog').onclick=$('cancel-exe-dialog').onclick=()=>$('exe-dialog').close();
$('download-exe').onclick=()=>{
    const testMode=$('exe-mode').value==='preview';
    try {download(testMode?'HyperHDR-DayCycle-Test.exe':'HyperHDR-DayCycle.exe',createExecutable(testMode),'application/vnd.microsoft.portable-executable');$('exe-dialog').close();status(testMode?'Тестовый EXE скачан: сутки за 24 секунды на реальной подсветке. Остановите обычный контроллер перед запуском.':'EXE с текущим расписанием скачан. Инструкция по автозапуску — в разделе «Как запускать».');}
    catch(error){$('exe-dialog-error').textContent=error.message;$('exe-dialog-error').hidden=false;}
};
function showSection(section) {
    const settings=section==='settings';
    if(!settings) pausePlayback();
    $('settings-section').hidden=!settings;
    $('launch-section').hidden=settings;
    for(const name of ['settings','launch']) {
        const tab=$(name+'-tab');
        if(name===section) tab.setAttribute('aria-current','page');
        else tab.removeAttribute('aria-current');
    }
}
$('settings-tab').onclick=()=>showSection('settings');
$('launch-tab').onclick=()=>showSection('launch');
render();
