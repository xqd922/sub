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

export function renderPreviewHtml(
  yamlConfig: string,
  jsonConfig: string,
  meta: PreviewMeta = {},
): string {
  const escapedYaml = escapeHtml(yamlConfig)
  const escapedJson = escapeHtml(jsonConfig)
  const escapedUris = escapeHtml(meta.rawUris || meta.v2rayBase64 || '')
  const safeName = escapeHtml(meta.subscriptionName || '配置预览')

  const protocolBadges = Object.entries(meta.protocolCounts || {})
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `<span class="pill">${escapeHtml(type)}: ${count}</span>`)
    .join('')

  const countBadge =
    typeof meta.nodeCount === 'number'
      ? `<span class="pill">共 ${meta.nodeCount} 个节点</span>`
      : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeName} · 配置预览</title>
  <style>${PREVIEW_STYLES}</style>
</head>
<body>
  <div class="topbar">
    <div class="summary">
      <span class="title">${safeName}</span>
      ${countBadge}
      ${protocolBadges}
    </div>
    <div class="tabs" role="tablist" aria-label="预览视图">
      <button type="button" class="tab-btn" data-view="split" aria-selected="true">并排对比</button>
      <button type="button" class="tab-btn" data-view="clash" aria-selected="false">Clash YAML</button>
      <button type="button" class="tab-btn" data-view="singbox" aria-selected="false">sing-box JSON</button>
      <button type="button" class="tab-btn" data-view="uris" aria-selected="false">节点 URI</button>
    </div>
  </div>
  <div id="preview-grid" class="grid">
    <div class="container" data-panel="clash">
      <div class="header">
        <h2>Clash 配置</h2>
        <div class="actions">
          <button type="button" class="action-btn download-btn" data-target="clash-pre" data-filename="clash.yaml">下载 YAML</button>
          <button type="button" class="action-btn primary copy-btn" data-target="clash-pre">复制 YAML</button>
        </div>
      </div>
      <pre id="clash-pre">${escapedYaml}</pre>
    </div>
    <div class="container" data-panel="singbox">
      <div class="header">
        <h2>sing-box 配置</h2>
        <div class="actions">
          <button type="button" class="action-btn download-btn" data-target="singbox-pre" data-filename="sing-box.json">下载 JSON</button>
          <button type="button" class="action-btn primary copy-btn" data-target="singbox-pre">复制 JSON</button>
        </div>
      </div>
      <pre id="singbox-pre">${escapedJson}</pre>
    </div>
    <div class="container hidden" data-panel="uris">
      <div class="header">
        <h2>节点 URI 列表</h2>
        <div class="actions">
          <button type="button" class="action-btn download-btn" data-target="uris-pre" data-filename="nodes.txt">下载 TXT</button>
          <button type="button" class="action-btn primary copy-btn" data-target="uris-pre">复制全部</button>
        </div>
      </div>
      <pre id="uris-pre">${escapedUris}</pre>
    </div>
  </div>
  <script>
    (function () {
      var grid = document.getElementById('preview-grid');
      var panels = document.querySelectorAll('[data-panel]');
      var tabs = document.querySelectorAll('.tab-btn');

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

      document.querySelectorAll('.copy-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var el = document.getElementById(btn.getAttribute('data-target'));
          if (!el) return;
          var orig = btn.textContent;
          navigator.clipboard.writeText(el.textContent || '').then(function () {
            btn.textContent = '已复制';
            setTimeout(function () { btn.textContent = orig; }, 1500);
          }).catch(function () {});
        });
      });

      document.querySelectorAll('.download-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var el = document.getElementById(btn.getAttribute('data-target'));
          if (!el) return;
          var blob = new Blob([el.textContent || ''], { type: 'text/plain;charset=utf-8' });
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
