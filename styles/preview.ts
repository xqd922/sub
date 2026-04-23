export const previewStyles = `
  :root {
    --bg: #f7f8fa;
    --surface: #ffffff;
    --border: #e5e6eb;
    --text: #1d2129;
    --muted: #86909c;
    --blue: #165dff;
    --green: #00b42a;
    --cyan: #14c9c9;
    --radius: 8px;
    --shadow: 0 16px 42px rgba(29, 33, 41, 0.08);
  }

  * {
    box-sizing: border-box;
  }

  body {
    min-height: 100vh;
    margin: 0;
    padding: 24px clamp(16px, 3vw, 36px) 36px;
    color: var(--text);
    background:
      radial-gradient(circle at 8% 10%, rgba(20, 201, 201, 0.12), transparent 28%),
      radial-gradient(circle at 88% 4%, rgba(22, 93, 255, 0.10), transparent 26%),
      linear-gradient(180deg, #ffffff 0%, var(--bg) 44%, #eef3ff 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", Arial, sans-serif;
  }

  .page-shell {
    max-width: 1440px;
    margin: 0 auto;
  }

  .preview-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-mark {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    border-radius: 10px;
    color: #fff;
    background: var(--blue);
    font-weight: 700;
    box-shadow: 0 8px 18px rgba(22, 93, 255, 0.16);
  }

  .brand-title {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
  }

  .brand-subtitle,
  .eyebrow,
  .panel-meta,
  .tip-card {
    color: var(--muted);
  }

  .brand-subtitle {
    font-size: 12px;
  }

  .status-group {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 9px;
    border-radius: 4px;
    background: #e8f3ff;
    color: var(--blue);
    font-size: 12px;
    font-weight: 600;
  }

  .status-pill.green {
    background: #e8ffea;
    color: var(--green);
  }

  .status-pill.cyan {
    background: #e8fffb;
    color: #08979c;
  }

  .hero-card {
    margin-bottom: 18px;
    padding: 22px 24px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.9);
    box-shadow: var(--shadow);
    backdrop-filter: blur(12px);
  }

  .eyebrow {
    display: block;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .hero-card h1 {
    margin: 0 0 8px;
    font-size: clamp(28px, 4vw, 42px);
    line-height: 1.15;
    letter-spacing: -0.035em;
  }

  .hero-card p {
    max-width: 780px;
    margin: 0;
    color: #4e5969;
    font-size: 15px;
    line-height: 1.8;
  }

  .config-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .config-panel {
    display: flex;
    min-height: 68vh;
    max-height: 72vh;
    overflow: hidden;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.94);
    box-shadow: var(--shadow);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.78);
  }

  .panel-title {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  .panel-title h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  .panel-meta {
    font-size: 12px;
  }

  .copy-button {
    flex: 0 0 auto;
    height: 32px;
    padding: 0 12px;
    border: 1px solid #bedaff;
    border-radius: 4px;
    color: var(--blue);
    background: #e8f3ff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .copy-button:hover {
    border-color: var(--blue);
    background: #dbeaff;
  }

  .code-wrap {
    flex: 1;
    min-height: 0;
    background: #fbfcff;
  }

  pre {
    height: 100%;
    margin: 0;
    padding: 18px;
    overflow: auto;
    color: #1d2129;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", "Noto Sans Mono", monospace;
    font-size: 13px;
    line-height: 1.72;
    white-space: pre;
    tab-size: 2;
  }

  pre::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  pre::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: rgba(29, 33, 41, 0.22);
    background-clip: padding-box;
  }

  pre::-webkit-scrollbar-track {
    background: transparent;
  }

  .tip-card {
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.72);
    font-size: 13px;
    line-height: 1.7;
  }

  @media (max-width: 980px) {
    .preview-topbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .status-group {
      justify-content: flex-start;
    }

    .config-grid {
      grid-template-columns: 1fr;
    }

    .config-panel {
      min-height: 58vh;
      max-height: 64vh;
    }
  }

  @media (max-width: 640px) {
    body {
      padding: 18px 14px 28px;
    }

    .hero-card {
      padding: 18px;
    }

    .panel-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .copy-button {
      width: 100%;
    }

    pre {
      padding: 14px;
      font-size: 12px;
    }
  }
`
