import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import UserContext from "./context/UserContext";

const root = document.getElementById("root");
if (!root) throw new Error("root missing");

createRoot(root).render(
  <UserContext>
    <App />
  </UserContext>
);
