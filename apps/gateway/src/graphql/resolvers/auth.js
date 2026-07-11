export const queries = {
  me: async (_, __, { token, clients, logger }) => {
    if (!token) return null;
    try {
      const [authResult, safetyResult] = await Promise.allSettled([
        clients.auth.getMe(token),
        clients.users.getMySafetyProfile(token),
      ]);

      const user = authResult.status === 'fulfilled'
        ? (authResult.value?.user || authResult.value || null)
        : null;

      if (!user) return null;

      // Merge safety fields (dob, parentEmail, parentVerifiedAt, capabilities)
      if (safetyResult.status === 'fulfilled' && safetyResult.value) {
        const s = safetyResult.value;
        user.dob              = s.dob              ?? user.dob              ?? null;
        user.parentEmail      = s.parentEmail      ?? user.parentEmail      ?? null;
        user.parentVerifiedAt = s.parentVerifiedAt ?? user.parentVerifiedAt ?? null;
        user.capabilities     = s.capabilities     ?? user.capabilities     ?? null;
      }

      return user;
    } catch (error) {
      logger.warn(`me query failed: ${error.message}`);
      return null;
    }
  },
};

export const mutations = {
  login: async (_, args, { clients }) =>
    clients.auth.login(args),

  register: async (_, args, { clients }) =>
    clients.auth.register(args),

  requestPasswordReset: async (_, { email }, { clients, logger }) => {
    try {
      return await clients.auth.requestPasswordReset(email);
    } catch (error) {
      logger.warn(`requestPasswordReset failed: ${error.message}`);
      return true; // Don't leak whether the email exists
    }
  },

  resetPassword: async (_, { token, newPassword }, { clients, logger }) => {
    try {
      return await clients.auth.resetPassword(token, newPassword);
    } catch (error) {
      logger.warn(`resetPassword failed: ${error.message}`);
      throw error;
    }
  },

  changePassword: async (_, { currentPassword, newPassword }, { token, clients, logger }) => {
    try {
      return await clients.auth.changePassword(token, currentPassword, newPassword);
    } catch (error) {
      logger.warn(`changePassword failed: ${error.message}`);
      throw error;
    }
  },

  changeEmail: async (_, { newEmail, currentPassword }, { token, clients, logger }) => {
    try {
      return await clients.auth.changeEmail(token, newEmail, currentPassword);
    } catch (error) {
      logger.warn(`changeEmail failed: ${error.message}`);
      throw error;
    }
  },

  enableTwoFactor: async (_, __, { token, clients, logger }) => {
    try {
      return await clients.auth.enableTwoFactor(token);
    } catch (error) {
      logger.warn(`enableTwoFactor failed: ${error.message}`);
      throw error;
    }
  },

  verifyTwoFactor: async (_, { code }, { token, clients, logger }) => {
    try {
      return await clients.auth.verifyTwoFactor(token, code);
    } catch (error) {
      logger.warn(`verifyTwoFactor failed: ${error.message}`);
      throw error;
    }
  },

  disableTwoFactor: async (_, { code }, { token, clients, logger }) => {
    try {
      return await clients.auth.disableTwoFactor(token, code);
    } catch (error) {
      logger.warn(`disableTwoFactor failed: ${error.message}`);
      throw error;
    }
  },
};
