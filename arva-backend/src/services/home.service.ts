import { toImageUrl } from '../lib/imageUrl.js';
import { bannerRepository, type BannerRecord } from '../repositories/banner.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { toProductResponse, type ProductResponse } from './product.service.js';

export interface BannerResponse {
  id: string;
  title: string;
  subtitle: string | null;
  buttonLabel: string | null;
  linkUrl: string | null;
  imageUrl: string;
}

export interface HomeResponse {
  banners: {
    carousel: BannerResponse[];
    promoStrips: BannerResponse[];
    sideBanners: BannerResponse[];
    verticalBanners: BannerResponse[];
  };
  sections: {
    popular: ProductResponse[];
    fruits: ProductResponse[];
    equipments: ProductResponse[];
  };
}

const POPULAR_LIMIT = 8;
const CATEGORY_SECTION_LIMIT = 4;

function toBannerResponse(banner: BannerRecord): BannerResponse {
  return {
    id: String(banner.id),
    title: banner.title,
    subtitle: banner.subtitle,
    buttonLabel: banner.buttonLabel,
    linkUrl: banner.linkUrl,
    imageUrl: toImageUrl(banner.imageUrl),
  };
}

function pickBanners(banners: BannerRecord[], type: BannerRecord['type']): BannerResponse[] {
  return banners.filter((banner) => banner.type === type).map(toBannerResponse);
}

async function getHome(): Promise<HomeResponse> {
  const [banners, popular, fruits, equipments] = await Promise.all([
    bannerRepository.findActive(),
    productRepository.findMany({ discountOnly: false }, 'popular', 0, POPULAR_LIMIT),
    productRepository.findMany(
      { categorySlug: 'fruits', discountOnly: false },
      'popular',
      0,
      CATEGORY_SECTION_LIMIT,
    ),
    productRepository.findMany(
      { categorySlug: 'equipments', discountOnly: false },
      'popular',
      0,
      CATEGORY_SECTION_LIMIT,
    ),
  ]);

  return {
    banners: {
      carousel: pickBanners(banners, 'CAROUSEL'),
      promoStrips: pickBanners(banners, 'PROMO_STRIP'),
      sideBanners: pickBanners(banners, 'SIDE_BANNER'),
      verticalBanners: pickBanners(banners, 'VERTICAL_BANNER'),
    },
    sections: {
      popular: popular.map(toProductResponse),
      fruits: fruits.map(toProductResponse),
      equipments: equipments.map(toProductResponse),
    },
  };
}

export const homeService = { getHome };
