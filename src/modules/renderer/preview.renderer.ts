import { PREVIEW_STYLES } from '@/modules/renderer/preview.styles'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderPreviewHtml(yamlConfig: string, jsonConfig: string): string {
  const escapedYaml = escapeHtml(yamlConfig)
  const escapedJson = escapeHtml(jsonConfig)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>配置预览</title>
  <style>${PREVIEW_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Clash 配置</h2>
      <button type="button" class="copy-btn" data-target="clash-pre">复制 YAML</button>
    </div>
    <pre id="clash-pre">${escapedYaml}</pre>
  </div>
  <div class="container">
    <div class="header">
      <h2>sing-box 配置</h2>
      <button type="button" class="copy-btn" data-target="singbox-pre">复制 JSON</button>
    </div>
    <pre id="singbox-pre">${escapedJson}</pre>
  </div>
  <script>
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
  </script>
</body>
</html>`
}
