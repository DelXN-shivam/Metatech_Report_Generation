// components/FolderName.jsx
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
// import BackButton from "./BackButton";
import config from "../config.json";
import axios from "axios";
import { useTheme } from "./ThemeContext";

const FolderName = () => {
  const router = useRouter();
  const { darkMode } = useTheme();
  const fid = typeof router.query.fid !== "undefined" ? router.query.fid : "root"; // Default to "root"
  const [fname, setFName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const teamDriveId = process.env.TEAM_DRIVE || config.directory.team_drive; // Use environment variable or fallback to config
  // config.directory.team_drive
  const corpora = teamDriveId ? "teamDrive" : "allDrives";

  useEffect(() => {
    setLoaded(false);
    setLoading(true);
    const fetchData = async () => {
      const accessToken = localStorage.getItem("access_token");
      try {
        const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${fid}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            corpora: corpora,
            includeTeamDriveItems: true,
            supportsAllDrives: true,
            teamDriveId: teamDriveId,
          },
        });
        const data = response.data;
        setFName(data.name || "Root Folder"); // Use "Root Folder" for the root folder
        setLoaded(true);
        setLoading(false);
      } catch (err) {
        if (err.response && err.response.status === 401) {
          console.error("Access token expired. Please refresh.");
        } else {
          console.error(err);
        }
        setLoading(false);
      }
    };
    fetchData();
  }, [fid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className={`ml-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading folder...</span>
      </div>
    );
  }

  if (loaded && fname) {
    return (
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm rounded-lg p-4 mb-4`}>
        <div className="flex items-center space-x-2">
          <svg 
            className={`w-6 h-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" 
            />
          </svg>
          <h2 className={`text-xl font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{fname}</h2>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>
            {fid === "root" ? "Root Directory" : "Subfolder"}
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default FolderName;




// import React, { useEffect, useState } from 'react';
// import { useRouter } from 'next/router';
// import BackButton from './BackButton';
// import config from "../config.json";
// import axios from 'axios';
// import styles from '../styles/Home.module.css'


// const FolderName = () => {
//   const router = useRouter();

//   const accessToken = localStorage.getItem("access_token");
//   const fid = (typeof router.query.fid !== 'undefined') ? router.query.fid : config.directory.target_folder;
//   const [fname, setFName] = useState('');
//   const [loaded, setLoaded] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const teamDriveId = config.directory.team_drive;
//   const corpora = (teamDriveId) ? "teamDrive" : "allDrives";

//   useEffect(() => {
//     setLoaded(false);
//     setLoading(true);
//     const fetchData = async () => {
//       const response = await axios.get("https://www.googleapis.com/drive/v3/files/" + fid, {
//         headers: { Authorization: `Bearer ${accessToken}` },
//         params: {
//           source: "PlayBookFolders",
//           corpora: corpora,
//           includeTeamDriveItems: true,
//           supportsAllDrives: true,
//           teamDriveId: teamDriveId
//         }
//       });
//       const data = response.data;
//       setFName(data.name);
//       setLoaded(true);
//       setLoading(false);
//     };
//     fetchData();
//   }, [fid, router]);

//   if (loading) {
//     return <div>Loading...</div>;
//   }

//   if (router && loaded && fid !== config.directory.target_folder) {
//     return (
//         <div className={styles.FolderHeader}>
//           <h2><BackButton />{fname}</h2>
//         </div>
//     );
//   }

//   return null;
// };

// export default FolderName;
