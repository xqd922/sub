export const PREVIEW_STYLES = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  :root {
    --bg: #ffffff;
    --surface: #f5f5f5;
    --surface-2: #ebebeb;
    --border: #e5e5e5;
    --text: #111111;
    --muted: #666666;
    --btn-bg: #111111;
    --btn-fg: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111010;
      --surface: #1b1b1b;
      --surface-2: #262626;
      --border: #2c2c2c;
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
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface);
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .title {
    font-weight: 600;
    margin-inline-end: 6px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .tabs {
    display: inline-flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tab-btn {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 12px;
    background: transparent;
    color: var(--muted);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }
  .tab-btn[aria-selected="true"] {
    background: var(--btn-bg);
    color: var(--btn-fg);
    border-color: var(--btn-bg);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    flex: 1;
    min-height: 0;
  }
  .grid.single {
    grid-template-columns: 1fr;
  }
  .container {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 116px);
    overflow: hidden;
  }
  .container.hidden {
    display: none;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .actions {
    display: inline-flex;
    gap: 8px;
  }
  h2 {
    margin: 0;
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .action-btn {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 10px;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 150ms ease;
  }
  .action-btn.primary {
    border-color: var(--btn-bg);
    background: var(--btn-bg);
    color: var(--btn-fg);
  }
  .action-btn:hover {
    opacity: 0.82;
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
  @media (max-width: 900px) {
    body {
      padding: 12px;
    }
    .grid {
      grid-template-columns: 1fr;
    }
    .container {
      max-height: 62vh;
    }
  }
`
