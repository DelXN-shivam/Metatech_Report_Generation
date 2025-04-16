// For BackButton

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import Link from "next/link";
import { useTheme } from "./ThemeContext";

const PlayBookFolders = () => {
  const router = useRouter();
  const { darkMode } = useTheme();
  const fid = typeof router.query.fid !== "undefined" ? router.query.fid : "root";
  const teamDriveId = '';
  const corpora = teamDriveId ? "teamDrive" : "allDrives";
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const accessToken = localStorage.getItem("access_token");

  useEffect(() => {
    const fetchFolders = async () => {
      setLoading(true);
      setResults([]);
      try {
        const res = await axios.get("https://www.googleapis.com/drive/v3/files", {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            corpora: corpora,
            includeTeamDriveItems: true,
            supportsAllDrives: true,
            teamDriveId: teamDriveId,
            q: `mimeType='application/vnd.google-apps.folder' and trashed = false and parents in '${fid}'`,
          },
        });
        setResults(res.data.files || []);
      } catch (err) {
        console.error("Error fetching folders:", err);
      }
      setLoading(false);
    };

    fetchFolders();
  }, [fid]);

  return (
    <div className="w-full">
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-8">
          <div className={darkMode ? "text-gray-500" : "text-gray-400"}>
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="mt-2 text-sm font-medium">No folders found</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.map((result) => (
            <Link
              href={{
                pathname: `/list/[fid]`,
                query: { fid: result.id },
              }}
              as={`/list/${result.id}`}
              key={result.id}
            >
              <div className={`group ${darkMode ? 'bg-gray-700 border-gray-600 hover:border-blue-700' : 'bg-white border-gray-100 hover:border-blue-200'} rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border p-4`}>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-blue-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'} truncate group-hover:text-blue-600`}>
                      {result.name}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Folder</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayBookFolders;
