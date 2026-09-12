---
title: Code and Syntax Highlighting
lang: en
translationKey: code-highlighting
---

# Code and Syntax Highlighting

**中文:** [[代码与语法高亮|中文]] · [[Markdown Syntax]] · [[Math and Diagrams]]

Technical notes live or die by readable code. Inimark supports **inline code**, **fenced code blocks**, and **syntax highlighting** driven by CodeMirror language packs (theme colors come from [[Themes and Appearance]]).

> [!TIP]
> Open this page in Inimark to see highlighting live. Unknown language tags still render as plain preformatted text.

## Inline code

Wrap a short token in backticks:

```markdown
Use `std::vector` in C++, or `Path` in Rust.
```

Rendered: Use `std::vector` in C++, or `Path` in Rust.

Shortcut for inline code: `Ctrl/⌘ + Shift + \`` (see [[Find Replace and Shortcuts]]).

Good for: APIs, file names, CLI flags, one-liners that should not wrap as a block.

## Fenced code blocks

### How to insert

1. Shortcut: `Alt + Ctrl/⌘ + C` inserts a fenced block.
2. Or type a fence yourself in [[Editing Modes#Source mode|source mode]]:

````markdown
```python
print("hello")
```
````

3. Put a **language tag** on the opening fence (`python`, `cpp`, `rust`…). That tag selects highlighting.

> [!TIP]
> After a messy paste from the browser, use **paste as plain text** (`Ctrl/⌘ + Shift + V`) so indentation stays honest.

### Language tags (common)

| Language | Typical tags |
| --- | --- |
| C++ | `cpp`, `c++` |
| C | `c` |
| Python | `python`, `py` |
| Java | `java` |
| Rust | `rust` |
| R | `r` |
| Swift | `swift` |
| TypeScript / JavaScript | `ts`, `typescript`, `js`, `javascript` |
| Go | `go` |
| SQL | `sql` |
| JSON | `json` |
| Shell | `bash`, `shell`, `sh` |

Exact alias coverage follows the bundled CodeMirror language data. If a tag is unknown, you still get a readable monospace block — just without colors.

Special fence: `mermaid` renders as a diagram, not highlighted source → [[Math and Diagrams]].

## Showcase by language

Each sample is a real, short snippet you can copy.

### C++

```cpp
#include <iostream>
#include <vector>

int main() {
  std::vector<int> xs{1, 2, 3};
  for (int x : xs) {
    std::cout << x << '\n';
  }
  return 0;
}
```

### Python

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

def length(p: Point) -> float:
    return (p.x ** 2 + p.y ** 2) ** 0.5

print(length(Point(3, 4)))
```

### Java

```java
import java.util.List;

public final class Greeter {
  public static String join(List<String> parts) {
    return String.join(" · ", parts);
  }

  public static void main(String[] args) {
    System.out.println(join(List.of("Inimark", "Java")));
  }
}
```

### Rust

```rust
fn factorial(n: u64) -> u64 {
    (1..=n).product()
}

fn main() {
    let n = 6;
    println!("{n}! = {}", factorial(n));
}
```

### R

```r
mean_sd <- function(x) {
  c(mean = mean(x), sd = sd(x))
}

xs <- c(1.2, 3.4, 5.6, 7.8)
print(mean_sd(xs))
```

### Swift

```swift
struct User {
  let id: Int
  var name: String
}

func greet(_ user: User) -> String {
  "Hello, \(user.name) (#\(user.id))"
}

let alice = User(id: 1, name: "Alice")
print(greet(alice))
```

### TypeScript

```ts
type Note = { path: string; title: string };

export function displayTitle(note: Note): string {
  return note.title.trim() || note.path;
}
```

### Go

```go
package main

import "fmt"

func sum(xs []int) int {
  total := 0
  for _, x := range xs {
    total += x
  }
  return total
}

func main() {
  fmt.Println(sum([]int{1, 2, 3}))
}
```

### SQL

```sql
SELECT title, updated_at
FROM notes
WHERE library_id = $1
ORDER BY updated_at DESC
LIMIT 20;
```

### JSON

```json
{
  "siteName": "Inimark Docs",
  "defaultTheme": "light",
  "out": "dist"
}
```

### Shell

```bash
pnpm docs:build
pnpm test:editor
```

## Editing habits

| Goal | Method |
| --- | --- |
| Quick insert | `Alt + Ctrl/⌘ + C` |
| Tweak language tag | Click / focus the fence language field in WYSIWYG, or edit in source |
| Large refactors | [[Editing Modes#Source mode|Source mode]] (`Ctrl/⌘ + /`) |
| Keep paste clean | Plain-text paste |
| Change colors | [[Themes and Appearance]] code theme |

## Related

- Markup overview: [[Markdown Syntax]]
- Diagram fences: [[Math and Diagrams]]
- Tech-note workflow: [[Everyday Workflows#Technical notes (code, diagrams, APIs)]]

---

Prev: [[Markdown Syntax]] · Next: [[Math and Diagrams]]
