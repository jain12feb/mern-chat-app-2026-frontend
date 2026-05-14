import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import { SocketProvider } from "./context/SocketContext";
import { WebRTCProvider } from "./context/WebRTCContext";
import { ThemeProvider } from "./components/theme-provider";
import "./index.css";
import App from "./App.tsx";
import { ConfirmDialogProvider as BaseConfirmDialogProvider } from "@omit/react-confirm-dialog";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SocketProvider>
          <WebRTCProvider>
            <App />
          </WebRTCProvider>
        </SocketProvider>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
);
