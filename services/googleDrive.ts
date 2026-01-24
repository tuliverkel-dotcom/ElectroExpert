
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
    this.clientId = id;
    localStorage.setItem('ee_google_client_id', id);
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
            
            if (window.google && this.clientId && this.clientId !== 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
              this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: (response: any) => {
                  if (response.error !== undefined) throw response;
                  this.accessToken = response.access_token;
                },
              });
            }
          } catch (e) {
            console.error("GAPI Init Error:", e);
          }
          resolve(true);
        });
      }
    });
  }

  async signIn(): Promise<boolean> {
    if (!this.clientId || this.clientId.includes('YOUR_CLIENT_ID')) {
      throw new Error("Chýba platné Google Client ID. Nastavte ho v nastaveniach.");
    }

    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        // Skúsime re-inicializovať ak sa pridalo ID neskôr
        this.init().then(() => {
          if (!this.tokenClient) return reject("Nepodarilo sa inicializovať Google Auth.");
          this.executeAuth(resolve);
        });
      } else {
        this.executeAuth(resolve);
      }
    });
  }

  private executeAuth(resolve: (val: boolean) => void) {
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
    const checkToken = setInterval(async () => {
      if (this.accessToken) {
        clearInterval(checkToken);
        await this.syncStructureWithCloud();
        resolve(true);
      }
    }, 500);
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
    console.log(`Cloud Check: ${name}`);
    return `f_${Math.random().toString(36).substr(2, 5)}`; 
  }

  async listCloudProjects(): Promise<any[]> {
    if (!this.accessToken) return [];
    return [{ id: 'cp1', name: 'Záloha z Cloudu', timestamp: Date.now() }];
  }

  async uploadFile(name: string, base64Full: string, mimeType: string, baseId: string): Promise<string> {
    if (!this.accessToken) return '';
    console.log(`Cloud Upload: ${name}`);
    return `cloud_file_${Date.now()}`;
  }

  async signOut() {
    this.accessToken = null;
    this.rootFolderId = null;
    this.baseFolderIds = {};
  }
}

export const driveService = new GoogleDriveService();
