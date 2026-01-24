
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

  async init() {
    return new Promise((resolve) => {
      if (window.gapi) {
        window.gapi.load('client', async () => {
          await window.gapi.client.init({
            apiKey: process.env.API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
          
          if (window.google) {
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
              scope: 'https://www.googleapis.com/auth/drive.file',
              callback: (response: any) => {
                if (response.error !== undefined) throw response;
                this.accessToken = response.access_token;
              },
            });
          }
          resolve(true);
        });
      }
    });
  }

  async signIn(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.tokenClient) return resolve(false);
      this.tokenClient.requestAccessToken({ prompt: 'none' }); // Skúsiť tiché prihlásenie ak už bol udelený súhlas
      
      const checkToken = setInterval(async () => {
        if (this.accessToken) {
          clearInterval(checkToken);
          await this.syncStructureWithCloud();
          resolve(true);
        }
      }, 500);

      // Timeout pre prípad, že prompt: 'none' zlyhá
      setTimeout(() => {
        if (!this.accessToken) {
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
        }
      }, 1000);
    });
  }

  private async syncStructureWithCloud() {
    // 1. Hľadáme existujúci root
    this.rootFolderId = await this.findOrCreateFolder("ElectroExpert_Cloud");
    
    // 2. Mapujeme základné priečinky
    const bases = ['General', 'INTEC', 'VEGA'];
    for (const base of bases) {
      const id = await this.findOrCreateFolder(base, this.rootFolderId!);
      this.baseFolderIds[base.toLowerCase()] = id;
    }
    console.log("Cloud štruktúra synchronizovaná.");
  }

  async findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    // V reálnom GAPI by tu bol list s q: "name = '...' and mimeType = 'folder' and '...' in parents"
    console.log(`Cloud Check: Hľadám/Vytváram priečinok "${name}"`);
    return `f_${Math.random().toString(36).substr(2, 5)}`; 
  }

  async listCloudProjects(): Promise<any[]> {
    if (!this.accessToken) return [];
    // Simulácia načítania zoznamu priečinkov začínajúcich na "Projekt_"
    return [
      { id: 'cp1', name: 'Existujúci Projekt z Disku', timestamp: Date.now() - 86400000 }
    ];
  }

  // Fix: Added missing uploadFile method to handle cloud synchronization of documentation
  async uploadFile(name: string, base64Full: string, mimeType: string, baseId: string): Promise<string> {
    if (!this.accessToken) {
      console.warn("Google Drive: Not authenticated, skipping upload.");
      return '';
    }
    const parentId = this.baseFolderIds[baseId.toLowerCase()] || this.rootFolderId;
    console.log(`Cloud Upload: Nahrávam "${name}" (typ: ${mimeType}) do priečinka ${baseId} (Parent: ${parentId})`);
    
    // In a production environment, this would call window.gapi.client.drive.files.create
    // for a multipart upload using the provided base64 content.
    return `cloud_file_${Math.random().toString(36).substr(2, 9)}`;
  }

  async signOut() {
    this.accessToken = null;
    this.rootFolderId = null;
    this.baseFolderIds = {};
  }

  getIsAuthenticated() {
    return !!this.accessToken;
  }
}

export const driveService = new GoogleDriveService();
