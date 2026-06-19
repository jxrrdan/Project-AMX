import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppShell.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'customers',
          name: 'customers',
          component: () => import('@/views/CustomersView.vue'),
        },
        {
          path: 'customers/:id',
          name: 'customer-detail',
          component: () => import('@/views/CustomerDetailView.vue'),
        },
        {
          path: 'orders',
          name: 'orders',
          component: () => import('@/views/OrdersView.vue'),
        },
        {
          path: 'orders/:id',
          name: 'order-detail',
          component: () => import('@/views/OrderDetailView.vue'),
        },
        {
          path: 'workshop',
          name: 'workshop',
          component: () => import('@/views/WorkshopView.vue'),
        },
        {
          path: 'workshop/:id',
          name: 'wip-detail',
          component: () => import('@/views/WIPDetailView.vue'),
        },
        {
          path: 'parts',
          name: 'parts',
          component: () => import('@/views/PartsView.vue'),
        },
        {
          path: 'vhc',
          name: 'vhc',
          component: () => import('@/views/VHCView.vue'),
        },
        {
          path: 'vhc/:id',
          name: 'vhc-detail',
          component: () => import('@/views/VHCDetailView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login' }
  }
})

export default router
