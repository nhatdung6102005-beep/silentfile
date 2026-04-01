# Save File Bot Auto

Bot Discord lưu file hoặc link và gửi lại qua DM.

## Tính năng
- `/save name:tên file:(chọn file)` để lưu trực tiếp
- Hoặc gửi file / link trước, sau đó chạy `/save name:tên`
- `/download name` để bot gửi lại vào DM
- `/list` để xem danh sách đã lưu
- `/delete name` để xóa mục đã lưu
- `/download` và `/delete` có gợi ý tên

## Cài đặt
1. Giải nén file ZIP
2. Mở file `.env` và điền:
   - `TOKEN`
   - `CLIENT_ID`
3. Chạy:
   ```bash
   npm install
   npm start
   ```

## Lấy CLIENT_ID
- Vào Discord Developer Portal
- Chọn ứng dụng của bot
- Tab **General Information**
- Copy **Application ID**
- Đó chính là `CLIENT_ID`

## Link add bot
Thay `CLIENT_ID` trong link dưới:
```text
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

## Lưu ý
- Bot lưu URL của file Discord hoặc link bạn gửi
- Nếu file gốc bị xóa khỏi Discord hoặc hết hiệu lực thì link có thể không dùng được nữa
