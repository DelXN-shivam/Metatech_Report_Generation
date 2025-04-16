import React, { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import { useTheme } from './ThemeContext';

const GoogleDriveSearch = () => {
  const router = useRouter();
  const { darkMode } = useTheme();
  const fid = typeof router.query.fid !== "undefined" ? router.query.fid : "root";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fparent, setFParent] = useState(null);
  const [extractedDoc, setExtractedDoc] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [lastDownloadedFile, setLastDownloadedFile] = useState(null);
  const [fileTypes, setFileTypes] = useState([
    { label: "All Files", value: "" },
    { label: "Word Document (.docx)", value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { label: "MS Word (.doc)", value: "application/msword" },
    { label: "Google Docs", value: "application/vnd.google-apps.document" },
    { label: "Excel (.xlsx)", value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    { label: "MS Excel (.xls)", value: "application/vnd.ms-excel" },
    { label: "PDF (.pdf)", value: "application/pdf" },
    { label: "Other", value: "other" }
  ]);
  const [selectedFileType, setSelectedFileType] = useState("");
  const accessToken = localStorage.getItem("access_token");

  const refreshAccessToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        // client_id: config.api.client_id,
        // client_secret: config.api.client_secret,
        client_id: process.env.API_CLIENT_ID,
        client_secret: process.env.API_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
        return response.data.access_token;
      }
      return null;
    } catch (err) {
      console.error('Error refreshing token:', err);
      return null;
    }
  };

  const makeAuthenticatedRequest = async (requestFn) => {
    try {
      return await requestFn();
    } catch (err) {
      if (err.response && err.response.status === 401) {
        // Token expired, try to refresh
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          // Retry the request with new token
          return await requestFn();
        }
      }
      throw err;
    }
  };

  // Add event listener for token validation
  useEffect(() => {
    const handleTokenValidated = () => {
      // Trigger initial data fetch
      searchFiles();
    };

    window.addEventListener('tokenValidated', handleTokenValidated);
    return () => {
      window.removeEventListener('tokenValidated', handleTokenValidated);
    };
  }, []);

  // Fetch the parent folder ID of the current folder
  useEffect(() => {
    const fetchParentFolder = async () => {
      if (fid === "root") {
        setFParent(null);
        return;
      }

      try {
        const accessToken = localStorage.getItem('access_token');
        const response = await makeAuthenticatedRequest(() =>
          axios.get(
            `https://www.googleapis.com/drive/v2/files/${fid}/parents`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          )
        );

        const data = response.data;
        if (data.items && data.items.length > 0) {
          setFParent(data.items[0].id);
        } else {
          setFParent(null);
        }
      } catch (err) {
        console.error("Error fetching parent folder:", err);
        setFParent(null);
      }
    };

    fetchParentFolder();
  }, [fid]);

  // Fetch folders
  useEffect(() => {
    const fetchFolders = async () => {
      if (!accessToken) return;

      try {
        const response = await makeAuthenticatedRequest(() =>
          axios.get(
            "https://www.googleapis.com/drive/v3/files",
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              params: {
                q: `mimeType='application/vnd.google-apps.folder' and trashed = false and parents in '${fid}'`,
                fields: "files(id,name)"
              }
            }
          )
        );

        if (response.data.files) {
          const fetchedFolders = [{ id: "", name: "All Folders" }, ...response.data.files];
          setFolders(fetchedFolders);
        }
      } catch (err) {
        console.error("Error fetching folders:", err);
      }
    };

    fetchFolders();
  }, [accessToken, fid]);

  // Function to recursively fetch all subfolders
  const fetchAllSubfolders = async (folderIds) => {
    const allFolderIds = [...folderIds];

    while (folderIds.length > 0) {
      try {
        const res = await axios.get("https://www.googleapis.com/drive/v3/files", {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            q: `mimeType='application/vnd.google-apps.folder' and trashed = false and parents in '${folderIds.join(
              "','"
            )}'`,
          },
        });

        const subFolders = res.data.files || [];
        if (subFolders.length === 0) break;

        folderIds = subFolders.map((folder) => folder.id);
        allFolderIds.push(...folderIds);
      } catch (err) {
        console.error("Error fetching subfolders:", err);
        setError(err);
        return allFolderIds;
      }
    }

    return allFolderIds;
  };

  // Search files within the folder and its subfolders
  const searchFiles = async () => {
    // Validate query has minimum length
    if (!query.trim()) {
      setSearchError("Please enter a search query");
      return;
    }

    // Validate minimum query length (3 characters)
    if (query.trim().length < 3) {
      setSearchError("Search query must be at least 3 characters long");
      return;
    }

    // Validate query doesn't contain only special characters
    if (!/[a-zA-Z0-9]/.test(query)) {
      setSearchError("Search query must contain at least one letter or number");
      return;
    }

    setSearchError(null);
    setLoading(true);
    setError(null);
    setResults([]);
    setExtractedDoc(null);
    setLastDownloadedFile(null);

    try {
      let folderIds = [selectedFolder || fid];
      if (!selectedFolder) {
        folderIds = await fetchAllSubfolders(folderIds);
      }

      let fileTypeQuery = "";
      if (selectedFileType) {
        if (selectedFileType === "other") {
          fileTypeQuery = " and (mimeType!='application/vnd.google-apps.document' and mimeType!='application/openxmlformats-officedocument.wordprocessingml.document' and mimeType!='application/msword')";
        } else if (selectedFileType === "application/vnd.google-apps.document") {
          fileTypeQuery = " and mimeType='application/vnd.google-apps.document'";
        } else if (selectedFileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          fileTypeQuery = " and mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'";
        } else if (selectedFileType === "application/msword") {
          fileTypeQuery = " and mimeType='application/msword'";
        } else {
          fileTypeQuery = ` and mimeType='${selectedFileType}'`;
        }
      }

      const escapedQuery = query.replace(/'/g, "\\'");

      const res = await axios.get("https://www.googleapis.com/drive/v3/files", {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: `mimeType!='application/vnd.google-apps.folder' and trashed = false and parents in '${folderIds.join(
            "','"
          )}' and (name contains '${escapedQuery}' or fullText contains '${escapedQuery}')${fileTypeQuery}`,
          fields: "files(id,name,mimeType,size,modifiedTime)",
        },
      });

      setResults(res.data.files || []);

      // Show message when no results are found, but don't clear the search query
      if (res.data.files && res.data.files.length === 0) {
        let message = `No results found for "${query}"`;
        if (selectedFolder) {
          const selectedFolderName = folders.find(f => f.id === selectedFolder)?.name || 'selected folder';
          message += ` in ${selectedFolderName}`;
        }
        if (selectedFileType) {
          const selectedTypeName = fileTypes.find(t => t.value === selectedFileType)?.label || 'selected file type';
          message += ` with ${selectedTypeName}`;
        }
        message += ". Please try different filters.";
        setSearchError(message);
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError(new Error("Access token expired. Please refresh."));
      } else {
        setError(err);
      }
    }
    setLoading(false);
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      searchFiles();
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setExtractedDoc(null);
    setSearchError(null);
    setSelectedFolder("");
    setSelectedFileType("");
  };

  const navigateBack = () => {
    clearSearch();
    if (fid === "root") {
      router.push("/");
    } else if (fparent) {
      router.push({
        pathname: `/list/[fid]`,
        query: { fid: fparent },
      });
    }
  };

  // Add this new function after the extractTextFromDoc function
  function extractCleanTextFromDoc(arrayBuffer) {
    try {
      // Convert ArrayBuffer to Uint8Array
      const uint8Array = new Uint8Array(arrayBuffer);

      // Try multiple encodings to find the best readable text
      const encodings = ['utf-8', 'utf-16le', 'utf-16be', 'latin1'];
      let bestText = '';
      let maxReadableChars = 0;

      for (const encoding of encodings) {
        try {
          const decoder = new TextDecoder(encoding, { fatal: false });
          const decodedText = decoder.decode(uint8Array);

          // Count readable characters
          const readableChars = decodedText.replace(/[^\x20-\x7E\n\r\t]/g, '').length;

          if (readableChars > maxReadableChars) {
            maxReadableChars = readableChars;
            bestText = decodedText;
          }
        } catch (err) {
          console.log(`Failed to decode with ${encoding}:`, err);
        }
      }

      if (!bestText) {
        return null;
      }

      // Clean up the text - more aggressive approach
      let cleanedText = bestText
        // Remove binary data patterns
        .replace(/~!bjbj[\s\S]*?uDhhCtyG/g, '')
        // Remove OLE compound document headers
        .replace(/Root Entry[\s\S]*?WordDocument/g, '')
        // Remove Microsoft Office headers
        .replace(/Microsoft Office Word[\s\S]*?Normal\.dotm/g, '')
        // Remove binary data sections
        .replace(/[^\x20-\x7E\n\r\t]+/g, ' ')
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove empty lines
        .replace(/^\s*[\r\n]/gm, '')
        // Trim the result
        .trim();

      // Extract meaningful text chunks
      const lines = cleanedText.split('\n');
      const meaningfulLines = lines.filter(line => {
        // Check if line contains meaningful text
        const cleanLine = line.trim();
        if (cleanLine.length < 3) return false;

        // Check for common binary patterns
        if (/[^\x20-\x7E]/.test(cleanLine)) return false;

        // Check for common document structure markers
        const markers = ['Reference:', 'Subject:', 'Date:', 'To:', 'From:', 'Dear', 'Regards', 'Sincerely'];
        return markers.some(marker => cleanLine.includes(marker)) ||
          (cleanLine.length > 10 && /[a-zA-Z]{3,}/.test(cleanLine));
      });

      return meaningfulLines.join('\n') || null;
    } catch (err) {
      console.log('Text extraction failed:', err);
      return null;
    }
  }

  // Update the extractContentFromFile function to handle .doc files by downloading them first and then processing them locally
  const extractContentFromFile = async (fileId, fileName, mimeType) => {
    try {
      let content = '';
      const accessToken = localStorage.getItem("access_token");

      // Get metadata for all file types first
      const metadataResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { fields: 'name,mimeType,size,modifiedTime,description' }
        }
      );
      const metadata = metadataResponse.data;

      // For supported document types, download and process through our API
      const supportedTypes = [
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/pdf', // .pdf
        'text/plain', // .txt
        'application/vnd.oasis.opendocument.text', // .odt
        'application/vnd.google-apps.document' // Google Docs
      ];

      if (supportedTypes.includes(mimeType) || 
          (mimeType === 'application/vnd.google-apps.document')) {
        try {
          // For Google Docs, export as docx
          let fileData;
          let actualMimeType = mimeType;
          
          if (mimeType === 'application/vnd.google-apps.document') {
            const response = await axios.get(
              `https://www.googleapis.com/drive/v3/files/${fileId}/export`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
                responseType: 'arraybuffer'
              }
            );
            fileData = response.data;
            actualMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (mimeType === 'application/msword') {
            // For .doc files, download directly and process locally
            const response = await axios.get(
              `https://www.googleapis.com/drive/v3/files/${fileId}`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { alt: 'media' },
                responseType: 'arraybuffer'
              }
            );
            fileData = response.data;
            actualMimeType = 'application/msword';
          } else {
            // For other file types, download directly
            const response = await axios.get(
              `https://www.googleapis.com/drive/v3/files/${fileId}`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { alt: 'media' },
                responseType: 'arraybuffer'
              }
            );
            fileData = response.data;
          }
          
          // Convert array buffer to base64
          let base64Data;
          if (typeof Buffer !== 'undefined') {
            // Node.js environment
            base64Data = Buffer.from(fileData).toString('base64');
          } else {
            // Browser environment
            const bytes = new Uint8Array(fileData);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            base64Data = window.btoa(binary);
          }
          
          // Send to our extract-text API
          const extractResponse = await fetch('/api/extract-text', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: actualMimeType,
              fileName: fileName
            }),
          });
          
          if (!extractResponse.ok) {
            const errorData = await extractResponse.json();
            throw new Error(errorData.error || 'Failed to extract text');
          }
          
          const data = await extractResponse.json();
          content = data.extractedText;
          
          // If content is empty or very short for a .doc file, try fallback method
          if (mimeType === 'application/msword' && (!content || content.length < 50)) {
            console.log("API extraction returned little content for .doc file, trying fallback...");
            const fallbackContent = generateFallbackContent(metadata,
              "Limited text could be extracted from this .doc file. It may be in an older format or contain mostly images.");
            return { fileName, content: fallbackContent };
          }
        } catch (err) {
          console.error(`Error processing file ${fileName} through API:`, err);
          
          // Special fallback for .doc files
          if (mimeType === 'application/msword') {
            const fallbackContent = generateFallbackContent(metadata,
              `This .doc file could not be processed automatically. It may be in an older format or contain complex formatting. Error: ${err.message}`);
            return { fileName, content: fallbackContent };
          }
          
          content = generateFallbackContent(metadata,
            `Error extracting text: ${err.message}`);
        }
      } else {
        // For unsupported file types, use the existing fallback
        content = generateFallbackContent(metadata,
          `Content extraction is not supported for this file type.`);
      }

      return { fileName, content };
    } catch (err) {
      console.error(`Error extracting content from ${fileName}:`, err);
      return {
        fileName,
        content: `Error extracting content: ${err.message}`
      };
    }
  };

  // Update the cleanDocContent function to handle .doc file content better
  function cleanDocContent(text) {
    // Handle null, undefined, or non-string inputs
    if (text === null || text === undefined) {
      return '';
    }

    // Convert to string if not already a string
    const textStr = String(text);

    return textStr
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\r/g, '\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control characters
      .replace(/\t+/g, ' ')             // Replace tabs with spaces
      .replace(/\s+\n/g, '\n')          // Remove spaces before newlines
      .replace(/\n{3,}/g, '\n\n')       // Reduce multiple newlines
      .replace(/[ \t]{2,}/g, ' ')       // Reduce multiple spaces
      .trim();                          // Remove leading/trailing whitespace
  }

  // Keep the existing generateFallbackContent function
  function generateFallbackContent(metadata, message) {
    return `[Document Information]\n` +
      `Name: ${metadata.name}\n` +
      `Type: ${metadata.mimeType}\n` +
      `Size: ${Math.round(metadata.size / 1024) || 'Unknown'}KB\n` +
      `Modified: ${new Date(metadata.modifiedTime).toLocaleString()}\n\n` +
      message;
  }

  // Helper Functions:

  async function parseDocFile(arrayBuffer, fileName, metadata) {
    // First check if this looks like a valid .doc file
    if (!isLikelyValidDoc(arrayBuffer)) {
      return generateFallbackContent(metadata,
        "File doesn't appear to be a valid Word document.\n" +
        "It may be corrupted or in an unsupported format.");
    }

    try {
      // Try proper .doc parsing first
      const parsedText = await extractTextFromDoc(arrayBuffer);
      if (parsedText) {
        return parsedText;
      }

      // If description exists, use it as fallback
      if (metadata.description) {
        return `[Word Document (.doc) - Preview from Description]\n` +
          `Name: ${metadata.name}\n` +
          `Type: ${metadata.mimeType}\n` +
          `Size: ${Math.round(metadata.size / 1024)}KB\n` +
          `Modified: ${new Date(metadata.modifiedTime).toLocaleString()}\n\n` +
          `Description/Preview:\n${cleanDocContent(metadata.description)}\n\n` +
          `Note: Full text extraction from this .doc file was limited.`;
      }

      // Final fallback to metadata only
      return generateFallbackContent(metadata,
        "Text extraction failed for this .doc file.\n" +
        "This might be due to the document format or encryption.\n" +
        "Please download the file to view its content.");
    } catch (err) {
      console.error('Error in parseDocFile:', err);
      return generateFallbackContent(metadata,
        "Error processing this .doc file.\n" +
        "Please download the file to view its content.\n" +
        `Error: ${err.message}`);
    }
  }

  function extractTextFromDoc(arrayBuffer) {
    try {
      // Convert ArrayBuffer to Uint8Array
      const uint8Array = new Uint8Array(arrayBuffer);

      // Try multiple encodings to find the best readable text
      const encodings = ['utf-8', 'utf-16le', 'utf-16be', 'latin1'];
      let bestText = '';
      let maxReadableChars = 0;

      for (const encoding of encodings) {
        try {
          const decoder = new TextDecoder(encoding, { fatal: false });
          const decodedText = decoder.decode(uint8Array);

          // Count readable characters
          const readableChars = decodedText.replace(/[^\x20-\x7E\n\r\t]/g, '').length;

          if (readableChars > maxReadableChars) {
            maxReadableChars = readableChars;
            bestText = decodedText;
          }
        } catch (err) {
          console.log(`Failed to decode with ${encoding}:`, err);
        }
      }

      if (!bestText) {
        return null;
      }

      // Clean up the text - more aggressive approach
      let cleanedText = bestText
        // Remove binary data patterns
        .replace(/~!bjbj[\s\S]*?uDhhCtyG/g, '')
        // Remove OLE compound document headers
        .replace(/Root Entry[\s\S]*?WordDocument/g, '')
        // Remove Microsoft Office headers
        .replace(/Microsoft Office Word[\s\S]*?Normal\.dotm/g, '')
        // Remove binary data sections
        .replace(/[^\x20-\x7E\n\r\t]+/g, ' ')
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove empty lines
        .replace(/^\s*[\r\n]/gm, '')
        // Trim the result
        .trim();

      // Extract meaningful text chunks
      const lines = cleanedText.split('\n');
      const meaningfulLines = lines.filter(line => {
        // Check if line contains meaningful text
        const cleanLine = line.trim();
        if (cleanLine.length < 3) return false;

        // Check for common binary patterns
        if (/[^\x20-\x7E]/.test(cleanLine)) return false;

        // Check for common document structure markers
        const markers = ['Reference:', 'Subject:', 'Date:', 'To:', 'From:', 'Dear', 'Regards', 'Sincerely'];
        return markers.some(marker => cleanLine.includes(marker)) ||
          (cleanLine.length > 10 && /[a-zA-Z]{3,}/.test(cleanLine));
      });

      return meaningfulLines.join('\n') || null;
    } catch (err) {
      console.log('Text extraction failed:', err);
      return null;
    }
  }

  function isLikelyValidDoc(arrayBuffer) {
    if (!arrayBuffer || arrayBuffer.byteLength < 8) return false;

    const header = new Uint8Array(arrayBuffer.slice(0, 8));
    const docSignatures = [
      [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // OLE Compound
      [0xEC, 0xA5, 0xC1, 0x00], // Older Word format
      [0xDB, 0xA5, 0x2D, 0x00]  // Word 6.0/95
    ];

    return docSignatures.some(sig =>
      header.length >= sig.length &&
      sig.every((byte, i) => byte === header[i])
    );
  }

  function extractUntilReference(text) {
    if (!text) return '';

    const lines = text.split('\n');
    let referenceLineIndex = -1;

    // Find the first line containing "Reference" (case insensitive)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('reference')) {
        referenceLineIndex = i;
        break;
      }
    }

    // If Reference line found, include it and everything before it
    if (referenceLineIndex >= 0) {
      return lines.slice(0, referenceLineIndex + 1).join('\n');
    }

    // If no Reference line found, return first 100 lines as fallback
    return lines.slice(0, 100).join('\n');
  }

  // Helper function to extract text until a specific marker is found
  function extractUntilMarker(text, marker, defaultLineCount = 23) {
    if (!marker || !text) {
      return text.split('\n').slice(0, defaultLineCount).join('\n');
    }

    try {
      const markerLower = marker.toLowerCase();
      const lines = text.split('\n');
      const markerLineIndex = lines.findIndex(line =>
        line.toLowerCase().includes(markerLower)
      );

      if (markerLineIndex === -1) {
        return lines.slice(0, defaultLineCount).join('\n');
      }

      const endIndex = Math.min(markerLineIndex + 4, lines.length);
      return lines.slice(0, endIndex).join('\n');
    } catch (err) {
      console.error('Error in extractUntilMarker:', err);
      return text.split('\n').slice(0, defaultLineCount).join('\n');
    }
  }

  // Add this new function to handle file upload
  const handleUpload = async (file) => {
    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to process file: ${file.name}`);
      }

      const data = await response.json();
      return data.extractedText;
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Update the processAndCreateDoc function to handle large responses
  const processAndCreateDoc = async () => {
    if (results.length === 0 || !accessToken) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Extract content from each file in the results array
      const extractedFiles = [];

      // Limit the number of files to process to avoid response size issues
      const filesToProcess = results.slice(0, 10); // Process max 10 files at once

      for (const file of filesToProcess) {
        try {
          // If the file already has extractedText (from a previous upload), use it
          if (file.extractedText) {
            extractedFiles.push({
              fileName: file.name,
              extractedText: file.extractedText
            });
          } else {
            // Otherwise extract content from Google Drive
            const { fileName, content } = await extractContentFromFile(file.id, file.name, file.mimeType);

            // Limit content size to avoid response size issues (max ~10KB per file)
            const limitedContent = content.length > 10000 ? content.substring(0, 10000) + "... (content truncated)" : content;

            extractedFiles.push({
              fileName,
              extractedText: limitedContent
            });
          }
        } catch (err) {
          console.error(`Error processing ${file.name}:`, err);
          // Continue with other files even if one fails
        }
      }

      if (extractedFiles.length === 0) {
        throw new Error("Could not extract content from any files");
      }

      // Send the extracted content to the combine-files API
      const response = await fetch('/api/combine-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          files: extractedFiles,
          query: query
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to combine files');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]
        : 'combined_document.docx';
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Store the last downloaded file info
      setLastDownloadedFile({
        filename,
        blob
      });

    } catch (err) {
      console.error("Error creating document:", err);
      setError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAgain = () => {
    if (!lastDownloadedFile) return;

    const url = window.URL.createObjectURL(lastDownloadedFile.blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', lastDownloadedFile.filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  // Update the downloadExtractedDoc function to handle errors better
  const downloadExtractedDoc = async () => {
    if (!extractedDoc) return;

    try {
      // Use the download-file API to get the file
      const downloadUrl = `/api/download-file?fileName=${encodeURIComponent(extractedDoc)}`;
      window.location.href = downloadUrl;
    } catch (err) {
      console.error("Error downloading document:", err);
      setError(new Error(`Failed to download document: ${err.message}`));
    }
  };

  // Function to download a file
  const downloadFile = async (fileId, fileName, mimeType) => {
    try {
      setError(null);

      // For .doc files, first try to export and log the content
      if (mimeType === 'application/msword') {
        try {
          const result = await handleDocExport(fileId);
          console.log('Successfully extracted .doc content:', result);
        } catch (exportError) {
          console.error('Error extracting .doc content:', exportError);
        }
      }

      // For Google Docs, use export
      if (mimeType === 'application/vnd.google-apps.document') {
        const response = await axios.get(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
            responseType: 'blob'
          }
        );

        // Create a download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${fileName}.docx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
      // For other files, use direct download
      else {
        const response = await axios.get(
          `https://www.googleapis.com/drive/v3/files/${fileId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { alt: 'media' },
            responseType: 'blob'
          }
        );

        // Create a download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(`Error downloading file ${fileName}:`, err);
      setError(new Error(`Failed to download ${fileName}: ${err.message}`));
    }
  };

  // Add this new useEffect to clear lastDownloadedFile when file type changes
  useEffect(() => {
    setLastDownloadedFile(null);
  }, [selectedFileType]);

  // Add this new function to handle .doc file export and logging
  const handleDocExport = async (fileId) => {
    try {
      const accessToken = localStorage.getItem("access_token");
      
      // First get the file metadata
      const metadataResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { fields: 'name,mimeType,size,modifiedTime' }
        }
      );
      
      const metadata = metadataResponse.data;
      
      // Export the .doc file as text
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { mimeType: 'text/plain' },
          responseType: 'arraybuffer'
        }
      );
      
      // Convert the response to text
      const text = new TextDecoder('utf-8').decode(response.data);
      
      // Log the extracted text
      console.log('File Name:', metadata.name);
      console.log('File Size:', metadata.size);
      console.log('Last Modified:', metadata.modifiedTime);
      console.log('Extracted Text:', text);
      
      return {
        fileName: metadata.name,
        content: text
      };
    } catch (error) {
      console.error('Error exporting .doc file:', error);
      throw error;
    }
  };

  return (
    <div className={`w-full text-left p-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchError(null);
            }}
            onKeyPress={handleKeyPress}
            className={`w-full p-3 pl-10 border ${searchError ? 'border-red-500' : darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
              } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="Search files based on content..."
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={searchFiles}
          disabled={loading || !accessToken}
          className={`px-6 py-3 ${darkMode ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition duration-300 disabled:bg-blue-300 flex items-center space-x-2`}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search</span>
            </>
          )}
        </button>

        {/* Clear Button */}
        <button
          onClick={clearSearch}
          className={`px-6 py-3 ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} rounded-lg transition duration-300 flex items-center space-x-2`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Clear</span>
        </button>
      </div>

      {/* Filter Dropdowns */}
      <div className="flex gap-4 mt-4">
        {/* Folders Dropdown */}
        <div className="flex-1">
          <label htmlFor="folder-select" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
            Folder
          </label>
          <select
            id="folder-select"
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>

        {/* File Types Dropdown */}
        <div className="flex-1">
          <label htmlFor="file-type-select" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
            File Type
          </label>
          <select
            id="file-type-select"
            value={selectedFileType}
            onChange={(e) => setSelectedFileType(e.target.value)}
            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
          >
            {fileTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Error Message */}
      {searchError && (
        <div className={`p-4 mb-4 mt-4 rounded-lg flex items-center space-x-2 ${searchError.startsWith("No results found")
          ? darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-50 text-blue-600'
          : darkMode ? 'bg-red-900 text-red-200' : 'bg-red-50 text-red-600'
          }`}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {searchError.startsWith("No results found") ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            )}
          </svg>
          <span>{searchError}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4 mt-4">
        {results.length > 0 && (
          <button
            onClick={processAndCreateDoc}
            disabled={isProcessing || !accessToken}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 disabled:bg-green-300 flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Extract & Download</span>
              </>
            )}
          </button>
        )}

        {lastDownloadedFile && (
          <button
            onClick={downloadAgain}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 flex items-center space-x-2"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download Again</span>
          </button>
        )}
      </div>

      {/* Status Messages */}
      {!accessToken && (
        <div className="p-4 mb-4 bg-red-50 text-red-600 rounded-lg flex items-center space-x-2">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Error: No access token found. Please authenticate.</span>
        </div>
      )}
      {error && (
        <div className="p-4 mb-4 bg-red-50 text-red-600 rounded-lg flex items-center space-x-2">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Error: {error.message}</span>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="mt-4">
          <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Search Results ({results.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result) => (
              <div key={result.id} className={`${darkMode ? 'bg-gray-800 border-gray-700 hover:border-blue-800' : 'bg-white border-gray-100 hover:border-blue-200'} rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border p-4`}>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={`https://docs.google.com/document/d/${result.id}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium truncate block"
                    >
                      {result.name}
                    </a>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>{result.mimeType}</p>
                  </div>
                  <button
                    onClick={() => downloadFile(result.id, result.name, result.mimeType)}
                    className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                    title="Download file"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleDriveSearch;
