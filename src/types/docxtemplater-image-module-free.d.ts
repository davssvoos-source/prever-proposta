declare module "docxtemplater-image-module-free" {
  interface ImageModuleOptions {
    centered?: boolean;
    fileType?: string;
    getImage: (tagValue: string, tagName: string) => ArrayBuffer | Uint8Array | Buffer;
    getSize: (img: unknown, tagValue: string, tagName: string) => [number, number];
  }
  export default class ImageModule {
    constructor(options: ImageModuleOptions);
  }
}
