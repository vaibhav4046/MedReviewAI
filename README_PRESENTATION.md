# MedReviewAI Presentation Guide 🎓

Follow these steps tomorrow to ensure a flawless presentation for your professor.

## 1. Preparation (Before the Professor Arrives)
Make sure your `.env` file in the root directory has all the necessary keys:
- `DATABASE_URL` (Neon PostgreSQL)
- `GROQ_API_KEY` (Used for fast analysis)
- `GEMINI_API_KEY` (Backup)
- `PUBMED_API_KEY` (Optional but recommended)

## 2. Starting the Application
Open a terminal in the project folder and run:
```bash
./start_project.sh
```
This script will:
- Stop any old versions of the app.
- Start the **Backend** on port `8000`.
- Start the **Frontend** (Vite).

## 3. During the Demo
- **Searching**: Use keywords like "diabetes", "lung cancer", or "heart disease".
- **Analysis**: Click the "Analyze" button on any PubMed result. It will use **Groq**, which is extremely fast—perfect for a live demo.
- **PDF Upload**: You can upload a medical PDF in the "Analyze" tab. It will extract the text and show the PICO framework instantly.
- **History**: All your previous analyses are saved in the **Neon Database** and can be viewed in the "History" or "Dashboard" tabs.

## 4. Troubleshooting
If you see "Failed to fetch":
1. Check if the backend is still running: `ps aux | grep main.py`
2. Check the logs: `cat backend/backend.log`
3. Restart the app: `./start_project.sh`

Good luck! You've got this! 🚀
