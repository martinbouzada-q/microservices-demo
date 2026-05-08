/**
 * Static catalog data used by specs. IDs match real entries in
 * `src/productcatalogservice/products.json`.
 */
export const testProducts = {
  sunglasses: { id: 'OLJCESPC7Z', name: 'Sunglasses', price: '$19.99' },
  tankTop:    { id: '66VCHSJNUP', name: 'Tank Top',   price: '$18.99' },
  watch:      { id: '1YMWWN1N4O', name: 'Watch',      price: '$109.99' },
  loafers:    { id: 'L9ECAV7KIM', name: 'Loafers',    price: '$89.99' },
  hairdryer:  { id: '2ZYFJ3GM2N', name: 'Hairdryer',  price: '$24.99' },
} as const;

export type ProductKey = keyof typeof testProducts;
