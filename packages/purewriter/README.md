# `@inimark/purewriter`

独立的 **纯纯写作（Pure Writer）** 文库序列化 / 反序列化模块。

输入输出边界是 **Inimark 文库中的笔记内容**（`.md` / `.txt`），不依赖 desktop / Tauri。

## 能力

| 方向 | API |
| --- | --- |
| 文库 → Pure Writer 模型 | `vaultToLibrary` / `serializeVault` |
| Pure Writer 模型 → 文库 | `libraryToVault` / `deserializeLibrary` |
| 模型 ↔ `Room.db` | `encodeRoomDatabase` / `decodeRoomDatabase` |
| 模型 ↔ `.pwb`（7z） | `@inimark/purewriter/node` 中的 `encodePwb` / `decodePwb` |
| 磁盘文库导入导出 | `exportVaultToPwb` / `importPureWriterBytesToVault` 等 |

## 路径映射

- `Note.md` → 默认文件夹（`Default`）
- `Folder/Note.md` → 文件夹 `Folder`
- `Folder/Cat/Note.md` → 文件夹 + 分类 `Cat`
- `Folder/a/b/Note.md` → 文件夹 + 分类名 `a/b`（深层目录压成一层分类）

默认不导出废纸篓（`PW_Trash`）与软删除条目；可用选项打开。

## 使用

```ts
import { vaultToLibrary, libraryToVault, encodeRoomDatabaseAsync } from "@inimark/purewriter";

const library = vaultToLibrary({
  notes: [{ path: "诗/致橡树.md", content: "…" }],
});
const db = await encodeRoomDatabaseAsync(library);
```

Node：

```ts
import { exportVaultToPwb, importPureWriterBytesToVault } from "@inimark/purewriter/node";

await exportVaultToPwb("/path/to/vault"); // → Uint8Array (.pwb)
await importPureWriterBytesToVault(pwbBytes, "/path/to/out-vault");
```

`.pwb` 打包需要本机 7-Zip，或安装可选依赖 `7zip-bin`。
