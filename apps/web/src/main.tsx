// React 18 entry point — mounts App into #root
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/globals.css";
import App from "./app";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
