# Vue 3 & Flutter Code Factory cho Google Antigravity (`vue-flutter-factory-antigravity`)

Bộ **Code Factory kiểm soát chất lượng code tự động** được thiết kế chuyên biệt cho **Google Antigravity (AGY)**, tối ưu hóa riêng cho quy trình phát triển **Web (Vue 3 / Nuxt / Pinia / TypeScript)** và **Mobile (Flutter / Dart)**.

Lấy cảm hứng từ kiến trúc `code-factory`, plugin này chuyển hóa toàn bộ mô hình **Verify Ladder (`V0` → `V4`)**, **Bộ nhớ dự án (`Repository Memory Profile`)**, **Phân loại thay đổi (`Diff Classifier`)**, **Dàn Subagents Chuyên gia Review (`Reviewer Fleet`)**, và **Chốt chặn an toàn (`Lifecycle Hooks`)** sang chuẩn native của Antigravity — đồng thời nâng cấp bước kiểm thử thực tế (`V3/V4`) bằng **Browser Subagent**, **Chrome DevTools MCP**, và **Android Device Hub**.

---

## 🏗️ Cấu trúc thư mục

```text
vue-flutter-factory-antigravity/
├── plugin.json                                     # Manifest chuẩn của Antigravity Plugin
├── hooks.json                                      # Cấu hình Lifecycle Hooks (PreToolUse & Stop Gates)
├── assets/
│   └── logo.svg                                    # Biểu tượng Plugin (Vue + Flutter + Verify Badge)
├── hooks/
│   ├── pre_tool_gate.py                            # Chặn sửa file *.g.dart/*.freezed.dart & lệnh git nguy hiểm
│   └── stop_verify_gate.py                         # Chốt chặn trước khi dừng: kiểm tra quên chạy build_runner & conflict
├── rules/
│   └── AGENTS.md                                   # Bộ quy tắc cốt lõi luôn bật (Always-on Rules) cho Vue & Flutter
├── agents/                                         # Dàn Reviewer Fleet Subagents
│   ├── vue-reactivity-reviewer.md                  # Soát lỗi mất reactivity (storeToRefs), vòng lặp watch, mutate prop
│   ├── vue-ui-a11y-reviewer.md                     # Soát lỗi 4 trạng thái UI, Accessibility (ARIA) & Core Web Vitals
│   ├── flutter-lifecycle-memory-reviewer.md        # Soát lỗi quên dispose() controller, dùng BuildContext sau await
│   └── flutter-ui-performance-reviewer.md          # Soát lỗi vỡ khung RenderFlex overflow, ListView trong Column, thiếu const
└── skills/                                         # Bộ Skills điều phối quy trình
    ├── code-factory-verify/
    │   ├── SKILL.md                                # Điều phối Verify Ladder (V0-V4) & gọi dàn Reviewer Fleet
    │   └── scripts/
    │       └── factory.py                          # Engine CLI: quét profile dự án, phân loại diff, chạy V0/V1 vi sai
    ├── vue-factory/
    │   └── SKILL.md                                # Quy trình 6 bước chuẩn cho Vue 3 / Nuxt / Pinia / TypeScript
    └── flutter-factory/
        └── SKILL.md                                # Quy trình 6 bước chuẩn cho Flutter / Dart / Freezed / Bloc / Riverpod
```

---

## 🚀 Các tính năng cốt lõi cho Vue 3 (Web) & Flutter (Mobile)

### 1. Chốt chặn an toàn tự động (`hooks.json`)

* **Chốt chặn trước khi chạy công cụ — `PreToolUse` (`hooks/pre_tool_gate.py`):**
  * **Cấm tuyệt đối (`deny`)** việc AI sửa trực tiếp vào các file sinh tự động của Flutter (`*.g.dart`, `*.freezed.dart`, `*.gr.dart`, `*.config.dart`, `*.mocks.dart`) và của Vue/Nuxt (`auto-imports.d.ts`, `components.d.ts`, `typed-router.d.ts`). Khi bị chặn, Hook sẽ hướng dẫn AI sửa ở file nguồn và chạy `build_runner`.
  * **Yêu cầu xác nhận (`ask`)** khi AI định chỉnh sửa các file cấu hình native nhạy cảm của Mobile (`AndroidManifest.xml`, `Info.plist`, `build.gradle`, `Podfile`) hoặc chạy các lệnh Git có nguy cơ mất dữ liệu (`git reset --hard`, `git push --force`, `git clean -fd`).
* **Chốt chặn trước khi kết thúc lượt — `Stop` Verify Gate (`hooks/stop_verify_gate.py`):**
  * Ngay khi AI định dừng lại để báo cáo hoàn thành, Hook tự động quét các file vừa sửa: nếu phát hiện file `.dart` có dùng `@freezed`, `@JsonSerializable`, `@riverpod` mà chưa chạy `build_runner` (file `.g.dart`/`.freezed.dart` bị thiếu hoặc cũ hơn file gốc) hoặc còn sót dấu merge conflict (`<<<<<<<`), Hook sẽ tự động giữ AI lại (`"decision": "continue"`) để xử lý dứt điểm.

---

### 2. Thang kiểm chứng chất lượng 5 tầng — Verify Ladder (`V0` → `V4`)

Điểm mạnh nhất của Verify Ladder là cơ chế **Kiểm tra vi sai (Differential Check)**: chỉ bắt lỗi phát sinh trên đúng những file bạn vừa chạm vào, không bị kẹt bởi các lỗi cũ (legacy tech debt) có sẵn trong dự án.

| Tầng Verify | Khi code Web (Vue 3 / Nuxt) | Khi code Mobile (Flutter / Dart) |
| :--- | :--- | :--- |
| **`V0` (Kiểm tra tĩnh & Type)** | Chạy `vue-tsc --noEmit` (bắt lỗi type ngay trong `<template>`) + `eslint` trên các file `.vue`/`.ts` vừa sửa | Kiểm tra độ mới của file codegen + `dart format` + `flutter analyze` trên các file `.dart` vừa sửa |
| **`V1` / `V2` (Test mục tiêu)** | Chạy `vitest run <changed_spec.ts>` cho đúng component/store liên quan | Chạy `flutter test <changed_test.dart>` (Unit / Widget test liên quan) |
| **`V3` (Chạy thực tế & Giao diện)** | Gọi **`browser` subagent** / **`chrome-devtools`** mở localhost, bấm thử luồng UI và kiểm tra không có `[Vue warn]` trong Console | Gọi **`android-device-hub`** (`android layout`, `android screen`, `adb logcat`) kiểm tra máy ảo không bị lỗi sọc vàng-đen `RenderFlex overflowed` |
| **`V4` (Bằng chứng bàn giao)** | Ảnh chụp màn hình trình duyệt + bảng tổng kết Verify | Ảnh chụp màn hình máy ảo Android + bảng tổng kết Verify |

---

### 3. Dàn Chuyên gia Review độc lập — Reviewer Fleet Subagents (`agents/`)

Thay vì chỉ dùng 1 cuộc hội thoại chung, hệ thống phân tích `git diff` và gọi song song các Subagents chuyên biệt để bắt những lỗi logic mà trình biên dịch không phát hiện được:

* 🟢 **`vue-reactivity-reviewer`**:
  * Bắt lỗi destructure trực tiếp từ Pinia store làm đứt tính phản ứng (bắt buộc bọc qua `storeToRefs()`).
  * Bắt lỗi gán/sửa trực tiếp `props`, lạm dụng `watch` thay vì `computed`, hoặc đồng bộ 2 chiều giữa URL query (`useRoute().query`) và store gây vòng lặp vô tận (infinite loop).
  * Bắt lỗi quên dọn dẹp `setInterval`, `addEventListener`, `AbortController` trong `onUnmounted`.
* 🟢 **`vue-ui-a11y-reviewer`**:
  * Kiểm tra giao diện đã xử lý đủ **4 trạng thái** chưa: **Loading** (skeleton/spinner + khóa nút chống bấm đúp), **Error** (có nút Thử lại), **Empty** (trạng thái rỗng), và **Data**.
  * Kiểm tra chuẩn Accessibility (thẻ `<button>`, `aria-label`, điều hướng bàn phím) và lỗi dùng `:key="index"` trong `v-for` khi danh sách có lọc/sắp xếp.
* 🔵 **`flutter-lifecycle-memory-reviewer`**:
  * Kiểm tra toàn bộ `TextEditingController`, `ScrollController`, `PageController`, `TabController`, `AnimationController`, `FocusNode`, `StreamSubscription` đã được `.dispose()` / `.cancel()` trong hàm `dispose()` chưa.
  * Bắt lỗi dùng `BuildContext` (`Navigator.of(context)`, `ScaffoldMessenger.of(context)`, `showDialog`) sau từ khóa `await` mà thiếu chốt chặn `if (!context.mounted) return;`.
  * Bắt lỗi truyền trực tiếp hàm gọi API vào `FutureBuilder(future: api.fetch())` bên trong hàm `build()`.
* 🔵 **`flutter-ui-performance-reviewer`**:
  * Bắt lỗi kinh điển gây đỏ/trắng màn hình: đặt `ListView` / `GridView` bên trong `Column` mà không bọc `Expanded` / `Flexible` (`Vertical viewport was given unbounded height`).
  * Bắt lỗi tràn chữ/vỡ khung (`RenderFlex overflowed`) khi đặt `Text` động bên trong `Row` mà không bọc `Expanded`/`Flexible` kèm `TextOverflow.ellipsis`.
  * Nhắc tách các hàm `Widget _buildItem()` thành `class _Item extends StatelessWidget` có `const` constructor để tối ưu hiệu năng rebuild.

---

## 📥 Hướng dẫn cài đặt (Hỗ trợ cả macOS, Windows & Linux)

Plugin đã được tối ưu hóa **Cross-Platform** (tự động xử lý khác biệt giữa `python3`/`python`, đường dẫn `\` trên Windows vs `/` trên macOS, và chuẩn hóa UTF-8 cho log CLI).

### Trên macOS / Linux (Terminal / zsh / bash):
```bash
git clone https://github.com/Tdao199883/vue-flutter-factory-antigravity.git \
  ~/.gemini/config/plugins/vue-flutter-factory-antigravity
```

### Trên Windows (PowerShell):
```powershell
git clone https://github.com/Tdao199883/vue-flutter-factory-antigravity.git `
  "$HOME\.gemini\config\plugins\vue-flutter-factory-antigravity"
```

### Trên Windows (Command Prompt / CMD):
```cmd
git clone https://github.com/Tdao199883/vue-flutter-factory-antigravity.git "%USERPROFILE%\.gemini\config\plugins\vue-flutter-factory-antigravity"
```

Ngay sau khi clone vào thư mục `plugins/vue-flutter-factory-antigravity`, Antigravity sẽ **tự động nhận diện và kích hoạt** toàn bộ Rules, Skills, Reviewer Subagents và Hooks mà không cần khởi động lại.

Bạn có thể bật/tắt nhanh plugin bất cứ lúc nào trong phần **Customizations → Plugins** trên giao diện Antigravity.

---

## 🛠️ Cách sử dụng

### 1. Tự động trong lúc chat (Mặc định)
Khi plugin đang bật, bạn chỉ cần giao task bình thường (ví dụ: *"Tạo trang quản lý đơn hàng bằng Vue 3 + Pinia"* hoặc *"Tạo màn hình chi tiết sản phẩm bằng Flutter + Riverpod"*).
* Các **Rules** và **Hooks** sẽ tự động bảo vệ ở hậu trường.
* Các **Skills** (`vue-factory`, `flutter-factory`, `code-factory-verify`) sẽ tự động được Agent kích hoạt theo ngữ cảnh dự án.

### 2. Gọi trực tiếp Engine CLI (`factory.py`)
Bạn (hoặc Agent) có thể chạy trực tiếp bộ công cụ Python của Code Factory tại thư mục gốc của bất kỳ dự án Vue hoặc Flutter nào:

```bash
# 1. Quét dự án và tạo/cập nhật bộ nhớ kiến trúc tại .agents/repo-profile.json
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py profile --cwd "$(pwd)"

# 2. Phân loại git diff hiện tại -> Đề xuất các Reviewer Subagents và các tầng Verify cần chạy
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py classify --cwd "$(pwd)"

# 3. Chạy kiểm tra chất lượng tự động tầng V0 (typecheck/lint vi sai) & V1 (test mục tiêu)
python3 ~/.gemini/config/plugins/vue-flutter-factory-antigravity/skills/code-factory-verify/scripts/factory.py verify --cwd "$(pwd)"
```

### 3. Các câu lệnh gợi ý (Suggested Prompts)
Bạn có thể gõ nhanh vào khung chat của Antigravity:
* *"Chạy Verify Ladder (V0-V4) của Code Factory cho các thay đổi hiện tại của tớ"*
* *"Gọi dàn Vue Reviewer Fleet kiểm tra reactivity và UI cho các file .vue vừa sửa"*
* *"Gọi dàn Flutter Reviewer Fleet kiểm tra lifecycle, memory leak và lỗi overflow cho các file .dart vừa sửa"*
