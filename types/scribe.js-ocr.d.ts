declare module 'scribe.js-ocr' {
  interface ScribeInitOptions {
    ocr: boolean;
    pdf: boolean;
    font: boolean;
  }

  interface ScribeRecognizeOptions {
    langs: string[];
    mode: string;
    modeAdv: string;
    combineMode: string;
  }

  interface Scribe {
    init(options: ScribeInitOptions): Promise<void>;
    importFiles(paths: string[]): Promise<void>;
    recognize(options: ScribeRecognizeOptions): Promise<void>;
    exportData(format: string): Promise<string>;
    terminate(): Promise<void>;
  }

  const scribe: Scribe;
  export default scribe;
}