
export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  parentId?: string;
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

class GoogleDriveService {
  private accessToken: string | null = null;
  private rootFolderId: string | null = null;
  private baseFolderIds: Record<string, string> = {};
  private tokenClient: any = null;
  private clientId: string | null = localStorage.getItem('ee_google_client_id');

  setClientId(id: string) {
    this.clientId = id.trim();
    localStorage.setItem('ee_google_client_id', this.clientId);
    this.reinitTokenClient();
  }

  async init() {
    return new Promise((resolve) => {
      if (window.gapi) {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              // Všimnite si: API kľúč nie je nevyhnutný pre Drive Upload ak používame OAuth
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            this.reinitTokenClient();
          } catch (e) {
            console.error("GAPI Init Error:", e);
          }
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  }

  private reinitTokenClient() {
    if (window.google?.accounts?.oauth2 && this.clientId && this.clientId.endsWith('.apps.googleusercontent.com')) {
      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.resource',
          callback: (response: any) => {
            if (response.error !== undefined) {
              console.error("Auth Callback Response Error:", response);
              // Nepoužívame alert tu, chybu zachytí App.tsx
            }
            this.accessToken = response.access_token;
          },
        });
        console.log("Token Client Initialized with ID:", this.clientId);
      } catch (err) {
        console.error("TokenClient Init Failed:", err);
      }
    }
  }

  async signIn(): Promise<boolean> {
    if (!this.clientId || !this.clientId.endsWith('.apps.googleusercontent.com')) {
      throw new Error("Neplatné Client ID.");
    }

    return new Promise((resolve, reject) => {
      // Skúsime reinicializáciu tesne pred prihlásením
      this.reinitTokenClient();
      
      if (!this.tokenClient) {
        return reject(new Error("GSI_LOAD_ERROR: Nepodarilo sa inicializovať Google Identity Services."));
      }

      try {
        // Vyžiadame token
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
        
        let attempts = 0;
        const checkToken = setInterval(async () => {
          attempts++;
          if (this.accessToken) {
            clearInterval(checkToken);
            resolve(true);
          }
          if (attempts > 120) { // 60 sekúnd timeout
            clearInterval(checkToken);
            reject(new Error("TIMEOUT: Používateľ nepotvrdil prihlásenie alebo kľúč je neplatný."));
          }
        }, 500);
      } catch (e) {
        console.error("Sign-in process failed:", e);
        reject(e);
      }
    });
  }

  async uploadFile(name: string, base64Full: string, mimeType: string, baseId: string): Promise<string> {
    if (!this.accessToken) return '';
    console.log(`Cloud Upload: ${name}`);
    // Tu by nasledoval reálny fetch na Drive API v3
    return `cloud_id_${Date.now()}`;
  }

  async signOut() {
    this.accessToken = null;
    this.rootFolderId = null;
    this.baseFolderIds = {};
  }
}

export const driveService = new GoogleDriveService();
