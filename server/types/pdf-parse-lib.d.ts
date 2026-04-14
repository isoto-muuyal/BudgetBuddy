declare module "pdf-parse/lib/pdf-parse.js" {
  const pdf: (dataBuffer: Buffer) => Promise<{ text: string }>;
  export default pdf;
}
