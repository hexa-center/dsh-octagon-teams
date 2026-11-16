/**
 * Configuration page for Octagon Teams, served at `/octagon-teams`.
 *
 * Plain HTML + vanilla JS, no build step: the Host route supplies the JSON API
 * under `/octagon-teams/api`, and this page only renders and posts to it.
 * @param {{origin: string}} _options - unused; kept for future deep links.
 * @returns {string} complete HTML document.
 */
export function renderPage(_options = {}) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Octagon Teams · 配置</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f5f6f8;
    --panel: #ffffff;
    --panel-soft: #fafbfc;
    --line: #e6e8ec;
    --line-strong: #d6d9df;
    --text: #15181d;
    --muted: #6b7280;
    --accent: #4f46e5;
    --accent-soft: #eef2ff;
    --accent-line: #c7d2fe;
    --ok: #059669;
    --danger: #dc2626;
    --shadow: 0 1px 2px rgba(16, 24, 40, .05), 0 8px 24px -12px rgba(16, 24, 40, .12);
    --radius: 14px;
    --radius-sm: 10px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115;
      --panel: #171a21;
      --panel-soft: #1b1f27;
      --line: #262b35;
      --line-strong: #333a47;
      --text: #e8eaef;
      --muted: #98a1af;
      --accent: #8b93ff;
      --accent-soft: #20233a;
      --accent-line: #3a3f66;
      --ok: #34d399;
      --danger: #f87171;
      --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 12px 32px -16px rgba(0, 0, 0, .6);
    }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
  code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .hidden { display: none !important; }

  /* header */
  .top { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(10px);
    background: color-mix(in srgb, var(--bg) 84%, transparent); border-bottom: 1px solid var(--line); }
  .top-inner, .layout { width: min(1180px, 100% - 40px); margin: 0 auto; }
  .top-inner { display: flex; align-items: center; gap: 14px; height: 62px; }
  .brand { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 650; letter-spacing: .01em; }
  .logo { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
    background: var(--accent); color: #fff; font-size: 15px; }
  .brand-sub { margin-left: 8px; color: var(--muted); font-weight: 450; font-size: 13px; }
  .top-meta { margin-left: auto; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .top-meta code { color: var(--muted); font-size: 12px; max-width: 320px; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; }
  .pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 999px;
    border: 1px solid var(--line); color: var(--muted); font-size: 11.5px; white-space: nowrap; }
  .pill.soft { background: var(--panel-soft); }
  .pill.accent { color: var(--accent); border-color: var(--accent-line); background: var(--accent-soft); }
  .pill.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 35%, var(--line)); }

  /* layout */
  .layout { display: grid; grid-template-columns: 268px minmax(0, 1fr); gap: 22px; padding: 22px 0 64px; align-items: start; }
  .sidebar { position: sticky; top: 84px; display: flex; flex-direction: column; gap: 10px; min-width: 0;
    background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 14px 10px 12px; max-height: calc(100vh - 108px); }
  .side-title { display: flex; align-items: baseline; gap: 6px; padding: 0 6px 4px;
    font-size: 11.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .side-note { margin: 4px 6px 0; font-size: 11.5px; line-height: 1.5; color: var(--muted); }
  ul.roles { list-style: none; margin: 0; padding: 0; overflow: auto; min-width: 0; max-width: 100%;
    display: flex; flex-direction: column; gap: 2px; }
  ul.roles li { display: flex; align-items: center; gap: 10px; padding: 8px 8px; border-radius: var(--radius-sm);
    cursor: pointer; transition: background .12s ease; }
  ul.roles li:hover { background: var(--panel-soft); }
  ul.roles li.active { background: var(--accent-soft); outline: 1px solid var(--accent-line); }
  .avatar { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
    background: var(--panel-soft); border: 1px solid var(--line); font-size: 15px; }
  li.active .avatar { background: var(--panel); }
  ul.roles .who { min-width: 0; flex: 1; display: flex; flex-direction: column; }
  ul.roles .who b { font-weight: 550; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  ul.roles .who span { font-size: 11px; color: var(--muted); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); visibility: hidden; flex: none; }
  li.customized .dot { visibility: visible; }

  .content { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }

  /* hero */
  .hero { display: flex; align-items: center; gap: 16px; padding: 18px 20px; }
  .hero .avatar { width: 48px; height: 48px; border-radius: 13px; font-size: 24px; }
  .hero-main { min-width: 0; flex: 1; }
  .hero-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .hero-line h2 { margin: 0; font-size: 19px; font-weight: 650; letter-spacing: -.01em; }
  .hero-main p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }

  /* tabs */
  .tabs { display: inline-flex; gap: 2px; padding: 3px; background: var(--panel); border: 1px solid var(--line);
    border-radius: 12px; box-shadow: var(--shadow); align-self: flex-start; }
  .tabs button { white-space: nowrap; border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 13px;
    padding: 7px 14px; border-radius: 9px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .tabs button:hover { color: var(--text); }
  .tabs button.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  .tabs .count { font-size: 11px; min-width: 18px; text-align: center; padding: 1px 5px; border-radius: 999px;
    background: var(--panel-soft); border: 1px solid var(--line); color: var(--muted); }
  .tabs button.active .count { border-color: var(--accent-line); color: var(--accent); background: var(--panel); }

  .body-tab { padding: 22px; }

  /* form */
  .form { display: flex; flex-direction: column; gap: 18px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > label, .field-label { font-size: 12.5px; font-weight: 600; display: flex; align-items: baseline; gap: 8px; }
  .field .hint { font-weight: 400; color: var(--muted); font-size: 12px; }
  .field .hint b { font-weight: 500; color: var(--text); }
  .grid-2 { display: grid; grid-template-columns: minmax(0, 1fr) 96px; gap: 14px; }
  input[type=text], textarea { font: inherit; color: var(--text); background: var(--panel-soft);
    border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; width: 100%;
    transition: border-color .12s ease, box-shadow .12s ease; }
  input[type=text]:focus, textarea:focus { outline: 0; border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); background: var(--panel); }
  input:disabled { color: var(--muted); background: var(--bg); border-style: dashed; cursor: not-allowed; }
  textarea { min-height: 160px; resize: vertical; line-height: 1.6; }
  textarea.tall { min-height: 280px; }
  .textarea-wrap { position: relative; }
  .textarea-wrap textarea { padding-bottom: 26px; }
  .counter { position: absolute; right: 10px; bottom: 7px; font-size: 11px; color: var(--muted);
    background: var(--panel-soft); padding: 0 4px; border-radius: 4px; }
  .actions { display: flex; align-items: center; gap: 10px; padding-top: 4px; flex-wrap: wrap; }
  .actions .end { margin-left: auto; display: flex; gap: 10px; }

  button { font: inherit; border: 1px solid var(--line-strong); background: var(--panel); color: var(--text);
    border-radius: var(--radius-sm); padding: 8px 14px; cursor: pointer; transition: all .12s ease; }
  button:hover { border-color: var(--accent); color: var(--accent); }
  button.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 550; }
  button.primary:hover { filter: brightness(1.06); color: #fff; }
  button.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--line-strong)); }
  button.danger:hover { border-color: var(--danger); color: var(--danger); }
  button.small { padding: 5px 10px; font-size: 12px; border-radius: 8px; }
  .muted { color: var(--muted); }

  /* skills */
  .stack { display: flex; flex-direction: column; gap: 22px; }
  .block-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
  .block-head h3 { margin: 0; font-size: 13.5px; font-weight: 650; }
  .market-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  .market { text-align: left; padding: 11px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm);
    background: var(--panel-soft); display: flex; flex-direction: column; gap: 4px; cursor: pointer; position: relative; }
  .market:hover { border-color: var(--accent); }
  .market.on { border-color: var(--accent); background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent-line); }
  .market b { font-size: 13px; font-weight: 600; padding-right: 18px; word-break: break-all; }
  .market .desc { color: var(--muted); font-size: 11.5px; line-height: 1.45; display: -webkit-box;
    -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .market .src { color: var(--muted); font-size: 11px; }
  .top-meta .pill { cursor: pointer; }
  .market .tick { position: absolute; top: 9px; right: 10px; width: 16px; height: 16px; border-radius: 50%;
    display: grid; place-items: center; font-size: 10px; color: var(--accent); background: var(--panel);
    border: 1px solid var(--accent-line); visibility: hidden; }
  .market.on .tick { visibility: visible; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px;
    border: 1px solid var(--line); background: var(--panel-soft); font-size: 12px; cursor: pointer; }
  .chip:hover { border-color: var(--accent); color: var(--accent); }
  .chip.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
  .empty { color: var(--muted); font-size: 12.5px; padding: 10px 12px; border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm); background: var(--panel-soft); }

  /* tools */
  .tool-summary { margin: 0 0 14px; font-size: 12.5px; color: var(--muted); }
  .tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
  .tool-group { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px;
    background: var(--panel-soft); }
  .tool-group h4 { margin: 0 0 8px; font-size: 11.5px; font-weight: 600; letter-spacing: .04em;
    text-transform: uppercase; color: var(--muted); }
  .tool-row { display: flex; flex-direction: column; gap: 6px; }
  .tool { display: flex; align-items: baseline; gap: 8px; font-size: 12px; }
  .tool code { font-size: 12px; color: var(--accent); background: var(--accent-soft); padding: 1px 6px;
    border-radius: 5px; flex: none; }
  .tool span { color: var(--muted); font-size: 11.5px; }
  .missing { margin-top: 16px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: 12px; }
  .missing .off { text-decoration: line-through; color: var(--muted); background: transparent;
    border: 1px dashed var(--line-strong); padding: 3px 8px; border-radius: 999px; }
  .tool { cursor: pointer; border-radius: 7px; padding: 3px 6px; margin: -3px -6px; }
  .tool:hover { background: var(--accent-soft); }
  .tool.off { opacity: .52; }
  .tool.off code { text-decoration: line-through; background: transparent; color: var(--muted); }
  .tool.locked { cursor: default; opacity: .62; }
  .tool.locked:hover { background: transparent; }
  .tool .lock { font-size: 10px; color: var(--muted); border: 1px solid var(--line-strong);
    border-radius: 999px; padding: 0 5px; letter-spacing: .02em; white-space: nowrap; flex: none; }
  .tool-actions { margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

  /* toast */
  .request { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px;
    display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; background: var(--panel-soft); }
  .request.approved { border-left: 3px solid #16a34a; }
  .request.denied { border-left: 3px solid var(--danger); }
  .request-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .request-head strong { font-size: 13.5px; }
  .request-reason { color: var(--muted); font-size: 12.5px; white-space: pre-wrap; }
  .request-actions { display: flex; gap: 8px; }
  .request-actions button { padding: 5px 10px; font-size: 12px; }
  .request-list-title { font-size: 12px; text-transform: uppercase; letter-spacing: .06em;
    color: var(--muted); margin: 16px 0 8px; }
  .toast { position: fixed; right: 22px; bottom: 22px; max-width: 380px; padding: 11px 15px; border-radius: 12px;
    background: var(--panel); border: 1px solid var(--line); box-shadow: var(--shadow); font-size: 13px;
    opacity: 0; transform: translateY(8px); transition: opacity .18s ease, transform .18s ease; pointer-events: none; }
  .toast.show { opacity: 1; transform: none; }
  .toast.error { border-color: color-mix(in srgb, var(--danger) 50%, var(--line)); color: var(--danger); }

  .new-role { margin: 6px 10px 10px; width: calc(100% - 20px); border: 1px dashed var(--border);
    background: transparent; color: var(--muted); border-radius: 10px; padding: 9px 10px; font-size: 13px; cursor: pointer; }
  .new-role:hover { color: var(--accent); border-color: var(--accent); }
  .drawer { position: fixed; inset: 0; z-index: 40; background: rgba(15, 23, 42, .45);
    display: flex; align-items: center; justify-content: center; padding: 20px; }
  .drawer[hidden] { display: none; }
  .drawer-panel { width: min(640px, 100%); max-height: 88vh; overflow: auto; background: var(--panel);
    border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
  .drawer-head { display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid var(--border); }
  .drawer-head h3 { margin: 0; font-size: 15px; }
  .drawer-body { padding: 16px; display: flex; flex-direction: column; gap: 13px; }
  .ghost { border: none; background: transparent; color: var(--muted); cursor: pointer; font-size: 15px; padding: 2px 6px; }
  .ghost:hover { color: var(--text); }
  select { font: inherit; color: var(--text); background: var(--panel); border: 1px solid var(--border);
    border-radius: 10px; padding: 9px 10px; width: 100%; }
  @media (max-width: 900px) {
    body { overflow-x: hidden; }
    .layout { grid-template-columns: minmax(0, 1fr); padding-top: 14px; }
    .sidebar { position: static; max-height: none; }
    ul.roles { flex-direction: row; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
    ul.roles li { min-width: 160px; }
    .hero { padding: 16px; }
    .body-tab { padding: 16px; }
    .top-inner { gap: 8px; }
    .brand { white-space: nowrap; font-size: 14px; }
    .brand-sub { display: none; }
    .top-meta { gap: 6px; min-width: 0; }
    .top-meta .pill { max-width: 116px; display: block; overflow: hidden; white-space: nowrap;
      text-overflow: ellipsis; }
    .top-meta code { display: none; }
    .hero-line h2 { font-size: 17px; }
    .tabs { width: 100%; }
    .tabs button { flex: 1; justify-content: center; padding: 7px 6px; }
    .grid-2 { grid-template-columns: minmax(0, 1fr) 78px; }
  }
</style>
</head>
<body>
<header class="top">
  <div class="top-inner">
    <div class="brand"><span class="logo">✦</span>Octagon Teams<span class="brand-sub">配置中心</span></div>
    <div class="top-meta">
      <span class="pill mono" id="lead-badge">lead</span>
      <code id="profile" title=""></code>
      <button class="small" id="reset-all">全部恢复默认</button>
    </div>
  </div>
</header>

<div class="layout">
  <aside class="sidebar">
    <div class="side-title">成员 <span class="muted" id="member-count"></span></div>
    <ul class="roles" id="role-list"></ul>
    <button class="new-role" id="new-role">＋ 新建角色</button>
    <p class="side-note">配置只影响本 profile；已存在的会话保留创建时的版本，新会话与新子智能体立即生效。</p>
  </aside>

  <main class="content">
    <section class="card hero">
      <div class="avatar" id="hero-emoji">✦</div>
      <div class="hero-main">
        <div class="hero-line">
          <h2 id="hero-name">Octagon Teams · 统筹</h2>
          <span class="pill accent" id="hero-tier">lead</span>
          <span class="pill soft" id="hero-state">底稿</span>
        </div>
        <p id="hero-desc">团队里唯一面向你的成员：拆任务、派活、验收。</p>
      </div>
    </section>

    <div class="tabs" id="tabs">
      <button data-tab="profile" class="active">角色配置</button>
      <button data-tab="skills">技能</button>
      <button data-tab="tools">内置工具<span class="count" id="tool-count">0</span></button>
      <button data-tab="requests">能力申请<span class="count" id="req-count" hidden>0</span></button>
    </div>

    <section class="card body-tab" id="tab-profile">
      <div class="form">
        <div class="grid-2">
          <div class="field">
            <label>名称 <span class="hint" id="name-hint">显示在选择器与团队列表里</span></label>
            <input type="text" id="f-name" maxlength="60" placeholder="例如：后端工程师">
          </div>
          <div class="field">
            <label>Emoji</label>
            <input type="text" id="f-emoji" maxlength="8" placeholder="⚙️">
          </div>
        </div>
        <div class="field">
          <label>职责 / 需求 <span class="hint">一句话说明负责什么，会作为 preset 的描述显示</span></label>
          <input type="text" id="f-requirement" maxlength="300" placeholder="例如：实现后端接口、数据模型与迁移，保证可测试">
        </div>
        <div class="field">
          <label>前置提示词（人格） <span class="hint">作为该 preset 的 persona 注入系统提示；恢复默认会删掉本条覆盖</span></label>
          <div class="textarea-wrap">
            <textarea id="f-persona" placeholder="这个角色是谁、怎么工作、什么不能做、如何交付……"></textarea>
            <span class="counter" id="persona-count">0 字</span>
          </div>
        </div>
        <div class="actions">
          <span class="muted" id="role-status"></span>
          <div class="end">
            <button id="delete-role" class="danger" hidden>删除角色</button>
            <button id="reset-role">恢复该角色默认</button>
            <button class="primary" id="save-role">保存角色</button>
          </div>
        </div>
      </div>
    </section>

    <section class="card body-tab hidden" id="tab-skills">
      <div class="stack">
        <div>
          <div class="block-head"><h3>从技能市场选择</h3><span class="muted">勾选后以只读链接进入本角色目录，不影响其他角色</span></div>
          <div class="market-grid" id="installed-list"></div>
        </div>
        <div>
          <div class="block-head"><h3>本角色独有技能</h3><span class="muted">上传的 SKILL.md 或手工新建</span></div>
          <div class="chips" id="skill-list"></div>
          <div class="actions" style="margin-top:10px">
            <input type="text" id="skill-name" placeholder="技能目录名，如 review-checklist" style="max-width:260px">
            <button class="small" id="new-skill">新建</button>
            <button class="small" id="upload-skill">上传 SKILL.md</button>
            <input type="file" id="upload-input" accept=".md,.markdown,.txt" style="display:none">
            <button class="small danger" id="delete-skill">删除选中</button>
            <span class="muted" id="skill-status"></span>
          </div>
        </div>
        <div class="field">
          <label>SKILL.md</label>
          <textarea class="tall" id="skill-content" placeholder="# skill-name&#10;&#10;什么时候使用、步骤、约束、输出格式……"></textarea>
        </div>
        <div class="actions">
          <div class="end"><button class="primary" id="save-skill">保存技能</button></div>
        </div>
      </div>
    </section>

    <section class="card body-tab hidden" id="tab-tools">
      <p class="tool-summary" id="tools-summary"></p>
      <div class="tool-grid" id="tool-groups"></div>
      <div class="missing" id="tools-missing"></div>
      <div class="tool-actions">
        <button class="primary" id="save-tools">保存工具</button>
        <button id="reset-tools">恢复默认工具</button>
        <span class="muted" id="tools-status"></span>
      </div>
    </section>

    <section class="card body-tab hidden" id="tab-requests">
      <p class="tool-summary">角色缺少工具或技能时会提出申请；在这里可以代替 Lead 批准或拒绝。批准工具会立即对该角色生效，批准技能写进它的技能目录、下一次派生生效。</p>
      <div id="request-pending"></div>
      <div id="request-recent"></div>
    </section>
  </main>
</div>

<div class="drawer" id="create-drawer" hidden>
  <div class="drawer-panel">
    <div class="drawer-head">
      <h3>新建角色</h3>
      <button class="ghost" id="close-create" aria-label="关闭">✕</button>
    </div>
    <div class="drawer-body">
      <div class="grid-2">
        <div class="field">
          <label>名称</label>
          <input type="text" id="n-name" maxlength="60" placeholder="例如：数据工程师">
        </div>
        <div class="field">
          <label>Emoji</label>
          <input type="text" id="n-emoji" maxlength="8" placeholder="🧩">
        </div>
      </div>
      <div class="field">
        <label>能力档位 <span class="hint">决定这个角色默认能用哪些工具，建好后仍可逐个调整</span></label>
        <select id="n-tier"></select>
      </div>
      <div class="field">
        <label>职责 / 需求</label>
        <input type="text" id="n-requirement" maxlength="300" placeholder="例如：负责数据管道、ETL 与数据质量校验">
      </div>
      <div class="field">
        <label>前置提示词（人格）</label>
        <textarea id="n-persona" placeholder="你是谁、怎么工作、什么不能做、如何交付……"></textarea>
      </div>
      <div class="actions">
        <span class="muted" id="create-status"></span>
        <div class="end">
          <button id="cancel-create">取消</button>
          <button class="primary" id="submit-create">创建角色</button>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>
<script>
(function () {
  var state = { lead: null, roles: [], leadId: null, key: null, skill: null, tab: 'profile', disabled: {}, tiers: [] };
  var $ = function (id) { return document.getElementById(id); };
  var toastTimer = null;

  function toast(message, isError) {
    var el = $('toast');
    el.textContent = message;
    el.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 3200);
  }

  function api(method, path, body) {
    return fetch('/octagon-teams/api' + path, {
      method: method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
        return data;
      });
    });
  }

  function current() {
    if (!state.key) return null;
    if (state.key === 'lead') return state.lead;
    for (var i = 0; i < state.roles.length; i++) {
      if (state.roles[i].key === state.key) return state.roles[i];
    }
    return null;
  }

  function setTab(name) {
    state.tab = name;
    var buttons = document.querySelectorAll('#tabs button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].className = buttons[i].getAttribute('data-tab') === name ? 'active' : '';
    }
    var tabs = ['profile', 'skills', 'tools', 'requests'];
    for (var j = 0; j < tabs.length; j++) {
      $('tab-' + tabs[j]).className = 'card body-tab' + (tabs[j] === name ? '' : ' hidden');
    }
    if (name === 'requests') loadRequests();
  }

  function renderList() {
    var list = $('role-list');
    list.innerHTML = '';
    var entries = [{ key: 'lead', emoji: state.lead.emoji, name: state.lead.name, tier: '统筹', customized: state.lead.customized }]
      .concat(state.roles.map(function (role) { return { key: role.key, emoji: role.emoji, name: role.name, tier: role.tier, customized: role.customized }; }));
    $('member-count').textContent = entries.length + ' 位';
    entries.forEach(function (role) {
      var li = document.createElement('li');
      li.className = (role.key === state.key ? 'active' : '') + (role.customized ? ' customized' : '');
      var avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = role.emoji || '·';
      var who = document.createElement('span'); who.className = 'who';
      var name = document.createElement('b'); name.textContent = role.name;
      var tier = document.createElement('span'); tier.textContent = role.custom ? '自定义' : role.tier;
      who.appendChild(name); who.appendChild(tier);
      var dot = document.createElement('span'); dot.className = 'dot';
      li.appendChild(avatar); li.appendChild(who); li.appendChild(dot);
      li.addEventListener('click', function () { select(role.key); });
      list.appendChild(li);
    });
  }

  function fillForm() {
    var role = current();
    if (!role) return;
    var isLead = role.key === 'lead';
    $('hero-emoji').textContent = role.emoji || '✦';
    $('hero-name').textContent = role.name || '';
    $('hero-desc').textContent = role.requirement || '';
    $('hero-tier').textContent = isLead ? '统筹' : (role.custom ? '自定义 · ' + role.tier : role.tier);
    $('hero-state').textContent = role.custom ? '自定义角色' : (role.customized ? '已覆盖底稿' : '底稿默认');
    $('f-name').value = role.name || '';
    $('f-emoji').value = role.emoji || '';
    $('f-requirement').value = role.requirement || '';
    $('f-persona').value = role.persona || '';
    $('persona-count').textContent = (role.persona || '').length + ' 字';
    $('role-status').textContent = role.custom
      ? '自定义角色：没有底稿，保存即生效；删除会同时移除它的技能目录'
      : (role.customized ? '已覆盖底稿，可恢复' : '当前为底稿默认');
    $('delete-role').hidden = !role.custom;
    $('reset-role').hidden = !!role.custom;
    $('f-name').disabled = isLead;
    $('f-emoji').disabled = isLead;
    $('name-hint').textContent = isLead ? '统筹名称固定，避免选择器里认不出来' : '显示在选择器与团队列表里';
    $('f-name').title = isLead ? '统筹名称固定' : '';
    $('f-emoji').title = $('f-name').title;
    renderTools(role);
  }

  function renderTools(role) {
    var tools = role.tools || { count: 0, groups: [] };
    var leadOnly = role.leadOnly || [];
    var blocked = role.blocked || [];
    if (!state.disabled[role.key]) state.disabled[role.key] = (role.disabled || []).slice();
    var off = state.disabled[role.key];
    $('tools-summary').textContent = role.key === 'lead'
      ? '统筹可调用 ' + tools.count + ' 个工具；write / edit / apply_patch 永久关闭（统筹只验收，不写实现）。点击其余工具可停用或启用，只影响统筹。'
      : '这些是「' + role.name + '」自己的工具，共 ' + tools.count + ' 个，与团队其他成员互相独立。点击可停用/启用；被停用的调用会被运行时拒绝。';
    var wrap = $('tool-groups');
    wrap.innerHTML = '';
    var enabled = 0;
    tools.groups.forEach(function (group) {
      var box = document.createElement('div'); box.className = 'tool-group';
      var head = document.createElement('h4'); head.textContent = group.label; box.appendChild(head);
      var rows = document.createElement('div'); rows.className = 'tool-row';
      group.tools.forEach(function (tool) {
        var leadBlocked = role.key === 'lead' && blocked.indexOf(tool.name) >= 0;
        var roleLocked = role.key !== 'lead' && leadOnly.indexOf(tool.name) >= 0;
        var locked = leadBlocked || roleLocked;
        var on = !locked && off.indexOf(tool.name) < 0;
        if (on) enabled++;
        var row = document.createElement('div');
        row.className = 'tool' + (on ? '' : ' off') + (locked ? ' locked' : '');
        var code = document.createElement('code'); code.textContent = tool.name;
        var note = document.createElement('span'); note.textContent = tool.summary || '';
        row.appendChild(code); row.appendChild(note);
        if (leadBlocked) {
          var lock = document.createElement('span'); lock.className = 'lock'; lock.textContent = '永久关闭';
          row.appendChild(lock); row.title = '统筹不写实现，这是设计';
        } else if (roleLocked) {
          var only = document.createElement('span'); only.className = 'lock'; only.textContent = '仅 Lead';
          row.appendChild(only); row.title = '派生与协调只由 Lead 做；角色需要协作时报告给 Lead';
        }
        row.addEventListener('click', function () {
          if (locked) return;
          var index = off.indexOf(tool.name);
          if (index >= 0) off.splice(index, 1); else off.push(tool.name);
          renderTools(role);
        });
        rows.appendChild(row);
      });
      box.appendChild(rows);
      wrap.appendChild(box);
    });
    var missing = role.missing || [];
    var missingBox = $('tools-missing');
    missingBox.innerHTML = '';
    if (missing.length) {
      var label = document.createElement('span'); label.textContent = '组合里未安装（全团队都没有）：';
      missingBox.appendChild(label);
      missing.forEach(function (name) {
        var chip = document.createElement('span'); chip.className = 'off'; chip.textContent = name;
        missingBox.appendChild(chip);
      });
    }
    $('tool-count').textContent = enabled + '/' + tools.count;
    $('tools-status').textContent = '已启用 ' + enabled + ' / ' + tools.count;
  }

  function renderSkills(payload) {
    var installed = payload.installed || [];
    var installedList = $('installed-list');
    installedList.innerHTML = '';
    if (!installed.length) {
      var none = document.createElement('div');
      none.className = 'empty';
      none.textContent = '没有发现已安装技能：先在技能市场安装，或上传 SKILL.md。';
      installedList.appendChild(none);
    }
    installed.forEach(function (skill) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'market' + (skill.selected ? ' on' : '');
      var tick = document.createElement('span'); tick.className = 'tick'; tick.textContent = '✓';
      var name = document.createElement('b'); name.textContent = skill.name;
      var desc = document.createElement('small');
      desc.className = 'desc';
      desc.textContent = skill.description || skill.title || '（无描述）';
      var src = document.createElement('small');
      src.className = 'src';
      src.textContent = '来源：' + skill.source;
      card.appendChild(tick); card.appendChild(name); card.appendChild(desc); card.appendChild(src);
      card.title = (skill.title || skill.name) + '（' + skill.source + '）';
      card.addEventListener('click', function () { toggleInstalled(skill.name, !skill.selected); });
      installedList.appendChild(card);
    });

    var local = (payload.local || []).filter(function (skill) { return !skill.linked; });
    var list = $('skill-list');
    list.innerHTML = '';
    if (!local.length) {
      var empty = document.createElement('span');
      empty.className = 'empty';
      empty.textContent = '这个角色还没有本地技能。';
      list.appendChild(empty);
    }
    local.forEach(function (skill) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (skill.name === state.skill ? ' on' : '');
      chip.textContent = skill.name;
      chip.title = skill.title || skill.name;
      chip.addEventListener('click', function () { openSkill(skill.name); });
      list.appendChild(chip);
    });
  }

  function localTime(value) {
    var date = new Date(value || '');
    if (isNaN(date.getTime())) return '';
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function requestCard(request, actions) {
    var card = document.createElement('div');
    card.className = 'request ' + (request.status || '');
    var head = document.createElement('div');
    head.className = 'request-head';
    var title = document.createElement('strong');
    title.textContent = (request.kind === 'skill' ? '技能' : '工具') + '「' + request.name + '」';
    var who = document.createElement('span');
    who.className = 'pill soft';
    who.textContent = request.roleKey;
    var when = document.createElement('span');
    when.className = 'muted';
    when.textContent = (request.status === 'pending' ? '待处理 · ' : (request.status === 'approved' ? '已批准 · ' : '已拒绝 · ')) +
      localTime(request.createdAt);
    head.appendChild(title); head.appendChild(who); head.appendChild(when);
    card.appendChild(head);
    var reason = document.createElement('div');
    reason.className = 'request-reason';
    reason.textContent = (request.reason || '（角色没有写理由）') + (request.note ? '\\n审批说明：' + request.note : '');
    card.appendChild(reason);
    if (actions) {
      var row = document.createElement('div');
      row.className = 'request-actions';
      var approve = document.createElement('button');
      approve.className = 'primary';
      approve.textContent = '批准';
      approve.addEventListener('click', function () { decideRequest(request, true); });
      var deny = document.createElement('button');
      deny.className = 'danger';
      deny.textContent = '拒绝';
      deny.addEventListener('click', function () { decideRequest(request, false); });
      row.appendChild(approve); row.appendChild(deny);
      card.appendChild(row);
    }
    return card;
  }

  function renderRequests(data) {
    var pending = data.pending || [];
    var recent = data.recent || [];
    var count = $('req-count');
    count.textContent = String(pending.length);
    count.hidden = pending.length === 0;
    var pendingBox = $('request-pending');
    pendingBox.innerHTML = '';
    if (pending.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = '没有待处理的能力申请。';
      pendingBox.appendChild(empty);
    } else {
      pending.forEach(function (request) { pendingBox.appendChild(requestCard(request, true)); });
    }
    var recentBox = $('request-recent');
    recentBox.innerHTML = '';
    if (recent.length > 0) {
      var title = document.createElement('div');
      title.className = 'request-list-title';
      title.textContent = '最近处理';
      recentBox.appendChild(title);
      recent.forEach(function (request) { recentBox.appendChild(requestCard(request, false)); });
    }
  }

  function loadRequests() {
    api('GET', '/capabilities').then(renderRequests).catch(function (error) { toast(error.message, true); });
  }

  function decideRequest(request, approve) {
    api('POST', '/capabilities/' + encodeURIComponent(request.id) + '/decide', { approve: approve }).then(function (data) {
      renderRequests(data);
      toast(approve ? '已批准，工具立即生效' : '已拒绝');
      if (approve && request.kind === 'tool') api('GET', '/roles').then(applyRoles).catch(function () {});
    }).catch(function (error) { toast(error.message, true); });
  }

  function loadSkills() {
    if (!state.key) return;
    api('GET', '/skills/' + state.key).then(function (payload) {
      renderSkills(payload);
    }).catch(function (error) { toast(error.message, true); });
  }

  function toggleInstalled(name, selected) {
    if (!state.key) return;
    api('PUT', '/skills/' + state.key + '/select', { name: name, selected: selected }).then(function (payload) {
      renderSkills(payload);
      var sync = payload.sync || {};
      if (selected && (sync.conflicts || []).length) {
        toast('技能 ' + name + ' 与本角色同名本地技能冲突，未链接', true);
      } else {
        toast(selected ? '已为本角色启用 ' + name : '已取消 ' + name);
      }
    }).catch(function (error) { toast(error.message, true); });
  }

  function openSkill(name) {
    state.skill = name;
    $('skill-name').value = name;
    api('GET', '/skills/' + state.key + '/' + encodeURIComponent(name)).then(function (data) {
      $('skill-content').value = data.content || '';
      loadSkills();
    }).catch(function (error) { toast(error.message, true); });
  }

  function select(key) {
    var known = key === 'lead' || state.roles.some(function (role) { return role.key === key; });
    state.key = known ? key : 'lead';
    state.skill = null;
    state.disabled = {};
    $('skill-content').value = '';
    $('skill-name').value = '';
    renderList();
    fillForm();
    loadSkills();
  }

  function applyRoles(data) {
    state.lead = data.lead;
    state.roles = data.roles;
    state.disabled = {};
    if (data.leadId) {
      state.leadId = data.leadId;
      $('lead-badge').textContent = data.leadId;
    }
    if (data.profileDir) {
      $('profile').textContent = data.profileDir;
      $('profile').title = data.profileDir;
    }
    if (Array.isArray(data.tiers) && state.tiers.length === 0) {
      state.tiers = data.tiers;
      var select = $('n-tier');
      select.innerHTML = '';
      data.tiers.forEach(function (tier) {
        var option = document.createElement('option');
        option.value = tier.name;
        option.textContent = tier.label;
        select.appendChild(option);
      });
    }
    renderList();
    fillForm();
  }

  $('f-persona').addEventListener('input', function () {
    $('persona-count').textContent = $('f-persona').value.length + ' 字';
  });

  $('save-tools').addEventListener('click', function () {
    if (!state.key) return;
    api('PUT', '/roles/' + state.key, { tools: state.disabled[state.key] || [] }).then(function (data) {
      applyRoles(data);
      toast('工具策略已保存');
    }).catch(function (error) { toast(error.message, true); });
  });

  $('reset-tools').addEventListener('click', function () {
    if (!state.key) return;
    api('POST', '/roles/' + state.key + '/tools/reset').then(function (data) {
      applyRoles(data);
      toast('已恢复该角色的默认工具');
    }).catch(function (error) { toast(error.message, true); });
  });

  $('tabs').addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('button[data-tab]') : null;
    if (button) setTab(button.getAttribute('data-tab'));
  });

  $('lead-badge').addEventListener('click', function () {
    var value = $('lead-badge').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () { toast('已复制 preset id'); }).catch(function () {});
    }
  });

  $('save-role').addEventListener('click', function () {
    if (!state.key) return;
    api('PUT', '/roles/' + state.key, {
      name: $('f-name').value,
      emoji: $('f-emoji').value,
      requirement: $('f-requirement').value,
      persona: $('f-persona').value
    }).then(function (data) {
      applyRoles(data);
      toast('已保存并重新注册');
    }).catch(function (error) { toast(error.message, true); });
  });

  $('reset-role').addEventListener('click', function () {
    if (!state.key) return;
    api('POST', '/roles/' + state.key + '/reset').then(function (data) {
      applyRoles(data);
      toast('已恢复该角色底稿');
    }).catch(function (error) { toast(error.message, true); });
  });

  function openCreate() {
    $('n-name').value = '';
    $('n-emoji').value = '🧩';
    $('n-requirement').value = '';
    $('n-persona').value = '';
    $('create-status').textContent = '';
    $('create-drawer').hidden = false;
    $('n-name').focus();
  }

  function closeCreate() {
    $('create-drawer').hidden = true;
  }

  $('new-role').addEventListener('click', openCreate);
  $('close-create').addEventListener('click', closeCreate);
  $('cancel-create').addEventListener('click', closeCreate);
  $('create-drawer').addEventListener('click', function (event) {
    if (event.target === $('create-drawer')) closeCreate();
  });

  $('submit-create').addEventListener('click', function () {
    var body = {
      name: $('n-name').value,
      emoji: $('n-emoji').value,
      tier: $('n-tier').value,
      requirement: $('n-requirement').value,
      persona: $('n-persona').value
    };
    $('create-status').textContent = '创建中…';
    api('POST', '/roles', body).then(function (data) {
      applyRoles(data);
      closeCreate();
      select(data.roles[data.roles.length - 1].key);
      toast('已创建角色，可继续配置它的技能与工具');
    }).catch(function (error) {
      $('create-status').textContent = error.message;
    });
  });

  $('delete-role').addEventListener('click', function () {
    if (!state.key) return;
    var role = current();
    if (!window.confirm('删除「' + role.name + '」？它的技能目录也会被移除。')) return;
    api('DELETE', '/roles/' + state.key).then(function (data) {
      state.key = 'lead';
      applyRoles(data);
      select('lead');
      toast('角色已删除');
    }).catch(function (error) { toast(error.message, true); });
  });

  $('reset-all').addEventListener('click', function () {
    if (!window.confirm('把所有角色恢复为底稿默认？技能文件不会被删除。')) return;
    api('POST', '/reset').then(function (data) {
      applyRoles(data);
      toast('全部恢复底稿');
    }).catch(function (error) { toast(error.message, true); });
  });

  $('save-skill').addEventListener('click', function () {
    var name = $('skill-name').value.trim();
    if (!state.key) return;
    if (!name) { toast('先填技能名', true); return; }
    api('PUT', '/skills/' + state.key + '/' + encodeURIComponent(name), { content: $('skill-content').value })
      .then(function () {
        state.skill = name;
        loadSkills();
        toast('技能已保存');
      }).catch(function (error) { toast(error.message, true); });
  });

  $('new-skill').addEventListener('click', function () {
    state.skill = null;
    $('skill-name').value = '';
    $('skill-content').value = '# 新技能\\n\\n## 何时使用\\n\\n## 步骤\\n\\n## 输出格式\\n';
    $('skill-name').focus();
    loadSkills();
  });

  $('delete-skill').addEventListener('click', function () {
    var name = state.skill || $('skill-name').value.trim();
    if (!state.key || !name) return;
    if (!window.confirm('删除本角色技能 ' + name + '？（不会动技能市场的原件）')) return;
    api('DELETE', '/skills/' + state.key + '/' + encodeURIComponent(name)).then(function () {
      state.skill = null;
      $('skill-content').value = '';
      return api('PUT', '/skills/' + state.key + '/select', { name: name, selected: false }).catch(function () { return null; });
    }).then(function () {
      loadSkills();
      toast('已从本角色移除');
    }).catch(function (error) { toast(error.message, true); });
  });

  $('upload-skill').addEventListener('click', function () { $('upload-input').click(); });

  $('upload-input').addEventListener('change', function () {
    var file = $('upload-input').files && $('upload-input').files[0];
    if (!file || !state.key) return;
    var reader = new FileReader();
    reader.onload = function () {
      var name = file.name.replace(/\\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
      if (!name) name = 'uploaded-skill';
      api('POST', '/skills/' + state.key, { name: name, content: String(reader.result) }).then(function () {
        state.skill = name;
        $('skill-name').value = name;
        return api('GET', '/skills/' + state.key + '/' + encodeURIComponent(name));
      }).then(function (data) {
        $('skill-content').value = data.content;
        loadSkills();
        toast('已上传并写入本角色技能');
      }).catch(function (error) { toast(error.message, true); });
      $('upload-input').value = '';
    };
    reader.readAsText(file);
  });

  api('GET', '/roles').then(function (data) {
    applyRoles(data);
    var params = new URLSearchParams(window.location.search);
    select(params.get('role') || 'lead');
    var tab = params.get('tab');
    setTab(tab === 'skills' || tab === 'tools' || tab === 'requests' ? tab : 'profile');
    loadRequests();
  }).catch(function (error) { toast(error.message, true); });
})();
</script>
</body>
</html>`
}
