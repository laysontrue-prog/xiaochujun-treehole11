const User = require('../models/User');

/**
 * Calculate level based on experience
 * Formula: 
 * Lv1-3: 0-7 exp (Linear, ~3 per level)
 * Lv4-6: 8-30 exp (Linear, ~8 per level)
 * Lv7-9: 31-90 exp (Linear, ~20 per level)
 * Lv10: 91+ exp
 */
function calculateLevel(experience) {
  if (experience >= 91) return 10;
  if (experience >= 31) return Math.floor((experience - 31) / 20) + 7;
  if (experience >= 8) return Math.floor((experience - 8) / 8) + 4;
  return Math.floor(experience / 3) + 1;
}

/**
 * Add experience to a user
 * @param {String} userId - The user's ID
 * @param {Number} amount - Amount of experience to add
 * @returns {Object} - { newLevel, newExperience, levelUp, previousLevel }
 */
async function addExperience(userId, amount) {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const previousLevel = user.level || 1;
    user.experience = (user.experience || 0) + amount;
    
    // Recalculate level
    const newLevel = calculateLevel(user.experience);
    
    // Clamp level between 1 and 10
    user.level = Math.max(1, Math.min(10, newLevel));
    
    await user.save();

    return {
      newLevel: user.level,
      newExperience: user.experience,
      levelUp: user.level > previousLevel,
      previousLevel
    };
  } catch (error) {
    console.error('Error adding experience:', error);
    return null;
  }
}

module.exports = {
  addExperience,
  calculateLevel
};
