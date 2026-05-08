import { env } from './env';

export const baseURL = env.BASE_URL;

export const urls = {
  home: '/',
  product: (id: string) => `/product/${id}`,
  cart: '/cart',
  cartAdd: '/cart',
  cartAddAjax: '/api/cart/add',
  cartEmpty: '/cart/empty',
  wishlist: '/wishlist',
  wishlistAdd: '/wishlist/add',
  wishlistRemove: '/wishlist/remove',
  orders: '/orders',
  order: (id: string) => `/order/${id}`,
  setCurrency: '/setCurrency',
  checkout: '/cart/checkout',
} as const;
