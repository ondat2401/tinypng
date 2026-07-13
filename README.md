# TinyCompress

Web nén ảnh PNG / JPEG / WebP dùng [TinyPNG API (Tinify)](https://tinypng.com/developers).
Chức năng tương đương tinypng.com nhưng **không giới hạn số lượng ảnh** upload cùng lúc.

## Tính năng

- Kéo & thả nhiều ảnh (không giới hạn số lượng)
- Nén song song (4 ảnh cùng lúc) qua hàng đợi
- **Thumbnail ảnh thật** cho từng file
- **Đồng hồ quota**: hiển thị số lượt đã dùng / 500 trong tháng
- **Resize khi nén**: fit / scale / cover / thumb theo kích thước px
- Hiển thị dung lượng trước / sau + % tiết kiệm cho từng ảnh và tổng
- Chuyển định dạng: giữ nguyên / WebP / PNG / JPEG
- **Kéo-thả sắp xếp lại thứ tự** ảnh
- **Dark mode** (nhớ lựa chọn, không nhấp nháy khi tải)
- **Nhiều API key + tự xoay key khi hết quota** ngay trên web (không cần sửa file)
- Tải từng ảnh hoặc tải hết dưới dạng `.zip`
- API key mặc định được giữ **an toàn ở server** (.env), key thêm trên web lưu trong trình duyệt

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

## Ghi chú

- Giới hạn 30MB mỗi ảnh (chỉnh trong `app/api/compress/route.ts`).
- Số ảnh nén song song chỉnh bằng hằng `CONCURRENCY` trong `app/page.tsx`.
- Mỗi lần nén / chuyển định dạng tính là 1 lượt trong quota TinyPNG.
