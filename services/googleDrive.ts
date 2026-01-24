
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
  }

  async init() {
    return new Promise((resolve) => {
      if (window.gapi) {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: process.env.API_KEY,
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            
            this.reinitTokenClient();
          } catch (e) {
            console.error("GAPI Init Error:", e);
          }
          resolve(true);
        });
      }
    });
  }

  private reinitTokenClient() {
    if (window.google && this.clientId && this.clientId.endsWith('.apps.googleusercontent.com')) {
      try {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (response.error !== undefined) {
              console.error("Auth Callback Error:", response);
              throw response;
            }
            this.accessToken = response.access_token;
          },
        });
      } catch (err) {
        console.error("TokenClient Init Failed:", err);
      }
    }
  }

  async signIn(): Promise<boolean> {
    if (!this.clientId || !this.clientId.endsWith('.apps.googleusercontent.com')) {
      throw new Error("Chýba platné Google Client ID.");
    }

    return new Promise((resolve, reject) => {
      this.reinitTokenClient();
      
      if (!this.tokenClient) {
        return reject(new Error("Nepodarilo sa vytvoriť prihlasovacieho klienta. Skontrolujte Client ID."));
      }

      try {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
        
        let attempts = 0;
        const checkToken = setInterval(async () => {
          attempts++;
          if (this.accessToken) {
            clearInterval(checkToken);
            await this.syncStructureWithCloud();
            resolve(true);
          }
          if (attempts > 120) { // 60 sekúnd timeout
            clearInterval(checkToken);
            reject(new Error("Časový limit prihlásenia vypršal."));
          }
        }, 500);
      } catch (e) {
        reject(e);
      }
    });
  }

  private async syncStructureWithCloud() {
    this.rootFolderId = await this.findOrCreateFolder("ElectroExpert_Cloud");
    const bases = ['General', 'INTEC', 'VEGA'];
    for (const base of bases) {
      const id = await this.findOrCreateFolder(base, this.rootFolderId!);
      this.baseFolderIds[base.toLowerCase()] = id;
    }
  }

  async findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    // V demo režime simulujeme, v reálnej produkcii by tu bol GAPI call
    return `f_${Math.random().toString(36).substr(2, 5)}`; 
  }

  async uploadFile(name: string, base64Full: string, mimeType: string, baseId: string): Promise<string> {
    if (!this.accessToken) return '';
    console.log(`Cloud Upload Simulated: ${name}`);
    return `cloud_file_${Date.now()}`;
  }

  async signOut() {
    this.accessToken = null;
    this.rootFolderId = null;
    this.baseFolderIds = {};
  }
}

export const driveService = new GoogleDriveService();
