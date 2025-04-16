import React, { useState, useEffect } from 'react';
import { FiFolder, FiFile, FiFolderPlus, FiFilePlus, FiDatabase } from 'react-icons/fi';
import { useTheme } from './ThemeContext';
import { useRouter } from 'next/router';
import axios from 'axios';
import config from '../config.json';

const StatsCards = () => {
  const { darkMode } = useTheme();
  const router = useRouter();
  const fid = typeof router.query.fid !== "undefined" ? router.query.fid : "root";
  const [stats, setStats] = useState({
    totalFolders: 0,
    totalFiles: 0,
    newFolders: 0,
    newFiles: 0,
    totalSize: 0
  });
  const [loading, setLoading] = useState(true);
  const accessToken = localStorage.getItem("access_token");
  const teamDriveId = config.directory.team_drive;
  const corpora = teamDriveId ? "teamDrive" : "allDrives";

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // Fetch folders
        const foldersResponse = await axios.get("https://www.googleapis.com/drive/v3/files", {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            corpora: corpora,
            includeTeamDriveItems: true,
            supportsAllDrives: true,
            teamDriveId: teamDriveId,
            q: `mimeType='application/vnd.google-apps.folder' and trashed = false and parents in '${fid}'`,
            fields: "files(id,createdTime)"
          }
        });

        // Fetch files
        const filesResponse = await axios.get("https://www.googleapis.com/drive/v3/files", {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            corpora: corpora,
            includeTeamDriveItems: true,
            supportsAllDrives: true,
            teamDriveId: teamDriveId,
            q: `mimeType!='application/vnd.google-apps.folder' and trashed = false and parents in '${fid}'`,
            fields: "files(id,size,createdTime,mimeType)"
          }
        });

        // Calculate total size
        const totalSize = filesResponse.data.files?.reduce((sum, file) => {
          // Handle Google Docs, Sheets, Slides, etc. which don't have size
          if (file.mimeType?.includes('google-apps') || !file.size) {
            return sum;
          }
          return sum + (parseInt(file.size) || 0);
        }, 0) || 0;

        // Calculate new items (created in last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const newFolders = foldersResponse.data.files?.filter(folder => 
          new Date(folder.createdTime) > sevenDaysAgo
        ).length || 0;

        const newFiles = filesResponse.data.files?.filter(file => 
          new Date(file.createdTime) > sevenDaysAgo
        ).length || 0;

        setStats({
          totalFolders: foldersResponse.data.files?.length || 0,
          totalFiles: filesResponse.data.files?.length || 0,
          newFolders,
          newFiles,
          totalSize
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
      setLoading(false);
    };

    fetchStats();
  }, [fid, accessToken]);

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const cards = [
    {
      title: 'Folders',
      value: loading ? '...' : stats.totalFolders,
      icon: <FiFolder className="h-6 w-6 text-blue-500" />,
      lightMode: {
        gradient: 'from-blue-50 to-blue-100',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
      },
      darkMode: {
        gradient: 'from-blue-400 to-blue-500',
        textColor: 'text-blue-300',
        borderColor: 'border-blue-600',
        iconBg: 'bg-blue-300',
        iconColor: 'text-blue-300',
      }
    },
    {
      title: 'Files',
      value: loading ? '...' : stats.totalFiles,
      icon: <FiFile className="h-6 w-6 text-green-500" />,
      lightMode: {
        gradient: 'from-green-50 to-green-100',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
      },
      darkMode: {
        gradient: 'from-green-400 to-green-500',
        textColor: 'text-green-300',
        borderColor: 'border-green-600',
        iconBg: 'bg-green-300',
        iconColor: 'text-green-300',
      }
    },
    {
      title: 'Total Size',
      value: loading ? '...' : formatSize(stats.totalSize),
      icon: <FiDatabase className="h-6 w-6 text-pink-500" />,
      lightMode: {
        gradient: 'from-pink-50 to-pink-100',
        textColor: 'text-pink-700',
        borderColor: 'border-pink-200',
        iconBg: 'bg-pink-100',
        iconColor: 'text-pink-600',
      },
      darkMode: {
        gradient: 'from-pink-400 to-pink-500',
        textColor: 'text-pink-300',
        borderColor: 'border-pink-600',
        iconBg: 'bg-pink-300',
        iconColor: 'text-pink-300',
      }
    },
    {
      title: 'New Folders',
      value: loading ? '...' : stats.newFolders,
      icon: <FiFolderPlus className="h-6 w-6 text-purple-500" />,
      lightMode: {
        gradient: 'from-purple-50 to-purple-100',
        textColor: 'text-purple-700',
        borderColor: 'border-purple-200',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
      },
      darkMode: {
        gradient: 'from-purple-400 to-purple-500',
        textColor: 'text-purple-300',
        borderColor: 'border-purple-600',
        iconBg: 'bg-purple-300',
        iconColor: 'text-purple-300',
      }
    },
    {
      title: 'New Files',
      value: loading ? '...' : stats.newFiles,
      icon: <FiFilePlus className="h-6 w-6 text-orange-500" />,
      lightMode: {
        gradient: 'from-orange-50 to-orange-100',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
      },
      darkMode: {
        gradient: 'from-orange-400 to-orange-500',
        textColor: 'text-orange-300',
        borderColor: 'border-orange-600',
        iconBg: 'bg-orange-300',
        iconColor: 'text-orange-100',
      }
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card, index) => {
        const theme = darkMode ? card.darkMode : card.lightMode;
        return (
          <div
            key={index}
            className={`bg-gradient-to-br h-44 ${theme.gradient} ${theme.borderColor} border rounded-lg p-5 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 flex items-center justify-center`}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className={`${theme.iconBg} p-3 rounded-full shadow-inner mb-3`}>
                <div className={theme.iconColor}>
                  {card.icon}
                </div>
              </div>
              <p className={`text-lg font-medium ${theme.textColor}`}>{card.title}</p>
              <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-gray-600'}`}>{card.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsCards; 