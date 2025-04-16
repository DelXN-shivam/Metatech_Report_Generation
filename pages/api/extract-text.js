import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import WordExtractor from 'word-extractor';
import libreoffice from 'libreoffice-convert';
import { promisify } from 'util';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Convert .doc to .docx using LibreOffice
async function convertDocToDocx(inputPath, outputPath) {
  try {
    const convertAsync = promisify(libreoffice.convert);
    const docxBuffer = await convertAsync(
      fs.readFileSync(inputPath),
      '.docx',
      undefined
    );
    fs.writeFileSync(outputPath, docxBuffer);
    return true;
  } catch (error) {
    console.error('Error converting .doc to .docx:', error);
    return false;
  }
}

// Helper function to extract text from .doc files using word-extractor
async function extractFromDoc(filePath) {
  try {
    // First try to convert to .docx
    const docxPath = filePath + '.docx';
    const converted = await convertDocToDocx(filePath, docxPath);
    
    if (converted) {
      // If conversion successful, use mammoth to extract text from .docx
      const buffer = fs.readFileSync(docxPath);
      const result = await mammoth.extractRawText({ buffer });
      // Clean up the temporary .docx file
      fs.unlinkSync(docxPath);
      return result.value;
    }
    
    // If conversion fails, fall back to word-extractor
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(filePath);
    return extracted.getBody();
  } catch (error) {
    console.error('Error extracting from .doc:', error);
    return '';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if the request has a content-type of multipart/form-data
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      const form = new IncomingForm();
      
      form.parse(req, async (err, fields, files) => {
        if (err) {
          return res.status(500).json({ error: 'Error parsing form' });
        }
          
        if (!files || !files.file || !files.file[0]) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
      
        const file = files.file[0];
      
        // Accept more document file types
        const validTypes = [
          'application/msword', // .doc
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/pdf', // .pdf
          'application/vnd.oasis.opendocument.text', // .odt
          'text/plain', // .txt
        ];
      
        if (!validTypes.includes(file.mimetype)) {
          return res.status(400).json({ error: 'Invalid file type. Please upload a valid document file' });
        }
      
        try {
          let extractedText = '';
          
          // Process different file types
          if (file.mimetype === 'application/msword') {
            extractedText = await extractFromDoc(file.filepath);
          } else if (file.mimetype === 'application/pdf') {
            const buffer = fs.readFileSync(file.filepath);
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text;
          } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const buffer = fs.readFileSync(file.filepath);
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
          } else if (file.mimetype === 'text/plain') {
            const buffer = fs.readFileSync(file.filepath);
            extractedText = buffer.toString('utf8');
          } else if (file.mimetype === 'application/rtf') {
            const buffer = fs.readFileSync(file.filepath);
            extractedText = buffer.toString('utf8').replace(/[^\x20-\x7E\r\n]/g, '');
          } else if (file.mimetype === 'application/vnd.oasis.opendocument.text') {
            const buffer = fs.readFileSync(file.filepath);
            extractedText = buffer.toString('utf8').replace(/[^\x20-\x7E\r\n]/g, '');
          }
          
          // Process the extracted text
          let lines = extractedText.split(/[\r\n]+/);
          lines = lines.map(line => 
            line
                .replace(/[^\x20-\x7E]/g, '')
                .replace(/\s+/g, ' ')
              .trim()
            ).filter(line => line.length > 0);
            
          // Find the line with 'Reference' or limit to 23 lines
          let endIndex = -1;
          for (let i = 0; i < lines.length; i++) {
            const cleanLine = lines[i].toUpperCase();
            if (cleanLine.includes('REFERENCE')) {
              endIndex = i;
              break;
            }
          }
          
          if (endIndex >= 0) {
            lines = lines.slice(0, endIndex + 1);
          } else {
            lines = lines.slice(0, 23);
          }
          
          return res.status(200).json({ extractedText: lines.join('\n') });
        } catch (error) {
          console.error('Error processing file:', error);
          return res.status(500).json({ error: 'Error processing file' });
        }
      });
    } else {
      // Handle base64 data submission
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const { fileData, mimeType, fileName } = JSON.parse(body);
          
          if (!fileData || !mimeType) {
            return res.status(400).json({ error: 'Missing required fields' });
          }
          
          // Create a temporary file
          const tempDir = path.join(process.cwd(), 'temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
          }
          
          const tempFilePath = path.join(tempDir, fileName || 'temp_file');
          const buffer = Buffer.from(fileData, 'base64');
          fs.writeFileSync(tempFilePath, buffer);
          
          let extractedText = '';
          
          // Process based on mimeType
          if (mimeType === 'application/msword') {
            extractedText = await extractFromDoc(tempFilePath);
          } else if (mimeType === 'application/pdf') {
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text;
          } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
          } else if (mimeType === 'text/plain') {
            extractedText = buffer.toString('utf8');
          } else if (mimeType === 'application/rtf') {
            extractedText = buffer.toString('utf8').replace(/[^\x20-\x7E\r\n]/g, '');
          } else if (mimeType === 'application/vnd.oasis.opendocument.text') {
            extractedText = buffer.toString('utf8').replace(/[^\x20-\x7E\r\n]/g, '');
          }
          
          // Process the extracted text - apply the same logic as in the form upload method
          let lines = extractedText.split(/[\r\n]+/);
          lines = lines.map(line => 
            line
                .replace(/[^\x20-\x7E]/g, '')
                .replace(/\s+/g, ' ')
              .trim()
            ).filter(line => line.length > 0);
            
          // Find the line with 'Reference' or limit to 23 lines
          let endIndex = -1;
          for (let i = 0; i < lines.length; i++) {
            const cleanLine = lines[i].toUpperCase();
            if (cleanLine.includes('REFERENCE')) {
              endIndex = i;
              break;
            }
          }
          
          if (endIndex >= 0) {
            lines = lines.slice(0, endIndex + 1);
          } else {
            lines = lines.slice(0, 23);
          }
          
          // Clean up the temporary file
          fs.unlinkSync(tempFilePath);
          
          return res.status(200).json({ extractedText: lines.join('\n') });
        } catch (error) {
          console.error('Error processing file:', error);
          return res.status(500).json({ error: 'Error processing file' });
        }
      });
    }
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
