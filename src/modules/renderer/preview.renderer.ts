import { PREVIEW_STYLES } from '@/modules/renderer/preview.styles'

export interface PreviewMeta {
  subscriptionName?: string
  nodeCount?: number
  protocolCounts?: Record<string, number>
  v2rayBase64?: string
  rawUris?: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatSnippetStats(content: string): string {
  if (!content) return '0 行'
  const lines = content.split('\n').length
  const bytes = new TextEncoder().encode(content).length
  const size = bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`
  return `${lines} 行 · ${size}`
}

export function renderPreviewHtml(
  yamlConfig: string,
  jsonConfig: string,
  meta: PreviewMeta = {},
): string {
  const escapedYaml = escapeHtml(yamlConfig)
  const escapedJson = escapeHtml(jsonConfig)
  const rawUrisText = meta.rawUris || meta.v2rayBase64 || ''
  const escapedUris = escapeHtml(rawUrisText)
  const safeName = escapeHtml(meta.subscriptionName || '配置预览')

  const protocolBadges = Object.entries(meta.protocolCounts || {})
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `<span class="pill">${escapeHtml(type)}: ${count}</span>`)
    .join('')

  const countBadge =
    typeof meta.nodeCount === 'number'
      ? `<span class="pill accent">共 ${meta.nodeCount} 个节点</span>`
      : ''

  const yamlMeta = formatSnippetStats(yamlConfig)
  const jsonMeta = formatSnippetStats(jsonConfig)
  const urisMeta = formatSnippetStats(rawUrisText)

  return `<!DOCTYPE html>
<html lang="zh-CN" data-mode="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeName} · 配置预览</title>
  <script>
    (function () {
      try {
        var saved = localStorage.getItem('boardui:theme');
        var dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
      } catch (e) {}
    })();
  </script>
  <style>${PREVIEW_STYLES}</style>
</head>
<body>
  <header class="topbar">
    <div class="summary">
      <span class="brand-dot" aria-hidden="true"></span>
      <span class="title">${safeName}</span>
      ${countBadge}
      ${protocolBadges}
    </div>
    <div class="controls">
      <label class="filter-box" aria-label="过滤配置行">
        <input id="filter-input" class="filter-input" type="search" placeholder="筛选关键字…" autocomplete="off" spellcheck="false" />
        <span id="filter-count" class="filter-count"></span>
      </label>
      <div class="tabs" role="tablist" aria-label="预览视图">
        <button type="button" class="tab-btn" data-view="split" aria-selected="true">并排</button>
        <button type="button" class="tab-btn" data-view="clash" aria-selected="false">Clash</button>
        <button type="button" class="tab-btn" data-view="singbox" aria-selected="false">sing-box</button>
        <button type="button" class="tab-btn" data-view="uris" aria-selected="false">URI</button>
      </div>
      <button type="button" id="theme-toggle" class="theme-btn" aria-label="切换主题">深色</button>
    </div>
  </header>
  <main class="workspace">
    <div id="preview-grid" class="grid">
      <section class="container" data-panel="clash">
        <div class="header">
          <div class="header-meta">
            <h2>Clash YAML</h2>
            <span class="meta-tag">${yamlMeta}</span>
          </div>
          <div class="actions">
            <button type="button" class="action-btn download-btn" data-target="clash-pre" data-filename="clash.yaml">下载</button>
            <button type="button" class="action-btn primary copy-btn" data-target="clash-pre">复制 YAML</button>
          </div>
        </div>
        <pre id="clash-pre">${escapedYaml}</pre>
      </section>
      <section class="container" data-panel="singbox">
        <div class="header">
          <div class="header-meta">
            <h2>sing-box JSON</h2>
            <span class="meta-tag">${jsonMeta}</span>
          </div>
          <div class="actions">
            <button type="button" class="action-btn download-btn" data-target="singbox-pre" data-filename="sing-box.json">下载</button>
            <button type="button" class="action-btn primary copy-btn" data-target="singbox-pre">复制 JSON</button>
          </div>
        </div>
        <pre id="singbox-pre">${escapedJson}</pre>
      </section>
      <section class="container hidden" data-panel="uris">
        <div class="header">
          <div class="header-meta">
            <h2>节点 URI</h2>
            <span class="meta-tag">${urisMeta}</span>
          </div>
          <div class="actions">
            <button type="button" class="action-btn download-btn" data-target="uris-pre" data-filename="nodes.txt">下载</button>
            <button type="button" class="action-btn primary copy-btn" data-target="uris-pre">复制全部</button>
          </div>
        </div>
        <pre id="uris-pre">${escapedUris}</pre>
      </section>
    </div>
  </main>
  <script>
    (function () {
      var grid = document.getElementById('preview-grid');
      var panels = document.querySelectorAll('[data-panel]');
      var tabs = document.querySelectorAll('.tab-btn');
      var themeBtn = document.getElementById('theme-toggle');
      var filterInput = document.getElementById('filter-input');
      var filterCount = document.getElementById('filter-count');
      var rawStore = {};

      ['clash-pre', 'singbox-pre', 'uris-pre'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) rawStore[id] = el.textContent || '';
      });

      function syncThemeLabel() {
        var dark = document.documentElement.getAttribute('data-mode') === 'dark';
        if (themeBtn) themeBtn.textContent = dark ? '浅色' : '深色';
      }
      syncThemeLabel();

      if (themeBtn) {
        themeBtn.addEventListener('click', function () {
          var next = document.documentElement.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-mode', next);
          try { localStorage.setItem('boardui:theme', next); } catch (e) {}
          syncThemeLabel();
        });
      }

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          var view = tab.getAttribute('data-view');
          tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
          grid.classList.toggle('single', view !== 'split');
          panels.forEach(function (panel) {
            var name = panel.getAttribute('data-panel');
            var visible = view === 'split' ? (name === 'clash' || name === 'singbox') : name === view;
            panel.classList.toggle('hidden', !visible);
          });
        });
      });

      if (filterInput) {
        filterInput.addEventListener('input', function () {
          var q = (filterInput.value || '').trim().toLowerCase();
          var totalMatches = 0;
          Object.keys(rawStore).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var raw = rawStore[id];
            if (!q) {
              el.textContent = raw;
              return;
            }
            var lines = raw.split('\\n').filter(function (line) {
              return line.toLowerCase().indexOf(q) !== -1;
            });
            totalMatches += lines.length;
            el.textContent = lines.length > 0 ? lines.join('\\n') : '# 无匹配行';
          });
          if (filterCount) {
            filterCount.textContent = q ? (totalMatches + ' 行') : '';
          }
        });
      }

      document.querySelectorAll('.copy-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-target');
          var text = rawStore[id] || '';
          var orig = btn.textContent;
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = '已复制';
            setTimeout(function () { btn.textContent = orig; }, 1500);
          }).catch(function () {});
        });
      });

      document.querySelectorAll('.download-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-target');
          var text = rawStore[id] || '';
          var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = btn.getAttribute('data-filename') || 'config.txt';
          a.click();
          URL.revokeObjectURL(url);
        });
      });
    })();
  </script>
</body>
</html>`
}
