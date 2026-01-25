
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
  private tokenClient: any = null;
  private clientId: string | null = localStorage.getItem('ee_google_client_id');
  private rootFolderId: string | null = null;

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
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            this.reinitTokenClient();
          } catch (e) {
            console.error("GAPI Init Error:", e);
          }
          resolve(true);
        });
      } else {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => this.init().then(resolve);
        document.body.appendChild(script);
      }
    });
  }

  private reinitTokenClient() {
    if (window.google?.accounts?.oauth2 && this.clientId) {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.access_token) {
            this.accessToken = response.access_token;
          }
        },
      });
    }
  }

  async signIn(): Promise<boolean> {
    if (!this.clientId) return false;
    
    return new Promise((resolve) => {
      if (!this.tokenClient) this.reinitTokenClient();
      this.tokenClient.requestAccessToken({ prompt: '' });
      
      let check = setInterval(() => {
        if (this.accessToken) {
          clearInterval(check);
          this.ensureRootFolder().then(() => resolve(true));
        }
      }, 500);
      
      setTimeout(() => { clearInterval(check); resolve(!!this.accessToken); }, 30000);
    });
  }

  private async ensureRootFolder(): Promise<string> {
    if (this.rootFolderId) return this.rootFolderId;
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='ElectroExpert_Cloud' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
      this.rootFolderId = data.files[0].id;
    } else {
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'ElectroExpert_Cloud',
          mimeType: 'application/vnd.google-apps.folder',
        }),
      });
      const folder = await createResponse.json();
      this.rootFolderId = folder.id;
    }
    return this.rootFolderId!;
  }

  async findFile(name: string, parentId?: string): Promise<string | null> {
    if (!this.accessToken) return null;
    const parent = parentId || await this.ensureRootFolder();
    const query = `name='${name}' and '${parent}' in parents and trashed=false`;
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  async getFileContent(fileId: string): Promise<string> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return await response.text();
  }

  async saveConfig(name: string, content: string): Promise<void> {
    if (!this.accessToken) return;
    const rootId = await this.ensureRootFolder();
    const existingId = await this.findFile(name, rootId);

    if (existingId) {
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: content
      });
    } else {
      const metadata = { name, parents: [rootId] };
      const boundary = 'config_sync';
      const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--`;
      
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      });
    }
  }

  private async getSubfolderId(baseId: string): Promise<string> {
    const rootId = await this.ensureRootFolder();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${baseId}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    } else {
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: baseId,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootId],
        }),
      });
      const folder = await createResponse.json();
      return folder.id;
    }
  }

  async uploadFile(name: string, base64: string, mimeType: string, baseId: string): Promise<string> {
    if (!this.accessToken) return '';
    
    try {
      const parentId = await this.getSubfolderId(baseId);
      const metadata = { name, parents: [parentId] };
      const boundary = 'upload_boundary';
      const multipartRequestBody = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64}\r\n--${boundary}--`;

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      const result = await response.json();
      return result.id;
    } catch (e) {
      console.error("Cloud Upload Failed:", e);
      return '';
    }
  }
}

export const driveService = new GoogleDriveService();
