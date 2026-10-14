import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-600 hover:text-primary-600';
  };

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">Q</span>
              </div>
              <span className="text-xl font-bold text-gray-900">QA System</span>
            </Link>

            <div className="flex space-x-6">
              <Link
                to="/workspace"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                  location.pathname === '/' || location.pathname === '/workspace'
                    ? 'text-primary-600 border-b-2 border-primary-600 font-semibold'
                    : 'text-gray-600 hover:text-primary-600'
                }`}
              >
                QA Workspace
              </Link>
              <Link
                to="/analytics"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${isActive('/analytics')}`}
              >
                Analytics
              </Link>
              <Link
                to="/model-card"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${isActive('/model-card')}`}
              >
                Model Card
              </Link>
              <Link
                to="/about"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${isActive('/about')}`}
              >
                About
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 shadow-sm border border-green-200">
              <span className="w-2 h-2 mr-2 bg-green-500 rounded-full animate-pulse"></span>
              qa_model.pkl Active
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
