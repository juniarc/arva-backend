// The same dummy data the frontend uses. Slugs must stay identical to the frontend's.
// Images are photos from Wikimedia Commons (freely licensed). Each URL points at a 960px thumbnail.
// Prices are integer IDR. A variant with originalPrice null is not discounted.

export interface SeedCategory {
  slug: string;
  name: string;
  iconKey: string;
  sortOrder: number;
}

export interface SeedShop {
  slug: string;
  name: string;
  city: string;
  logoUrl: string;
  // Rating in tenths (34 = 3.4).
  ratingTenths: number;
  ratingCount: number;
}

export interface SeedVariant {
  label: string;
  unit: string;
  price: number;
  originalPrice: number | null;
  stock: number;
}

export interface SeedProduct {
  slug: string;
  name: string;
  // Full URL of the product photo.
  imageUrl: string;
  categorySlug: string;
  shopSlug: string;
  // One decimal, for example 3.4. The seed stores it in tenths.
  rating: number;
  soldCount: number;
  variants: SeedVariant[];
}

export interface SeedBanner {
  type: 'CAROUSEL' | 'PROMO_STRIP' | 'SIDE_BANNER' | 'VERTICAL_BANNER';
  position: number;
  title: string;
  subtitle: string | null;
  buttonLabel: string | null;
  linkUrl: string | null;
  imageUrl: string;
}

export const categories: SeedCategory[] = [
  { slug: 'seeds', name: 'Seeds', iconKey: 'seeds', sortOrder: 1 },
  { slug: 'vegetables', name: 'Vegetables', iconKey: 'vegetables', sortOrder: 2 },
  { slug: 'fruits', name: 'Fruits', iconKey: 'fruits', sortOrder: 3 },
  { slug: 'fertilizers', name: 'Fertilizers', iconKey: 'fertilizers', sortOrder: 4 },
  { slug: 'equipments', name: 'Equipments', iconKey: 'equipments', sortOrder: 5 },
];

const SHOP_LOGO = '/images/dummy/shop-logo-placeholder.jpg';

export const shops: SeedShop[] = [
  { slug: 'shops-name', name: "Shop's Name", city: 'Jakarta', logoUrl: SHOP_LOGO, ratingTenths: 34, ratingCount: 212 },
  { slug: 'bali-fresh-farm', name: 'Bali Fresh Farm', city: 'Kab. Badung', logoUrl: SHOP_LOGO, ratingTenths: 44, ratingCount: 158 },
  { slug: 'java-harvest', name: 'Java Harvest', city: 'Kab. Bandung', logoUrl: SHOP_LOGO, ratingTenths: 42, ratingCount: 96 },
  { slug: 'green-valley-store', name: 'Green Valley Store', city: 'Kab. Malang', logoUrl: SHOP_LOGO, ratingTenths: 45, ratingCount: 121 },
  { slug: 'tani-makmur', name: 'Tani Makmur', city: 'Kab. Bogor', logoUrl: SHOP_LOGO, ratingTenths: 47, ratingCount: 340 },
  { slug: 'agro-sentosa', name: 'Agro Sentosa', city: 'Kab. Garut', logoUrl: SHOP_LOGO, ratingTenths: 41, ratingCount: 77 },
];

export const products: SeedProduct[] = [
  {
    slug: 'bali-banana-fruit',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Cavendish_banana_from_Maracaibo.jpg/960px-Cavendish_banana_from_Maracaibo.jpg',
    name: "Bali's Banana Fruit",
    categorySlug: 'fruits',
    shopSlug: 'shops-name',
    rating: 3.4,
    soldCount: 501,
    variants: [
      { label: '1 kg', unit: 'kg', price: 1000, originalPrice: 1250, stock: 250 },
      { label: '2 kg', unit: 'kg', price: 2000, originalPrice: 2000, stock: 120 },
      { label: '5 kg', unit: 'kg', price: 4500, originalPrice: null, stock: 80 },
    ],
  },
  {
    slug: 'manggo',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Mango_fruit_Nam_Dok_Mai.jpg/960px-Mango_fruit_Nam_Dok_Mai.jpg',
    name: 'Manggo',
    categorySlug: 'fruits',
    shopSlug: 'java-harvest',
    rating: 4.2,
    soldCount: 310,
    variants: [
      { label: '1 kg', unit: 'kg', price: 2000, originalPrice: null, stock: 90 },
      { label: '2 kg', unit: 'kg', price: 3800, originalPrice: null, stock: 40 },
    ],
  },
  {
    slug: 'javas-cucumber',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Ryerson_Market_cucumbers_on_sale.jpg/960px-Ryerson_Market_cucumbers_on_sale.jpg',
    name: "Java's Cucumber",
    categorySlug: 'vegetables',
    shopSlug: 'java-harvest',
    rating: 3.9,
    soldCount: 220,
    variants: [
      { label: '1 kg', unit: 'kg', price: 1000, originalPrice: 1250, stock: 150 },
      { label: '2 kg', unit: 'kg', price: 1900, originalPrice: 2500, stock: 60 },
    ],
  },
  {
    slug: 'granny-smith-apple',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Granny_Smith_Apples.jpg/960px-Granny_Smith_Apples.jpg',
    name: 'Granny Smith Apple',
    categorySlug: 'fruits',
    shopSlug: 'green-valley-store',
    rating: 4.5,
    soldCount: 180,
    variants: [
      { label: '1 kg', unit: 'kg', price: 4500, originalPrice: null, stock: 70 },
      { label: '2 kg', unit: 'kg', price: 8500, originalPrice: 9000, stock: 30 },
    ],
  },
  {
    slug: 'tomato-seeds-premium',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Tomato_seeds_that_sprouted_while_inside_the_tomato_01.jpg/960px-Tomato_seeds_that_sprouted_while_inside_the_tomato_01.jpg',
    name: 'Tomato Seeds Premium',
    categorySlug: 'seeds',
    shopSlug: 'tani-makmur',
    rating: 4.7,
    soldCount: 640,
    variants: [
      { label: '10 g', unit: 'g', price: 15000, originalPrice: null, stock: 200 },
      { label: '50 g', unit: 'g', price: 52000, originalPrice: 60000, stock: 40 },
    ],
  },
  {
    slug: 'chili-seeds-hot',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Red_chili_peppers_drying_on_a_footbridge.jpg/960px-Red_chili_peppers_drying_on_a_footbridge.jpg',
    name: 'Hot Chili Seeds',
    categorySlug: 'seeds',
    shopSlug: 'tani-makmur',
    rating: 4.4,
    soldCount: 415,
    variants: [{ label: '10 g', unit: 'g', price: 12000, originalPrice: null, stock: 120 }],
  },
  {
    slug: 'lettuce-seeds',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Lactuca_sativa_%27Lollo_Bionda%27.jpg/960px-Lactuca_sativa_%27Lollo_Bionda%27.jpg',
    name: 'Lettuce Seeds',
    categorySlug: 'seeds',
    shopSlug: 'agro-sentosa',
    rating: 4.1,
    soldCount: 96,
    variants: [{ label: '5 g', unit: 'g', price: 9000, originalPrice: 10000, stock: 0 }],
  },
  {
    slug: 'organic-compost-5kg',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Compost_bin_with_compost.jpg/960px-Compost_bin_with_compost.jpg',
    name: 'Organic Compost 5kg',
    categorySlug: 'fertilizers',
    shopSlug: 'agro-sentosa',
    rating: 4.3,
    soldCount: 288,
    variants: [
      { label: '5 kg', unit: 'kg', price: 35000, originalPrice: null, stock: 25 },
      { label: '10 kg', unit: 'kg', price: 62000, originalPrice: 70000, stock: 12 },
    ],
  },
  {
    slug: 'liquid-npk-fertilizer',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/2023_Naw%C3%B3z_do_kwiat%C3%B3w.jpg/960px-2023_Naw%C3%B3z_do_kwiat%C3%B3w.jpg',
    name: 'Liquid NPK Fertilizer',
    categorySlug: 'fertilizers',
    shopSlug: 'tani-makmur',
    rating: 4.6,
    soldCount: 370,
    variants: [
      { label: '1 L', unit: 'L', price: 45000, originalPrice: null, stock: 60 },
      { label: '5 L', unit: 'L', price: 189000, originalPrice: 210000, stock: 15 },
    ],
  },
  {
    slug: 'hand-sprayer-2l',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Plug_nozzle_garden_sprayer.jpg/960px-Plug_nozzle_garden_sprayer.jpg',
    name: 'Hand Sprayer 2L',
    categorySlug: 'equipments',
    shopSlug: 'green-valley-store',
    rating: 4.0,
    soldCount: 130,
    variants: [{ label: '2 L', unit: 'L', price: 85000, originalPrice: 99000, stock: 40 }],
  },
  {
    slug: 'garden-hoe-steel',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Draw_hoe_and_Dutch_hoe.jpg/960px-Draw_hoe_and_Dutch_hoe.jpg',
    name: 'Garden Hoe Steel',
    categorySlug: 'equipments',
    shopSlug: 'bali-fresh-farm',
    rating: 4.2,
    soldCount: 77,
    variants: [{ label: 'Standard', unit: 'pcs', price: 52000, originalPrice: null, stock: 18 }],
  },
  {
    slug: 'drip-irrigation-kit',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Drip_emitter.jpg/960px-Drip_emitter.jpg',
    name: 'Drip Irrigation Kit',
    categorySlug: 'equipments',
    shopSlug: 'agro-sentosa',
    rating: 4.8,
    soldCount: 52,
    variants: [
      { label: '10 m', unit: 'm', price: 150000, originalPrice: 175000, stock: 8 },
      { label: '20 m', unit: 'm', price: 260000, originalPrice: null, stock: 0 },
    ],
  },
  {
    slug: 'orange-fresh',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Oranges_-_whole-halved-segment.jpg/960px-Oranges_-_whole-halved-segment.jpg',
    name: 'Fresh Orange',
    categorySlug: 'fruits',
    shopSlug: 'bali-fresh-farm',
    rating: 4.3,
    soldCount: 268,
    variants: [{ label: '1 kg', unit: 'kg', price: 14000, originalPrice: 17500, stock: 110 }],
  },
  {
    slug: 'spinach-fresh',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Spinacia_oleracea_bd-2.jpg/960px-Spinacia_oleracea_bd-2.jpg',
    name: 'Fresh Spinach',
    categorySlug: 'vegetables',
    shopSlug: 'java-harvest',
    rating: 3.9,
    soldCount: 143,
    variants: [{ label: '500 g', unit: 'g', price: 6000, originalPrice: null, stock: 75 }],
  },
  {
    slug: 'red-chili-fresh',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Capsicum_baccatum_in_Sa%C3%BAde_flea_market%2C_S%C3%A3o_Paulo%2C_Brazil.jpg/960px-Capsicum_baccatum_in_Sa%C3%BAde_flea_market%2C_S%C3%A3o_Paulo%2C_Brazil.jpg',
    name: 'Red Chili',
    categorySlug: 'vegetables',
    shopSlug: 'tani-makmur',
    rating: 4.4,
    soldCount: 205,
    variants: [{ label: '1 kg', unit: 'kg', price: 38000, originalPrice: null, stock: 22 }],
  },
  {
    slug: 'carrot-fresh',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Carrot_view.jpg/960px-Carrot_view.jpg',
    name: 'Carrot',
    categorySlug: 'vegetables',
    shopSlug: 'green-valley-store',
    rating: 4.1,
    soldCount: 160,
    variants: [{ label: '1 kg', unit: 'kg', price: 12000, originalPrice: 14000, stock: 95 }],
  },
  {
    slug: 'watering-can-plastic',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Watering_can_for_bonsai.jpg/960px-Watering_can_for_bonsai.jpg',
    name: 'Watering Can 5L',
    categorySlug: 'equipments',
    shopSlug: 'agro-sentosa',
    rating: 3.8,
    soldCount: 64,
    variants: [{ label: '5 L', unit: 'L', price: 38000, originalPrice: null, stock: 45 }],
  },
];

export const banners: SeedBanner[] = [
  {
    type: 'CAROUSEL',
    position: 1,
    title: 'BIG SALE',
    subtitle: 'Products for vegetarians. Go shop online: www.web.com',
    buttonLabel: 'Shop now',
    linkUrl: '/products',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Vegetable_Market_WATERFRONT_MARKET.jpg/960px-Vegetable_Market_WATERFRONT_MARKET.jpg',
  },
  {
    type: 'CAROUSEL',
    position: 2,
    title: 'SUPER SALE',
    subtitle: 'Up to 60% off',
    buttonLabel: 'Shop now',
    linkUrl: '/products?discount=true',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Fresh_fruits_and_vegetables_in_2020_04.jpg/960px-Fresh_fruits_and_vegetables_in_2020_04.jpg',
  },
  {
    type: 'SIDE_BANNER',
    position: 1,
    title: 'Fitness Nutrition',
    subtitle: 'Healthy food',
    buttonLabel: null,
    linkUrl: null,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Healthy_Food_-_Colourful_Fruit_and_Veg_-_50191699151.jpg/960px-Healthy_Food_-_Colourful_Fruit_and_Veg_-_50191699151.jpg',
  },
  {
    type: 'SIDE_BANNER',
    position: 2,
    title: 'We Are What We Eat',
    subtitle: null,
    buttonLabel: null,
    linkUrl: null,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Healthy_Vegetable_Bowl.jpg/960px-Healthy_Vegetable_Bowl.jpg',
  },
  {
    type: 'VERTICAL_BANNER',
    position: 1,
    title: '50% OFF',
    subtitle: null,
    buttonLabel: null,
    linkUrl: '/products?discount=true',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Fresh_fruits_and_vegetables_in_2020_01.jpg/960px-Fresh_fruits_and_vegetables_in_2020_01.jpg',
  },
  {
    type: 'PROMO_STRIP',
    position: 1,
    title: 'Healthy Fruits',
    subtitle: 'Save up to 20% off',
    buttonLabel: 'Shop now',
    linkUrl: '/products?category=fruits',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Fresh_fruits_for_sale_at_a_local_stall_in_Uganda.jpg/960px-Fresh_fruits_for_sale_at_a_local_stall_in_Uganda.jpg',
  },
  {
    type: 'PROMO_STRIP',
    position: 2,
    title: 'Healthy Fruits',
    subtitle: 'Save up to 20% off',
    buttonLabel: 'Shop now',
    linkUrl: '/products?category=fruits',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Fresh_fruits_and_vegetables_in_2020_06.jpg/960px-Fresh_fruits_and_vegetables_in_2020_06.jpg',
  },
];
