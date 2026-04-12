# FilmDispo – Setup & Deployment

## Voraussetzungen
- [Node.js](https://nodejs.org) (v18 oder neuer)
- [Git](https://git-scm.com)
- GitHub Account

---

## 1. Repository auf GitHub erstellen

1. Geh zu [github.com/new](https://github.com/new)
2. Repository-Name: `filmdispo` (oder was du möchtest)
3. **Öffentlich** oder **Privat** – beides funktioniert
4. Ohne README erstellen (wir pushen alles selbst)

---

## 2. Lokale Installation

```bash
# Abhängigkeiten installieren
npm install

# Lokaler Entwicklungsserver starten (optional zum Testen)
npm run dev
```

---

## 3. vite.config.js anpassen

Öffne `vite.config.js` und ändere `REPO_NAME` auf deinen Repository-Namen:

```js
const REPO_NAME = 'filmdispo'  // <- dein Repo-Name
```

---

## 4. Code zu GitHub pushen

```bash
git init
git add .
git commit -m "Initial FilmDispo deployment"
git branch -M main
git remote add origin https://github.com/DEIN_NAME/DEIN_REPO.git
git push -u origin main
```

---

## 5. GitHub Pages aktivieren

1. Geh zu deinem Repository → **Settings** → **Pages**
2. Source: **GitHub Actions**
3. Der erste Deploy startet automatisch (dauert ~2 Min.)
4. Deine App ist dann erreichbar unter:
   `https://DEIN_NAME.github.io/DEIN_REPO/`

---

## 6. Google Drive Sync einrichten (optional)

### Google Cloud Projekt erstellen

1. Geh zu [console.cloud.google.com](https://console.cloud.google.com)
2. Neues Projekt erstellen (z.B. "FilmDispo")
3. **APIs & Services** → **Bibliothek**
4. "Google Drive API" suchen und **aktivieren**

### API-Schlüssel erstellen

1. **APIs & Services** → **Anmeldedaten** → **Anmeldedaten erstellen** → **API-Schlüssel**
2. Key kopieren → in `.env` als `VITE_GOOGLE_API_KEY` eintragen
3. API-Schlüssel einschränken: nur "Google Drive API"

### OAuth Client-ID erstellen

1. **Anmeldedaten erstellen** → **OAuth-Client-ID**
2. Anwendungstyp: **Webanwendung**
3. Name: "FilmDispo"
4. **Autorisierte JavaScript-Quellen** hinzufügen:
   - `http://localhost:5173` (für lokale Entwicklung)
   - `https://DEIN_NAME.github.io` (für GitHub Pages)
5. Client-ID kopieren → in `.env` als `VITE_GOOGLE_CLIENT_ID` eintragen

### .env Datei anlegen

```bash
cp .env.example .env
# Dann .env öffnen und Werte eintragen
```

### GitHub Secrets für automatisches Deployment

Damit die Google-Credentials beim Build verfügbar sind:

1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. Zwei Secrets hinzufügen:
   - `VITE_GOOGLE_CLIENT_ID` = deine Client-ID
   - `VITE_GOOGLE_API_KEY` = dein API-Key
3. Die `deploy.yml` Workflow-Datei bereits konfiguriert zum Nutzen dieser Secrets

### deploy.yml für Secrets aktualisieren

Füge in `.github/workflows/deploy.yml` vor dem Build-Step ein:

```yaml
      - name: Build
        run: npm run build
        env:
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
          VITE_GOOGLE_API_KEY: ${{ secrets.VITE_GOOGLE_API_KEY }}
```

---

## Nutzung auf mehreren Geräten

1. Öffne FilmDispo auf Gerät A
2. Klicke **"☁ Mit Google anmelden"** in der Topbar
3. Alle Änderungen werden automatisch in Google Drive gespeichert
4. Auf Gerät B: Anmelden + **"↓ Laden"** klicken

Daten werden gespeichert in:
`Google Drive / FilmDispo / filmdispo_projects.json`

---

## Lokale Entwicklung

```bash
npm run dev       # Entwicklungsserver auf localhost:5173
npm run build     # Production Build in ./dist/
npm run preview   # Production Build lokal ansehen
```
