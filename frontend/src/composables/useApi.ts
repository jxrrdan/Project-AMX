import { api } from '@/api/client'

export function useApi() {
  return {
    get: (url: string, params?: Record<string, any>) =>
      api.get(url, { params }).then((r) => r.data),

    post: (url: string, data: any) =>
      api.post(url, data).then((r) => r.data),

    patch: (url: string, data: any) =>
      api.patch(url, data).then((r) => r.data),

    del: (url: string) =>
      api.delete(url).then((r) => r.data),
  }
}
