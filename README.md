# AI Werewolf (Werewolf AI Host) - Deployment Guide

This is a web-based Werewolf game built with **React**, **TypeScript**, and **Tailwind CSS**, featuring **Google Gemini AI** as the game host and bot players.

Follow this guide to deploy the application to a cloud platform or your own server.

## 📋 Prerequisites

Before you begin, ensure you have:
1. **Node.js** (Version 18+ recommended)
2. **npm** or **yarn**
3. **Google Gemini API Key** (Get one at [Google AI Studio](https://aistudiocdn.com/google-ai-studio))

---

## 🚀 Step 1: Project Initialization

Since the source code is in TypeScript (`.tsx`), it cannot run directly in a browser. You need a build tool like **Vite** to compile it.

1. **Create a Vite Project**
   Open your terminal and run:
   ```bash
   npm create vite@latest werewolf-ai -- --template react-ts
   cd werewolf-ai
   ```

2. **Install Dependencies**
   Install the required libraries:
   ```bash
   npm install @google/genai lucide-react
   ```

3. **Migrate Files**
   Copy the code files you have into the `src` folder of the new project:
   - `App.tsx` -> `src/App.tsx`
   - `components/` -> `src/components/`
   - `services/` -> `src/services/`
   - `types.ts` -> `src/types.ts`
   - `constants.ts` -> `src/constants.ts`

4. **Setup Tailwind CSS**
   For production, install Tailwind locally instead of using the CDN:
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
   
   Update `tailwind.config.js`:
   ```javascript
   export default {
     content: [
       "./index.html",
       "./src/**/*.{js,ts,jsx,tsx}",
     ],
     theme: {
       extend: {
         fontFamily: {
           serif: ['"Noto Serif TC"', 'serif'],
           sans: ['"Roboto"', 'sans-serif'],
         }
       },
     },
     plugins: [],
   }
   ```
   
   Add the following to the top of `src/index.css`:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

5. **Update API Key Logic (Important)**
   Vite uses `import.meta.env` for environment variables.
   **You must update `src/services/geminiService.ts`**:
   Replace all instances of `process.env.API_KEY` with:
   ```ts
   import.meta.env.VITE_API_KEY
   ```

---

## ☁️ Option A: Deploy to Vercel (Recommended)

Vercel is the easiest way to deploy React apps with free HTTPS.

1. **Push to GitHub**
   Upload your `werewolf-ai` folder to a GitHub repository.

2. **Connect to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/).
   - Click **Add New** > **Project**.
   - Select your GitHub repository.

3. **Configure Environment Variables**
   - In the Vercel project settings, find **Environment Variables**.
   - Key: `VITE_API_KEY`
   - Value: `YOUR_GOOGLE_GEMINI_API_KEY`

4. **Deploy**
   - Click **Deploy**.
   - Your site will be live in a minute!

---

## 🖥️ Option B: Deploy to Linux Server (Nginx)

Use this method for VPS providers like AWS, Google Cloud, or DigitalOcean.

### 1. Build on Server

Upload your project to the server and run:

```bash
# 1. Set Environment Variable (or use a .env file)
export VITE_API_KEY=your_actual_api_key

# 2. Build the project
npm run build
```
This creates a `dist` folder containing the static website files.

### 2. Configure Nginx

Install Nginx (e.g., on Ubuntu):
```bash
sudo apt update
sudo apt install nginx
```

Edit Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/werewolf
```

Paste the following configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com; # Replace with your Domain or IP

    root /path/to/your/project/dist; # Point to the 'dist' folder created in step 1
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/werewolf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🐳 Option C: Deploy with Docker

If you prefer containerization, use this method.

1. **Create a `Dockerfile`**
   Create a file named `Dockerfile` in the project root:

   ```dockerfile
   # Build Stage
   FROM node:18-alpine as build
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   # Accept build argument for API Key
   ARG VITE_API_KEY
   ENV VITE_API_KEY=$VITE_API_KEY
   RUN npm run build

   # Production Stage
   FROM nginx:alpine
   COPY --from=build /app/dist /usr/share/nginx/html
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Build and Run**

   ```bash
   # Build the image (Inject your API Key here)
   docker build --build-arg VITE_API_KEY=your_actual_api_key -t werewolf-ai .

   # Run the container
   docker run -d -p 8080:80 werewolf-ai
   ```
   Access the game at `http://localhost:8080` (or your server IP).

---

## ⚠️ Important Notes

1. **API Key Security**:
   Since this is a frontend-only application, your API Key is exposed to the browser. It is highly recommended to **restrict your API Key** in the Google Cloud Console to allow requests only from your specific domain (e.g., `https://your-game.vercel.app`) or IP address to prevent misuse.

2. **Audio & Browser Policies**:
   Modern browsers (Chrome/Safari) block auto-playing audio. If sound effects do not play, click anywhere on the page to unlock the Audio Context.
