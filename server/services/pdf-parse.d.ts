declare module "pdf-parse";
declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = { text: string };
  type PdfParseOptions = {
    max?: number;
    pagerender?: (pageData: any) => Promise<string> | string;
  };
  function pdfParse(buffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;
  export default pdfParse;
}
