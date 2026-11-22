export const PREVIEW_STYLES = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  :root {
    color-scheme: light;
    --bg: #fafafa;
    --surface: #ffffff;
    --surface-2: #f4f4f5;
    --border: #e4e4e7;
    --border-strong: #d4d4d8;
    --text: #18181b;
    --muted: #71717a;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --brand: #f6821f;
    --btn-bg: #2563eb;
    --btn-fg: #ffffff;
    --code-bg: #ffffff;
    --mark-bg: rgba(246, 130, 31, 0.22);
  }
  :root[data-mode="dark"] {
    color-scheme: dark;
    --bg: #0a0a0a;
    --surface: #141414;
    --surface-2: #1c1c1c;
    --border: #262626;
    --border-strong: #363636;
    --text: #f4f4f5;
    --muted: #a1a1aa;
    --accent: #3b82f6;
    --accent-hover: #60a5fa;
    --brand: #f6821f;
    --btn-bg: #2563eb;
    --btn-fg: #ffffff;
    --code-bg: #111111;
    --mark-bg: rgba(246, 130, 31, 0.3);
  }
  body {
    margin: 0;
    font-family: Inter, "PingFang SC", "Microsoft YaHei UI", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }
  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 90%, transparent);
    backdrop-filter: blur(10px);
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .brand-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--brand);
    box-shadow: 0 0 8px var(--brand);
    flex-shrink: 0;
  }
  .title {
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-inline-end: 4px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11.5px;
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }
  .pill.accent {
    color: var(--text);
    font-weight: 500;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .filter-box {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--bg);
  }
  .filter-box:focus-within {
    border-color: var(--accent);
  }
  .filter-input {
    width: 168px;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .filter-input::placeholder {
    color: var(--muted);
    font-family: inherit;
  }
  .filter-count {
    font-size: 11px;
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }
  .tabs {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
  }
  .tab-btn {
    border: 0;
    border-radius: 6px;
    padding: 4px 10px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 140ms ease, color 140ms ease;
  }
  .tab-btn:hover {
    color: var(--text);
  }
  .tab-btn[aria-selected="true"] {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
  .theme-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 10px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
    transition: border-color 140ms ease, color 140ms ease;
  }
  .theme-btn:hover {
    border-color: var(--border-strong);
    color: var(--text);
  }
  .workspace {
    padding: 16px 20px 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    flex: 1;
    min-height: 0;
  }
  .grid.single {
    grid-template-columns: 1fr;
  }
  .container {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 92px);
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
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
  }
  .header-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .meta-tag {
    font-size: 11px;
    color: var(--muted);
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }
  .actions {
    display: inline-flex;
    gap: 6px;
    flex-shrink: 0;
  }
  h2 {
    margin: 0;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .action-btn {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 10px;
    background: var(--surface);
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 140ms ease, background-color 140ms ease, opacity 140ms ease;
  }
  .action-btn:hover {
    border-color: var(--border-strong);
  }
  .action-btn.primary {
    border-color: var(--btn-bg);
    background: var(--btn-bg);
    color: var(--btn-fg);
  }
  .action-btn.primary:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
  pre {
    margin: 0;
    padding: 14px 16px;
    background: var(--code-bg);
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 12px;
    line-height: 1.65;
    overflow-y: auto;
    color: var(--text);
    flex: 1;
  }
  mark {
    background: var(--mark-bg);
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
  }
  @media (max-width: 900px) {
    .topbar {
      padding: 10px 12px;
    }
    .workspace {
      padding: 12px;
    }
    .grid {
      grid-template-columns: 1fr;
    }
    .container {
      max-height: 62vh;
    }
    .filter-input {
      width: 130px;
    }
  }
`
