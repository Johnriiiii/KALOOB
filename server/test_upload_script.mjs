import fs from "fs";
import path from "path";
const filePath = path.join(process.cwd(), "tmp_upload_test.xlsx");
const loginRes = await fetch("http://127.0.0.1:4000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "sj-parish", password: "Kaloob2026!" }),
});
const loginBody = await loginRes.json();
console.log("login", loginRes.status, loginBody);
if (!loginRes.ok) process.exit(1);
const token = loginBody.token;
const form = new FormData();
form.append("file", fs.createReadStream(filePath));
form.append("description", "test upload");
form.append("chapelId", "all");
const uploadRes = await fetch("http://127.0.0.1:4000/api/files/upload", {
  method: "POST",
  headers: { Authorization: "Bearer " + token },
  body: form,
});
const text = await uploadRes.text();
console.log("upload", uploadRes.status, text);
