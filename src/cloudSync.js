/**
 * cloudSync.js
 * Google Drive Sync fuer FilmDispo
 *
 * Nutzt die Google Drive REST API via gapi.
 * Speichert alle Projekte als eine einzige Datei:
 *   "filmdispo_projects.json" in "Mein Drive / FilmDispo/"
 *
 * Setup (einmalig, gratis):
 * 1. Geh zu https://console.cloud.google.com
 * 2. Neues Projekt erstellen
 * 3. "Google Drive API" aktivieren
 * 4. OAuth 2.0 Client-ID erstellen (Web-Anwendung)
 *    - Authorized JavaScript origins: deine GitHub Pages URL
 *    - z.B. https://DEIN_NAME.github.io
 * 5. Client-ID unten eintragen
 */

// ─── KONFIGURATION ────────────────────────────────────────────────────────────
// HIER DEINE GOOGLE CLIENT-ID EINTRAGEN:
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const FILE_NAME = 'filmdispo_projects.json';
const FOLDER_NAME = 'FilmDispo';
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';

let gapiLoaded = false;
let gisLoaded = false;
let tokenClient = null;

function loadGapi() {
  return new Promise((resolve) => {
    if (gapiLoaded) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiLoaded = true;
        resolve();
      });
    };
    document.head.appendChild(script);
  });
}

function loadGis() {
  return new Promise((resolve) => {
    if (gisLoaded) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    document.head.appendChild(script);
  });
}

async function findOrCreateFolder() {
  // Ordner suchen
  const res = await window.gapi.client.drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
  });
  if (res.result.files.length > 0) return res.result.files[0].id;

  // Ordner erstellen
  const created = await window.gapi.client.drive.files.create({
    resource: {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  return created.result.id;
}

async function findProjectsFile(folderId) {
  const res = await window.gapi.client.drive.files.list({
    q: `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,modifiedTime)',
    spaces: 'drive',
  });
  return res.result.files[0] || null;
}

async function uploadProjects(projects, folderId, fileId) {
  const content = JSON.stringify(projects);
  const boundary = 'filmdispo_boundary';
  const metadata = JSON.stringify({
    name: FILE_NAME,
    mimeType: 'application/json',
    ...(fileId ? {} : { parents: [folderId] }),
  });
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const method = fileId ? 'PATCH' : 'POST';
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  return response.json();
}

async function downloadProjects(fileId) {
  const res = await window.gapi.client.drive.files.get({
    fileId,
    alt: 'media',
  });
  return JSON.parse(res.body);
}

export function useCloudSync(projects, setProjects) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('idle'); // idle | syncing | synced | error
  const [lastCloudSync, setLastCloudSync] = useState(null);
  const folderIdRef = useRef(null);
  const fileIdRef = useRef(null);
  const syncTimerRef = useRef(null);

  // Check if Google credentials are configured
  const isConfigured = !!(CLIENT_ID && API_KEY);

  useEffect(() => {
    if (!isConfigured) return;
    // Check for saved token
    const savedToken = localStorage.getItem('filmdispo_gtoken');
    if (savedToken) {
      try {
        const token = JSON.parse(savedToken);
        // Token might be expired — will be refreshed on next use
        if (Date.now() < token.expires_at) {
          initGapi().then(() => {
            window.gapi.client.setToken(token);
            setIsSignedIn(true);
          });
        }
      } catch (e) {}
    }
  }, []);

  const initGapi = async () => {
    await Promise.all([loadGapi(), loadGis()]);
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) {
            setCloudStatus('error');
            return;
          }
          // Save token with expiry
          const tokenData = {
            ...response,
            expires_at: Date.now() + (response.expires_in - 60) * 1000,
          };
          localStorage.setItem('filmdispo_gtoken', JSON.stringify(tokenData));
          window.gapi.client.setToken(response);
          setIsSignedIn(true);
          setCloudStatus('idle');
        },
      });
    }
  };

  const signIn = useCallback(async () => {
    if (!isConfigured) {
      alert('Google Drive ist noch nicht konfiguriert.\n\nBitte trage deine Google Client-ID und API-Key in die .env Datei ein.\nSiehe SETUP.md fuer Anweisungen.');
      return;
    }
    await initGapi();
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }, [isConfigured]);

  const signOut = useCallback(() => {
    const token = window.gapi.client.getToken();
    if (token) window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken(null);
    localStorage.removeItem('filmdispo_gtoken');
    setIsSignedIn(false);
    setCloudStatus('idle');
    folderIdRef.current = null;
    fileIdRef.current = null;
  }, []);

  const ensureFolder = async () => {
    if (!folderIdRef.current) {
      folderIdRef.current = await findOrCreateFolder();
    }
    if (!fileIdRef.current) {
      const file = await findProjectsFile(folderIdRef.current);
      fileIdRef.current = file?.id || null;
    }
  };

  const syncToCloud = useCallback(async (currentProjects) => {
    if (!isSignedIn || !isConfigured) return;
    // Debounce: wait 3s after last change
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        setCloudStatus('syncing');
        await ensureFolder();
        const result = await uploadProjects(
          currentProjects,
          folderIdRef.current,
          fileIdRef.current
        );
        if (result.id) fileIdRef.current = result.id;
        setCloudStatus('synced');
        setLastCloudSync(Date.now());
      } catch (e) {
        console.error('Cloud sync error:', e);
        setCloudStatus('error');
      }
    }, 3000);
  }, [isSignedIn, isConfigured]);

  const loadFromCloud = useCallback(async () => {
    if (!isSignedIn || !isConfigured) return;
    try {
      setCloudStatus('syncing');
      await ensureFolder();
      if (!fileIdRef.current) {
        alert('Keine Cloud-Daten gefunden. Speichere zuerst Projekte um sie in der Cloud zu sichern.');
        setCloudStatus('idle');
        return;
      }
      const cloudProjects = await downloadProjects(fileIdRef.current);
      if (Array.isArray(cloudProjects)) {
        setProjects(cloudProjects);
        localStorage.setItem('filmdispo_projects_v1', JSON.stringify(cloudProjects));
        setCloudStatus('synced');
        setLastCloudSync(Date.now());
        alert('Projekte erfolgreich aus Cloud geladen!');
      }
    } catch (e) {
      console.error('Cloud load error:', e);
      setCloudStatus('error');
      alert('Fehler beim Laden aus der Cloud: ' + e.message);
    }
  }, [isSignedIn, isConfigured, setProjects]);

  return { cloudStatus, lastCloudSync, syncToCloud, loadFromCloud, isSignedIn, signIn, signOut, isConfigured };
}
