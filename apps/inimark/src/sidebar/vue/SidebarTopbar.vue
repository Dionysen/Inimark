<script setup lang="ts">
import { ref } from "vue";
import { UiIconButton, UiIconTabs, type UiIconTabItem } from "@dionysen/ui-vue";
import {
  RightSidebarToggleClosedIcon,
  RightSidebarToggleOpenIcon,
  SidebarToggleClosedIcon,
  SidebarToggleOpenIcon,
} from "./sidebar-icons.ts";

defineProps<{
  tabs: UiIconTabItem[];
  activeId: string;
  sidebarOpen: boolean;
  collapseLabel: string;
  side: "left" | "right";
}>();

const emit = defineEmits<{
  select: [id: string];
  toggle: [];
}>();

const tabsRef = ref<InstanceType<typeof UiIconTabs>>();

function reflow(): void {
  void tabsRef.value?.reflow();
}

defineExpose({ reflow });
</script>

<template>
  <UiIconTabs
    ref="tabsRef"
    class="inimark-sidebar-tabs"
    :items="tabs"
    :model-value="activeId"
    label="Sidebar panels"
    @update:model-value="emit('select', $event)"
  />
  <UiIconButton
    class="inimark-sidebar-toggle-btn"
    :class="side === 'left' ? 'inimark-sidebar-collapse-btn' : 'inimark-right-sidebar-collapse-btn'"
    size="small"
    :label="collapseLabel"
    data-tauri-drag-region="false"
    @press="emit('toggle')"
  >
    <component
      :is="side === 'left'
        ? (sidebarOpen ? SidebarToggleOpenIcon : SidebarToggleClosedIcon)
        : (sidebarOpen ? RightSidebarToggleOpenIcon : RightSidebarToggleClosedIcon)"
    />
  </UiIconButton>
</template>
