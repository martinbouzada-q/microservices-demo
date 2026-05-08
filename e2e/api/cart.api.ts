import type { APIRequestContext } from '@playwright/test';
import { urls } from '../config/urls';

export const cartApi = {
  async add(request: APIRequestContext, productId: string, quantity = 1) {
    return request.post(urls.cartAdd, {
      form: { product_id: productId, quantity: String(quantity) },
    });
  },

  async addAjax(request: APIRequestContext, productId: string, quantity = 1) {
    return request.post(urls.cartAddAjax, {
      form: { product_id: productId, quantity: String(quantity) },
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
  },

  async empty(request: APIRequestContext) {
    return request.post(urls.cartEmpty);
  },
};
