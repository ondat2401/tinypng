# TinyCompress

Web nén ảnh PNG / JPEG / WebP dùng [TinyPNG API (Tinify)](https://tinypng.com/developers).
Chức năng tương đương tinypng.com nhưng **không giới hạn số lượng ảnh** upload cùng lúc.

## Tính năng

- Kéo & thả nhiều ảnh (không giới hạn số lượng)
- **Kéo cả folder** hoặc bấm **"Select a folder"** → tự lấy hết ảnh bên trong (đệ quy cả folder con)
- **Lọc trùng tự động**: bỏ qua ảnh đã có (theo đường dẫn + kích thước)
- **Hiển thị đường dẫn tương đối** của ảnh trong folder
- **Tùy chọn chất lượng (Quality)** cho JPEG/WebP
- Nén song song (4 ảnh cùng lúc) qua hàng đợi
- **Thumbnail ảnh thật** cho từng file
- **Đồng hồ quota**: hiển thị số lượt đã dùng / 500 trong tháng
- **Resize khi nén**: fit / scale / cover / thumb theo kích thước px
- Hiển thị dung lượng trước / sau + % tiết kiệm cho từng ảnh và tổng
- Chuyển định dạng: giữ nguyên / WebP / PNG / JPEG
- **Kéo-thả sắp xếp lại thứ tự** ảnh
- **Dark mode** (nhớ lựa chọn, không nhấp nháy khi tải)
- **Nhiều API key + tự xoay key khi hết quota** ngay trên web (không cần sửa file)
- **Danh sách key có sẵn (preset)**: nút "Chọn key" để thêm nhanh key nội bộ
- Tải từng ảnh hoặc tải hết dưới dạng `.zip`
- API key mặc định được giữ **an toàn ở server** (.env), key thêm trên web lưu trong trình duyệt

## Nạp ảnh từ folder

- **Kéo folder** trực tiếp vào vùng thả, hoặc bấm **📁 Select a folder**.
- App duyệt **đệ quy** toàn bộ folder (kể cả folder con) bằng FileSystem Entry API và lấy hết file PNG/JPEG/WebP. File khác loại bị bỏ qua tự động.
- Với mỗi ảnh, **đường dẫn tương đối** trong folder được hiển thị phía trên tên file (icon 📁).
- **Lọc trùng**: nếu một ảnh có cùng đường dẫn + kích thước với ảnh đã nạp, nó sẽ bị bỏ qua để tránh nén lặp.
- Hỗ trợ tốt trên trình duyệt nền Chromium (Chrome/Edge/Brave/Cốc Cốc) và Safari. Firefox nên dùng nút "Select a folder".

## Tùy chọn chất lượng (Quality)

- Thanh trượt **Quality (40–100%)**, mặc định `Max` (100 = không đổi).
- **Chỉ áp dụng cho ảnh JPEG/WebP.** PNG bỏ qua tùy chọn này.
- Lưu ý: TinyPNG API nén tự động (smart lossy) và **không có tham số quality** phía server. Vì vậy khi bạn chọn quality < 100, ảnh sau khi TinyPNG nén sẽ được **mã hóa lại phía trình duyệt** (canvas) ở mức chất lượng đã chọn — cho phép đánh đổi thêm dung lượng lấy chất lượng thấp hơn.

## Quản lý API key & xoay key

- Key mặc định lấy từ `.env.local` (an toàn ở server).
- Bấm **"Quản lý key"** ở thanh quota để thêm nhiều key khác (lưu trong `localStorage` của trình duyệt).
- Khi key đang dùng **hết quota** (TinyPNG trả lỗi tài khoản), web **tự động chuyển sang key kế tiếp** rồi nén tiếp các ảnh còn lại. Nếu hết sạch key thì các ảnh còn lại được đánh dấu lỗi.
- Key được gửi tới backend qua header `x-api-key`; để tránh xung đột khi nén song song, web chỉ đổi key **sau khi** các request đang chạy kết thúc (cơ chế hàng rào).

## Cài đặt

```bash
npm install
```

## Cấu hình API key

1. Đăng ký key miễn phí tại https://tinypng.com/developers (free 500 ảnh/tháng).
2. Tạo file `.env.local` ở thư mục gốc:

```bash
cp .env.example .env.local
```

3. Mở `.env.local` và điền key:

```
TINIFY_API_KEY=key_that_bạn_nhận_được
```

## Chạy

```bash
# Môi trường dev
npm run dev

# Bản production
npm run build
npm start
```

Mở http://localhost:3000

## Cấu trúc

```
app/
  layout.tsx              # layout gốc
  page.tsx                # UI: kéo-thả, hàng đợi, tải zip
  globals.css             # Tailwind v4
  api/compress/route.ts   # backend gọi Tinify (giữ API key)
```

## Key có sẵn (preset) cho nội bộ

- Sửa mảng `PRESET_KEYS` ở đầu `app/page.tsx` để khai báo các key dùng nhanh:

```ts
const PRESET_KEYS = [
  { label: "Key nội bộ 1", value: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
  { label: "Key nội bộ 2", value: "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy" },
];
```

- Trên web, bấm **"Chọn key ▾"** ở thanh quota để thêm nhanh và kích hoạt key.
- ⚠️ **Cảnh báo bảo mật:** các key này nằm trong mã nguồn phía client, sẽ **lộ công khai** nếu repo public. Chỉ dùng cho môi trường nội bộ, hoặc để repo ở chế độ **Private**.

## Triển khai (Deploy) lên Vercel

1. Đẩy code lên GitHub.
2. Vào https://vercel.com → **Add New → Project** → import repo.
3. (Tùy chọn) Thêm biến môi trường `TINIFY_API_KEY` trong **Settings → Environment Variables** nếu muốn dùng key dùng chung ở server.
4. **Deploy**. Mỗi lần `git push`, Vercel tự động deploy lại.

File `vercel.json` đã cấu hình sẵn: framework `nextjs`, region `sin1` (Singapore) và cho phép API nén chạy tối đa 60 giây.

## Ghi chú

- Giới hạn 30MB mỗi ảnh (chỉnh trong `app/api/compress/route.ts`).
- Số ảnh nén song song chỉnh bằng hằng `CONCURRENCY` trong `app/page.tsx`.
- Mỗi lần nén / chuyển định dạng tính là 1 lượt trong quota TinyPNG.
- Tùy chọn Quality re-encode phía client nên không tốn thêm lượt quota TinyPNG.
