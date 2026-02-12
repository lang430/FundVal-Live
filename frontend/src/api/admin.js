/**
 * 管理员相关 API
 */

const API_BASE = '/api';

/**
 * 获取所有用户列表
 */
export async function getUsers() {
  const response = await fetch(`${API_BASE}/auth/users`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get users');
  }

  return response.json();
}

/**
 * 创建用户
 */
export async function createUser(username, password, isAdmin = false) {
  const response = await fetch(`${API_BASE}/auth/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      is_admin: isAdmin,
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create user');
  }

  return response.json();
}

/**
 * 删除用户
 */
export async function deleteUser(userId) {
  const response = await fetch(`${API_BASE}/auth/users/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete user');
  }

  return response.json();
}

/**
 * 获取注册开关状态
 */
export async function getAllowRegistration() {
  const response = await fetch(`${API_BASE}/auth/registration`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get registration setting');
  }

  const data = await response.json();
  return { allow_registration: !!data.registration_enabled };
}

/**
 * 设置注册开关
 */
export async function setAllowRegistration(allow) {
  const response = await fetch(`${API_BASE}/auth/registration`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled: !!allow }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update registration setting');
  }

  const data = await response.json();
  return { allow_registration: !!data.registration_enabled };
}

/**
 * 开启多用户模式
 */
export async function enableMultiUser(adminUsername, adminPassword) {
  const response = await fetch(`${API_BASE}/auth/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: adminUsername,
      password: adminPassword,
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to init admin');
  }

  return response.json();
}
