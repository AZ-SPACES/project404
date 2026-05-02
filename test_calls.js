const http = require('http');

async function test() {
  // Login as admin to get token
  const loginRes = await fetch("http://localhost:8080/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "admin@azapay.com", password: "Password1!" })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
      console.log("Login failed:", loginData);
      return;
  }
  const token = loginData.data.accessToken;
  const adminId = loginData.data.user.id;
  console.log("Logged in admin:", adminId);

  // Now create a dummy user
  const userEmail = "dummy_" + Date.now() + "@test.com";
  const registerRes = await fetch("http://localhost:8080/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: userEmail, password: "Password1!", firstName: "Dummy", lastName: "User", phone: "123" + Date.now().toString().slice(-7) })
  });
  const regData = await registerRes.json();
  if (!regData.success) {
      console.log("Register failed:", regData);
      return;
  }
  const userId = regData.data.user.id;
  console.log("Registered dummy user:", userId);

  // Admin calls User
  const callRes = await fetch("http://localhost:8080/api/v1/calls", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ calleeId: userId, type: "VOICE" })
  });
  console.log("Call status:", callRes.status);
  console.log("Call response:", await callRes.text());
}
test();
