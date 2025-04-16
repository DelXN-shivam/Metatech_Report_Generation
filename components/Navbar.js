import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTheme } from './ThemeContext';

const Navbar = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const router = useRouter();
  const { darkMode } = useTheme();

  useEffect(() => {
    // Get user details from localStorage when component mounts
    const storedUserDetails = localStorage.getItem('userDetails');
    if (storedUserDetails) {
      setUserDetails(JSON.parse(storedUserDetails));
    }
  }, []);

  const handleSignOut = () => {
    // Clear all authentication tokens and user details
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('code');
    localStorage.removeItem('userDetails');
    
    // Close the profile dropdown
    setIsProfileOpen(false);
    
    // Redirect to root path where SimpleSignOn is rendered
    window.location.href = '/';
  };

  return (
    <nav className={`${darkMode ? 'bg-gray-800' : 'bg-gradient-to-r from-[#0057B8] to-[#0057B8]'} shadow-lg py-1`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-white">Report Generation Dashboard</span>
          </div>

          <div className="flex items-center space-x-6">
            {/* Notification Bell */}
            <button className="relative p-2 rounded-full text-white/90 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50">
              <span className="sr-only">View notifications</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-blue-600"></span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-3 focus:outline-none"
              >
                <div className="relative">
                  <img
                    className="h-10 w-10 rounded-full ring-2 ring-white/50"
                    src={userDetails?.picture || "/user_icon.jpg"}
                    alt="User profile"
                  />
                  <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-blue-600"></span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-white">{userDetails?.name || 'Admin Name'}</p>
                  <p className="text-xs text-white/70">{userDetails?.email || 'Administrator'}</p>
                </div>
                <svg
                  className={`h-5 w-5 text-white/70 transition-transform duration-200 ${isProfileOpen ? 'transform rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div className={`absolute right-0 mt-2 w-72 ${darkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg shadow-xl py-2 z-10`}>
                  <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-600' : 'border-gray-100'}`}>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{userDetails?.name || 'Admin Name'}</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>{userDetails?.email || 'admin@metatech.com'}</p>
                  </div>

                  <div className="py-1">
                    <Link href="/profile" className={`flex items-center px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <svg className={`h-5 w-5 mr-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Your Profile
                    </Link>

                    <Link href="/settings" className={`flex items-center px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}>
                      <svg className={`h-5 w-5 mr-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </Link>
                  </div>

                  <div className={`border-t ${darkMode ? 'border-gray-600' : 'border-gray-100'}`}></div>

                  <button
                    onClick={handleSignOut}
                    className={`flex items-center w-full px-4 py-2 text-sm text-red-600 ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}`}
                  >
                    <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 