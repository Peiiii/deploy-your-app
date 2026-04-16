declare module 'adm-zip' {
  export default class AdmZip {
    addLocalFolder(localPath: string, zipPath?: string): void;
    toBuffer(): Buffer;
  }
}
