const dotenv = require('dotenv');
const path = require('path');

// Ensure env is loaded
dotenv.config();

// Centralized configuration for JWT Secret
// Priority: 
// 1. process.env.JWT_SECRET
// 2. Hardcoded fallback (for development/fallback compatibility)
const JWT_SECRET = process.env.JWT_SECRET || 'student_treehole_2025_super_secret_fallback_key';

console.log('JWT Configuration Loaded. Secret length:', JWT_SECRET.length);

module.exports = {
  JWT_SECRET
};
