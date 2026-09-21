<script setup lang="ts">
import { defineComponent, h, onBeforeUnmount, ref, watchEffect } from "vue";
import {
  UiButton,
  UiCheckbox,
  UiDialog,
  UiIconButton,
  UiMenu,
  UiPopover,
  UiTextField,
  UiToggle,
  UiTree,
  type UiMenuItem,
  type UiTreeNode,
} from "@dionysen/ui-vue";

const appearance = ref<"light" | "dark">("light");
const presses = ref(0);
const displayName = ref("Inimark");
const invalidName = ref("");
const autosave = ref(true);
const includeHidden = ref(false);
const selectAll = ref(false);
const menuOpen = ref(false);
const dialogOpen = ref(false);
const popoverOpen = ref(false);
const compactMode = ref(true);
const filterQuery = ref("");
const lastAction = ref("None");
const expandedIds = ref(["notes", "projects"]);
const selectedNodeId = ref("welcome");

function makeIcon(paths: string[]) {
  return defineComponent(() => () =>
    h(
      "svg",
      { viewBox: "0 0 24 24", fill: "none" },
      paths.map((d) => h("path", {
        d,
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.75",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      })),
    ),
  );
}

const OpenIcon = makeIcon(["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10H3z"]);
const RenameIcon = makeIcon(["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"]);
const PinIcon = makeIcon(["m12 17-5 5", "m5 15 4-4-3-5 2-2 5 3 4-4 4 4-4 4 3 5-2 2-5-3-4 4z"]);
const DeleteIcon = makeIcon(["M3 6h18", "M8 6V4h8v2", "M19 6l-1 15H6L5 6", "M10 11v5", "M14 11v5"]);

const menuItems: UiMenuItem[] = [
  { id: "open", label: "Open", icon: OpenIcon, shortcut: "⌘O" },
  { id: "rename", label: "Rename", icon: RenameIcon, shortcut: "F2" },
  { id: "pin", label: "Pin in sidebar", icon: PinIcon, checked: true },
  { id: "delete", label: "Move to Trash", icon: DeleteIcon, danger: true, separatorBefore: true },
];

const treeNodes: UiTreeNode[] = [
  {
    id: "notes",
    label: "Notes",
    kind: "folder",
    meta: "2 notes",
    outlined: true,
    children: [
      { id: "welcome", label: "Welcome.md", kind: "file" },
      { id: "ideas", label: "Ideas.md", kind: "file" },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    kind: "folder",
    meta: "1 folder",
    children: [
      {
        id: "inimark",
        label: "Inimark",
        kind: "folder",
        meta: "Git",
        outlined: true,
        children: [
          { id: "roadmap", label: "Roadmap.md", kind: "file" },
          { id: "release", label: "Release notes.md", kind: "file" },
        ],
      },
    ],
  },
  { id: "archive", label: "Archive", kind: "folder", disabled: true },
  { id: "readme", label: "README.md", kind: "file" },
];

function onMenuSelect(item: UiMenuItem): void {
  lastAction.value = item.label;
}

function onTreeSelect(node: UiTreeNode): void {
  selectedNodeId.value = node.id;
}

function toggleAppearance(): void {
  appearance.value = appearance.value === "light" ? "dark" : "light";
}

watchEffect(() => {
  document.documentElement.dataset.appearance = appearance.value;
});

onBeforeUnmount(() => {
  delete document.documentElement.dataset.appearance;
});
</script>

<template>
  <main class="lab">
    <header class="lab__header">
      <div>
        <p class="lab__eyebrow">@dionysen/ui-vue</p>
        <h1>UI Lab</h1>
        <p>Shared Vue components for Inimark and Vellum.</p>
      </div>
      <UiButton variant="ghost" @press="toggleAppearance">
        {{ appearance === "light" ? "Dark theme" : "Light theme" }}
      </UiButton>
    </header>

    <section class="lab__section">
      <div class="lab__section-heading">
        <div>
          <h2>Button</h2>
          <p>Variants, sizes and interaction states.</p>
        </div>
        <span>{{ presses }} presses</span>
      </div>

      <div class="lab__row">
        <UiButton @press="presses++">Default</UiButton>
        <UiButton variant="primary" @press="presses++">Primary</UiButton>
        <UiButton variant="danger" @press="presses++">Danger</UiButton>
        <UiButton variant="ghost" @press="presses++">Ghost</UiButton>
      </div>

      <div class="lab__row">
        <UiButton size="small">Small</UiButton>
        <UiButton disabled>Disabled</UiButton>
        <UiButton loading>Saving…</UiButton>
        <UiButton>一段较长的中文按钮文字</UiButton>
      </div>
    </section>

    <section class="lab__section">
      <div class="lab__section-heading">
        <div>
          <h2>Icon button</h2>
          <p>Accessible names, toggle state and compact sizing.</p>
        </div>
      </div>

      <div class="lab__row">
        <UiIconButton label="Add item" @press="presses++">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
        </UiIconButton>
        <UiIconButton label="Pin panel" :pressed="true">
          <svg viewBox="0 0 24 24"><path d="m12 17-5 5M5 15l4-4-3-5 2-2 5 3 4-4 4 4-4 4 3 5-2 2-5-3-4 4z" /></svg>
        </UiIconButton>
        <UiIconButton label="Delete item" variant="danger" size="small">
          <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" /></svg>
        </UiIconButton>
        <UiIconButton label="Unavailable action" disabled>
          <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </UiIconButton>
      </div>
    </section>

    <section class="lab__section">
      <div class="lab__section-heading">
        <div>
          <h2>Text field</h2>
          <p>Labels, descriptions, validation and v-model.</p>
        </div>
      </div>

      <div class="lab__form-grid">
        <UiTextField
          v-model="displayName"
          label="Display name"
          description="Shown in the title bar and library switcher."
        />
        <UiTextField
          v-model="invalidName"
          label="Theme name"
          placeholder="Enter a unique name"
          error="A theme with this name already exists."
        />
        <UiTextField label="Disabled field" model-value="Unavailable" disabled />
        <UiTextField aria-label="Search components" placeholder="Search components…">
          <template #leading>
            <svg class="lab__inline-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
          </template>
        </UiTextField>
      </div>
    </section>

    <section class="lab__section">
      <div class="lab__section-heading">
        <div>
          <h2>Selection controls</h2>
          <p>Switch and checkbox states driven by v-model.</p>
        </div>
      </div>

      <div class="lab__control-stack">
        <UiToggle
          v-model="autosave"
          label="Autosave"
          description="Save the active document after a short delay."
        />
        <UiToggle
          label="Cloud backup"
          description="Unavailable while no account is connected."
          disabled
        />
        <div class="lab__divider" />
        <UiCheckbox
          v-model="includeHidden"
          label="Include hidden files"
          description="Show dotfiles in search and file navigation."
        />
        <UiCheckbox
          v-model="selectAll"
          label="Select all themes"
          :indeterminate="!selectAll"
        />
      </div>
    </section>

    <section class="lab__section lab__section--overlay-demo">
      <div class="lab__section-heading">
        <div>
          <h2>Menu</h2>
          <p>Icons, checked items, shortcuts, danger states and keyboard navigation.</p>
        </div>
        <span>Last action: {{ lastAction }}</span>
      </div>

      <div class="lab__row">
        <UiMenu
          v-model="menuOpen"
          trigger-label="Note actions"
          :items="menuItems"
          @select="onMenuSelect"
        >
          <template #trigger-icon>
            <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
          </template>
        </UiMenu>
      </div>
    </section>

    <section class="lab__section">
      <div class="lab__section-heading">
        <div>
          <h2>Node tree</h2>
          <p>Folder and file icons, nesting, selection and arrow-key navigation.</p>
        </div>
        <span>Selected: {{ selectedNodeId }}</span>
      </div>

      <div class="lab__tree-demo">
        <UiTree
          v-model:expanded-ids="expandedIds"
          :nodes="treeNodes"
          :selected-id="selectedNodeId"
          indent-lines
          label="Example vault"
          @select="onTreeSelect"
        />
      </div>
    </section>

    <section class="lab__section">
      <div class="lab__section-heading">
        <div>
          <h2>Dialog</h2>
          <p>Focus trapping, focus restoration, Escape and backdrop dismissal.</p>
        </div>
      </div>

      <div class="lab__row">
        <UiButton variant="primary" @press="dialogOpen = true">Open dialog</UiButton>
      </div>
    </section>

    <section class="lab__section lab__section--overlay-demo">
      <div class="lab__section-heading">
        <div>
          <h2>Popover</h2>
          <p>A non-modal local surface that accepts form controls and custom content.</p>
        </div>
      </div>

      <div class="lab__row">
        <UiPopover v-model="popoverOpen" trigger-label="View options" width="340px">
          <template #trigger>
            <span class="lab__popover-trigger">
              <svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              View options
            </span>
          </template>
          <template #default="{ close }">
            <div class="lab__popover-content">
              <div>
                <strong>View options</strong>
                <p>These controls do not block the rest of the page.</p>
              </div>
              <UiTextField v-model="filterQuery" label="Filter nodes" placeholder="Type to filter…" />
              <UiToggle v-model="compactMode" label="Compact rows" />
              <div class="lab__popover-actions">
                <UiButton @press="close">Done</UiButton>
              </div>
            </div>
          </template>
        </UiPopover>
      </div>
    </section>

    <section class="lab__section">
      <div class="lab__section-heading">
        <div>
          <h2>Scrollbar</h2>
          <p>Hidden at rest, visible on hover and stronger while active.</p>
        </div>
      </div>
      <div class="lab__scroll-demo dionysen-scrollbar">
        <p v-for="index in 12" :key="index">Scrollable item {{ index }}</p>
      </div>
    </section>

    <UiDialog
      v-model="dialogOpen"
      title="Create a new note"
      description="Choose a clear title. You can rename the note later."
    >
      <UiTextField label="Note title" placeholder="Untitled" autofocus />
      <template #actions>
        <UiButton @press="dialogOpen = false">Cancel</UiButton>
        <UiButton variant="primary" @press="dialogOpen = false">Create note</UiButton>
      </template>
    </UiDialog>
  </main>
</template>
