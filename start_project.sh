#!/bin/bash

# MedReviewAI - One-Click Start Script

echo "🚀 Starting MedReviewAI Project..."

# 1. Kill any existing processes on ports 8000 (Backend) and 5173/8080 (Frontend)
echo "🧹 Cleaning up existing processes..."
fuser -k 8000/tcp > /dev/null 2>&1
fuser -k 5173/tcp > /dev/null 2>&1
fuser -k 8080/tcp > /dev/null 2>&1

# 2. Start the Backend
echo "🐍 Starting Python Backend (FastAPI)..."
cd backend
source venv/bin/activate
# Run in background and redirect output to a log file
nohup python3 main.py > backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# 3. Start the Frontend
echo "⚛️ Starting React Frontend (Vite)..."
cd ..
# Run in background
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo "---------------------------------------------------"
echo "🎉 SUCCESS! MedReviewAI is running."
echo "🔗 Frontend: http://localhost:5173 (or http://localhost:8080)"
echo "🔗 Backend API: http://localhost:8000"
echo "---------------------------------------------------"
echo "Tips for your presentation:"
echo "1. Wait about 10 seconds for the backend to fully initialize."
echo "2. Keep this terminal open or check backend.log if you see any issues."
echo "3. Use Groq for lightning-fast results in front of your professor!"
