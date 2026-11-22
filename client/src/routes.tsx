import type { RouteObject } from 'react-router'
import { RootLayout } from '@/components/RootLayout'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CategoryPage } from '@/pages/CategoryPage'
import { HomePage } from '@/pages/HomePage'
import { ProductPage } from '@/pages/ProductPage'
import { SearchPage } from '@/pages/SearchPage'

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/categories/:category', element: <CategoryPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/products/:id', element: <ProductPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
