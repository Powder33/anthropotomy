import './style.css';
import { createIcons, Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Dna, Expand, Eye, Focus, Layers3, Menu, MousePointer2, Move, RotateCcw, Search, SlidersHorizontal, Sparkles, X, ZoomIn, ZoomOut } from 'lucide';
import musclesData from './muscles.json';
import { AnatomyViewer } from './viewer';
import { anatomyPalette } from './palette';
import type { Layer, Muscle, Part, Region, View } from './types';

const muscles = musclesData as Muscle[];
const icons = { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Dna, Expand, Eye, Focus, Layers3, Menu, MousePointer2, Move, RotateCcw, Search, SlidersHorizontal, Sparkles, X, ZoomIn, ZoomOut };
const icon = (name: string, extra = '') => `<i data-lucide="${name}" ${extra} aria-hidden="true"></i>`;
const refreshIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.65 } });
const regions: { id: Region | 'all'; name: string; short: string }[] = [
  { id: 'all', name: '全身肌肉', short: '全身' }, { id: 'neck', name: '头颈部', short: '头颈' },
  { id: 'shoulder', name: '肩部', short: '肩部' }, { id: 'chest', name: '胸部', short: '胸部' },
  { id: 'back', name: '背部', short: '背部' }, { id: 'arm', name: '手臂', short: '手臂' },
  { id: 'core', name: '腹部与核心', short: '核心' }, { id: 'hip', name: '臀部与髋部', short: '臀髋' },
  { id: 'thigh', name: '大腿', short: '大腿' }, { id: 'calf', name: '小腿', short: '小腿' },
];
const regionName = (id: string) => regions.find(r => r.id === id)?.name ?? '';
const listOrder = ['chest', 'back', 'shoulder', 'arm', 'core', 'hip', 'thigh', 'calf', 'neck'];
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
let selected = muscles[0];
let selectedPart: Part | null = null;
let region: Region | 'all' = 'all';
let layer: Layer = 'all';
let isolated = false;
let bones = true;
let favoritesOnly = false;
let favorites: string[] = [];
try { favorites = JSON.parse(localStorage.getItem('jili-favorites') || '[]').filter((id: string) => muscles.some(m => m.id === id)); } catch { /* Storage may be unavailable in private browsing. */ }
let viewer: AnatomyViewer | null = null;

$('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" aria-label="肌理首页"><span class="brand-symbol">${icon('dna')}</span><span><strong>肌理<span class="brand-dot">.</span></strong><small>MUSCLE ATLAS</small></span></a>
    <nav class="main-nav" aria-label="主导航"><button class="nav-item active" id="atlas-tab">肌肉图谱</button><button class="nav-item" id="guide-nav">学习指南 ${icon('arrow-up-right')}</button></nav>
    <div class="header-end"><span class="free-label"><span></span> 自由探索，免费学习</span><button class="icon-button help-button" id="help-button" aria-label="查看使用指南">${icon('circle-help')}</button></div>
  </header>
  <main>
    <section class="intro">
      <div><div class="eyebrow"><span></span> YOUR BODY, UNDERSTOOD</div><h1>先看清<span class="heading-comma">，</span>再练好<span class="heading-dot">。</span></h1><p>从一块肌肉开始，读懂身体的每一次运动。</p></div>
      <div class="intro-note">${icon('mouse-pointer-2')}<span>点击肌肉，发现身体的连接<br><strong>45 个学习条目 · 真实解剖模型</strong></span></div>
    </section>
    <div class="workspace">
      <aside class="explorer" aria-label="肌肉浏览">
        <div class="explorer-top"><div class="section-heading"><h2>探索身体</h2><span class="count-pill">${muscles.length}</span></div><label class="search-box">${icon('search')}<input type="search" id="search" placeholder="搜索肌肉名称…" aria-label="搜索中文或英文肌肉名称" autocomplete="off"><kbd>/</kbd></label></div>
        <div class="region-block"><div class="small-label">按部位探索</div><div class="region-grid" role="group" aria-label="身体部位">${regions.map(r => `<button class="region-chip ${r.id === 'all' ? 'active' : ''}" data-region="${r.id}" aria-pressed="${r.id === 'all'}">${r.short}</button>`).join('')}</div></div>
        <div class="list-heading"><span id="list-caption">全部肌肉</span><button class="favorites-toggle" id="favorites-toggle" aria-label="只显示收藏的肌肉" aria-pressed="false">${icon('bookmark')}<span>收藏</span></button></div>
        <div class="muscle-list" id="muscle-list"></div>
        <div class="explorer-footer">${icon('book-open')}<p>健身先健脑<br><span>让每一次发力都有迹可循</span></p></div>
      </aside>
      <section class="stage" aria-label="3D 肌肉图谱">
        <div class="stage-heading"><div><span class="stage-kicker">交互式解剖图谱</span><h2 id="stage-title">全身肌肉<span class="model-dot"></span></h2></div><span class="model-badge">3D <span>·</span> 成人男性参考</span></div>
        <div class="view-switch" role="group" aria-label="模型视角"><button class="active" data-view="front" aria-pressed="true">正面</button><button data-view="back" aria-pressed="false">背面</button><button data-view="left" aria-pressed="false">左侧</button><button data-view="right" aria-pressed="false">右侧</button></div>
        <div class="model-legend" aria-label="模型颜色说明"><span><span class="legend-swatch" style="--swatch:${anatomyPalette.bone}" aria-hidden="true"></span>骨骼</span><span><span class="legend-swatch" style="--swatch:${anatomyPalette.muscle}" aria-hidden="true"></span>肌肉</span><span class="legend-selected"><span class="legend-swatch" style="--swatch:${anatomyPalette.selected}" aria-hidden="true"></span>已选中</span></div>
        <div class="model-container" id="model-container"></div>
        <div class="model-loading" id="model-loading" role="status"><div class="loading-icon">${icon('dna')}</div><strong id="loading-label">正在准备人体模型</strong><div class="progress-track"><span id="loading-progress"></span></div><p>第一次认识身体，值得多等一小会儿</p></div>
        <div class="stage-annotation"><span class="annotation-line"></span><span id="annotation-name">胸大肌<small>PECTORALIS MAJOR</small></span></div>
        <div class="stage-options"><div class="layer-selector">${icon('layers-3')}<label class="sr-only" for="layer">显示层次</label><select id="layer"><option value="all">全部层次</option><option value="superficial">主要浅层</option><option value="deep">仅看深层</option></select>${icon('chevron-down')}</div><button class="bone-toggle active" id="bones-toggle" aria-pressed="true">${icon('eye')} 骨骼参照</button></div>
        <div class="stage-bottom"><div class="model-tools"><button class="icon-button" id="zoom-out" aria-label="缩小模型" title="缩小">${icon('zoom-out')}</button><span></span><button class="icon-button" id="reset-view" aria-label="重置全部视图" title="重置视图">${icon('rotate-ccw')}</button><span></span><button class="icon-button" id="zoom-in" aria-label="放大模型" title="放大">${icon('zoom-in')}</button></div><div class="interaction-hint"><span>${icon('move')} 拖动旋转</span><span class="desktop-hint">滚轮缩放</span><span>点击选择</span></div></div>
        <div class="isolated-badge" id="isolated-badge" hidden>${icon('focus')} 单独观察中<button id="exit-isolate" aria-label="退出单独观察">${icon('x')}</button></div>
      </section>
      <aside class="detail-panel" aria-label="所选肌肉介绍"><div id="detail-content"></div></aside>
    </div>
    <footer class="site-footer"><span>认识结构，理解功能，带着知识训练。</span><button id="credits-button">免费开放资源 · 模型来源与说明 ${icon('arrow-up-right')}</button></footer>
  </main>
  <div class="toast" id="toast" role="status" hidden></div>
  <div class="sr-only" id="selection-announcement" aria-live="polite"></div>
  <dialog id="info-dialog" aria-labelledby="dialog-title"><div class="dialog-header"><span class="eyebrow">LEARN YOUR BODY</span><button class="icon-button" id="close-dialog" aria-label="关闭说明">${icon('x')}</button></div><div id="dialog-body"></div></dialog>
`;

function renderList() {
  const query = $<HTMLInputElement>('#search').value.trim().toLocaleLowerCase();
  const aliases: Record<string, string> = { thigh: '股四头肌 腘绳肌 大腿 腿部', calf: '腿部 小腿', core: '腹肌 核心', hip: '臀肌 臀部 髋部', arm: '二头 三头 手臂 前臂' };
  const filtered = muscles.filter(m =>
    (region === 'all' || m.region === region) && (!favoritesOnly || favorites.includes(m.id)) &&
    `${m.name} ${m.english} ${regionName(m.region)} ${aliases[m.region] || ''}`.toLocaleLowerCase().includes(query));
  $('#list-caption').textContent = `${favoritesOnly ? '我的收藏' : region === 'all' ? '全部肌肉' : regionName(region)} · ${filtered.length}`;
  $('#muscle-list').innerHTML = filtered.length ? regions.filter(r => r.id !== 'all').sort((a, b) => listOrder.indexOf(a.id) - listOrder.indexOf(b.id)).map(r => {
    const list = filtered.filter(m => m.region === r.id);
    if (!list.length) return '';
    return `<div class="muscle-group"><h3>${r.name}<span>${String(list.length).padStart(2, '0')}</span></h3>${list.map(m => `<button class="muscle-item ${m.id === selected.id ? 'selected' : ''}" data-muscle="${m.id}" aria-pressed="${m.id === selected.id}"><span class="muscle-item-dot"></span><span><strong>${m.name}</strong><small>${m.english}</small></span>${icon(m.id === selected.id ? 'arrow-up-right' : 'chevron-right')}</button>`).join('')}</div>`;
  }).join('') : `<div class="empty-state">${icon(favoritesOnly ? 'bookmark' : 'search')}<strong>${favoritesOnly ? '还没有相关收藏' : '没有找到这块肌肉'}</strong><p>${favoritesOnly ? '在肌肉介绍中点击书签，留待下次复习。' : '试试中文名、英文名，或选择其他部位。'}</p><button class="text-button" id="clear-filters">重置筛选</button></div>`;
  refreshIcons();
}

function renderDetail() {
  const m = selected;
  const side = selectedPart ? ({ left: '左侧', right: '右侧', center: '中线' }[selectedPart.side] || '双侧') : '双侧';
  const marked = favorites.includes(m.id);
  $('#detail-content').innerHTML = `
    <div class="detail-topline"><span>正在认识</span><button class="icon-button bookmark-button ${marked ? 'marked' : ''}" id="bookmark-muscle" aria-label="${marked ? '取消收藏' : '收藏'}${m.name}" aria-pressed="${marked}">${icon('bookmark')}</button></div>
    <div class="detail-title"><span class="muscle-number">${String(muscles.indexOf(m) + 1).padStart(2, '0')} / ${muscles.length}</span><h2>${m.name}</h2><p>${m.english}</p></div>
    <div class="detail-tags"><span>${regionName(m.region)}</span><span>${m.layer === 'deep' ? '深层肌肉' : '浅层肌肉'}</span><span>${side}</span></div>
    <p class="muscle-summary">${m.summary}</p>
    <button class="isolate-button ${isolated ? 'is-active' : ''}" id="isolate-button" aria-pressed="${isolated}">${icon(isolated ? 'layers-3' : 'focus')}<span>${isolated ? '返回全身观察' : '单独观察这块肌肉'}</span>${icon('arrow-up-right')}</button>
    ${m.layer === 'deep' && !isolated ? `<p class="deep-note">${icon('layers-3')} 位于深层，单独观察可看清完整形态。</p>` : ''}
    <div class="detail-tabs" role="tablist" aria-label="肌肉知识"><button class="active" id="function-tab" role="tab" aria-selected="true" aria-controls="function-panel">肌肉功能</button><button id="training-tab" role="tab" aria-selected="false" aria-controls="training-panel" tabindex="-1">训练关联</button></div>
    <div id="function-panel" role="tabpanel" aria-labelledby="function-tab"><div class="functions-list">${m.actions.map((a, i) => `<div class="function-item"><span>${String(i + 1).padStart(2, '0')}</span><div><h3>${a.name}</h3><p>${a.description}</p></div></div>`).join('')}</div><div class="learn-note">${icon('sparkles')}<div><strong>多懂一点</strong><p>${m.tip}</p></div></div></div>
    <div id="training-panel" role="tabpanel" aria-labelledby="training-tab" hidden><p class="training-intro">把结构和动作联系起来。以下是相关动作示例，不是个性化训练处方。</p>${m.exercises.map((e, i) => `<div class="exercise-card"><span class="exercise-icon">${icon('activity')}</span><div><small>动作 ${String(i + 1).padStart(2, '0')}</small><h3>${e.name}</h3><p>${e.description}</p></div></div>`).join('')}</div>
    <details class="anatomy-details"><summary>深入了解 · 起点与止点 ${icon('chevron-down')}</summary><div><h3>起点</h3><p>${m.origin}</p><h3>止点</h3><p>${m.insertion}</p>${selectedPart ? `<h3>选中的模型结构</h3><p class="source-mesh">${selectedPart.name}${selectedPart.fmaId ? ` · ${selectedPart.fmaId}` : ''}</p>` : ''}<p class="anatomy-footnote">概括主要附着点；肌束和个体之间存在差异。</p><a href="${m.reading}" target="_blank" rel="noopener noreferrer">延伸阅读 · OpenStax ${icon('arrow-up-right')}</a></div></details>
    <div class="detail-pagination"><button id="previous-muscle" aria-label="上一块肌肉">${icon('arrow-left')} 上一块</button><button id="next-muscle" aria-label="下一块肌肉">下一块 ${icon('arrow-right')}</button></div>
  `;
  $('#annotation-name').innerHTML = `${m.name}<small>${m.english.toUpperCase()}</small>`;
  $('#stage-title').innerHTML = `${isolated ? m.name : regionName(region)}<span class="model-dot"></span>`;
  $('#isolated-badge').hidden = !isolated;
  refreshIcons();
}

function chooseMuscle(id: string, part: Part | null = null) {
  const found = muscles.find(m => m.id === id);
  if (!found) return;
  selected = found;
  selectedPart = part;
  viewer?.select(id, !part);
  if (!part) updateViewButtons(found.view === 'back' ? 'back' : 'front');
  renderList();
  renderDetail();
  $('#selection-announcement').textContent = `已选择${found.name}。${found.summary}`;
}

function updateViewButtons(view: View) {
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function toggleIsolation(value = !isolated) {
  isolated = value;
  viewer?.setOptions({ isolated });
  renderDetail();
  $('#isolate-button').focus({ preventScroll: true });
}

function reset() {
  isolated = false;
  layer = 'all';
  bones = true;
  region = 'all';
  favoritesOnly = false;
  $<HTMLInputElement>('#search').value = '';
  $<HTMLSelectElement>('#layer').value = 'all';
  $('#favorites-toggle').setAttribute('aria-pressed', 'false');
  $('#bones-toggle').classList.add('active');
  $('#bones-toggle').setAttribute('aria-pressed', 'true');
  updateRegions();
  viewer?.setOptions({ isolated, layer, bones, region });
  viewer?.setView('front');
  updateViewButtons('front');
  renderList(); renderDetail();
}

function updateRegions() {
  document.querySelectorAll<HTMLButtonElement>('[data-region]').forEach(button => {
    const active = button.dataset.region === region;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 2600);
}

function showDialog(type: 'guide' | 'credits') {
  $('#dialog-body').innerHTML = type === 'guide' ? `
    <h2 id="dialog-title">从好奇身体开始。</h2><p class="dialog-lead">不用背完所有名字，先把一块肌肉的位置和动作联系起来。</p>
    <div class="guide-step"><span>01</span><div><h3>选择一个部位</h3><p>用左侧的部位筛选或搜索肌肉的中英文名称，也可以直接点击 3D 模型。</p></div></div>
    <div class="guide-step"><span>02</span><div><h3>换个角度观察</h3><p>鼠标拖动旋转、滚轮缩放；触屏单指旋转、双指缩放。按正面、背面或侧面快速切换。左右侧按人体自身区分。</p></div></div>
    <div class="guide-step"><span>03</span><div><h3>理解一次运动</h3><p>在介绍中阅读主要功能，切换到「训练关联」对照熟悉的动作。深层肌肉可用「单独观察」查看。</p></div></div>
    <div class="glossary"><h3>先认识几个动作词</h3><dl><dt>屈曲 / 伸展</dt><dd>通常指关节角度减小 / 增大，例如弯肘与伸肘。</dd><dt>外展 / 内收</dt><dd>通常指肢体离开 / 靠近身体中线。</dd><dt>内旋 / 外旋</dt><dd>肢体绕自身长轴向内 / 向外转动。</dd><dt>起点 / 止点</dt><dd>肌肉主要附着的位置。实际运动时两端都可能移动。</dd></dl></div><p class="dialog-footnote">收藏保存在当前浏览器。图谱聚焦主要骨骼肌，不覆盖所有肌肉或人体差异。</p>
  ` : `
    <h2 id="dialog-title">开放的知识，自由地探索。</h2><p class="dialog-lead">本项目使用免费开放的真实解剖网格，无需账号、API 密钥或付费订阅。</p>
    <div class="credit-card"><h3>BodyParts3D / Anatomography</h3><p>© The Database Center for Life Science。依据公开分发的 CC BY-SA 2.1 Japan 授权使用，保留署名与相同方式共享要求。</p><a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noopener noreferrer">查看模型授权 ${icon('arrow-up-right')}</a></div>
    <div class="credit-card"><h3>Z-Anatomy</h3><p>Gauthier Kervyn 及 Z-Anatomy 贡献者。CC BY-SA 4.0 授权，补充腹直肌、背阔肌等结构。</p><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">查看模型授权 ${icon('arrow-up-right')}</a></div>
    <p class="credit-text">浏览器模型由 <a href="https://github.com/JohanBellander/BodyExplorer" target="_blank" rel="noopener noreferrer">Johan Bellander / BodyExplorer</a> 整理的网格裁剪而来；本项目转换了坐标、单位与存储格式，并建立中文学习条目。模型保留各自来源信息及授权，未把几何数据改为专有资源。</p>
    <p class="credit-text">功能与附着点为入门概括；可通过每个条目中的 OpenStax 解剖学教材链接继续学习。肌肉通常协同工作，动作关联不代表孤立发力。</p>
    <p class="dialog-footnote">模型为成人参考解剖，组合网格的体型与配准存在局限，主要用于健身学习。<a href="${import.meta.env.BASE_URL}ATTRIBUTION.md" target="_blank" rel="noopener noreferrer">完整资源说明</a></p>
  `;
  refreshIcons();
  $<HTMLDialogElement>('#info-dialog').showModal();
}

document.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const muscleButton = target.closest<HTMLButtonElement>('[data-muscle]');
  if (muscleButton) { chooseMuscle(muscleButton.dataset.muscle!); return; }
  const regionButton = target.closest<HTMLButtonElement>('[data-region]');
  if (regionButton) {
    region = regionButton.dataset.region as Region | 'all';
    updateRegions(); viewer?.setOptions({ region }); renderList(); renderDetail(); return;
  }
  const viewButton = target.closest<HTMLButtonElement>('[data-view]');
  if (viewButton) { const view = viewButton.dataset.view as View; viewer?.setView(view); updateViewButtons(view); return; }
  const id = target.closest<HTMLButtonElement>('button')?.id;
  switch (id) {
    case 'isolate-button': toggleIsolation(); break;
    case 'exit-isolate': toggleIsolation(false); break;
    case 'zoom-in': viewer?.zoom(1); break;
    case 'zoom-out': viewer?.zoom(-1); break;
    case 'reset-view': case 'clear-filters': case 'atlas-tab': reset(); break;
    case 'guide-nav': case 'help-button': showDialog('guide'); break;
    case 'credits-button': showDialog('credits'); break;
    case 'close-dialog': $<HTMLDialogElement>('#info-dialog').close(); break;
    case 'favorites-toggle':
      favoritesOnly = !favoritesOnly; $('#favorites-toggle').setAttribute('aria-pressed', String(favoritesOnly)); renderList(); break;
    case 'bones-toggle':
      bones = !bones; $('#bones-toggle').classList.toggle('active', bones); $('#bones-toggle').setAttribute('aria-pressed', String(bones)); viewer?.setOptions({ bones }); break;
    case 'bookmark-muscle':
      favorites = favorites.includes(selected.id) ? favorites.filter(id => id !== selected.id) : [...favorites, selected.id];
      try { localStorage.setItem('jili-favorites', JSON.stringify(favorites)); toast(favorites.includes(selected.id) ? '已收藏，留给下次复习' : '已取消收藏'); } catch { toast('当前浏览器无法持久保存，收藏将在关闭页面后丢失'); }
      renderDetail(); renderList(); break;
    case 'previous-muscle': case 'next-muscle': {
      const visible = [...document.querySelectorAll<HTMLButtonElement>('[data-muscle]')].map(button => muscles.find(m => m.id === button.dataset.muscle)!);
      const choices = visible.length ? visible : muscles;
      const index = choices.indexOf(selected);
      const next = index < 0 ? 0 : (index + (id === 'next-muscle' ? 1 : -1) + choices.length) % choices.length;
      chooseMuscle(choices[next].id);
      $('#' + id).focus({ preventScroll: true }); break;
    }
    case 'function-tab': case 'training-tab': {
      const training = id === 'training-tab';
      $('#function-panel').hidden = training; $('#training-panel').hidden = !training;
      ['function-tab', 'training-tab'].forEach(tab => {
        const active = tab === id;
        $( '#' + tab).classList.toggle('active', active); $( '#' + tab).setAttribute('aria-selected', String(active)); $( '#' + tab).tabIndex = active ? 0 : -1;
      }); break;
    }
  }
});
$('#search').addEventListener('input', renderList);
$('#layer').addEventListener('change', () => { layer = $<HTMLSelectElement>('#layer').value as Layer; viewer?.setOptions({ layer }); });
document.addEventListener('keydown', event => {
  const tag = (event.target as HTMLElement).tagName;
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !$<HTMLDialogElement>('#info-dialog').open) { event.preventDefault(); $('#search').focus(); }
  if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && (event.target as HTMLElement).getAttribute('role') === 'tab') {
    event.preventDefault(); const tab = $('#function-tab').getAttribute('aria-selected') === 'true' ? $('#training-tab') : $('#function-tab'); tab.click(); tab.focus();
  }
});
$('#info-dialog').addEventListener('click', event => { if (event.target === $('#info-dialog')) { const rect = $('#info-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $<HTMLDialogElement>('#info-dialog').close(); } });
renderList(); renderDetail(); refreshIcons();

async function loadModel() {
  try {
    viewer ??= new AnatomyViewer($('#model-container'), muscles, (id, part) => chooseMuscle(id, part));
    await viewer.load(percent => { $('#loading-progress').style.width = `${percent}%`; $('#loading-label').textContent = `正在加载解剖模型 · ${percent}%`; });
    viewer.select(selected.id, false);
    viewer.setOptions({ isolated, bones, layer, region });
    $('#model-loading').hidden = true;
  } catch (error) {
    console.error('Anatomy model:', error);
    $('#model-loading').innerHTML = `<div class="loading-icon">${icon('layers-3')}</div><strong>模型暂时无法显示</strong><p>请检查网络及浏览器的 WebGL 支持。<br>仍可通过肌肉列表阅读全部介绍。</p><button class="retry-button" id="retry-model">重新加载</button>`;
    $('#retry-model').addEventListener('click', () => location.reload()); refreshIcons();
  }
}
$('#model-container').addEventListener('modelerror', event => toast((event as CustomEvent).detail));
void loadModel();
