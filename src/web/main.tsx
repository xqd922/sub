import React from "react";
import { createRoot } from "react-dom/client";
import "@arco-design/web-react/dist/css/arco.css";
import "./styles.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
