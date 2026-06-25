# AgroInsight - AI-Powered Smart Crop Recommendation System

Full-stack platform: Flask + MySQL backend with a trained ML pipeline
(KNN / Random Forest / XGBoost + SHAP/LIME explainability), and a React +
Vite PWA frontend with JWT auth, Kannada/English i18n, a land allocation
planner, and model/research dashboards.

---

## 1. Prerequisites

- **XAMPP** running, with **MySQL** started (Apache not required — Flask
  serves the API directly)
- **Python 3.10+**
- **Node.js 18+** and npm

---

## 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 2.1 Create the database

Open phpMyAdmin (via XAMPP) or the MySQL CLI and run:

```sql
CREATE DATABASE agroinsight_db;
```

### 2.2 Configure environment variables

A working `.env` is already included with random JWT/secret keys and
XAMPP's default credentials (`root` / blank password). Open `backend/.env`
and set your real OpenWeatherMap key:

```
OPENWEATHER_API_KEY=your_real_key_here
```

Get a free key at https://openweathermap.org/api if you don't have one.
If `DB_USER`/`DB_PASSWORD` differ from XAMPP defaults on your machine,
update those too.

### 2.3 Train the ML models

The trained model artifacts are already included in
`backend/app/ml/artifacts/` (trained on the provided dataset, Random Forest
selected as best model at 99.37% CV F1). Re-run this only if you change the
dataset:

```bash
python -m app.ml.train_models
```

### 2.4 Run database migrations

```bash
flask --app run.py db init        # only the very first time
flask --app run.py db migrate -m "initial schema"
flask --app run.py db upgrade
```

This creates the `users`, `recommendation_history`, and `saved_plans`
tables in `agroinsight_db`.

### 2.5 Start the backend

```bash
python run.py
```

API is now live at `http://localhost:5000/api`. Check
`http://localhost:5000/api/health` → `{"status": "ok"}`.

---

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`. The included `.env` already points
it at `http://localhost:5000/api`.

---

## 4. First Use

1. Open `http://localhost:5173`, click **Sign Up**
2. Fill in your name, email, password, **city** (required — used for
   automatic weather lookup), state, and land area
3. Go to **Recommend**, enter N, P, K, pH → get your Top-5 crop
   recommendations with SHAP explanation
4. Click **Plan My Land** to open the Land Allocation Planner
5. Check **Models** for the performance dashboard, **Research** for the
   SHAP/LIME benchmark
6. Toggle language (EN/ಕನ್ನಡ) and theme (light/dark) from the navbar

---

## 5. Project Structure

```
agroinsight/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Flask app factory
│   │   ├── config.py            # env-based config
│   │   ├── extensions.py        # db, jwt, bcrypt, cors, limiter, migrate
│   │   ├── models/               # User, RecommendationHistory, SavedPlan
│   │   ├── routes/               # auth, profile, recommend, history, plans, models
│   │   ├── services/
│   │   │   └── weather_service.py
│   │   ├── ml/
│   │   │   ├── train_models.py   # run once to (re)train
│   │   │   ├── prediction_service.py  # loads artifacts, serves predictions + SHAP/LIME
│   │   │   ├── crop_data.csv
│   │   │   └── artifacts/        # trained .pkl models, scaler, encoder, metrics.json
│   │   └── utils/validators.py
│   ├── migrations/               # Alembic migration history
│   ├── requirements.txt
│   ├── .env / .env.example
│   └── run.py
│
└── frontend/
    ├── src/
    │   ├── api/                  # axios client + endpoint modules
    │   ├── context/              # Auth, Theme contexts + hooks
    │   ├── components/           # Navbar, Layout, ProtectedRoute, StrataBar
    │   ├── pages/                 # Login, Register, Dashboard, Recommend,
    │   │                          # Planner, History, Profile, ModelDashboard,
    │   │                          # ResearchDashboard
    │   ├── locales/              # en.json, kn.json
    │   ├── i18n.js
    │   ├── App.jsx
    │   └── index.css             # Tailwind v4 theme tokens
    ├── vite.config.js            # Tailwind + PWA plugin config
    └── .env
```

---

## 6. Key Design Notes

- **JWT storage**: access + refresh tokens live in memory and
  `sessionStorage` only (never `localStorage`), per spec. Axios
  automatically attaches `Authorization: Bearer <token>` and refreshes
  on 401.
- **Weather**: fetched live from OpenWeatherMap based on the user's
  profile city; falls back to fixed averages if the API key is missing
  or the call fails, so recommendations never break.
- **ML pipeline**: trained once via `train_models.py`, not retrained per
  request. Random Forest currently wins by cross-validated F1, but the
  best model is auto-selected and recorded in `metrics.json` — re-running
  training after a dataset change can change which model wins.
- **PWA**: app shell precached for offline install; all `/api/*` calls
  remain `NetworkOnly` as specified, so predictions/auth never serve stale
  cached data.
- **i18n**: every UI string (nav, forms, results, explanations, dashboards)
  is translated via `react-i18next`; `en.json`/`kn.json` keys are 1:1.

---

## 7. Production Deployment Checklist

- [ ] Replace `.env` secrets with strong, unique values (never reuse the
      dev-generated ones committed here)
- [ ] Set `FLASK_ENV=production`
- [ ] Run behind `gunicorn` (included in requirements.txt):
      `gunicorn -w 4 -b 0.0.0.0:5000 run:app`
- [ ] Serve the frontend build (`npm run build` → `dist/`) via a static
      host or CDN; update `VITE_API_BASE_URL` to the real API domain
- [ ] Enable HTTPS on both frontend and backend (JWT bearer tokens must
      not travel over plain HTTP in production)
- [ ] Restrict `FRONTEND_ORIGIN` CORS setting to the real deployed domain
- [ ] Set up a process manager (systemd/supervisor) for the Flask app
- [ ] Point `SQLALCHEMY_DATABASE_URI` at a managed MySQL instance, not
      local XAMPP
- [ ] Re-run `flask db upgrade` against the production database
