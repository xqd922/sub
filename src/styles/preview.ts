export const previewStyles = `
  body { 
    margin: 0;
    padding: 20px;
    font-family: monospace;
    display: flex;
    min-height: calc(100vh - 40px);
    background: #f5f5f5;
    gap: 20px;
  }
  .container {
    flex: 1;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 40px);
    position: relative;
  }
  .container::after {
    content: '';
    position: absolute;
    right: -10px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(0,0,0,0.1);
  }
  .container:last-child::after {
    display: none;
  }
  h2 {
    margin: 0 0 20px;
    color: #333;
    font-size: 16px;
    position: sticky;
    top: 0;
    background: inherit;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 14px;
    line-height: 1.5;
    overflow-y: auto;
    padding-right: 10px;
  }
  @media (prefers-color-scheme: dark) {
    body {
      background: #1a1a1a;
      color: #e0e0e0;
    }
    .container {
      background: #2d2d2d;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .container::after {
      background: rgba(255,255,255,0.1);
    }
    h2 {
      color: #e0e0e0;
      border-bottom-color: rgba(255,255,255,0.1);
    }
  }
` 