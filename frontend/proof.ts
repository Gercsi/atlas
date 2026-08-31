import { createApp, h, ref } from "vue";
import Diagram from "./Diagram.vue";
import AppSidebar from "./AppSidebar.vue";
import Tutorial from "./Tutorial.vue";
import "./style.css";
const page = ref("diagram"),
  collapsed = ref(true);
createApp({
  render: () =>
    h("div", { class: ["shell", { "sidebar-collapsed": collapsed.value }] }, [
      h(AppSidebar, {
        page: page.value,
        user: { username: "Demo", role: "admin" },
        counts: {},
        qualityCount: 0,
        collapsed: collapsed.value,
        onToggle: () => {
          collapsed.value = !collapsed.value;
        },
        onNavigate: (target: string) => {
          if (["tutorial", "diagram"].includes(target)) page.value = target;
        },
      }),
      h("div", { class: "main-shell" }, [
        h("main", { style: "max-width:1600px;margin:0 auto;padding:24px" }, [
          h("div", { class: "eyebrow" }, "ELKÜLÖNÍTETT TECHNIKAI PRÓBA"),
          h("h1", "Kapcsolatok, félreérthetetlenül."),
          h(
            "p",
            "Kizárólag szintetikus adatok. Ez az oldal nem éri el az adatbázist és nem kerüli meg a bejelentkezést.",
          ),
          page.value === "tutorial"
            ? h(Tutorial, {
                role: "admin",
                caps: ["edit", "export_diagram"],
                onNavigate: (target: string) => {
                  if (target === "diagram") page.value = target;
                },
              })
            : h(Diagram, { caps: ["export_diagram"], zones: [], proof: true }),
        ]),
      ]),
    ]),
}).mount("#proof");
