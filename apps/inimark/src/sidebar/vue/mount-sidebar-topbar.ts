import {
  createApp,
  defineComponent,
  h,
  nextTick,
  reactive,
  ref,
  type ComponentPublicInstance,
} from "vue";
import type { UiIconTabItem } from "@dionysen/ui-vue";
import { t } from "../../i18n/index.ts";
import { sidebarTabLabel, type SidebarTabId } from "../tab-layout.ts";
import SidebarTopbar from "./SidebarTopbar.vue";
import { SIDEBAR_TAB_ICONS } from "./sidebar-icons.ts";

interface SidebarTopbarViewModel {
  tabs: UiIconTabItem[];
  activeId: SidebarTabId;
  sidebarOpen: boolean;
  collapseLabel: string;
  side: "left" | "right";
}

type SidebarTopbarInstance = ComponentPublicInstance & { reflow(): void };

export interface SidebarTopbarController {
  setTabs(ids: SidebarTabId[]): void;
  setActivePanel(id: SidebarTabId): void;
  setSidebarOpen(open: boolean): void;
  refreshLabels(): void;
  reflow(): void;
  destroy(): void;
}

function toTabItem(id: SidebarTabId): UiIconTabItem {
  return { id, label: sidebarTabLabel(id), icon: SIDEBAR_TAB_ICONS[id] };
}

export function mountSidebarTopbar(
  host: HTMLElement,
  options: {
    tabs: SidebarTabId[];
    activeId: SidebarTabId;
    side: "left" | "right";
    onSelect(id: SidebarTabId): void;
    onToggle(): void;
  },
): SidebarTopbarController {
  const collapseLabelKey = options.side === "left"
    ? "common.collapseSidebar"
    : "common.collapseRightSidebar";
  const expandLabelKey = options.side === "left"
    ? "common.expandSidebar"
    : "common.expandRightSidebar";
  const state = reactive<SidebarTopbarViewModel>({
    tabs: options.tabs.map(toTabItem),
    activeId: options.activeId,
    sidebarOpen: true,
    collapseLabel: t(collapseLabelKey),
    side: options.side,
  });
  const component = ref<SidebarTopbarInstance>();

  const Root = defineComponent({
    name: "SidebarTopbarRoot",
    setup() {
      return () => h(SidebarTopbar, {
        ref: component,
        tabs: state.tabs,
        activeId: state.activeId,
        sidebarOpen: state.sidebarOpen,
        collapseLabel: state.collapseLabel,
        side: state.side,
        onSelect: (id: string) => options.onSelect(id as SidebarTabId),
        onToggle: options.onToggle,
      });
    },
  });

  const app = createApp(Root);
  app.mount(host);

  return {
    setTabs(ids) {
      state.tabs = ids.map(toTabItem);
    },
    setActivePanel(id) {
      state.activeId = id;
    },
    setSidebarOpen(open) {
      state.sidebarOpen = open;
      state.collapseLabel = t(open ? collapseLabelKey : expandLabelKey);
    },
    refreshLabels() {
      state.tabs = state.tabs.map((item) => toTabItem(item.id as SidebarTabId));
      state.collapseLabel = t(state.sidebarOpen ? collapseLabelKey : expandLabelKey);
    },
    reflow() {
      void nextTick(() => component.value?.reflow());
    },
    destroy() {
      app.unmount();
    },
  };
}
