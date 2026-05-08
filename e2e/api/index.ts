import { cartApi } from './cart.api';
import { wishlistApi } from './wishlist.api';
import { currencyApi } from './currency.api';

export const api = {
  cart: cartApi,
  wishlist: wishlistApi,
  currency: currencyApi,
} as const;
