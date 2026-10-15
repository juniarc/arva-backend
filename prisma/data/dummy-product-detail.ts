// Extra seed data for the product detail page: descriptions, rating counts and reviews.
// Keyed by product slug. The slugs match prisma/data/dummy-products.ts.

export interface SeedReview {
  authorName: string;
  authorAvatarUrl: string;
  rating: number;
  text: string;
  // The review's createdAt is set this many days before the seed runs.
  daysAgo: number;
}

export interface SeedProductDetail {
  description: string;
  ratingCount: number;
  reviewCount: number;
  reviews: SeedReview[];
}

// Every product gets this many images in the gallery.
export const IMAGES_PER_PRODUCT = 6;

const REVIEW_TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore ' +
  'magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.';

const AVATAR = '/images/dummy/avatar-1.jpg';

function review(rating: number, daysAgo: number): SeedReview {
  return { authorName: 'username', authorAvatarUrl: AVATAR, rating, text: REVIEW_TEXT, daysAgo };
}

// For products other than the banana: a short description and a small review list.
// ratingCount and reviewCount both equal the number of seeded reviews.
function simple(description: string, reviews: SeedReview[]): SeedProductDetail {
  return { description, ratingCount: reviews.length, reviewCount: reviews.length, reviews };
}

const BANANA_DESCRIPTION =
  'Banana Fruit from Bali, Indonesia. '.repeat(10).trim() +
  ' Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore ' +
  'et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut ' +
  'aliquip ex ea commodo consequat.';

export const productDetails: Record<string, SeedProductDetail> = {
  'bali-banana-fruit': {
    description: BANANA_DESCRIPTION,
    ratingCount: 212,
    reviewCount: 104,
    reviews: [review(4, 7), review(4, 8), review(3, 10)],
  },
  manggo: simple('Sweet, ripe mangoes picked at peak season. Good for eating fresh or for juice.', [
    review(5, 3),
    review(4, 12),
  ]),
  'javas-cucumber': simple('Crisp cucumbers grown in West Java. Great for salads and pickles.', [review(4, 5)]),
  'granny-smith-apple': simple('Tart, crunchy green apples from Malang. Good for snacks and baking.', [
    review(5, 2),
    review(4, 9),
  ]),
  'tomato-seeds-premium': simple('High-germination tomato seeds for home gardens and small farms.', [
    review(5, 4),
    review(5, 15),
  ]),
  'chili-seeds-hot': simple('Hot chili seeds that grow into productive plants in about three months.', [review(4, 6)]),
  'lettuce-seeds': simple('Loose-leaf lettuce seeds that grow fast, even in small pots.', [review(4, 20)]),
  'organic-compost-5kg': simple('Ready-to-use organic compost that improves soil and helps plants grow.', [
    review(4, 3),
    review(5, 11),
  ]),
  'liquid-npk-fertilizer': simple('Balanced liquid NPK fertilizer. Dilute with water and apply every two weeks.', [
    review(5, 1),
    review(4, 14),
  ]),
  'hand-sprayer-2l': simple('A 2 litre hand sprayer for water, liquid fertilizer, or pest control.', [review(4, 8)]),
  'garden-hoe-steel': simple('A sturdy steel garden hoe with a wooden handle, made for daily use.', [review(4, 13)]),
  'drip-irrigation-kit': simple('A complete drip irrigation kit that waters plants slowly and saves water.', [
    review(5, 7),
    review(5, 18),
  ]),
  'orange-fresh': simple('Juicy fresh oranges, sweet with a light citrus smell.', [review(4, 2), review(4, 10)]),
  'spinach-fresh': simple('Fresh spinach leaves, harvested the day before delivery.', [review(4, 5)]),
  'red-chili-fresh': simple('Fresh red chili with a strong, spicy flavour for everyday cooking.', [
    review(4, 4),
    review(3, 16),
  ]),
  'carrot-fresh': simple('Sweet, crunchy carrots from the highlands. Good raw or cooked.', [review(5, 6)]),
  'watering-can-plastic': simple('A light 5 litre plastic watering can with a long spout.', [review(4, 9)]),
};
