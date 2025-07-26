# 🔗 Connect Railway Backend to Vercel Frontend

## 🎯 **Step-by-Step Connection Guide**

### **1. Get Your Railway Backend URL**

1. Go to your **Railway Dashboard**
2. Click on your backend project
3. Go to **"Settings"** → **"Domains"**
4. Copy the **public domain** (e.g., `https://quiz-backend-production-abc123.up.railway.app`)

### **2. Test Backend Connection**

Open in browser or use curl:
```
https://your-railway-url.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "redis": { "connected": true },
  "connections": { "active": 0 },
  "memory": { "used": 45 }
}
```

### **3. Configure Vercel Environment Variables**

In your **Vercel Dashboard**:

1. Go to your project
2. Click **"Settings"** → **"Environment Variables"**
3. Add these variables:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-railway-url.up.railway.app` | All |
| `NEXT_PUBLIC_BACKEND_WS_URL` | `wss://your-railway-url.up.railway.app` | All |

### **4. Update Railway CORS Settings**

In your **Railway backend environment variables**, add:
```
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://localhost:3000,https://localhost:5173
```

### **5. Redeploy Frontend**

In Vercel:
1. Go to **"Deployments"**
2. Click **"Redeploy"** on your latest deployment
3. Check **"Use existing Build Cache"** is **unchecked**

### **6. Test Connection**

1. Open your Vercel app: `https://your-app.vercel.app`
2. Create a quiz session
3. Open multiple tabs and join as participants
4. Check browser console for connection status

### **7. Verify 300+ Participant Readiness**

Check backend metrics:
```
https://your-railway-url.up.railway.app/api/metrics
```

Expected:
```json
{
  "activeConnections": 0,
  "totalParticipants": 0,
  "memory": {...},
  "uptime": 1234
}
```

## 🚨 **Common Issues & Solutions**

### **CORS Error**
```javascript
// Error: "Access-Control-Allow-Origin"
```
**Solution:** Add your Vercel URL to Railway backend's `ALLOWED_ORIGINS`

### **WebSocket Connection Failed**
```javascript
// Error: WebSocket connection failed
```
**Solution:** Use `wss://` for the WebSocket URL in Vercel env vars

### **Backend Not Found**
```javascript
// Error: Failed to fetch
```
**Solution:** Verify Railway URL is correct and backend is running

## 🎉 **Success Indicators**

✅ Backend health check returns `"status": "healthy"`  
✅ Frontend connects to backend without CORS errors  
✅ WebSocket connection established  
✅ Multiple participants can join quiz session  
✅ Real-time updates work smoothly  

## 🔄 **Environment Variables Summary**

### **Vercel (Frontend)**
```env
NEXT_PUBLIC_BACKEND_URL=https://your-railway-url.up.railway.app
NEXT_PUBLIC_BACKEND_WS_URL=wss://your-railway-url.up.railway.app
```

### **Railway (Backend)**
```env
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
NODE_ENV=production
CLUSTER_ENABLED=true
```

🚀 **Your 300+ participant setup is now complete!** 