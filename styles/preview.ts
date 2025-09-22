export const previewStyles = `
  body { 
    margin: 0;
    padding: 20px;
    font-family: monospace;
    display: flex;
    gap: 20px;
    background: #f5f5f5;
  }
  .container {
    flex: 1;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    height: calc(100vh - 40px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  h2 {
    margin: 0 0 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    background: inherit;
  }
  pre {
    flex: 1;
    margin: 0;
    overflow: auto;
    font-size: 14px;
    padding: 0 0 10px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
  }
  pre::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }
  pre::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.2);
    border-radius: 2px;
  }
  pre::-webkit-scrollbar-track {
    background: transparent;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1a1a }
    .container { background: #2d2d2d }
    h2, pre { border-color: rgba(255,255,255,0.1) }
    pre::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2) }
  }
` 