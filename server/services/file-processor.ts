import fs from "fs/promises";
import path from "path";
import pdf from "pdf-parse";
import xlsx from "xlsx";
import { config } from "../config";

export class FileProcessor {
  async processFile(filePath: string, fileName: string): Promise<string> {
    const fileExtension = path.extname(fileName).toLowerCase();

    try {
      switch (fileExtension) {
        case '.pdf':
          return await this.processPDF(filePath);
        case '.xlsx':
        case '.xls':
          return await this.processExcel(filePath);
        default:
          throw new Error("Unsupported file format");
      }
    } catch (error) {
      console.error("File processing error:", error);
      throw new Error("Failed to process file");
    }
  }

  private async processPDF(filePath: string): Promise<string> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } catch (error) {
      console.error("PDF processing error:", error);
      throw new Error("Failed to extract text from PDF");
    }
  }

  private async processExcel(filePath: string): Promise<string> {
    try {
      const workbook = xlsx.readFile(filePath);
      let textContent = "";

      // Process all sheets
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        textContent += `\n=== Sheet: ${sheetName} ===\n`;
        
        sheetData.forEach((row: any) => {
          if (Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== "")) {
            textContent += row.join("\t") + "\n";
          }
        });
      });

      return textContent;
    } catch (error) {
      console.error("Excel processing error:", error);
      throw new Error("Failed to extract data from Excel file");
    }
  }

  async ensureUploadsDirectory(): Promise<void> {
    try {
      await fs.mkdir(config.uploads.directory, { recursive: true });
    } catch (error) {
      console.error("Failed to create uploads directory:", error);
      throw error;
    }
  }

  generateFileName(username: string, originalFileName: string): string {
    const timestamp = Date.now();
    const extension = path.extname(originalFileName);
    return `${username}-${timestamp}${extension}`;
  }

  async saveFile(buffer: Buffer, fileName: string): Promise<string> {
    await this.ensureUploadsDirectory();
    
    const filePath = path.join(config.uploads.directory, fileName);
    await fs.writeFile(filePath, buffer);
    
    return filePath;
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error("Failed to delete file:", error);
      // Don't throw error for file deletion failures
    }
  }
}

export const fileProcessor = new FileProcessor();
