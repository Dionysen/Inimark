import { mountApp } from "./app.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app mount point");
}

document.documentElement.dataset.appearance = "light";
document.documentElement.style.colorScheme = "light";

const app = mountApp(root);

window.addEventListener("beforeunload", () => {
  app.destroy();
});
