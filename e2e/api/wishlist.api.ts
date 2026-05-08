import type { APIRequestContext } from '@playwright/test';
import { urls } from '../config/urls';

export const wishlistApi = {
  async add(request: APIRequestContext, productId: string) {
    return request.post(urls.wishlistAdd, {
      form: { product_id: productId },
    });
  },

  async remove(request: APIRequestContext, productId: string) {
    return request.post(urls.wishlistRemove, {
      form: { product_id: productId },
    });
  },
};
