import type { APIRequestContext } from '@playwright/test';
import { urls } from '../config/urls';

export const currencyApi = {
  async set(request: APIRequestContext, currencyCode: string) {
    return request.post(urls.setCurrency, {
      form: { currency_code: currencyCode },
    });
  },
};
