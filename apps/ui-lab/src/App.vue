<script setup lang="ts">
import { defineComponent, h, onBeforeUnmount, ref, watchEffect } from "vue";
import {
  UiButton,
  UiCheckbox,
  UiDialog,
  UiIconButton,
  UiMenu,
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
const lastAction = ref("None");
const expandedIds = ref(["notes", "projects"]);
const selectedNodeId = ref("welcome");

function makeIcon(paths: string[]) {
  return defineComponent(() => () =>
    h(
      "svg",
      { viewBox: "0 0 16 16" },
      paths.map((d) => h("path", { d })),
    ),
  );
}

const OpenIcon = makeIcon(["M3 3.5h4l1.2 1.5H13v7.5H3z"]);
const RenameIcon = makeIcon(["m3 11.5.5-3 6-6 3 3-6 6z", "m8.5 3.5 3 3"]);
const PinIcon = makeIcon(["m6 2 4 1-1 3 3 3-3 1-2 4-1-5-3-3 3-1z"]);
const DeleteIcon = makeIcon(["M3 5h10M6 3h4M5 5l.5 8h5l.5-8"]);

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
    children: [
      { id: "welcome", label: "Welcome.md", kind: "file" },
      { id: "ideas", label: "Ideas.md", kind: "file" },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    kind: "folder",
    children: [
      {
        id: "inimark",
        label: "Inimark",
        kind: "folder",
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
          <svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" /></svg>
        </UiIconButton>
        <UiIconButton label="Pin panel" :pressed="true">
          <svg viewBox="0 0 16 16"><path d="m6 2 4 1-1 3 3 3-3 1-2 4-1-5-3-3 3-1z" /></svg>
        </UiIconButton>
        <UiIconButton label="Delete item" variant="danger" size="small">
          <svg viewBox="0 0 16 16"><path d="M3 5h10M6 3h4M5 5l.5 8h5l.5-8" /></svg>
        </UiIconButton>
        <UiIconButton label="Unavailable action" disabled>
          <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" /></svg>
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
            <svg class="lab__inline-icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4" /><path d="m10 10 3 3" /></svg>
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
            <svg viewBox="0 0 16 16"><circle cx="3" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="13" cy="8" r="1" /></svg>
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
