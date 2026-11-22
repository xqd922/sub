export const PREVIEW_STYLES = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  :root {
    --bg: #ffffff;
    --surface: #f5f5f5;
    --border: #ebebeb;
    --text: #111111;
    --muted: #737373;
    --btn-bg: #111111;
    --btn-fg: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111010;
      --surface: #1c1c1c;
      --border: #2a2a2a;
      --text: #f5f5f5;
      --muted: #a3a3a3;
      --btn-bg: #f5f5f5;
      --btn-fg: #111010;
    }
  }
  body {
    margin: 0;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", sans-serif;
    background: var(--bg);
    color: var(--text);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    min-height: 100vh;
  }
  .container {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 40px);
    overflow: hidden;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  h2 {
    margin: 0;
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .copy-btn {
    border: 0;
    border-radius: 6px;
    padding: 5px 10px;
    background: var(--btn-bg);
    color: var(--btn-fg);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 150ms ease;
  }
  .copy-btn:hover {
    opacity: 0.85;
  }
  pre {
    margin: 0;
    padding: 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 12.5px;
    line-height: 1.6;
    overflow-y: auto;
    color: var(--text);
  }
  @media (max-width: 768px) {
    body {
      grid-template-columns: 1fr;
      padding: 12px;
    }
    .container {
      max-height: 60vh;
    }
  }
`
