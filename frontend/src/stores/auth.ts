import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login as apiLogin } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('amx_token'))
  const userId = ref<string | null>(localStorage.getItem('amx_user_id'))
  const userName = ref<string | null>(localStorage.getItem('amx_user_name'))
  const userRole = ref<string | null>(localStorage.getItem('amx_user_role'))

  const isAuthenticated = ref(!!token.value)

  async function login(email: string, password: string) {
    const data = await apiLogin(email, password)
    token.value = data.access_token
    userId.value = data.user_id
    userName.value = data.name
    userRole.value = data.role
    isAuthenticated.value = true
    localStorage.setItem('amx_token', data.access_token)
    localStorage.setItem('amx_user_id', data.user_id)
    localStorage.setItem('amx_user_name', data.name)
    localStorage.setItem('amx_user_role', data.role)
  }

  function logout() {
    token.value = null
    userId.value = null
    userName.value = null
    userRole.value = null
    isAuthenticated.value = false
    localStorage.removeItem('amx_token')
    localStorage.removeItem('amx_user_id')
    localStorage.removeItem('amx_user_name')
    localStorage.removeItem('amx_user_role')
  }

  return { token, userId, userName, userRole, isAuthenticated, login, logout }
})
